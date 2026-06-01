---
title: python celery搭建、启动、停止.md
published: 2024-11-02
description: python celery搭建、启动、停止
image: ''
tags: [随笔]
category: 随笔
draft: false
---

### 一、celery
Celery 是一个简单、灵活且可靠的，处理大量消息的分布式系统，专注于实时处理的异步任务队列，同时也支持任务调度。
记得安装redis,因为我这使用celery的broker调度任务是通过redis进行的
```python
import time
from celery import Celery
broker = 'redis://127.0.0.1:6379'
backend = 'redis://127.0.0.1:6379/0'
app = Celery('my_task', broker=broker, backend=backend)
@app.task
def add(x, y):
    time.sleep(5)  # 模拟耗时操作
    return x + y
```
    创建了一个 Celery 实例 app，名称为 my_task；
    指定消息中间件用 redis，URL 为 redis://127.0.0.1:6379；
    指定存储用 redis，URL 为 redis://127.0.0.1:6379/0；
    创建了一个 Celery 任务 add，当函数被 @app.task 装饰后，就成为可被 Celery 调度的任务；
### 二、启动

    使用如下方式启动Celery Worker:
        celery -A tasks worker --loglevel=info
    使用delay()或apply_async()方法来调用任务
```python
# -*- coding: utf-8 -*-

from tasks import add

# 异步任务
add.delay(2, 8)
print('hello world')
```
可以看到，虽然任务函数 `add` 需要等待 5 秒才返回执行结果，但由于它是一个异步任务，不会阻塞当前的主程序，因此主程序会往下执行 `print`语句，直接打印出结果。

### 三、构建自启动

ubuntu@VM-0-17-ubuntu:~$ sudo systemctl cat celery.service

    # /etc/systemd/system/celery.service
    [Unit]
    Description=Celery Service
    After=network.target redis-server.service postgresql.service
    Requires=redis-server.service postgresql.service
    
    [Service]
    Type=simple
    User=ubuntu
    Group=ubuntu
    WorkingDirectory=/home/ubuntu/BankBot-X
    Environment=PATH=/home/ubuntu/BankBot-X/venv/bin
    Environment=C_FORCE_ROOT=true
    ExecStart=/home/ubuntu/BankBot-X/venv/bin/celery -A BankBot worker --loglevel=info
    ExecReload=/bin/kill -s HUP $MAINPID
    ExecStop=/bin/kill -s TERM $MAINPID
    Restart=always
    RestartSec=10
    
    [Install]
    WantedBy=multi-user.target

### 四、停止

    之前搭建了django+celery自动重启服务，
    查看是否有包含 celery 的活跃服务：
    ubuntu@VM-0-17-ubuntu:~$ sudo systemctl list-units --type=service | grep -E "celery|other"
    ubuntu@VM-0-17-ubuntu:~$ celery.service                           loaded active running Celery Service
    停止：sudo systemctl stop celery.service
    禁止开机启动：sudo systemctl disable celery.service
