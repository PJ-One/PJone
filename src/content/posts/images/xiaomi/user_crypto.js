const CryptoJS = require("D:\\Node\\node_modules\\crypto-js");
const JSEncrypt = require("D:\\Node\\node_modules\\jsencrypt");

function randomKey(length = 16) {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

    let str = "";
    for (let i = 0; i < length; i++) {
        const index = Math.floor(Math.random() * chars.length);
        str += chars.substring(index, index + 1);
    }

    return str;
}

function btoaNode(str) {
    return Buffer.from(str, "utf8").toString("base64");
}

function encryptAes(params = {}, isPreview = false) {
    const aesKey = randomKey(16);

    const publicKey = isPreview
        ? `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC0gABHEoaFAcUPlaqKFn3mOOdQ7m5SIINJ0+dLo6hq4AcGAJKnYP+uM1Ge0++8SVxPBC2H+AYBiaeYC0UC5El9fAdGRWjRt2QdDqY0GeB3iPoEAiNvTPgcjKXjt7++fb0CQ2yY9My13py2glTTENCEhD64bjW8n1/9zUrq5XJv7wIDAQAB
-----END PUBLIC KEY-----`
        : `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCYEVrK/4Mahiv0pUJgTybx4J9P5dUT/Y0PuwMbk+gMU+jrZnBiXGv6/hCH1avIhoBcE535F8nJQQN3UavZdFkYidsoXuEnat3+eVTp3FslyhRwIBDF09v4vDhRtxFOT+R7uH7h/mzmyA2/+lfIMWGIrffXprYizbV76+YQKhoqFQIDAQAB
-----END PUBLIC KEY-----`;

    const rsa = new JSEncrypt();
    rsa.setPublicKey(publicKey);

    // 原逻辑：o.encrypt(window.btoa(e))
    const encryptedKey = rsa.encrypt(btoaNode(aesKey));

    const iv = CryptoJS.enc.Utf8.parse("0102030405060708");
    const key = CryptoJS.enc.Utf8.parse(aesKey);

    // 原逻辑：window.btoa(Object.keys(n).join(","))
    const fieldsBase64 = btoaNode(Object.keys(params).join(","));

    const encryptedParams = {};

    Object.keys(params).forEach((field) => {
        const value = String(params[field]);

        const encrypted = CryptoJS.AES.encrypt(value, key, {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        });

        encryptedParams[field] = encrypted.toString();
    });

    return {
        EUI: `${encryptedKey}.${fieldsBase64}`,
        encryptedParams,
    };
}

function get_user(mobile) {
    return encryptAes({
        user: mobile,
    })
}

// 示例

let result = get_user("18300568261")
console.log(result);