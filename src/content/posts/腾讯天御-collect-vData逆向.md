---
title: 腾讯天御-collect-vData逆向
published: 2026-07-29
description: 腾讯 TDC 滑块验证码逆向：纯 node 补环境产出 collect / eks / vdata
image: ''
tags: [web]
category: 爬虫
draft: false
---
# 腾讯天御（TDC）滑块验证码2.0 vData 逆向笔记

> 目标站点：千千音乐 `music.taihe.com`（短信接口 `music.91q.com/v1/oauth/send_sms`）
> 验证码服务：`turing.captcha.qcloud.com`，aid = `2096724324`
> 实现：`spider/sms_30_qianqianmusic.py` + `spider/js/tengxun/qianqianmusic/`（Node 补环境）
> 日期：2026-07-29

---

## 1. 总体链路

```
cap_union_prehandle ─┬─ 有 data 字段 → 主滑块流程（dyn 变体）
                     └─ 无 data（subcapclass=15）→ placeholder 流程（风控变体）
                                  ↓
              tdc.js 补环境 → collect / eks / tlg
                                  ↓
                   缺口识别（OpenCV）→ ans(x)
                                  ↓
              pow 爆破（hashcash md5）→ pow_answer / pow_calc_time
                                  ↓
        vm-slide XHR 钩子（gen_vdata.js）→ vData
                                  ↓
              cap_union_new_verify → errorCode=0 → ticket + randstr
                                  ↓
        createSign 签名 → send_sms（state:true = 成功）
```

两条验证码路径共用 tdc / pow / vData 生成逻辑，只有"拿图 + 组 body"不同。

---

## 2. 关键 JS 资产

| 文件 | 来源 | 作用 |
|---|---|---|
| `tgJCap.f0ca357b.js` | 验证码框架主 JS（prehandle 的 `js` 参数指定） | 组 verify 请求、调 pow worker、加载 vm-slide |
| `tdc.js` | prehandle 返回的 `comm_captcha_cfg.tdc_path`，**每 sess 不同**（带 app_data 种子） | 生成 collect / eks |
| `vm-slide.e201876f.enc.js` | 静态 CDN 文件，本地存为 `vm-slide.js.txt` | **vData 的真正来源**：CHAOS VM 保护的 XHR 钩子 |
| `tcaptcha-slide.js` | placeholder 模板页引用的 JS，本地留档 | placeholder 流程的 verify 组装逻辑 |
| 千千前端 `bdad668.js` | `static1-qianqian.91q.com/client/` | send_sms 的 createSign 签名算法 |

---

## 3. tgJCap.js 字符串解码（decoder.js）

tgJCap 是 javascript-obfuscator 风格混淆：字符串全在数组里，索引用 `_0xXXXX(0xNNN)` 形式调用解码函数。**解码器无 RC4，纯数组偏移**：

```js
function a2_0x2e7c(idx){ return a2_0x42eb()[idx - 0x9e]; }   // 解码器
function a2_0x42eb(){ var arr=[...]; ... return arr; }        // 字符串数组
// 文件顶部 IIFE 先旋转数组直到校验和匹配
```

提取方法（已落地为 `decoder.js`）：
1. 取 `function a2_0x2e7c` 与 `function a2_0x42eb` 的完整定义；
2. 取文件顶部数组旋转 IIFE（`src[:618]`，注意补一个右括号——原文件是逗号表达式，外层括号不闭合）；
3. 拼接后 `module.exports = a2_0x2e7c`，即可在 Node 中解码任意索引。

批量解码技巧：正则 `_0x[0-9a-f]+\((0x[0-9a-f]+)\)` 替换为 `JSON.stringify(dec(idx))`，可把整段混淆代码还原成可读形式。

---

## 4. vData 的真相（本项目最重要的结论）

### 4.1 表面现象（红鲱鱼）

tgJCap 的 verify 函数里（解码后）：

```js
payload = { collect, tlg: collect.length, eks, sess, ans: JSON.stringify(ansData) };
if (runWorkload) { payload.pow_answer = nonce + ans; payload.pow_calc_time = duration; }
arr = [];
for (k in payload) arr.push(k + '=' + payload[k]);        // 原始值直接拼，不做 URL 编码
vData = window.getVData?.call(window, arr.join('&'));      // 可选链！
if (vData) payload.vData = vData;
```

`window.getVData` 在真实浏览器里**也是 undefined**，走的是可选链的空分支。静态搜索 vm-slide 也找不到 `getVData` / `vData` 字样（CHAOS VM 字符串全部运行时逐字符拼接）。

### 4.2 实际机制：XHR 钩子改写 body

对 CHAOS VM 解释器插桩（opcode 轨迹 + window 属性读写日志）还原出 vm-slide 的真实行为：

