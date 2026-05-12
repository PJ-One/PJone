---
title: pprint的使用
published: 2024-05-10
description: 之前看到有人用这个打印日志，归纳整理了一下pprint的使用
image: ''
tags: [随笔]
category: 随笔
draft: false
---
# Python pprint模块教程

## 什么是pprint？

`pprint`（Pretty Print）是Python标准库中的一个模块，用于"美化打印"复杂的数据结构。它能将嵌套的字典、列表等数据以更易读的格式输出，特别适合调试和查看复杂数据。

## 基础用法

### 导入模块

```
import pprint
```

### 基本打印

```
# 创建一个复杂的数据结构
data = {
    'users': [
        {
            'id': 1,
            'name': 'Alice',
            'roles': ['admin', 'editor'],
            'profile': {
                'age': 28,
                'city': 'Beijing',
                'hobbies': ['reading', 'swimming', 'coding']
            }
        },
        {
            'id': 2,
            'name': 'Bob',
            'roles': ['user'],
            'profile': {
                'age': 32,
                'city': 'Shanghai',
                'hobbies': ['gaming', 'music']
            }
        }
    ],
    'total_count': 2,
    'active': True
}

# 使用普通print
print("=== 普通print效果 ===")
print(data)

# 使用pprint
print("\n=== pprint效果 ===")
pprint.pprint(data)
```

## 主要函数

### 1. pprint.pprint()

直接打印格式化后的数据

```
pprint.pprint(object, stream=None, indent=1, width=80, depth=None, 
              compact=False, sort_dicts=False, underscore_numbers=False)
```

### 2. pprint.pformat()

返回格式化后的字符串，不直接打印

```
formatted_string = pprint.pformat(data, indent=4, width=60)
print(formatted_string)
```

## 参数详解

### indent - 缩进控制

```
print("=== 不同缩进效果 ===")
print("缩进2个空格:")
pprint.pprint(data, indent=2)

print("\n缩进4个空格:")
pprint.pprint(data, indent=4)

print("\n缩进8个空格:")
pprint.pprint(data, indent=8)
```

### width - 行宽控制

```
print("=== 不同行宽效果 ===")
print("行宽40:")
pprint.pprint(data, width=40)

print("\n行宽80:")
pprint.pprint(data, width=80)

print("\n行宽120:")
pprint.pprint(data, width=120)
```

### depth - 深度控制

```
print("=== 深度控制效果 ===")
print("深度为1:")
pprint.pprint(data, depth=1)

print("\n深度为2:")
pprint.pprint(data, depth=2)

print("\n深度为3:")
pprint.pprint(data, depth=3)
```

### compact - 紧凑模式

```
# 创建一个长列表
long_list = list(range(15))

print("=== 紧凑模式对比 ===")
print("非紧凑模式:")
pprint.pprint(long_list, width=30, compact=False)

print("\n紧凑模式:")
pprint.pprint(long_list, width=30, compact=True)
```

### sort_dicts - 字典排序

```
unsorted_dict = {'z': 1, 'a': 2, 'm': 3, 'b': 4}

print("=== 字典排序效果 ===")
print("不排序:")
pprint.pprint(unsorted_dict, sort_dicts=False)

print("\n排序:")
pprint.pprint(unsorted_dict, sort_dicts=True)
```

## 实际应用场景

### 1. 调试API响应

```
import requests
import pprint

# 模拟API调用
def debug_api_response():
    # 假设这是API返回的JSON数据
    api_response = {
        'status': 'success',
        'data': {
            'users': [
                {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'},
                {'id': 2, 'name': 'Bob', 'email': 'bob@example.com'}
            ],
            'pagination': {
                'current_page': 1,
                'per_page': 10,
                'total': 25,
                'total_pages': 3
            }
        },
        'message': 'Users retrieved successfully'
    }
    
    print("API响应调试:")
    pprint.pprint(api_response, indent=2, width=60)

debug_api_response()
```

### 2. 配置文件查看

```
# 模拟配置文件
config = {
    'database': {
        'host': 'localhost',
        'port': 5432,
        'username': 'admin',
        'password': 'secret',
        'options': {
            'ssl': True,
            'timeout': 30,
            'pool_size': 10
        }
    },
    'server': {
        'host': '0.0.0.0',
        'port': 8000,
        'debug': False,
        'allowed_hosts': ['*']
    },
    'logging': {
        'level': 'INFO',
        'file': '/var/log/app.log',
        'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    }
}

print("=== 配置文件查看 ===")
pprint.pprint(config, indent=4, sort_dicts=True)
```

### 3. 数据导出为字符串

```
def format_data_for_logging(data):
    """将数据格式化为日志友好的字符串"""
    return pprint.pformat(data, indent=2, width=80, compact=True)

# 使用示例
log_data = {'event': 'user_login', 'user_id': 123, 'timestamp': '2024-01-01T12:00:00'}
log_string = format_data_for_logging(log_data)
print("日志字符串:", log_string)
```

## 高级技巧

### 自定义PPrint对象

```
# 创建自定义的pprint对象
custom_pprint = pprint.PrettyPrinter(
    indent=4,
    width=100,
    depth=None,
    compact=True,
    sort_dicts=True
)

print("=== 自定义格式化 ===")
custom_pprint.pprint(data)
```

### 处理循环引用

```
print("=== 循环引用处理 ===")
# 创建包含循环引用的数据结构
a = [1, 2, 3]
b = [a, a]  # b包含a的两个引用
a.append(b)  # a的最后一个元素是b

# pprint能正确处理循环引用
pprint.pprint(a)
```

### 格式化输出到文件

```
# 将格式化输出写入文件
with open('formatted_data.txt', 'w') as f:
    pprint.pprint(data, stream=f, indent=2)
print("数据已写入formatted_data.txt")
```

## 总结

### 优点

- **可读性强**：自动缩进和换行，符合代码规范
- **灵活控制**：通过参数精细控制输出格式
- **安全可靠**：内置循环引用检测
- **标准库**：无需安装第三方包

### 适用场景

- 调试复杂的数据结构
- 查看API响应内容
- 格式化配置文件
- 生成日志友好的数据输出

### 推荐用法

```
# 调试时的推荐用法
pprint.pprint(your_data, indent=2, width=80, depth=None, compact=True)
```

`pprint`是Python开发中非常实用的工具，特别适合处理JSON数据、配置文件和复杂对象的调试工作。掌握它的各种参数用法，能大大提高开发效率和代码可读性。

