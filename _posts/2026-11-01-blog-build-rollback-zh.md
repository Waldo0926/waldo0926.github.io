---
layout: post
date: 2026-11-01 07:10:00 +0800
project: Blog
description: "文章用 Jekyll 构建，主站放在我的 VPS 上，GitHub Pages 作为镜像"
ref: blog-build-rollback
lang: zh-Hans
title: "这个博客怎么构建和部署"
image: /assets/og/blog-build-rollback-zh.png
source_repo: waldo0926.github.io
source_checked: 2026-11-01
---

博客用 Jekyll 生成，文章、布局、RSS 和 sitemap 它都能处理，中英文两篇用同一个 `ref` 互相链接，读者可以切换语言

我考虑过改成带数据库的网站，但这个站主要就是把 Markdown 变成网页，所以还是用 Jekyll，只重做了首页

## 在哪构建，在哪部署

源码在 [waldo0926.github.io](https://github.com/Waldo0926/waldo0926.github.io)，GitHub Actions 把网站构建到单独的 `site` 分支，我的 VPS 定时拉这个分支，提供 blog.secureview.tech

VPS 上只放静态文件，不跑 Jekyll

GitHub Pages 的地址还能打开，当作镜像，两边之间没有自动切换

## 每个 PR 都会检查

模板写错可能让整个页面打不开，所以每个 PR 都会构建一次网站，并检查每篇文章有没有分享预览图

另一个容易出问题的是链接，中英文文章要互相链接，项目页面也一样，改域名或导航时，代码没动这些链接也可能断掉

现在的做法写在[仓库 README](https://github.com/Waldo0926/waldo0926.github.io) 里，以后部署方式改了，这篇可能就不准了
