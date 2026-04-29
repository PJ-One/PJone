// ==================== x.compress 完整实现 ====================
const t = String.fromCharCode;

const x = {
    compress: function(e) {
        return x.baseCompress(e, 16, function(e) {
            return x.toChart16(t(e));
        });
    },
    baseCompress: function(e, t, n) {
        if (null === e) return "";
        var r, a, o, i, s = {}, c = {}, l = "", d = 2, u = 3, g = 2, h = [], f = 0, v = 0, m = 0;
        for (; m < e.length; m += 1) {
            o = e.charAt(m);
            Object.prototype.hasOwnProperty.call(s, o) || (s[o] = u++, c[o] = true);
            i = l + o;
            if (Object.prototype.hasOwnProperty.call(s, i)) {
                l = i;
            } else {
                if (Object.prototype.hasOwnProperty.call(c, l)) {
                    if (l.charCodeAt(0) < 256) {
                        for (r = 0; r < g; r++) {
                            f <<= 1;
                            v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                        }
                        for (a = l.charCodeAt(0), r = 0; r < 8; r++) {
                            f = f << 1 | 1 & a;
                            v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                            a >>= 1;
                        }
                    } else {
                        for (a = 1, r = 0; r < g; r++) {
                            f = f << 1 | a;
                            v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                            a = 0;
                        }
                        for (a = l.charCodeAt(0), r = 0; r < 16; r++) {
                            f = f << 1 | 1 & a;
                            v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                            a >>= 1;
                        }
                    }
                    0 === --d && (d = Math.pow(2, g), g++);
                    delete c[l];
                } else {
                    for (a = s[l], r = 0; r < g; r++) {
                        f = f << 1 | 1 & a;
                        v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                        a >>= 1;
                    }
                }
                0 === --d && (d = Math.pow(2, g), g++);
                s[i] = u++;
                l = String(o);
            }
        }
        if ("" !== l) {
            if (Object.prototype.hasOwnProperty.call(c, l)) {
                if (l.charCodeAt(0) < 256) {
                    for (r = 0; r < g; r++) {
                        f <<= 1;
                        v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                    }
                    for (a = l.charCodeAt(0), r = 0; r < 8; r++) {
                        f = f << 1 | 1 & a;
                        v === t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                        a >>= 1;
                    }
                } else {
                    for (a = 1, r = 0; r < g; r++) {
                        f = f << 1 | a;
                        v == t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                        a = 0;
                    }
                    for (a = l.charCodeAt(0), r = 0; r < 16; r++) {
                        f = f << 1 | 1 & a;
                        v == t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                        a >>= 1;
                    }
                }
                0 === --d && (d = Math.pow(2, g), g++);
                delete c[l];
            } else {
                for (a = s[l], r = 0; r < g; r++) {
                    f = f << 1 | 1 & a;
                    v == t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
                    a >>= 1;
                }
            }
            0 == --d && (d = Math.pow(2, g), g++);
        }
        for (a = 2, r = 0; r < g; r++) {
            f = f << 1 | 1 & a;
            v == t - 1 ? (v = 0, h.push(n(f)), f = 0) : v++;
            a >>= 1;
        }
        for (;;) {
            f <<= 1;
            if (v === t - 1) { h.push(n(f)); break; }
            v++;
        }
        return h.join("");
    },
    toChart16: function(e) {
        var t = "", n = e.length;
        for (var r = 0; r < n; r++) {
            var a = e.charCodeAt(r).toString(16);
            var o = a.length;
            if (o < 4) {
                a = "0".repeat(4 - o) + a;
            }
            t += a;
        }
        return t;
    }
};

// ==================== 测试 ====================


function get_i(r){
    const input = encodeURIComponent(r.join("!!"));
    const result = x.compress(input);
    return result
}
