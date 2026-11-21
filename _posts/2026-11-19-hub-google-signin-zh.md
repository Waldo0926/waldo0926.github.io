---
layout: post
date: 2026-11-19 11:10:00 +0800
project: Monash Hub
description: "账号按邮箱对应，所以登录会检查签名的 state 和已验证的邮箱，会话令牌也不会出现在服务器日志里"
ref: hub-google-signin
lang: zh-Hans
source_repo: monash-hub
source_checked: 2026-11-19
title: "Monash Hub 加入 Google 登录"
tags: [Python, FastAPI, OAuth, Security]
image: /assets/og/hub-google-signin-zh.png
---

Monash Hub 一开始就有邮箱加密码的账号，后来有人想要像 MonMap 那样直接用 Google 登录，所以现在登录页和注册页都多了一个按钮，已经上线了

按钮本身很好做，主要要想清楚的是：用 Google 登录时，怎么找到对应的 Hub 账号

因为找对账号的那条路，同样也可能找错

## 按邮箱对应，所以邮箱必须是真的

用 Google 登录时，按邮箱地址去找已有的账号，如果你之前就用同一个 Gmail 注册过，会直接进到原来的账号，昵称也不变，不会多出一个新账号

反过来说，谁能让 Google 替你的邮箱作证，谁就能用你的身份登录

Google 返回的信息里有一个 `email_verified`，不是 true 的话回调直接拒绝登录，这个情况专门写了测试

## state 参数

OAuth 会把一个 `state` 发给 Google，回调时再原样带回来，我这里的 state 是签名的，不存数据库

它是用服务器密钥算的 HMAC，里面有一个随机 nonce、十分钟后的过期时间，还有登录完要回到哪个页面

同一个 nonce 也会写进一个 HttpOnly 的 cookie，只在 `/api/v1/auth/google` 这个路径下有效，SameSite 设成 Lax

用 Lax 是因为回调是从 Google 网站跳回来的，设成 Strict 的话这一次跳转不会带上 cookie

回调两样都查：服务器没签过的 state 直接拒绝，state 是真的但浏览器里没有对应 cookie，也拒绝

少了第二步的话，别人可以用自己的 Google 账号开始登录，停在回调那一步，把链接发给你，你一点就登进了他的账号，之后你存的东西他都能看到

登录后回到哪一页也放在签名的 state 里，而且只接受本站的路径，`//evil.example` 这种绝对地址会被换成 `/`

## 故意不验 ID token 的签名

一般来说 ID token 要验签名，但这里的 token 根本不经过浏览器

服务器拿着一次性的 code，用 client secret 通过 TLS 直接去 Google 的 token 接口换，ID token 就在这个响应里，这条路上再验一次签名没有意义

issuer 和 audience 还是会查，发给别的应用的 token 一样会被拒绝

## 登录令牌放在 # 后面

登录成功后，回调会跳到 `/auth/google#token=...`

浏览器从来不会把 `#` 后面的内容发给服务器，所以这个令牌不会出现在 API、nginx 或中间任何代理的访问日志里，回调页面一加载就先把它从地址栏里清掉

## 一些小地方

- Google 会记住上次登录的账号，在学校公用电脑上，下一个人可能不知不觉就登进了上一个人的账号，所以请求里加了 `prompt=select_account`，每次都让你选
- Hub 的昵称不能有空格，这是为了防止有人冒充别人，所以 Google 名字 “Waldo Wen” 会变成 “WaldoWen”，被占用了就在后面加数字
- 用 Google 建的账号没有密码，数据库里存的是一个任何输入都对不上的哈希，而不是空值
- 双击或者开了两个标签页，可能会同时创建同一个账号，后到的那个会直接用前一个刚建好的账号
- 出错时登录页会显示具体原因：取消了、邮箱没验证、账号被停用
- 只有服务器说已经配置好了，按钮才会出现，Google 的图标是内嵌的，登录页仍然不会向第三方发请求

## 密钥

这个 PR 里没有任何凭据，OAuth client 是我自己在 Google Cloud 建的，client ID 和 secret 也是我自己放进服务器 `.env` 再重新部署的，在那之前按钮根本不显示，别的也都不受影响

PR 里有 25 个测试，包括伪造、篡改和过期的 state，在另一个浏览器打开回调，发给别的 client 或 issuer 的 token，没验证的邮箱，被停用的账号，昵称冲突，两个首次登录同时进来，还有那个对不上任何输入的密码哈希
