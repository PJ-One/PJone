---
title: 今日头条逆向：msToken + a_bogus 流程
published: 2025-07-11
description: jsdom 补环境,生成 msToken + 签 a_bogus，输出完整签名 URL,纯 requests，sign_feed()+feed() 拿 JSON
image: ''
tags: [逆向]
category: 爬虫
draft: false
---
日期：2026-07-10　　状态：✅ 全链路跑通（直接拿到 feed JSON）

---

目录结构--->
```
今日头条/
├─ main.py                    # 纯 requests；subprocess 调 node 拿签名参数
├─ get_mstoken.js             # node：生成 strData→mssdk 换回 msToken
├─ sign_feed.js               # node：生成 msToken + sec sdk 签 a_bogus，输出完整签名 url
├─ patch_env.js               # jsdom 补环境补丁（被上面两个 require）
├─ acrawler.js                # ↓ 4 个 SDK 原始脚本（可执行，非美化）
├─ runtime_bundler_52.js
├─ sdk-glue.js
├─ bdms.js
├─ package.json / package-lock.json / node_modules/   # jsdom 依赖
└─ 进度_msToken追溯.md         # 本文件
```

---

## 一、msToken 追溯

### 结论
- **msToken 不是本地算法生成的**，而是字节服务器 `mssdk.bytedance.com/web/common` 通过响应头
  `x-ms-token` + `Set-Cookie: msToken=...; domain=bytedance.com` **下发的 cookie**。
- 客户端唯一“生成”的是投喂给服务器的加密指纹 **`strData`**（base64 密文，由 bdms.js 生成）。

### 完整链路
```
页面内联脚本 window._SdkGlueInit({
  self:{aid:24,pageId:6457},
  bdms:{aid:24,pageId:6457,paths:["/api/pc/list/feed","/api/pc/list/user/feed"]}
})
  → sdk-glue.js 动态注入 bdms.js(<script no-entry=true>) → 调 window.bdms.init(options)
  → bdms.init 内：setInterval(300000ms=5分钟刷新) + requestAnimationFrame 采集环境指纹
        → 构建 strData → 经 glue 的 e.send POST mssdk/web/common
        → 服务器响应头 x-ms-token / Set-Cookie: msToken=...   ← msToken 在此下发
```
发起链（get_request_initiator 实证）：
`_SdkGlueInit → glue.s/x/S → bdms.init → setInterval → requestAnimationFrame → bdms.e → glue.e.send`

### 复现的真正 gate（关键）
不是任何环境值，而是 **token 发送由 `setInterval(300000ms=5分钟)` 驱动**。harness 运行窗口只有十几秒，
等不到首个 tick，所以一直"不发包"。**解法：patch `window.setInterval`，把 ≥10s 的大周期钳到 1s**，
首个 tick 立即触发 → 立刻发包。（曾误判"rAF 6帧后中止"，其实 bdms 一直在等 5 分钟定时器。）

补环境其余要点（patch_env.js）：navigator/screen/canvas/WebGL 真实值、crypto.subtle/performance.timing/
PerformanceObserver/matchMedia/navigator.connection 等缺失 API、隐藏 jsdom 泄漏的 `_document`/`_virtualConsole`、
原生函数 toString 伪装。真实指纹基线（Chrome136/Win32、20核/8G、2560×1440、GMT+8）从实时浏览器导出。

---

## 二、a_bogus 逆向过程（详细）

> 目标：feed 请求需要 `a_bogus` 签名参数，缺/错则 200 但 **body 为空**（反爬拦截）。

### 逆向步骤与关键证据
1. **确认是拦路参数**：用新鲜 msToken + 写死旧 a_bogus 请求 feed → `200` 但 `response.text` 为空。
   → a_bogus 确实是拦路参数（不对就返回空数据）。

2. **静态搜字符串失败**：`search_in_sources("a_bogus")` → 0 匹配。
   → 参数名是运行时动态拼接 / 混淆，静态搜不到。

3. **排除 byted_acrawler.sign**：`byted_acrawler.sign({url:...})` 返回 `_02B4Z6wo...` 开头的串。
   → 那是 **X-Bogus / _signature**，格式与 a_bogus(`mJ8wBfgX...`)完全不同。**a_bogus 不来自 acrawler.sign**。

