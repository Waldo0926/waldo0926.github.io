---
layout: post
date: 2026-11-21 11:45:00 +0800
project: Study Kit
description: "Study Kit 1.16.0 可以设文件大小上限、整类不下、不下录像，还会列出跳过了哪些，想要的一条命令就能补回来"
ref: study-kit-download-choices
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-21
title: "2 GB 的数据集可以不下，但要记得跳过了什么"
tags: [Python, Moodle, CLI, MCP]
image: /assets/og/study-kit-download-choices-zh.png
---

[Study Kit](https://github.com/Waldo0926/monash-study-kit) 会把课程放在 Moodle 上的文件都同步到你电脑上，让 AI 软件能搜、能读

录像本来就默认不下，其他的全都会下，包括偶尔出现的 2 GB 数据集，或者一整包去年的录播

Chrome 插件 [Monash Moodle Downloader](https://github.com/Zetanegative1/Monash-Moodle-Downloader) 在 4.7.0 里加了大小上限和类型过滤，我顺着看了一下 Study Kit 还缺什么

## 选择下载哪些文件

1.16.0 在 `download_videos` 旁边加了两个设置：

- `max_file_mb`，默认 300，超过的文件只记成链接，写上大小
- `skip_types`，整类不下：`pdf`、`slides`、`docs`、`sheets`、`archives`、`images`、`audio`、`code`

只想这一次不一样的话，`monash sync --videos`、`--max-mb 50`、`--skip-types archives` 都不会改设置

Moodle 的地址很多时候看不出是什么文件，资源是 `view.php?id=…`，真正的文件可能在一个没有扩展名的 CloudFront 链接后面

所以判断放在拿到响应头之后、写文件之前：真名字看 `Content-Disposition`，类型看 `Content-Type`，大小看 `Content-Length`

服务器不给大小的话，就边下边数，超了马上停，半个文件也会删掉

Moodle 文件夹是整包 zip 下来的，现在里面的文件也按同样的规则处理，顺便修了一个旧问题：以前关了 `download_videos`，文件夹 zip 里的录像还是会被解压出来

## 只会跳过还不够

上限有用的前提是你看得到它拦了什么，不然等到考试前一晚才发现作业要的数据集根本没下下来

所以每个跳过的文件都会记进一张表，`monash sync` 完会列出这次新跳过的，`monash skipped` 列出全部：

```text
FIT2109
  [3] Week 05/Dataset.csv（太大，512 MB）
  [7] Week 09/Project data/raw.zip（太大，1200 MB）
```

然后有两种补法：

- 只要一两个就 `monash skipped --get 3`，不受上限限制，开始前会先看硬盘空间够不够
- 要很多个就 `monash sync --max-mb 2000`，已经下好的不会重下，只补之前跳过的

也可以直接问 AI 软件“有哪些文件没下载？”，再说“把 dataset 那个下下来”

编号就是表里的行号，同步时是原地更新，不是删了重插，所以后台又同步一次之后，你刚看到的编号还是同一个

正是这个小决定，让你过几分钟再输 `--get 3` 也不会下错文件

## 顺手发现的两个问题

**单独同步一门课没有加锁**：完整同步会拿一把锁，保证 AI 软件每小时的后台同步和终端里的同步不会一起跑，但 `monash sync FIT2109` 和 `monash export --sync` 没拿

两边同时同步同一门课的话，一边可能把另一边下到一半的文件删掉

现在它们和新的 `--get` 都用同一把锁，后台正在同步就提示你等它跑完再试

**Windows 保留的文件名**：叫 `CON.pdf` 或 `NUL` 的文件在 Windows 上根本存不了，这个文件每次同步都会失败，现在这类名字前面会加个 `_`

## 没做的

我考虑过并发下载，但文件夹本来就是一个 zip，工具也故意让请求之间隔 0.4 秒，不给 Moodle 突发的压力

改成并发要给 cookie 和数据库加锁，收益不大，所以还是一个一个下

以上都能在[更新日志](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)里核对，使用说明在 [docs.secureview.tech](https://docs.secureview.tech/zh-cn/study-kit/cli/#选择下载哪些文件)