1. vm-slide 是个 webpack bundle，加载后执行 `init()`，其中 `proxyXHR` 模块 **monkey-patch `XMLHttpRequest.prototype.open` 和 `.send`**；
2. open 钩子逐字符构建 `/cap_union_new_verify` 并与 open 的 URL **严格相等比较**（所以 tgJCap 里 `AqSCodeCapDomain` 为空串、用相对路径请求才会命中）；
3. send 钩子命中后：取 `new Date()` → 校验 body 是 string → 用 `getCaptchaData` **从请求体字符串**算出 vData → **改写 body 追加 `&vData=...`** 再调原始 send。

实测铁证（Node 补环境中截获）：

```
钩子输入 body: collect=abc&sess=xyz
原始 send 收到: collect=abc&sess=xyz&vData=RB0pxg2NgBv2aMLqOR3dtFq4FRSoAT3v...（128 字符）
```

### 4.3 vData 特征

- 长度 128，字符集 `[A-Za-z0-9\-_*]`
- 含时间/随机因子，**每次调用结果不同**（正常，不是不稳定）
- 输入只有 body 字符串 + 当前时间；**全程无任何 addEventListener，不采集鼠标轨迹**（实测结论，无需伪造轨迹）

### 4.4 主滑块流程的 vData 输入串（键序固定）

```
collect=<collect>&tlg=<collect长度>&eks=<eks>&sess=<sess>&ans=<ans的JSON>&pow_answer=<prefix+数字>&pow_calc_time=<毫秒>
```

注意：值**原始拼接、不做 URL 编码**；`pow_*` 仅在有 pow_cfg 时存在。

---

## 5. Node 补环境要点（gen_vdata.js / env.js）

| 坑 | 解法 |
|---|---|
| `Bind must be called on a function` | VM 内部 `new (Function.bind.apply(A, C))`，A 从环境取到 undefined。需要足够完整的 window/document/navigator mock |
| **XHR 方法必须挂在 `XMLHttpRequest.prototype` 上** | vm-slide patch 的是 prototype；实例自有 open/send 会遮蔽钩子，vData 永远注入不进去。**这是最关键的一条** |
| 浏览器全局 with 语义 | window 用 Proxy 包裹：`has() => true`，缺失属性回退 undefined；标准内建挂到 window；`self/top/parent/frames/globalThis` 指向同一 proxy |
| tdc.js 顶层 this | 必须是 window（require 时 this=module.exports 会导致 VM bind 错误），用 `vm.runInContext` |
| 插桩日志丢失 | VM 闭包会嵌套重入解释器，每次 `__TENCENT_CHAOS_VM` 调用若重置日志会丢前段轨迹（早期"只跑 201 步"的假象） |

`gen_vdata.js` 用法：

```bash
# 主滑块流程
echo '{"collect":...,"eks":...,"sess":...,"ans":...,"pow_answer":...,"pow_calc_time":...}' | node gen_vdata.js
# placeholder 流程（直接给 jQuery.param 序列化后的完整 body）
echo '{"raw_body":"sess=...&ans=...&collect=..."}' | node gen_vdata.js
# 输出: {"vData": "..."}（失败 {"error": ...} 且退出码非 0）
```

---

## 6. 主滑块流程（dyn 变体，风控解除后自动走回）

1. `GET /cap_union_prehandle` → `sess / sid / pow_cfg / tdc_path / dyn_show_info`（背景图、精灵图、init_pos、sprite_pos）；
2. 下载当前 sess 的 `tdc.js`（**每 sess 不同**，含 app_data 种子）→ `node reverse.js` 补环境产 `collect / eks / tlg`；
3. 缺口识别：精灵图裁出 id=1 拼图块 → Canny 边缘模板匹配搜背景图，兜底暗块检测；
4. pow 爆破：找最小 o 使 `md5(prefix + o) == target`；
5. `POST /cap_union_new_verify`，表单 `collect / tlg / eks / sess / ans / pow_answer / pow_calc_time / vData`。

---

## 7. placeholder 流程（风控变体，subcapclass=15）

风控期 prehandle 返回 `src_2: template/new_placeholder.html`、无 `data` 字段。链路：

### 7.1 取配置

`GET /cap_union_new_show?aid=...&sess=<prehandle的sess>` → HTML 里正则提取：

```python
re.search(r"window\.captchaConfig=(\{.*?\});try", html)
# 字段: sess(新版, verify 用它) / cdnPic1 / cdnPic2 / spt / nonce /
#       dcFileName(tdc.js 文件名) / vsig / websig / subcapclass / powCfg{md5,prefix}
```

### 7.2 tdc（需对齐浏览器的 setData）

`GET /<dcFileName>` 下载 tdc.js；跑补环境时额外模拟浏览器的两次 `TDC.setData`：

```js
TDC.setData({clientType: "2"});
TDC.setData({coordinate: [30, 60, 0.4706]});   // 弹窗布局经验值，服务端无法严格校验
```

collect 从 984 → 1048 字符，与真实浏览器一致。

### 7.3 缺口识别（本项目第二个硬骨头）

