---
layout: post
date: 2026-11-01 04:10:00 +0800
project: Homelab
description: "两台 J1900、一台 Debian N1 和一台 VPS，哪些服务一直开着，哪些可以随时重装"
ref: spare-machines
lang: zh-Hans
title: "两台 J1900 和一台 N1 上跑什么"
image: /assets/og/spare-machines-zh.png
---

我把两台旧的 J1900 重新弄好了，另外还有一台装 Debian 的 N1，以及放公开服务的 VPS

在决定上面再跑什么之前，我想先弄清楚其中一台坏了会丢掉什么

## 不是所有东西都放在家里

公开的网站都在 VPS 上，HTTPS、自动部署和监控都已经有了，在家里再复制一套用处不大，家里的公网 IP 会变，停电、硬盘坏、路由器重启也更难处理

目前的打算是大一点的 J1900 做备份或备用机，另一台 J1900 用来做实验，N1 当一个小的 Debian 测试节点，这些只是计划，现在还没有自动切换，有的机器平时可以直接关着

## 把恢复步骤写下来

我想先写清楚 VPS 或某块硬盘坏了以后会怎样：

- 哪些数据只有一份
- 能不能在一台新机器上恢复数据库和对应的文件
- 家里 IP 变了以后怎么 SSH 进去
- 哪些任务要定时跑，哪些只在需要时手动跑
- 告警是报告新的故障，还是一整天重复同一句话

装好 Debian 并不能回答这些问题

## 以前的项目

我以前写过 [iKuai 网络自动化](https://github.com/Waldo0926/homelab-network-automation)和 [Linux 节点巡检](https://github.com/Waldo0926/edge-fleet-ops-automation)，公开的仓库是脱敏后重新整理的版本，不代表现在这几台机器上跑着这些工具

里面有些做法我想继续用：记录告警状态、连续检查几次再处理、限制自动操作的范围、默认先 dry run，等真正做完一次恢复演练，再单独写结果
