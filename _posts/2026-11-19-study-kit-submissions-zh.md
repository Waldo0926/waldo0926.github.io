---
layout: post
date: 2026-11-19 09:30:00 +0800
project: Study Kit
description: "Study Kit 能读你或你们组交过的作业和完整评语，让 AI 对照着帮你看"
ref: study-kit-submissions
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "Study Kit 1.13：读取已交作业和评语"
tags: [Python, Moodle, MCP, Privacy]
image: /assets/og/study-kit-submissions-zh.png
---

成绩出来以后，评语在 Moodle 的一个页面，自己交的文件在另一个页面，想弄清楚哪里扣分，得开两个标签页，再加一个评分标准

Study Kit 以前能看成绩，但看不到我到底交了什么，1.13 开始可以了

## 怎么用

在 AI 里这样问：

> 把我 A1 交的东西读一遍，对照老师的评语，具体说说哪里扣分

AI 会拿到你交的文件或在线文本，以及这份作业的完整反馈，放在一起看，终端里对应的是：

```bash
monash moodle submission <activity id> --json
```

activity id 用作业列表里的那个编号（`cmid`），不是课程 ID

## 它读什么

- 你或你们组交的文件，作业用在线文本的话也会读
- 这份作业完整的评分反馈
- PDF 可以按页读；你交的压缩包里的 PDF、DOCX、PPTX 也能读

视频不会自动转成文字，扫描版的 PDF 要先 OCR 才有字可读

## 文件存在哪

交过的作业用你自己的 Moodle 登录下载，单独放在 `data/submissions/` 里，不进课件库、全文索引和[整课导出]({% post_url 2026-11-03-study-kit-course-materials-zh %})，所以把导出的资料发给别人时，不会把你的作业一起发出去

每次读都会重新确认你还能看到这份作业、这个文件确实属于它，下载上限 256 MiB，Moodle 跳转下载时，cookie 不会跟着发到别的网站，只导课程资料的账号（用来导另一个账号课件的那种）完全读不了这些

## 它不做的事

它只读，不能交作业、重交，也不会改 Moodle 上的任何东西

它读的是已经批改完的作业的反馈，不做测验，也不是拿来答需要评分的作业的，只是帮你看懂已经拿到的评语

## 紧接着的一个修复

1.13.1 让作业列表里每一项都带上 `read_path`，AI 从成绩开始问的话，可以直接接着读交过的文件

这一版还修了几处：后面的下载被截断时保留之前完整的缓存；返回的是登录页时当作登录过期，不当成文件；折叠起来的在线文本只在提交区域里读

详细见[更新记录](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)