下载 `cdnPic1`（背景）、`cdnPic2`（拼图块，带 alpha）：

```
GET /hycdn?index=N&image=...?aid=<aid>&sess=<sess>&sid=<sid>&img_index=N
Referer: <cap_union_new_show 完整 URL>
```

**placeholder 的缺口是拼图片形状的「暗色剪影」，不是原纹理**——纹理模板匹配会在复杂背景上认错（实测把蘑菇认成缺口，连续 errorCode=50）。重写为剪影特征融合：

- **m1**（权重 0.5）：暗度图 `255-gray` + 拼图 alpha mask（腐蚀 7x7）做 `TM_CCOEFF_NORMED` 匹配——剪影区域整体偏暗；
- **m4**（权重 0.5）：内外亮度对比——`外圈(膨胀15-膨胀3)均值 - 内部(腐蚀3)均值`，剪影内暗外亮，差值最大处即缺口；
- 融合后 NMS 取 top-3 候选，首选置信度 <0.25 直接换题；
- 返回 680 坐标系下 template-left x。

修复后连续 errorCode=0，识别分数 0.85~0.98。

### 7.4 verify body 组装（键序与 tcaptcha-slide.js 一致）

```
<cap_union_new_show 的全部 query 参数> + sess + cdata=0 + ans=<x>,<spt>; +
vsig + websig + subcapclass + pow_answer + pow_calc_time +
collect + tlg + fpinfo= + eks + nonce
```

- `ans` 格式：`"x,spt;"`（注意分号）；
- 序列化用 **jQuery.param 等价**：`encodeURIComponent(k)=encodeURIComponent(v)` 按插入序 `&` 连接；
- 对序列化后的完整 raw_body 跑 vm-slide 钩子（`gen_vdata.js` 的 `raw_body` 模式）拿 vData，最终 body = `raw_body + "&vData=" + vData`；
- POST 头带 `X-Requested-With: XMLHttpRequest`，Referer 用 show 页完整 URL。

### 7.5 errorCode 语义与重试策略

| errorCode | 含义 | 策略 |
|---|---|---|
| 0 | 成功，返回 ticket + randstr | 完成 |
| 50 | 答案错（**同 sess 可换 x 重试**，不消耗挑战） | 每 challenge 最多 2 发（首选 + 第二候选），再错换题 |
| 9 | 瞬时错误 | 等 3s |
| 12 | **客户端级（IP/指纹）滚动限流**（约 50 发/10 分钟触发） | 退避 65s；冷却约 10 分钟恢复。这是限流不是封禁 |

---

## 8. send_sms 签名（千千前端 `bdad668.js` 逆出）

```js
secret = "0b50b02fd0d73a9c4c8c3a781c30845f";
function createSign(e){                 // e 已 delete e.method，含 appid/timestamp
    e.timestamp = Math.floor(Date.now()/1000);
    keys = Object.keys(e).sort();
    s = keys.map(k => k + "=" + e[k]).join("&") + secret;   // secret 直接拼在末尾
    return { sign: md5(s), timestamp: e.timestamp };
}
```

请求形状（对照前端 `handleParams` + POST 分支）：

- **URL query 只有 `sign` 和 `timestamp`**（前端会删掉其余 query 参数）；
- **multipart body 5 个字段**：`phone / randstr / ticket / appid=16073360 / timestamp`；
- `device-id = md5(UA)`（已验证与抓包硬编码值一致）；
- `requestid = "{timestamp}_{7位随机字母数字}"`；
- 成功判定：前端只看 `body.state === true`。errno：22000=成功、22001=签名错误（缺 sign）、23001=同号码 1 分钟 1 条频率限制。

---

## 9. 频率限制（正常使用碰不到，压测才会触发）

- **腾讯 verify**：IP/指纹级滚动窗口，约 50 发/10 分钟 → errorCode=12，脚本已自动退避 65s；
- **短信接口**：同号码 1 分钟 1 条 → errno 23001；
- 风控期（placeholder）由 IP 触发，与 UA 无关（3 个 UA + 新 Session 实测均 placeholder），等自然解除或换出口 IP 后主滑块路径自动恢复。

---

## 10. 文件清单（`spider/js/tengxun/qianqianmusic/`）

| 文件 | 用途 |
|---|---|
| `gen_vdata.js` | vm-slide 补环境 + XHR 钩子 → vData（主滑块 / placeholder 两种输入模式） |
| `env.js` + `fp_data.js` + `reverse.js` | tdc.js 补环境 → collect / eks / tlg（支持 setData 选项） |
| `vm-slide.js.txt` | vm-slide 静态副本（gen_vdata.js 运行时加载） |
| `decoder.js` | tgJCap 字符串解码器（分析工具，框架升级后重新提取即可） |
| `show_page.html` / `tcaptcha-slide.js` | placeholder 流程参考留档 |
| `tdc.js` | 每次运行自动下载覆盖，无需维护 |
