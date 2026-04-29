const E = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-:@~*,.()[]/|";

function compress_t(e) {
    function g(e, t) {
        var n = e.toString(2), r = "";
        for (var a = n.length + 1; a <= t; a++) r += "0";
        return r + n;
    }

    function d(e, t) {
        var n = [];
        for (var r = 0; r < e.length; r++) n.push(t(e[r]));
        return n;
    }

    function u(e, withSign) {
        // Step1: RLE压缩
        var n = (function(e) {
            e = d(e, function(v) {
                return Math.min(32767, Math.max(-32767, v));
            });
            var t = e.length, nn = 0, r = [];
            while (nn < t) {
                var a = 1, o = e[nn], i = Math.abs(o);
                while (!(t <= nn + a) && e[nn + a] === o && !(127 <= i || 127 <= a)) a++;
                if (1 < a)
                    r.push((o < 0 ? 49152 : 32768) | (a << 7) | i);
                else
                    r.push(o);
                nn += a;
            }
            return r;
        })(e);

        // Step2: 变长编码
        var a = [], o = [];
        d(n, function(v) {
            var abs = Math.abs(v) + 1;
            var r = Math.ceil(abs === 0 ? 0 : Math.log(abs) / Math.log(16));
            if (r === 0) r = 1;
            a.push(g(r - 1, 2));
            o.push(g(Math.abs(v), 4 * r));
        });

        // Step3: 符号位（仅坐标启用）
        var signBits = "";
        if (withSign) {
            var isNormal = function(v) { return v !== 0 && v >> 15 !== 1; };
            var normals = [];
            d(n, function(v) { if (isNormal(v)) normals.push(v); });
            signBits = d(normals, function(v) { return v < 0 ? "1" : "0"; }).join("");
        }

        return g(32768 | n.length, 16) + a.join("") + o.join("") + signBits;
    }

    const h = { mousemove:0, mousedown:1, mouseup:2, scroll:3, focus:4, blur:5, unload:6, unknown:7 };

    // 拆分四个数组
    var t_arr = [], n_arr = [], r_arr = [], a_arr = [];
    for (var o = 0; o < e.length; o++) {
        var s = e[o], c = s.length;
        t_arr.push(s[0]);
        n_arr.push(c === 2 ? s[1] : s[2]);
        if (c === 3) {
            r_arr.push(Math.round(s[1][0]));
            a_arr.push(Math.round(s[1][1]));
        }
    }

    // 事件类型RLE编码
    var evtEncoded = (function(e) {
        var t = [], n = e.length;
        for (var r = 0; r < n; ) {
            var a = e[r], o = 0;
            while (!(16 <= o)) {
                var i = r + o + 1;
                if (n <= i || e[i] !== a) break;
                o++;
            }
            r = r + 1 + o;
            var s = h[a];
            if (o !== 0) { t.push(8 | s); t.push(o - 1); }
            else t.push(s);
        }
        var c = g(32768 | n, 16), l = "";
        for (var dd = 0; dd < t.length; dd++) l += g(t[dd], 4);
        return c + l;
    })(t_arr);

    // 拼接所有二进制
    var l = evtEncoded + u(n_arr, false) + u(r_arr, true) + u(a_arr, true);

    // 补齐6的倍数
    var dlen = l.length;
    if (dlen % 6 !== 0) l += g(0, 6 - dlen % 6);

    // 每6位查E表转字符
    var result = "";
    var total = l.length / 6;
    for (var r2 = 0; r2 < total; r2++) {
        result += E.charAt(parseInt(l.slice(6 * r2, 6 * (r2 + 1)), 2));
    }
    return result;
}

const input = [
    [
        "mousedown",
        [
            0,
            285
        ],
        0
    ],
    [
        "mousemove",
        [
            0,
            0
        ],
        34
    ],
    [
        "mousemove",
        [
            1,
            1
        ],
        1
    ],
    [
        "mousemove",
        [
            1,
            1
        ],
        6
    ],
    [
        "mousemove",
        [
            8,
            1
        ],
        7
    ],
    [
        "mousemove",
        [
            9,
            1
        ],
        8
    ],
    [
        "mousemove",
        [
            14,
            1
        ],
        7
    ],
    [
        "mousemove",
        [
            6,
            1
        ],
        7
    ],
    [
        "mousemove",
        [
            27,
            0
        ],
        8
    ],
    [
        "mousemove",
        [
            11,
            0
        ],
        7
    ],
    [
        "mousemove",
        [
            9,
            0
        ],
        8
    ],
    [
        "mousemove",
        [
            7,
            0
        ],
        8
    ],
    [
        "mousemove",
        [
            4,
            0
        ],
        8
    ],
    [
        "mousemove",
        [
            3,
            0
        ],
        68
    ],
    [
        "mousemove",
        [
            1,
            0
        ],
        0
    ],
    [
        "mousemove",
        [
            1,
            0
        ],
        7
    ],
    [
        "mousemove",
        [
            1,
            0
        ],
        7
    ],
    [
        "mousemove",
        [
            1,
            0
        ],
        15
    ],
    [
        "mousemove",
        [
            1,
            0
        ],
        45
    ],
    [
        "mousemove",
        [
            1,
            -1
        ],
        23
    ],
    [
        "mousemove",
        [
            1,
            0
        ],
        15
    ],
    [
        "mouseup",
        [
            1,
            0
        ],
        38
    ]
];
function get_t(input){
    const result = compress_t(input);
    return result
}

