---
layout: post
date: 2026-11-01 07:40:00 +0800
project: Homelab
description: "Linux 巡检会记录状态，只在出新问题和恢复时提醒，自动修复也有次数限制"
ref: stateful-alerts
lang: zh-Hans
title: "只在状态变化时发的服务器告警"
image: /assets/og/stateful-alerts-zh.png
source_repo: edge-fleet-ops-automation
source_checked: 2026-11-01
---

有几台 Linux 机器时，最先想到的监控通常是定时 SSH 上去看看磁盘和容器，有问题就发消息

一开始这样够用，但一个故障持续几个小时，每次检查都会再发一遍，几十条一样的告警里，新的问题反而容易被漏掉

## 记录每次检查的状态

[Edge Fleet Ops Automation](https://github.com/Waldo0926/edge-fleet-ops-automation) 是我以前给 Linux 边缘节点用的工具，脱敏后重新整理过，值得再用的是节点发现、健康检查、保存状态和告警去重

磁盘第一次超过阈值时发一条，后面十次检查不再重复，恢复时再发一条，要求连续几次失败才告警，也能避免网络短暂断开时误报

## 自动修复要有限制

删文件、重启服务、清磁盘空间都可以自动做，但做错了可能让问题更严重，我会先用 dry run 跑，每个操作范围尽量小，再逐个决定哪些可以无人值守

公开仓库不代表这些工具现在跑在我的 J1900 或 N1 上，它记录的是我重新搭监控时想沿用的做法
