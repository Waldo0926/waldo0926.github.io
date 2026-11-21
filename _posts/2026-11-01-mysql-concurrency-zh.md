---
layout: post
date: 2026-11-01 07:30:00 +0800
project: SecureView
description: "连接池耗尽和死锁，是文件分享系统有多人同时使用后才出现的问题"
ref: mysql-concurrency
lang: zh-Hans
title: "SecureView 的并发测试"
image: /assets/og/mysql-concurrency-zh.png
source_repo: SecureView
source_checked: 2026-11-01
---

SecureView 是我们四个人的毕业设计，一个在浏览器里加密文件的文件分享系统，我负责测试、CI、部署和一部分安全功能

一个人演示时看到的是加密、上传、分享和解密，后来我花了更多时间在数据库连接、并发请求和失败之后的处理上

## 和加密无关的上传失败

100 个用户的压测发现了连接池的问题，修好之前有很多上传失败，测试结果写在项目 README 里，这篇不再给新的数据

我们还遇到过 MySQL 死锁，原因在事务边界和锁行的顺序，只上传一个文件时根本碰不到

## 每个修复都配一个测试

修好一个并发问题后，我会写一个能重现它的测试，手动重试几次刚好成功说明不了什么，MySQL 测试、浏览器测试和故障注入就是用来防止同样的问题再出现

要弄清一次死锁，需要知道哪些语句锁了哪些行、重试怎么做、写入到底有没有完成，光看报错信息是不够的

以前的测试数据和环境说明在 [SecureView 仓库](https://github.com/Waldo0926/SecureView)里，这篇只是回顾测试过程，不代表现在部署的性能
