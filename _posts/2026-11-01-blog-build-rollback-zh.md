---
layout: post
date: 2026-11-01 07:10:00 +0800
project: Blog
description: "把写文章、构建静态页面和实际部署分开，GitHub Pages作为镜像，而不是让博客依赖一台服务器。"
ref: blog-build-rollback
lang: zh-Hans
title: "为什么博客用Jekyll，网站却放在自己的VPS上"
image: /assets/og/site.png
source_repo: waldo0926.github.io
source_checked: 2026-11-01
---

以前想把博客做复杂一点：写文章、展示项目、加搜索，似乎很容易一路做成需要数据库的Web应用。但博客最常做的事其实只有一件：把Markdown变成网页。

我最后继续用了Jekyll。它已经能处理文章、布局、RSS和站点地图，英文和中文文章用同一个ref配对。没有必要因为想要更好看的首页就把整套系统换掉。

## GitHub负责构建，VPS负责提供网页

网站源码放在[waldo0926.github.io](https://github.com/Waldo0926/waldo0926.github.io)。GitHub Actions根据源码构建静态文件，放到专门的site分支。VPS定时拉取这个分支，通过自己的Web服务把内容放在blog.secureview.tech。

这样一来，线上不需要安装整套Jekyll运行环境，也不需要让访问博客的用户接触构建工具。GitHub Pages地址还在，可以作为独立镜像查看。两条发布路径应该保持内容一致，但我不会因为它们都能打开，就把它们称为自动故障切换。

## 一个简单的发布流程也有坑

静态站点最怕的不是查询慢，而是把坏的HTML直接发布出去。所以我给PR补了构建检查，还校验文章分享图的路径是否真的存在。合并前先让Jekyll构建，胜过部署后才看到页面空白。

另一个容易忘的地方是链接。每篇中文文章需要对应的英文地址，项目档案也一样。换域名、增加分类或重排目录时，内部链接和分享卡片都可能跟着出问题。

代码和当前发布流程可以在[博客仓库](https://github.com/Waldo0926/waldo0926.github.io)看。这篇记录的是已有设计；如果之后换部署方式，应该再更新文章，而不是让读者按旧说明操作。
