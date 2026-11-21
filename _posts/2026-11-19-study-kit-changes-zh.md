---
layout: post
date: 2026-11-19 09:00:00 +0800
project: Study Kit
description: "在本机记录课程里新上的文件、改过的作业说明、调整的截止时间和老师的新回复"
ref: study-kit-changes
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "Study Kit 1.12：monash changes"
tags: [Python, SQLite, Moodle, Ed]
image: /assets/og/study-kit-changes-zh.png
---

每周群里都有人问：A2 是不是延期了？老师是不是改了 spec？Moodle 不会告诉你，只能靠自己记得上周写的是什么再对一遍

[Study Kit](https://github.com/Waldo0926/monash-study-kit) 本来就会把每门课同步一份到我电脑上，所以 1.12 里我让它记住上次看到的东西，再告诉我哪里不一样了

## 它显示什么

```bash
monash changes --days 7
```

会列出新上传或改过的课件、被重写的作业说明、挪过的截止时间（新旧时间都写出来），还有 Ed 上老师的新回复，每一条都有课号、改动类型和原文链接

在 AI 里问“这周我的课有什么变化”，或者看 `study todo`，也是同一份列表

## 怎么做的

全部在 `changes.py` 和本机的一个 SQLite 文件 `changes.db` 里

平时同步的时候，每一项都会算一个指纹：课件、Ed 里的文件和存下来的作业说明，算的是文件的 SHA-256；截止时间直接比时间；Ed 上老师的帖子和回复，算的是正文的 SHA-256，下次同步再比指纹

这个功能不会为了比较多请求一次 Moodle 或 Ed，只看同步本来就下载下来的东西

每次同步都把所有 PDF 重新算一遍哈希太慢了，所以文件会在哈希旁边记下路径、修改时间和大小，这三样都没变就直接用旧的哈希

## 我比较在意的三条规则

**第一次同步只建基线**：第一次看到某门课时，只把所有东西记下来，什么都不报

不然刚装好就会说这门课的每个文件都是“新的”

**从不报“被删除”**：某次同步里少了一项，可能真是被删了，也可能是页面加载到一半超时了

这两种情况分不清，所以记录里只有新增和修改，错报一句“作业说明被删了”比什么都不说更糟

**会忘记**：超过 90 天的记录会删掉，最多只留 5000 条

## 花时间最多的部分

变更记录要靠得住，前提是同步本身靠得住，所以 1.12 大部分改动其实在这上面

以前 Moodle 宕机或者限流，看起来和登录过期一模一样，现在能分开了

安全的读取会隔一会儿再试，只成功一半的同步会照实说出来，不再报成功

`monash sync --retry-failed` 只重试上次失败的活动、帖子和 Lessons，不用整个学期重新拉一遍

其他改动见 [1.12.0 的更新记录](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)，包括带夏令时的澳洲时区（`monash config timezone Australia/Melbourne`）