4. **看 feed 发起链**（get_request_initiator）：
   `app axios(vendor.js l.request / index.js f.fetchData) → sec sdk(runtime_bundler main 策略) → bdms.e → glue e.send`
   → a_bogus 生成发生在 **sec sdk 处理 XHR 发送时**，由 bdms 参与计算。

5. **hook XHR.open 抓 open 时的 URL**：滚动触发 feed，open 时 URL **不含 a_bogus**（`hasABogus:false`），
   调用来自 app 的 axios。→ a_bogus 是在 **open 之后**才加上的。

6. **查原型方法是否被 hook**：
   ```
   XMLHttpRequest.prototype.send        = function(){...return r.apply(this,n)}   ← 被 sec 包装
   XMLHttpRequest.prototype.setRequestHeader = 同上                                ← 被 sec 包装
   window.fetch                          = 同上                                    ← 被 sec 包装
   window.XMLHttpRequest (构造函数)       = native                                 ← 未替换
   ```
   → **a_bogus 由 sec sdk 对 `send`/`fetch` 的 hook 追加**：
   app 先 `open` 一个无 a_bogus 的 URL → `send` 时 sec hook 拦截 → 计算 a_bogus → **用新 URL 重开**再发出。
   （glue 里 `blockXhr` 的 invokeList 重放机制正是"缓存 open/send，再用改写后的 URL 重放"。）
   注意：glue 的 blockXhr 只追加 `loadErrorReason`，a_bogus 是另一条 sec 策略(executeXHRRequestSend)所为。

7. **harness 复现时一开始签不出** → 关键发现：
   在 node harness 里 SDK 加载完就发 feed XHR，URL 里没有 a_bogus。
   **原因：a_bogus 签名必须等 msToken 就绪后才生效**（sec 策略依赖 token/状态）。
   → 在 harness 里 **等 msToken 生成成功后**，再 `new window.XMLHttpRequest()` 发 feed 请求，
   sec sdk 就自动重开 URL 追加 a_bogus。在 send hook 里抓这个"已签名 URL"即可。

### a_bogus 复现（sign_feed.js）
在与 msToken 相同的 harness 里：
```
生成 msToken → 构建 feed URL(含 msToken) → new XMLHttpRequest().send()
  → sec sdk 在 send hook 中签出 a_bogus 并重开 URL
  → 在 send hook 里捕获这个含 a_bogus 的最终 URL → 输出
```
```
node sign_feed.js '<paramsJSON>'   # 输出 {url, msToken, a_bogus, params}
```
**⚠️ 使用要点**：a_bogus 依赖**精确的 query 串**（含 msToken、时间戳、参数顺序）。
Python 必须用返回的 `url` **原样请求**，**不能自己重拼参数**，否则 a_bogus 对不上 → 空响应。

---

## 三、端到端（main.py，纯 requests + node）
- `get_mstoken()`：subprocess 调 `node get_mstoken.js --json` → 拿 msToken。
- `sign_feed(params)`：subprocess 调 `node sign_feed.js '<paramsJSON>'` → 拿 `{url, msToken, a_bogus}`。
- `feed()`：`session.get(signed["url"])` → **200 + 30~340KB feed JSON（`"message":"success"`）**，无需额外 cookie。

实测：`python main.py` 直接输出真实新闻 feed 的 JSON 数据。

---

## 四、涉及脚本角色
| 文件 | 角色 |
|---|---|
| acrawler.js | `byted_acrawler`（含 sign=X-Bogus，非 a_bogus），最先加载 |
| runtime_bundler_52.js | sec 策略运行时（`window.SDKRuntime` / `window.use`），XHR/fetch 签名策略引擎 |
| sdk-glue.js | 胶水层：加载 bdms、暴露 `_SdkGlueInit`、封装 `e.send`、hook XHR |
| bdms.js | **strData + a_bogus 加密核心**（VMP 混淆，`window.bdms.init` 是入口 trampoline）|

## 五、遗留
- strData 684 字节 vs 真实页 ~3800：服务器照样 200 接受，无需处理。
- 两个签名参数（msToken、a_bogus）全部在 node 补环境里生成，Python 侧纯 requests。
