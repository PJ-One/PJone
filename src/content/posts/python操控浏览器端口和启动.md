---
title: 操控浏览器
published: 2023-01-08
description: python操控浏览器端口和启动
image: ''
tags: [随笔]
category: 随笔
draft: false
---
# 查看浏览器信息

### 1、查看浏览器详情

    在Chrome内直接查看：地址栏输入 chrome://version
    
| 类别            | 详情                                                                   |
|---------------|----------------------------------------------------------------------|
| Google Chrome | 136.0.7103.49 (正式版本) （64 位） (cohort: Stable Installs & Version Pins) |
| 操作系统          | Windows 11 Version 25H2 (Build 26200.8457)                           |
|      JavaScript         |      V8 13.6.233.8                                                                |
|       用户代理        |             Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36                                                         |
|  命令行	             |        "C:\Program Files\Google\Chrome\Application\chrome.exe" --flag-switches-begin --disable-features=ExtensionManifestV2Disabled,ExtensionManifestV2Unsupported --flag-switches-end --origin-trial-disabled-features=CanvasTextNg|WebAssemblyCustomDescriptors                                                              |
|     可执行文件路径	          |          C:\Program Files\Google\Chrome\Application\chrome.exe                                                            |
|       个人资料路径        |       C:\Users\Administrator\AppData\Local\Google\Chrome\User Data\Default                                                               |
    可以看到上面没有--remote-debugging-port 参数

### 2、开启调试端口
    PowerShell用以下命令启动：& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
    再次查看浏览器打开信息: 
    命令行	"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --flag-switches-begin --disable-features=ExtensionManifestV2Disabled,ExtensionManifestV2Unsupported --flag-switches-end --origin-trial-disabled-features=CanvasTextNg|WebAssemblyCustomDescriptors


### 3、使用临时用户数据目录
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome_debug"
    这样可以多开几个独立的数据目录
### 4、selenium操控浏览器
    在python中连接操控浏览器的方法，以为selenium为例：
```python
import os
import sys
from selenium import webdriver
from loguru import logger
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options


def check_chromedriver():
    # 要检查的路径
    paths_to_check = [
        r"C:\Program Files\Google\Chrome\Application\chromedriver.exe",
        r"C:\Users\Administrator\AppData\Local\Google\Chrome\Application\chromedriver.exe",
    ]
    for path_to_check in paths_to_check:
        if os.path.exists(path_to_check):
            return path_to_check
        else:
            print(f"驱动路径 '{path_to_check}' 不存在。")


class Driver(webdriver.Chrome):
    def __init__(self, id):
        self.id = id
        self.request_data_thread = None
        options = Options()
        options.add_experimental_option("debuggerAddress", f"127.0.0.1:9{self.id}")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-logging")
        options.add_argument('--log-level=3')
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--hide-scrollbars")
        options.add_argument("--disable-popup-blocking")  # 禁用弹窗阻止
        options.set_capability("goog:loggingPrefs", {"performance": "ALL"})


        path_to_chromedriver = check_chromedriver()
        if path_to_chromedriver:
            print("驱动的路径是：", path_to_chromedriver)
        else:
            path_to_chromedriver = "自己设置一下"
            print("请自己单独设置chromedriver路径")
        if sys.platform.startswith('win'):
            print("当前平台是 Windows")
            self.download_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "download", str(self.id))
            print("下载所在目录:", self.download_dir)
            executable_path = path_to_chromedriver
            user_data_dir = r"C:\ChromeDebugData_" + f"{self.id}"  # 注意 C
            options.add_argument(f'--user-data-dir={user_data_dir}')
            service = Service(executable_path)
            self.webdriver = webdriver.Chrome(service=service, options=options, )
        elif sys.platform == 'darwin':
            print("当前平台是 macOS")
            user_data_dir = "$HOME/Library/Application Support/Google/Chrome"
            options.add_argument(f'--user-data-dir={user_data_dir}')
            self.download_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "download", str(self.id))
            service = Service()  # # 不传入 executable_path
            self.webdriver = webdriver.Chrome(service=service, options=options)
        else:
            print("当前平台既不是 Windows 也不是 macOS")
        logger.info(f"设置的下载文件路径是 {self.download_dir}")
        self._create_dir(self.download_dir)
        # self.event_handler = FileHandler()
        # self.observer = Observer()
        # self.observer.schedule(self.event_handler, self.download_dir, recursive=True)
        # self.observer.start()  # 启动观察者

if __name__ == '__main__':
        
    driver = Driver(id)



```

### 5、scrapling操控浏览器
```python
from scrapling.fetchers import StealthyFetcher , StealthySession
url = "https://www.hapag-lloyd.cn/zh/online-business/track/vessel-tracker-solution.html"

engine = StealthySession(
    headless=False,
    executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    user_data_dir="chrome_profile"
)

engine.start()

page = engine.context.new_page()

page.goto(url)

page.wait_for_timeout(4000)

# 找真正文本框
locator = page.locator('//input[@type="text"]').first

# 高亮（调试非常有用）
locator.highlight()

# 点击
locator.click()

# # 真人输入
# page.keyboard.type(
#     "ACASTOS",
#     delay=120
# )
# page.locator('//button[@value="查询"]').click()
input("按回车退出...")
```
    scrapling 的 StealthySession 本身不是专门用来连接已有 Chrome 9222 端口的。
    它默认是自己启动浏览器。
    scrapling 用来启动 stealth 浏览器；9222 用来接管已有浏览器。接管已有浏览器时，直接用 patchright.sync_api 更合适。