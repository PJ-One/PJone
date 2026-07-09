---
title: 豆瓣-collect与eks补环境逆向
published: 2026-07-09
description: 腾讯 TDC 滑块验证码逆向：纯 node 补环境产出 collect / eks
image: ''
tags: [web]
category: 爬虫
draft: false
---
## 腾讯 TDC 滑块验证码逆向：纯 node 补环境产出 collect / eks

> 目标站点：豆瓣登录（`aid=2044348370`）
> 
> 目标：不启动浏览器，用 **纯 requests + node** 让 `cap_union_new_verify` 返回 `errorCode=0`
> 
> 关键成果：node 手写补环境跑通 `tdc.js`，产出的 `collect` / `eks` 与真实 Chrome **逐字节一致**

---

## 1. 整体流程

```
cap_union_prehandle  →  拿 sess / tdc_path / pow_cfg / 背景图 / 精灵图 / 缺口配置
        │
        ├─ 下载当次 tdc.js（URL 带 app_data 种子，每个 sess 不同）
        │        └─ node 补环境跑 tdc.js  →  collect = TDC.getData(true)
        │                                    eks     = TDC.getInfo().info
        ├─ 下载背景图 + 精灵图  →  缺口识别  →  ans
        └─ pow_cfg  →  md5 爆破  →  pow_answer / pow_calc_time
        │
cap_union_new_verify（提交上述 6 个字段 + sess）  →  errorCode=0
```

`cap_union_new_verify` 的请求体字段：

| 字段 | 含义 | 来源 |
|------|------|------|
| `collect` | 设备指纹 + 行为采集 | `tdc.js` 的 `TDC.getData(true)` |
| `tlg` | `collect` 的长度 | `len(collect)` |
| `eks` | 加密密钥信息 | `tdc.js` 的 `TDC.getInfo().info` |
| `sess` | 会话 | prehandle 返回 |
| `ans` | 缺口答案坐标 | 图像识别 |
| `pow_answer` / `pow_calc_time` | 工作量证明 | md5 爆破 |

---

## 2. 参数来源逆向

在验证码 iframe 加载的 `dy-ele.98bbf895.js` 中定位到请求组装代码（已还原）：

```js
// 组装 verify 请求
a = decodeURIComponent((0, o.getTdcData)());   // collect
s = (0, o.getKeyInfo)();                        // eks
c = { collect: a, tlg: a.length, eks: s, sess: this.sess, ans: JSON.stringify(e) };

// pow（在 getWorkloadResult 中）
c.pow_answer = "" + workloadNonce + workloadAns;
c.pow_calc_time = workloadDuration;
```

再跟进 `getTdcData` / `getKeyInfo` 的定义：

```js
t.getTdcData = function () {
    a({ ft: n["default"]() });                              // TDC.setData({ft})
    return window.TDC.getData(!0) || "---";                 // collect
};
t.getKeyInfo = function () {
    return (c() || {}).info || "";                          // TDC.getInfo().info = eks
};
```

**结论：`collect` 和 `eks` 完全来自 `window.TDC`（即 `tdc.js`），没有额外的加密函数需要还原。** 只要在 node 里把 `tdc.js` 跑起来，就能拿到这两个值。

### 一个关键实测：eks 恒定，不含轨迹

在浏览器中对比"拖动前 / 拖动后"的 `TDC.getInfo().info`：

```
baseEksLen=248  successEksLen=248  common_prefix_len=248  now_eq_success=true
```

`eks` 拖动前后**完全相同**——它只依赖设备指纹 + sess，不编码鼠标轨迹。这说明该验证码主要校验 **指纹自洽 + ans 正确 + pow 正确**，对精确鼠标轨迹要求极低，为纯 node 方案扫清了最大顾虑。

---

## 3. 核心：tdc.js 纯 node 补环境

`tdc.js` 约 78KB，采用 `__TENCENT_CHAOS_STACK` VM 混淆（自定义字节码解释器），且带大量环境自检。直接 `require('./tdc.js')` 会报：

```
TypeError: Bind must be called on a function
    at tdc.js:1  (__TENCENT_CHAOS_VM)
```

补环境的整个过程就是把这些坑逐个填平。方法论是 **"真实基底 + 记录缺失"**：window / navigator / screen 用真机快照填真值，未定义属性返回 `undefined` 并记录，然后按记录逐个补，直到 `TDC` 正常挂载。

### 坑 1：tdc.js 顶层 `this` 必须是 `window`

