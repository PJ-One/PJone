---
title: scrapling获取cookie过五秒盾
published: 2026-07-17
description: 用 scrapling 拿 cf_clearance 再交给纯 requests 爬取，以赫伯罗特船期查询为例
image: ''
tags: [逆向]
category: 爬虫
draft: false
---

# scrapling 获取 cookie 过五秒盾

结论先说：

1. **scrapling 的 `solve_cloudflare=True` 确实能自动过五秒盾**，实测 4 秒解掉 Turnstile。
2. **但多数时候它压根不会触发盾** —— 这才是它真正的价值所在。
3. **cf_clearance 绑 User-Agent，不绑 TLS 指纹**，所以 cookie 能从浏览器搬给 requests 复用。

第 3 条是整套方案成立的基础：浏览器只在低频取 cookie 时出现一次，爬取主链路纯 requests。

案例站点是赫伯罗特（Hapag-Lloyd）船期查询：

```
https://www.hapag-lloyd.cn/zh/online-business/track/vessel-tracker-solution.html
```

## 一、先看盾长什么样

同一个站，同样的浏览器请求头，只换客户端：

| 客户端 | Cloudflare 的反应 |
|---|---|
| requests | 307 → **403**，22KB 硬拦 |
| httpx / httpx + HTTP/2 | 307 → **403**，同上 |
| curl_cffi（impersonate=chrome） | 过了 TLS 指纹 → **下发 53KB JS 挑战页** |
| scrapling StealthySession | 307 → **200 直接放行** |

两个值得注意的点。

**换 httpx 毫无意义。** 它和 requests 的 TLS 指纹同样来自 Python 的 OpenSSL，CF 一视同仁地
拦。库的选择根本不是那个变量。

**curl_cffi 的 403 和前两者不是一回事。** 它拿到的是挑战页而非硬 403，说明它过了 TLS 指纹
这一关，进到了挑战环节，只是没解题。**TLS 指纹是必要不充分条件。**

## 二、scrapling 能过盾吗：能

找一个必定触发挑战的站（nopecha 的 CF demo）实测：

```python
from scrapling.fetchers import StealthySession

with StealthySession(headless=True, solve_cloudflare=True,
                     network_idle=True, timeout=120000) as e:
    r = e.fetch('https://nopecha.com/demo/cloudflare')
```

输出：

```
INFO: The turnstile version discovered is "interactive"
INFO: Cloudflare captcha is solved
status: 200 | 耗时 11.2s | 挑战残留: False | 拿到 cf_clearance
```

它自己识别出 Turnstile 类型是 `interactive`，4 秒内解掉，全自动，无人工介入。

## 三、但在目标站，它根本没触发盾

把 `chrome_profile` 和 cookie 缓存全删掉，用全新指纹冷启动：

```
INFO: No Cloudflare challenge found
INFO: Fetched (307) → Fetched (200)
耗时 6.1s，拿到 cf_clearance
```

**`No Cloudflare challenge found` 是好消息，不是错误。**

scrapling 用的是真实 Chrome + stealth 补丁，CF 认它是真人，握手完直接发 cf_clearance，
没有题要解。所以在这个站，`solve_cloudflare=True` 是一路空转的保险 —— 留着没坏处（哪天
CF 提高防护等级就用上了），但它不是成功的原因。

**scrapling 赢在「不被判定为机器人」，而不是赢在「解题快」。**

这也意味着：判断成功与否**不能看它报没报这个 ERROR**，要看结果 —— status 200、拿到
cf_clearance、页面里有业务标志物（本站是 `javax.faces.ViewState`）。

顺带一提，网上常见的 capsolver 付费打码、以及挑战 JS 逆向补环境这两条路，对这个站**都不
需要**，6 秒就过了。

## 四、关键发现：cf_clearance 绑 UA，不绑 TLS 指纹

拿到 cookie 后，把它喂给不同 TLS 指纹的客户端：

| 客户端 + 有效 cf_clearance | 结果 |
|---|---|
| requests | **200** |
| httpx (h2) | **200** |
| curl_cffi | **200** |

三者返回字节数完全一致（76315 ch）。**cookie 可以跨客户端搬运。**

再固定客户端（requests）只换 UA：

| UA | 结果 |
|---|---|
| 取 cookie 时那个 Chrome UA | **200** |
| 改成 Firefox UA | 403 |
| python-requests 默认 UA | 403 |
| 完全不发 UA | 403 |

这跟「cf_clearance 绑 JA3」的常见说法不符，但本站配置下实测如此。

**推论：UA 和 cookie 是一套，必须一起存、一起用，不能拆。** 缓存文件里只存 cookie 不存 UA，
换台机器或换个 scrapling 版本就会莫名 403 —— 因为 scrapling 自带的 UA 会变（本次实测是
Chrome/147）。所以代码里不要硬编码 UA，要从浏览器实际请求头里读。

