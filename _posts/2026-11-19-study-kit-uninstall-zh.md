---
layout: post
date: 2026-11-19 11:20:00 +0800
project: Study Kit
description: "删掉令牌文件，并不等于收回了背后的授权，Study Kit 1.15.0 卸载时会先向 Google 吊销 Drive 和 Gmail 的授权再删数据，吊销失败就什么都不删"
ref: study-kit-uninstall
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "卸载的时候，授权也要收回来"
tags: [Python, OAuth, Google, Privacy]
image: /assets/og/study-kit-uninstall-zh.png
---

[Study Kit](https://github.com/Waldo0926/monash-study-kit) 可以选择读你的 Google Drive（有些课件放在 Google Docs 里）和学校的 Gmail，两者都走 Google OAuth，令牌存在你自己电脑上的 `secrets` 文件夹里

1.15.0 之前，`monash uninstall` 会问要不要删除所有数据，然后把整个文件夹删掉，看起来很干净

但删掉令牌文件，只是删了你手里那把钥匙，授权本身还留在 Google 那边

在 Google 账号的“有权访问你账号的第三方应用”里，Study Kit 会一直挂着，除非你自己去那里删，而大部分人根本不会去看

## 现在怎么做

删除任何东西之前，`monash uninstall` 会先把能找到的 Google 授权都吊销掉：

- 默认账号的 Drive 和 Gmail 令牌
- 每个命名 profile 里的这两个令牌（比如有两个 Monash 账号的人，或者单独开了只看课件的 profile）

吊销就是向 `https://oauth2.googleapis.com/revoke` 发一个 POST，令牌放在请求体里，不会出现在网址中，发的是 refresh token，因为吊销它就等于结束整个授权

如果 Google 回 `400 invalid_token`，说明授权早就失效了，可能是过期了，也可能你之前已经在 Google 那边删过，这种情况就当作已经吊销

## 吊销失败，就什么都不删

其他失败，比如没网或者 Google 报错，卸载会在动你文件之前停下来，说明原因，让你联网后再跑一次，或者先去 [myaccount.google.com/permissions](https://myaccount.google.com/permissions) 手动撤销

顺序很重要，如果先删再吊销，一旦吊销失败，授权还活着，手里却没有令牌可以用来吊销了，留着文件就随时可以重试

小一点的命令也是同样的规则：删除某个 profile 会先吊销它的 Google 令牌，退出 Gmail 也是先吊销再删令牌文件

## Ed 不一样

Ed 没有吊销令牌的接口，所以最后 Study Kit 会打印 Ed API 令牌设置页的链接，请你自己去那里删

这件事我宁愿直接说清楚，也不想假装卸载已经全部处理好了

## 1.15.0 上了 PyPI

1.15.0 也是 1.11.2 之后第一次发到 PyPI

1.12 到 1.14 都合进了 main，但一直没打 tag，所以从 PyPI 装的人一直停在 1.11.2

之前装过的话，跑一次 `monash update`，就能拿到这之后的所有改动：`monash changes`、看自己交的作业、考勤登录恢复，还有这次的卸载修复

我自己在 Mac 上遇到过一个情况：更新时 uv 重建了环境，旧的 `monash` 进程最后会报 `ImportError: cannot import name 'update_check'`

这时新版本其实已经装好了，跑一下 `monash --version` 就能确认，这个报错的修复正在 1.15.1 里审
