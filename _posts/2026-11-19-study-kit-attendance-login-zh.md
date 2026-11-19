---
layout: post
date: 2026-11-19 10:00:00 +0800
project: Study Kit
description: "Study Kit 1.14 会在考勤登录过期时，用你电脑上已有的浏览器登录状态自己试着登回去，Monash 要密码或 MFA 时就停下，它怎么判断、多久试一次，以及它保证不了什么"
ref: study-kit-attendance-login
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "不碰密码，让考勤登录别那么容易掉"
tags: [Python, Playwright, SSO, Privacy]
image: /assets/og/study-kit-attendance-login-zh.png
---

Study Kit 可选的考勤功能会去读 Monash 的考勤门户，AI 才能告诉你哪几节课还没签到

最大的问题是登录：隔一阵就会过期，而且往往是 AI 说“读不到考勤”时才发现，然后得重新跑一次 `monash attendance login`，偏偏都是赶着要答案的时候

1.14 想在完全不碰密码的前提下把这件事做好一点

## 它做什么

```bash
monash attendance maintain
```

它会检查考勤登录还能不能用，过期了的话，就用 Study Kit 本来为考勤单独保存在你电脑上的那个浏览器登录状态，悄悄打开门户

如果 Okta 在那个浏览器里还记得你，门户会自己登回去，你什么都不用做

如果 Monash 要你输密码或 MFA，它就停下来报告 `needs_login`，由你自己运行 `monash attendance login`

`monash attendance renew --timeout 30` 是手动试一次同样的静默恢复

## 它守的规矩

- **从不替你输入**：密码、MFA 验证码都不碰，留给你自己
- **失败了会等**：认证失败以后一小时内不再试，免得一直去戳 Okta  
  换了新的登录状态文件（比如你刚重新登录过）会马上重新检查
- **不把网络问题当成登录过期**：超时或证书错误就照实报告
- **不丢掉能用的东西**：恢复失败时保留之前的登录状态，不会覆盖掉
- **一次只用一个**：本机浏览器登录状态同一时间只给一个进程用，两个 Study Kit 进程不会抢

## 它保证不了的

登录里 Okta 那部分只存在于你登录的那台电脑上，能复用的只是考勤门户自己的登录状态，Okta 的登录状态从不导出

所以它只在同一台电脑上有效，电脑睡眠或断网时，登录照样可能过期

它让平时的情况顺一点，但不是绕过登录的办法

1.14 之前，后台任务续期失败也会算成成功，问题就被藏起来了，现在会如实报告

完整改动见[更新记录](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)