## 五、落地架构

```
cf_cookie.py   低频，浏览器，6 秒    ->  cf_clearance.json (cookie + UA)
                                             |
main.py        高频，纯 requests      <------+
```

cf_clearance 有效期约 30 分钟，一次取值能撑很多次查询，浏览器不在主爬取链路上。

取 cookie 的关键部分：

```python
from scrapling.fetchers import StealthySession

with StealthySession(
    headless=True,
    solve_cloudflare=True,        # 内置挑战处理（本站用不上，留作保险）
    user_data_dir="chrome_profile",
    network_idle=True,
) as engine:
    r = engine.fetch(URL)

    # 以结果为准，不看它报没报 "No Cloudflare challenge found"
    if r.status != 200 or "javax.faces.ViewState" not in r.html_content:
        raise RuntimeError("没过挑战")

    cookies = {c["name"]: c["value"] for c in r.cookies
               if "hapag-lloyd.cn" in c.get("domain", "")}
    # UA 必须跟 cookie 一起存，别硬编码
    ua = {k.lower(): v for k, v in dict(r.request_headers).items()}["user-agent"]
```

用 cookie 爬取：

```python
s = requests.Session()
s.headers.update({"User-Agent": data["user_agent"]})   # 必须一致，否则 403
for k, v in data["cookies"].items():
    s.cookies.set(k, v, domain="www.hapag-lloyd.cn")
```

## 六、scrapling 的两个 API 坑

**版本 API 不兼容。** 0.4.2 的 `StealthySession` 没有 `close()`；0.4.8 有 `close()` 且支持
上下文管理器（`with`），但没有 `stop()`。跨版本抄代码必炸，先确认自己 venv 里的版本：

```python
import scrapling; print(scrapling.__version__)
```

**不要去碰 `engine.context.pages`。** scrapling 用 page_pool 管理页面，`fetch()` 之后
`context.pages[-1]` 拿到的未必是刚才那个 page，在上面找业务标志物会一直找不到，表现为
「明明日志里 `Fetched (200)` 成功了，脚本却超时」。

正确做法是直接用 `fetch()` 的返回值，`Response` 对象什么都有：

| 属性 | 内容 |
|---|---|
| `r.status` | 200 |
| `r.cookies` | tuple[dict]，含 cf_clearance、JSESSIONID |
| `r.html_content` | str（注意 `r.body` 是 **bytes**） |
| `r.request_headers` | 含真实 UA |

## 附：目标站本身的定性

顺带记一下这个站，它有独立于 Cloudflare 的坑。

**不是 SPA，是 JSF（JavaServer Faces）整页表单回传。** 所以 Network 面板的 Fetch/XHR 里
**永远找不到数据** —— 那里只有广告统计和 Cloudflare 挑战。数据在 Document 请求的 HTML 里。
要在浏览器里看，得选 **Doc** 过滤器并勾上 **Preserve log**（POST 会触发导航，不勾记录直接
被清掉）。

```
GET  vessel-tracker-solution.html                              -> 200  ViewState + 942 条 <option> 船名
POST vessel-tracker-solution.html?_a=schedules_vessel_tracing  -> 302  (响应体为空!)
GET  vessel-tracker-solution.html  (自动跟随)                   -> 200  数据在这
```

那个 POST 只返回 302、body 为空，数据在紧随其后那个「看起来和首次加载一模一样」的 GET 里
—— 这是最容易找漏的地方。

**船名下拉不是 ExtJS 的 JSON store**，是原生 `<option value="2">ACHELOOS</option>`，ExtJS
只是包装了它。942 条全内嵌在首个 GET 里，不用额外请求。注意提交的是 **value（数字）而不是
船名字符串**。

**表格是多层嵌套的**，外层容器 table 同样能匹配到表头关键词，会把相邻表的行一起吞进来。
选表时要取嵌套最浅的候选（最内层真实数据表）。

**站点对没船期的船会明确回「没有发现数据」**，这个要和「解析失败」区分开，否则哪天解析逻辑
被改版搞坏，输出会伪装成「这船没船期」，根本发现不了。

最终效果：

```
=== ACHELOOS (value=2) ===
  [航次]
    2625N    683540   WA1    TANGER MED -> TANGER MED  (-1 天)
  [港口停靠]
    683540  DAKAR       到 2026-07-01 06:45  Actual Arrival     离 2026-07-02 03:42  Actual Departure
    683540  ABIDJAN     到 2026-07-12 10:53  Actual Arrival     离 2026-07-14 10:06  Actual Departure
    683540  TANGER MED  到 2026-07-21 23:00  Estimated Arrival  离 2026-07-22 19:00  Estimated Departure
```
