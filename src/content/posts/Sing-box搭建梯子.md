---
title: sing-box工具搭建VPN
published: 2024-11-05
description: 搭建VPN
image: ''
tags: [VPN]
category: 随笔
draft: false
---

### 一、准备
    一台 Linux 服务器（示例用 Ubuntu/Debian，具公网 IP）
    端口：默认用 TCP 443（云安全组/防火墙需放行）
    客户端：Clash Meta / Mihomo / Karing 或 sing-box 客户端
### 二、安装 sing-box
    1) 下载并安装二进制（也可用你已经下载的 tar.gz）
    VER=1.10.0
    curl -L "https://github.com/SagerNet/sing-box/releases/download/v${VER}/sing-box-${VER}-linux-amd64.tar.gz" -o sing-box.tar.gz
    tar xf sing-box.tar.gz
    sudo install -m 755 sing-box-${VER}-linux-amd64/sing-box /usr/local/bin/sing-box

    2) 准备配置目录
    sudo mkdir -p /etc/sing-box
    
    sing-box version


### 三、生成 REALITY 密钥与 short-id

    生成 Reality 密钥对
    sing-box generate reality-keypair
    # 输出包含：
    # Private key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    # Public key : yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
    
    # 生成 short-id（可多生成几条，保留一条用）
    sing-box generate rand --hex 8
    # 输出如：abcd1234


### 四、生成一个 UUID（用户身份）

    sing-box generate uuid
### 五、编写配置文件 /etc/sing-box/config.json
    示例：VLESS + REALITY（Vision 流），监听 443，SNI 伪装到 www.cloudflare.com。
    把里面的 UUID / private_key / short_id 改成生成的
```json
ubuntu@VM-0-17-ubuntu:~/sing-box$ cat /etc/sing-box/config.json
{
  "log": {
    "level": "info",
    "timestamp": true
  },
  "inbounds": [
    {
      "type": "vmess",
      "tag": "vmess-in",
      "listen": "::",
      "listen_port": 443,
      "users": [
        {
          "uuid": "9f1c9f5e-6a4e-4b2e-bc0d-0a5e3f9c1234",
          "alterId": 0
        }
      ]
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    }
  
```
### 六、先前台运行确认
    ubuntu@VM-0-17-ubuntu:~/sing-box$ sudo /usr/local/bin/sing-box run -c /etc/sing-box/config.json
    +0800 2026-05-31 17:06:42 INFO router: updated default interface eth0, index 2
    FATAL[0000] start service: initialize inbound/vmess[vmess-in]: listen tcp 0.0.0.0:443: bind: address already in use
### 七、做成 systemd 服务（开机自启）
    ubuntu@VM-0-17-ubuntu:~/sing-box$ sudo systemctl cat sing-box
        # /etc/systemd/system/sing-box.service
        [Unit]
        Description=Sing-box Service
        After=network.target
        
        [Service]
        ExecStart=/usr/local/bin/sing-box run -c /etc/sing-box/config.json
        Restart=on-failure
        RestartSec=5s
        User=root
        
        [Install]
        WantedBy=multi-user.target
    ubuntu@VM-0-17-ubuntu:~/sing-box$ sudo systemctl status sing-box
        ● sing-box.service - Sing-box Service
             Loaded: loaded (/etc/systemd/system/sing-box.service; enabled; preset: enabled)
             Active: active (running) since Mon 2025-12-08 11:32:48 CST; 5 months 22 days ago
           Main PID: 130951 (sing-box)
              Tasks: 11 (limit: 4375)
             Memory: 15.2M (peak: 83.5M)
                CPU: 17min 18.576s
             CGroup: /system.slice/sing-box.service
                     └─130951 /usr/local/bin/sing-box run -c /etc/sing-box/config.json

### 八、延迟问题排查
    检查延迟,看丢包和跳数：
    sudo apt install mtr -y
    ```shell
    ubuntu@VM-0-17-ubuntu:~/sing-box$ mtr -rw google.com
    Start: 2026-05-31T17:09:22+0800
    HOST: VM-0-17-ubuntu       Loss%   Snt   Last   Avg  Best  Wrst StDev
      1.|-- 11.78.9.193          80.0%    10    1.3   3.4   1.3   5.5   2.9
      2.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
      3.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
      4.|-- 10.196.7.65          10.0%    10    0.6   1.6   0.6   8.6   2.6
      5.|-- 142.250.162.174      10.0%    10    2.2   3.0   1.8   7.7   1.8
      6.|-- 142.250.162.174       0.0%    10    1.6   1.5   1.3   2.1   0.2
      7.|-- 209.85.255.81         0.0%    10    2.7   2.0   1.5   2.9   0.5
      8.|-- 142.251.192.10        0.0%    10    1.4   2.7   1.2  10.7   3.0
      9.|-- 216.239.50.192        0.0%    10    3.3   2.5   1.9   3.3   0.5
     10.|-- 74.125.37.250         0.0%    10    1.4   1.3   1.3   1.4   0.0
     11.|-- 216.239.35.145        0.0%    10    2.3  22.6   2.3  58.9  19.9
     12.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     13.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     14.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     15.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     16.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     17.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     18.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     19.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     20.|-- ???                  100.0    10    0.0   0.0   0.0   0.0   0.0
     21.|-- sa-in-f102.1e100.net  0.0%    10    0.9   0.9   0.8   0.9   0.0
    ```
    可以看到，后半段新加坡服务器访问 Google 很快，基本没问题
    大陆手机/宽带 → 新加坡服务器 → TikTok/Google

在服务器上看 sing-box 是否正在运行
```shell
ubuntu@VM-0-17-ubuntu:~/sing-box$ ps aux | grep sing-box
root      130951  0.0  0.8 1258616 33596 ?       Ssl   2025  17:18 /usr/local/bin/sing-box run -c /etc/sing-box/config.json
ubuntu   2758382  0.0  0.0   6544  2304 pts/0    S+   17:14   0:00 grep --color=auto sing-box
ubuntu@VM-0-17-ubuntu:~/sing-box$ sudo ss -tunlp | grep sing-box
tcp   LISTEN 0      4096                *:443              *:*    users:(("sing-box",pid=130951,fd=7))                      
```
    为了 改善大陆手机端刷短视频卡顿,可以改用 UDP 协议,
    Sing-box 支持 Hysteria2 / TUIC，这些协议特点：
        基于 UDP，抗丢包能力强
        内置 FEC（Forward Error Correction，前向纠错）
        支持 QoS 类似流控，延迟低
        视频应用体验明显提升