CommonJS 里顶层 `this === module.exports === {}`。VM 初始栈 `S=[[this]]`，某条 opcode 会 `new` 这个 `this`，得到 `{}` 非函数 → `bind` 报错。

**解法**：不要 `require`，用 `vm` 在 `this=window` 下执行：

```js
vm.runInContext('(function(){\n' + tdcSource + '\n}).call(window)', sandbox);
```

### 坑 2：window 上要挂全部标准全局

填完 `this` 后，报错点变成 `MISSING: window.Array`。浏览器里 `window.Array === Array`，而 sandbox 的 `window` 对象上没有这些构造函数，VM 通过 `window.Array` 取构造函数去 `new`，拿到 `undefined` 就崩了。

**解法**：把标准全局全部挂到 window：

```js
Object.assign(windowTarget, {
  Array, Object, Function, String, Number, Boolean, Date, Math, JSON, RegExp, Error,
  Symbol, Reflect, Proxy, Map, Set, Promise, ArrayBuffer, Uint8Array, /* ... */
  parseInt, parseFloat, encodeURIComponent, decodeURIComponent, TextEncoder, URL, Intl,
});
```

补上后 `window.TDC` 首次成功挂载：`keys=["getInfo","setData","clearTc","getData"]`。

### 坑 3：canvas / webgl 指纹接 fp_data.js

tdc.js 会做画布与显卡指纹采集。探针记录到它实际调用了：

```
canvas.getContext(webgl) / canvas.getContext(2d) / canvas.toDataURL
gl.getParameter(37445)  // UNMASKED_VENDOR_WEBGL
gl.getParameter(37446)  // UNMASKED_RENDERER_WEBGL
gl.getSupportedExtensions
```

node 没有画布，必须用真机采集的固定指纹（`fp_data.js`）应答：

```js
// 2d：toDataURL 直接返回真机 canvas 哈希图
el.toDataURL = () => FP.canvas300x150;
// webgl：关键枚举返回真机显卡信息
getParameter(p){
  if (p === 0x9245 || p === 0x1F00) return FP.glVendor;    // "Google Inc. (NVIDIA)"
  if (p === 0x9246 || p === 0x1F01) return FP.glRenderer;  // "ANGLE (NVIDIA, RTX 4060 Ti ...)"
}
getSupportedExtensions(){ return FP.glExts.slice(); }
```

### 坑 4：反爬检测项必须保持 undefined

补环境跑通后，`MISSING` 列表里剩下的全是自动化探测项：

```
window.callPhantom / window._phantom / window.WebPage
window.domAutomation / window.ubot / window.casper / window.CasperError
document.$cdc_asdjflasutopfhvcZLmcfl_ / document.__webdriver_script_fn
window.fxdriver_id / window.__fxdriver_unwrapped / window.patchRequire
window.RTCPeerConnection（及各前缀）
```

这些是 tdc.js 在探测 PhantomJS / Selenium / WebDriver / Casper 等工具的痕迹。**它们保持 `undefined` 恰恰是"干净真实环境"的正确表现**——千万不要为了消除 MISSING 而给它们赋值，那反而会被判为自动化。

### 侦察技巧：记录式 Proxy

补环境不是盲试。核心工具是一个"记录式 Proxy"：真实属性返回真值，未定义属性返回 `undefined` 并计数。跑一遍就能拿到精确的"待补清单"和"每个坑的具体缺失属性"，把几十轮试错压缩成几轮。

```js
function wrap(target) {
  return new Proxy(target, {
    get(t, p){ if (p in t) return t[p]; record(missing, p); return undefined; },
    set(t, p, v){ t[p] = v; return true; },
    has(t, p){ return p in t; },
  });
}
```

---

## 4. collect / eks 正确性验证（逐字节一致）

`eks` 是 `tdc.js` 里内嵌的一个常量（每个 sess 不同）。在浏览器实际加载的 tdc.js 源码里可以直接搜到：

```js
window.GAmDcMjnlhmVkAlJQanNfSKYmaQhdPZh = 'Bf8b0IU088mT8xUEcKKFh/4cIrQF1ZU6cox2rVYICq9pl...==';
```

用**同一份** tdc.js 让 node 补环境跑出来：

```
node reverse.js tdc_browser.js
→ eks     = Bf8b0IU088mT8xUEcKKFh/4cIrQF1ZU6cox2rVYICq9pl...   ✅ 与浏览器成功样本完全一致
→ collect = wZbREbFurR5SKhzrYWVAuiMzy9KAg5W2GvjTKVtv...        ✅ 与浏览器 collect 头部逐字节一致
```

