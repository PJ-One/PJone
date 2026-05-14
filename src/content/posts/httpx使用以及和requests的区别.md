---
title: httpx使用以及和requests的区别
published: 2025-03-01
description: httpx
image: ''
tags: [随笔]
category: 随笔
draft: false
---
### 一、httpx的用法

    httpx 是一个现代化的 Python HTTP 客户端库，功能上类似于 requests，但提供了更多特性和异步支持。
    
同步：
```python
import httpx

response = httpx.get("https://httpbin.org/get")
print(response.status_code)
print(response.json())
```
异步：
```python
import httpx
import asyncio

async def fetch():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://httpbin.org/get")
        print(response.status_code)
        print(response.json())

asyncio.run(fetch())
```
会话管理与超时：
```python
import httpx

with httpx.Client(timeout=5.0) as client:
    response = client.get("https://httpbin.org/delay/2")  # 最长等待5秒
    print(response.status_code)
```

HTTP/2 请求：
```python
with httpx.Client(http2=True) as client:
    response = client.get("https://nghttp2.org/httpbin/get")
    print(response.http_version)  # HTTP/2
```
asyncio.gather 来同时发出多个请求:
```python
import asyncio
import httpx

urls = [
    "https://httpbin.org/get?i=1",
    "https://httpbin.org/get?i=2",
    "https://httpbin.org/get?i=3",
    "..."
]

async def fetch(client, url):
    response = await client.get(url)
    print(f"{url} -> {response.status_code}")
    return response.text

async def main():
    # AsyncClient 支持 HTTP/1.1 和 HTTP/2，可复用连接池
    async with httpx.AsyncClient() as client:
        # 同时启动所有请求
        tasks = [fetch(client, url) for url in urls]
        results = await asyncio.gather(*tasks)
        # results 是所有请求返回的文本列表
        print("所有请求完成")

asyncio.run(main())
```
并发限制：
```python
sem = asyncio.Semaphore(5)  # 最多5个请求同时进行

async def fetch(client, url):
    async with sem:
        return await _fetch(client, url)
```
### 二、httpx的特性

| 特性               | requests                    | httpx              |
| ---------------- | --------------------------- | ------------------ |
| 同步请求             | ✅                           | ✅                  |
| 异步请求             | ❌                           | ✅（async/await 支持）  |
| HTTP/2 支持        | ❌                           | ✅                  |
| 重试 / 超时          | 需要额外库（`urllib3.util.retry`） | ✅ 内置超时和重试支持        |
| SSL 验证           | ✅                           | ✅（更易配置，如客户端证书、多域名） |
| 路由器/代理           | ✅                           | ✅（更灵活）             |
    异步支持：httpx 的最大优势是原生支持 asyncio，适合高并发请求场景。
    HTTP/2：httpx 支持 HTTP/2，而 requests 只支持 HTTP/1.1。
    现代 API 设计：httpx 提供 Client 和 AsyncClient，允许更精细控制会话、连接池和超时。
    类型提示与未来维护：httpx 设计时就考虑了 Python 3.7+ 特性，官方也推荐新项目使用 httpx 代替 requests。

