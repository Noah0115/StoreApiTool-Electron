# StoreApiTool-Electron

一个基于 Electron 的 Microsoft Store 文件直链查询工具。

## 运行环境

- 当前开发环境 Node.js 版本：`v23.11.1`
- 推荐 Node.js 版本：`22.x LTS`
- 适配版本区间：`>=20 <24`

说明：
- 项目当前使用 `electron 37.x`
- 本项目代码本身没有使用高版本 Node 独占语法，`20` 到 `23` 区间均可用于安装依赖和本地启动

## 功能

- 输入 Microsoft Store 商品链接
- 调用 `store.rg-adguard.net/api/GetFiles` 查询安装文件列表
- 支持打开微软商店页面
- 支持直接打开下载链接

## 使用方法

1. 安装依赖

```bash
npm install
```

2. 启动项目

```bash
npm start
```

3. 在应用中打开微软商店，复制目标商品链接
4. 将链接粘贴到输入框后点击“查询”
5. 在结果表格中选择需要的文件并下载

## 技术栈

- Electron
- HTML
- CSS
- JavaScript

## 项目结构

```text
StoreApiTool-Electron/
|- main.js
|- preload.js
|- package.json
|- src/
|  |- index.html
|  |- renderer.js
|  \- styles.css
```

## 作者

by Noah0115
