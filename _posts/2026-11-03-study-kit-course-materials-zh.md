---
layout: post
date: 2026-11-03 00:00:00 +0800
project: Study Kit
description: "从 Moodle Page、Book、作业说明，到 Ed 图片和 Google 文档：Study Kit 1.8–1.11.1 如何把一门课整理成本地资料包，以及 PDF 缓存、隔离账号和遗漏索引为什么要分开设计。"
ref: study-kit-course-materials
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-03
title: "一门课不只有 PDF：完整课程资料导出怎么做"
tags: [Python, Moodle, Ed, Google Drive, PDF, Privacy]
image: /assets/og/study-kit-course-materials-zh.png
---

[上一篇 Ed 导出文章]({% post_url 2026-11-01-study-kit-ed-export-zh %})讲的是 lesson 文件夹和一键打包。但一门课还有别的东西：Moodle Page 里的作业要求、Book 的几个章节、评分标准、lesson 正文里的图片，以及仍然只是链接的 Google 文档。把磁盘上已有的 PDF 压缩起来，这些内容还是没带走。

Study Kit 1.8 加了整课资料包，1.9 到 1.11.1 逐步补齐正文、图片、Google 文件、隔离账号和 PDF 输出。下面按当前[源码和更新日志](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)说明本地导出器的实现；私有部署改动和生产验证是另外的工作。

## 先看怎么用

装好 Study Kit、选好课程后：

```bash
monash export FIT2109 --sync --format both --to "./exports"
```

`--to` 是目标文件夹，不是 zip 文件名。`--sync` 先刷新这门课的 Moodle 和 Ed Lessons，不同步 Ed 讨论区；不加时只读本地缓存。`--dir` 输出文件夹，`--open` 在文件管理器里显示结果。

1.11.1 起，交互终端不写 `--to` 会先弹目录选择框，`--no-ask` 跳过弹窗。默认上次选择的位置或系统下载目录，也支持 Windows 移动过的“下载”文件夹。同步前先告诉你存在哪，生成 PDF 和打包时显示进度。

## 先采集，再打包

整个过程分三层：

```text
Moodle / Ed / 课程链接的 Google 文件
                  |
              同步与规范化
                  |
         本地文件 + SQLite 元数据
                  |
    export.Plan：文件项 + 遗漏项 + 统计
                  |
           可选的离线 PDF 渲染
                  |
           zip 或目录，附带索引
```

对应源码中，`syncer.py`、`moodle_content.py` 收集 Moodle 内容，Ed 模块同步 Lessons，`google_export.py` 处理 Google 链接，`export.py` 生成打包计划，`pdfrender.py` 负责把 Markdown 页面打印成 PDF。只有 CLI 明确要求先同步时，打包前才需要在线会话。

Moodle Page、Book 和作业正文存成 Markdown。Book 读打印视图，不计作逐章查看。学生可见的 rubric 和 marking guide 也是教学资料，但个人提交、成绩和反馈不进入资料包。文件夹优先整体下载，保留子目录和原文件名，失败再逐个获取。

Ed Lessons 则提供正文、幻灯片、Ed 托管附件和只有题目的测验页。Moodle 与 Ed 图片存进 `assets/`，按内容去重，再改为相对引用。下载失败时保留远程地址，并写入索引。旧版本把无扩展名 Ed 图片存成 `.img` 的，同步时按实际内容修正扩展名，让图片查看器能够识别。

包内按课号组织，下有 `Moodle/`、`Ed Lessons/` 和索引。原有 PDF、notebook、代码和压缩包保留格式；生成的正文、链接列表、测验和索引则使用选定的格式。

## Google 链接需要单独授权

```bash
uv tool install --reinstall --refresh "monash-study-kit[gmail]"
monash google login
monash export FIT2109 --refresh-google --format both --to "./exports"
```

如果已经使用其他 extras，安装命令里也要保留。可选依赖虽然叫 `gmail`，Drive 授权却是独立的：`monash google login` 只申请 `drive.readonly`，保存在 `google-drive-token.json`，与 Gmail 令牌分离。该权限允许读取账号有权访问的全部 Drive 文件，导出器实际处理课程链接；它不能改文件，也不授予 Gmail 权限。

Docs 和 Slides 默认 PDF，Sheets 是 XLSX，普通 Drive 文件保留原格式。`monash config google_docs_format docx` 只把 Docs 改成 DOCX，不影响 Slides 或导出器自己的 Markdown 正文。`--refresh-google` 隐含同步，并重新导出链接的 Google 文件。

文件过大、API 未启用、管理员限制、未共享给当前账号，都可能导致 API 失败。支持时会尝试专用登录浏览器的 Google 会话，Cookie 只在内存中，不能绕过共享权限。Google Forms 保留链接和原因。退出授权先吊销再删本机令牌；吊销失败保留文件，让用户能继续重试。

## PDF 是输出格式，不是另一套同步

1.11 起初始默认输出 `pdf`；`--format md` 不打印 PDF，`both` 同时保留可编辑 Markdown。同步保存的文本和 MCP 搜索索引不变。

每次导出使用一个独立的临时 Chrome、Edge 或 Brave 进程离线打印，嵌入已有本地图片、转义原始 HTML，并阻止远程请求。没有支持的浏览器就回退 Markdown，在终端和索引解释。1.11.1 会重试 Windows 临时 profile 清理，避免浏览器辅助进程短暂占用文件时，把已经完成的导出判为失败。

缓存键包含打印 HTML 和嵌入图片内容，因此只替换图片、不改 Markdown，也会生成新的键。PDF 缓存在 `data/pdf-cache/`，超过 500 MB 时淘汰最旧项；JSON 报告生成数量、缓存命中数量和回退原因。这些是实现规则，不是性能测试数据。

## 账号选择必须早于 import

```bash
monash --profile exchange setup
monash --profile exchange google login
monash --profile exchange export FIT2109 --sync --to "./exports"
monash profile list
```

模块 import 时就固定路径，所以 `entry.py` 必须先选账号，再加载 CLI 和服务模块。命名 profile 将凭据、数据库、课件和浏览器会话隔离在 `profiles/NAME` 下，强制只导课程资料：跳过 Gmail、考勤、Ed 讨论区和个人日历设置，也不能配置远程服务、`monash connect` 或独立移动资料根目录。

清理从默认账号执行：`monash profile remove exchange`。先吊销 Google 令牌，再清登录会话；不加 `--all` 就保留课件和数据库，吊销失败则保留本机文件。Ed API 令牌仍需手动删除。

## 完整还包括说清楚缺了什么

索引会列出本地文件缺失、Ed 课程未同步、Google 导出失败和剩余远程图片。notebook 引用的图片不存在、或者只是大小写不匹配，也要报告。zip 生成成功不代表每个链接都能下载；Moodle 文件夹通常最多每周刷新一次，刷新 Google 不是对所有资源强制刷新。

资料包排除个人记录，并去掉链接里的会议密码参数，但导出后仍是普通本地文件，分享前要检查，不能因此视为可以公开转载。Gmail 是另一项可选功能：普通登录申请 `gmail.modify`，加 `--read-only` 才申请 `gmail.readonly`。

本次本地 Study Kit 测试结果是 **663 passed、10 skipped**，覆盖合成资料、Google 错误、profile 和 PDF 行为，不代表每门真实课程、Google 账号和 Windows 环境都已经实测。[双语导出指南](https://docs.secureview.tech/zh-cn/study-kit/materials/)列出了安装、参数和重试方式。真正导出后，仍应先打开索引，看清楚哪些内容没有带走。
