---
title: kafka的使用
published: 2026-07-08
description: 以前一直使用kafka做中间消息存储，但是面试没想到有人会问——kafka是存储在内存还是磁盘这种问题，我不确定啊，总结一下Kafka的特性
image: ''
tags: [随笔]
category: 随笔
draft: false
---
# Kafka教程
<!-- TOC -->
* [Kafka教程](#kafka教程)
    * [一、Kafka 的数据是放在磁盘上还是内存上，为什么速度会快？](#一kafka-的数据是放在磁盘上还是内存上为什么速度会快)
    * [二、基础用法](#二基础用法)
    * [三、分布式理解](#三分布式理解)
<!-- TOC -->
### 一、Kafka 的数据是放在磁盘上还是内存上，为什么速度会快？

Kafka 的数据存储机制是将数据同时写入磁盘和内存，这种设计使得 Kafka 既能够提供高吞吐量的数据处理能力，又能够保证数据的持久性和可靠性。以下是 Kafka 数据存储的具体机制及其为什么速度快的原因。

1、数据存储机制：
1. 日志文件：
• Kafka 将消息存储在日志文件（log files）中，这些文件按主题（topic）和分区（partition）组织。
• 每个分区对应一个目录，目录中包含多个日志文件，每个日志文件是一个段（segment）。
2. 预写日志（WAL）：
• Kafka 使用预写日志（Write-Ahead Log, WAL）机制，确保数据在写入磁盘之前先写入操作系统的页缓存（page cache）。
• 这种机制保证了数据的持久性，即使在系统崩溃后也能恢复数据。
3. 内存缓存：
• 操作系统的页缓存会将频繁访问的数据缓存在内存中，从而加快读取速度。
• 当数据被写入日志文件时，操作系统会先将其写入页缓存，然后再异步地刷入磁盘。

2、为什么速度快
1. 顺序 I/O：
• Kafka 的日志文件是按顺序追加写入的，这使得 I/O 操作更加高效。
• 顺序写入比随机写入的性能要好得多，因为磁盘的顺序读写速度远高于随机读写速度。
2. 零拷贝（Zero-Copy）：
• Kafka 利用了操作系统的零拷贝技术，减少了数据在不同缓冲区之间的拷贝次数。
• 零拷贝技术允许数据直接从磁盘传输到网络接口，而不需要经过多次内存拷贝，从而提高了传输效率。
3. 批量处理：
• Kafka 支持批量处理消息，可以一次性处理多个消息，减少 I/O 操作的开销。
• 批量处理不仅提高了吞吐量，还减少了网络传输的延迟。
4. 分区分段：
• Kafka 的主题可以分为多个分区，每个分区又可以分为多个段。
• 这种设计使得数据可以并行处理，提高了整体的处理能力。
### 二、基础用法

    python3 -m pip install kafka-python
```
from kafka import KafkaProducer
import json

# 创建 Kafka 生产者
producer = KafkaProducer(bootstrap_servers='localhost:9092',
                         value_serializer=lambda v: json.dumps(v).encode('utf-8'))

# 发送消息
for i in range(10):
    message = {'key': 'value', 'index': i}
    producer.send('my-topic', value=message)

# 确保所有消息都已发送
producer.flush()

# 关闭生产者
producer.close()
```
解释
1. KafkaProducer：创建一个 Kafka 生产者实例，指定 Kafka 服务器地址和消息序列化方式。
2. send：向指定的主题发送消息。
3. flush：确保所有消息都已发送。
4. close：关闭生产者，释放资源。
```python
from kafka import KafkaConsumer

conf = {
    'bootstrap_servers': ["ip1:port1","ip2:port2","ip3:port3"],
    'topic_name': 'topic-name',
    'consumer_id': 'consumer-id'
}

print('start consumer')
consumer = KafkaConsumer(conf['topic_name'],
                        bootstrap_servers=conf['bootstrap_servers'],
                        group_id=conf['consumer_id'])

for message in consumer:
    print("%s:%d:%d: key=%s value=%s" % (message.topic, message.partition,message.offset, message.key,message.value))

print('end consumer')
```
1. bootstrap_servers：实例连接地址与端口。
2. topic_name：Topic名称。
3. consumer_id：消费组名称。根据业务需求，自定义消费组名称，如果设置的消费组不存在，Kafka会自动创建。
### 三、分布式理解

Kafka Python 的“分布式用法”核心不是 Python 自己分布式，而是利用 Kafka 的 Topic 分区 + Consumer Group + Offset 管理 来实现多进程、多机器并行消费。
Kafka 本身是由 broker 和 client 组成的分布式系统；consumer group 用来让多个 consumer 协同消费同一个 topic，offset 用来记录每个 consumer group 消费到哪里。

1、基本架构

    Producer 1 ─┐
    Producer 2 ─┼──> Topic: order-events
    Producer 3 ─┘        ├── Partition 0
                         ├── Partition 1
                         ├── Partition 2
                         └── Partition 3
    
    Consumer Group: order-service
        Consumer A -> Partition 0, 1
        Consumer B -> Partition 2
        Consumer C -> Partition 3
2、重点规则

    | 概念             | 作用                                 |
    | -------------- | ---------------------------------- |
    | Topic          | 消息分类，比如 `order-events`             |
    | Partition      | 并行度单位，一个 topic 可以有多个 partition     |
    | Producer       | 写消息到 topic                         |
    | Consumer       | 读消息                                |
    | Consumer Group | 多个 consumer 组成一个消费组，共同分摊 partition |
    | Offset         | 消费进度                               |
    | Key            | 决定消息进入哪个 partition，也影响同 key 的顺序性   |
3、并行度设计

Kafka 的实际消费并行度主要由 partition 数量 决定。

    topic 有 4 个 partition
    consumer group 有 2 个 consumer
可能分配成：
    
    Consumer A: partition 0, 1
    Consumer B: partition 2, 3
如果你开 8 个 consumer：
    
    4 个 consumer 有活干
    4 个 consumer 空闲
所以扩容时要同时考虑partition（分区）数量 >= 期望最大并行 consumer 数量