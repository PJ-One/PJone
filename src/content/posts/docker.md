---
title: docker 操作
published: 2025-06-01
description: docker 常用命令
image: ''
tags: [随笔]
category: 随笔
draft: false
---

    [root@node5 collectionmanage]# docker ps -a
    CONTAINER ID   IMAGE                   COMMAND                  CREATED       STATUS       PORTS                                                                                                                                                 NAMES
    eef3644fb1fe   crawler:latest          "/bin/bash"              10 days ago   Up 10 days   0.0.0.0:8088->8000/tcp, :::8088->8000/tcp, 0.0.0.0:8089->8080/tcp, :::8089->8080/tcp                                                                  distribution_task
    895b813d2d3c   nginx:v1                "/docker-entrypoint.…"   10 days ago   Up 9 days    0.0.0.0:80-81->80-81/tcp, :::80-81->80-81/tcp, 0.0.0.0:443->443/tcp, :::443->443/tcp                                                                  nginx
    d38e5545e54f   webservice_web          "bash -c 'export PYT…"   11 days ago   Up 11 days   0.0.0.0:8000->8000/tcp, :::8000->8000/tcp                                                                                                             web

    # 进入distribution_task 镜像
    [root@node5 collectionmanage]# docker exec -it distribution_task bash

    docker 配置 redis
    PS C:\Users\Administrator> docker pull redis
    latest: Pulling from library/redis
    2d429b9e73a6: Already exists
    92ef1eccbb9f: Pull complete
    5e00ad97561c: Pull complete
    8f865c3d417c: Pull complete
    74c736b00471: Pull complete
    928f5dbb5007: Pull complete
    4f4fb700ef54: Pull complete
    6fd0c1bf3b91: Pull complete
    Digest: sha256:af0be38eb8e43191bae9b03fe5c928803930b6f93e2dde3a7ad1165c04b1ce22
    Status: Downloaded newer image for redis:latest
    docker.io/library/redis:latest
    What's next:
        View a summary of image vulnerabilities and recommendations → docker scout quickview redis
    PS C:\Users\Administrator> docker run -d --name my_redis -p 6379:6379 redis
    4adb221dfd89aa353dd5b11a1ed5ee3db55d4dd5ce60db54cdc08c5236684f3c
    
    PS C:\Users\Administrator> docker ps -a
    CONTAINER ID   IMAGE      COMMAND                   CREATED          STATUS          PORTS                    NAMES
    4adb221dfd89   redis      "docker-entrypoint.s…"   32 seconds ago   Up 31 seconds   0.0.0.0:6379->6379/tcp   my_redis
    
    PS C:\Users\Administrator> docker ps
    CONTAINER ID   IMAGE      COMMAND                   CREATED             STATUS             PORTS                    NAMES
    4adb221dfd89   redis      "docker-entrypoint.s…"   24 minutes ago      Up 24 minutes      0.0.0.0:6379->6379/tcp   my_redis
    ff83bbf7e45e   postgres   "docker-entrypoint.s…"   About an hour ago   Up About an hour   0.0.0.0:5432->5432/tcp   my_postgres
    
    PS C:\Users\Administrator> docker exec -it 4adb221dfd89 redis-cli
    127.0.0.1:6379>
    
    下面两个命令，一个是进入系统，一个是进入redis服务器
    docker exec -it my_redis /bin/sh
    目的：
    这个命令主要是用于进入容器的命令行终端（/bin/sh是容器内的 shell）。当你执行这个命令时，你会进入到名为my_redis的容器内部的 shell 环境。这就好比你打开了一扇通往容器内部操作系统的门，让你能够在容器内部执行各种命令，就像你直接在一个普通的 Linux 系统中操作一样。
    
    
    docker exec -it 4adb221dfd89 redis - cli
    目的：
    这个命令是用于直接在指定容器（这里通过容器 ID4adb221dfd89来指定）中执行redis - cli（Redis 命令行客户端）。它的重点在于直接与 Redis 服务进行交互，而不是进入容器的通用命令行环境。
