---
layout: post
date: 2026-11-21 11:45:00 +0800
project: Study Kit
description: "Study Kit 1.16.0 可以设文件大小上限、按类型不下载，跳过的文件用 monash skipped 查看和补下"
ref: study-kit-download-choices
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-21
title: "Study Kit 1.16.0：下载大小上限和跳过文件清单"
tags: [Python, Moodle, CLI, MCP]
image: /assets/og/study-kit-download-choices-zh.png
---

[Study Kit](https://github.com/Waldo0926/monash-study-kit) 会把课程在 Moodle 上的文件同步到电脑上，方便 AI 软件搜索和读取

之前只有录像默认不下载，其他文件都会下，有的课会放几个 GB 的数据集或者打包的录播

Chrome 插件 [Monash Moodle Downloader](https://github.com/Zetanegative1/Monash-Moodle-Downloader) 4.7.0 加了大小上限和类型过滤，我参考它给 Study Kit 也加上了

## 新的设置

在 `download_videos` 之外加了两个设置：

- `max_file_mb`：默认 300，超过的文件不下载，记成链接并写上大小
- `skip_types`：按类型不下载，可选 `pdf`、`slides`、`docs`、`sheets`、`archives`、`images`、`audio`、`code`

只想这一次不同，可以用 `monash sync --videos`、`--max-mb 50`、`--skip-types archives`，不会改设置

Moodle 的地址经常看不出文件类型，比如资源是 `view.php?id=…`，真正的文件可能是一个没有扩展名的 CloudFront 链接

所以判断是在收到响应头之后、写文件之前做的：文件名看 `Content-Disposition`，类型看 `Content-Type`，大小看 `Content-Length`

如果服务器没给大小，就一边下载一边计数，超过上限就停止，并删掉下了一半的文件

Moodle 文件夹是整个 zip 下载的，现在 zip 里的文件也按同样规则处理

这里顺便修了一个问题：以前关掉 `download_videos` 后，文件夹 zip 里的录像还是会被解压出来

## 查看和补下跳过的文件

跳过的文件会记到数据库的一张表里，`monash sync` 结束时会列出这次新跳过的文件

`monash skipped` 列出全部：

```text
FIT2109
  [3] Week 05/Dataset.csv（太大，512 MB）
  [7] Week 09/Project data/raw.zip（太大，1200 MB）
```

补下有两种方式：

- 少量文件用 `monash skipped --get 3`，不受上限限制，下载前会检查硬盘剩余空间
- 大量文件用 `monash sync --max-mb 2000` 调大上限再同步一次，已经下好的文件不会重复下载

在 AI 软件里也可以问“有哪些文件没下载”，然后告诉它要哪几个

编号是表的行号，同步时是更新原有的行，所以后台同步之后编号不会变

## 修复的两个问题

**单独同步一门课时没有加锁**：完整同步会加锁，避免 AI 软件的后台同步和终端里的同步同时运行，但 `monash sync FIT2109` 和 `monash export --sync` 没有加

两者同时同步同一门课时，一边可能删掉另一边正在下载的临时文件

现在这两个命令和 `--get` 都使用同一个锁，后台正在同步时会提示稍后再试

**Windows 保留文件名**：`CON.pdf`、`NUL` 这类文件名在 Windows 上无法保存，以前这个文件每次同步都会失败，现在会在文件名前加 `_`

## 没有做的

我考虑过并发下载，但文件夹本来就是一个 zip，而且工具在请求之间固定间隔 0.4 秒，避免给 Moodle 造成压力

并发下载需要给 cookie 和数据库加锁，收益不大，所以还是逐个下载

具体改动见[更新日志](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)，使用说明见 [docs.secureview.tech](https://docs.secureview.tech/zh-cn/study-kit/cli/#选择下载哪些文件)