`collect` 的设备指纹段完全对齐，只有尾部时间戳/计数随每次调用变化（浏览器本身也如此）。**这证明补环境产出的值服务器完全认可。**

---

## 5. pow：标准 hashcash

`getWorkloadResult` 还原后就是暴力找最小整数：

```js
// 从 o=0 递增，找到第一个使 md5(nonce + o) === target 的 o
for (o = 0; md5(nonce + o) !== target; o++);
pow_answer = nonce + o;   // 例: 3ad951e8b7bca803#82086
```

python 一行复刻，秒级完成：

```python
prefix, target = pow_cfg["prefix"], pow_cfg["md5"]   # nonce, md5
o = 0
while hashlib.md5((prefix + str(o)).encode()).hexdigest() != target:
    o += 1
pow_answer = prefix + str(o)
```

---

## 6. ans：缺口识别（边缘模板匹配）

- `ans` 格式：`[{"elem_id":1,"type":"DynAnswerType_POS","data":"x,y"}]`
- `y` 直接取缺口块的 `init_pos.y`（不需要识别）
- `x` = 缺口块左上角横坐标（672 坐标系）

缺口块是"深色半透明 + 白色拼图描边"的固定形状。用手写阈值法（暗块/梯度）跨图鲁棒性差（不同背景暗度不一），最终采用 **精灵图拼图块 + 边缘模板匹配**：

1. 从精灵图（`sprite_url`）按 `sprite_pos` + alpha 通道裁出 id=1 拼图块作模板；
2. 模板与背景图各做 `Canny` 边缘；
3. `cv2.matchTemplate(TM_CCOEFF_NORMED)`，并加**搜索区约束**（`x≥50`、`y` 落在 `init_pos.y` 换算带内，排除图左缘误匹配）；
4. 峰值位置即缺口 x。

拼图形状固定，对背景内容/颜色不敏感，识别成功率约 **87%**，偏差通常 2~5px（在服务器容差内）。识别对应实现见 `gap.py`。

---

## 7. 代码结构

| 文件 | 职责 |
|------|------|
| `doubanlogin.py` | 端到端主流程：prehandle → node 产 collect/eks → 识别 ans → pow → verify，带失败重试 |
| `env.js` | **tdc.js 纯 node 补环境**（本文核心），导出 `runTdc(tdcSource) → {collect, eks, tlg}` |
| `reverse.js` | `node reverse.js <tdc.js路径>`，输出一行 JSON `{collect, eks, tlg, tokenid}` |
| `gap.py` | 缺口识别（边缘模板匹配 + 暗块兜底） |
| `fp_data.js` | 真机 canvas / webgl 指纹样本，被 env.js 引用 |
| `tdc.js` | 每次 prehandle 下载的当次混淆脚本（会被覆盖） |

python 调用 node 的桥接：

```python
p = subprocess.run(["node", "reverse.js", tdc_file], cwd=PROJ, capture_output=True, text=True)
tdc_out = json.loads(p.stdout)   # {collect, eks, tlg}
```

---

## 8. 错误码与注意事项

| errorCode | 含义 | 处理 |
|-----------|------|------|
| `0` | 成功，返回 `ticket` / `randstr` | — |
| `50` | ans 位置错误（识别偏差） | 重新识别 / 重试 |
| `12` | **IP 频率风控**（高频请求触发），非代码问题 | 降频、等待冷却、换出口 IP |

- **`errorCode=12` 是踩坑重点**：短时间密集请求会把出口 IP 打进冷却期，此时无论参数多正确都返回 12。冷却后单次调用即恢复 `errorCode=0`。生产中低频调用或走可换 IP 的代理池即可规避。
- tdc.js 每个 sess 不同（URL 带 `app_data` 种子），必须每次 prehandle 后重新下载再跑 node。

---

## 9. 总结

- 该验证码 `collect` / `eks` 没有独立加密算法，**唯一来源就是 tdc.js**，工作重心在"纯 node 补环境"。
- 补环境四个决定性要点：**`this=window`、window 挂全局、canvas/webgl 接真机指纹、反爬项保持 undefined**。
- 用"真实基底 + 记录式 Proxy"侦察，能把补环境从盲目试错变成有据可依的定点补齐。
- node 产出与真机逐字节一致，配合 pow 爆破 + 缺口模板匹配，实现纯 requests + node 的 `errorCode=0`。
