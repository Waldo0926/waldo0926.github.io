---
layout: post
date: 2026-10-26 08:30:00 +0800
project: Ed Web
description: "Ed Web 在浏览器里读 Ed 论坛，没有后端。这次改版加了只抓变化帖子的增量刷新、说得清楚的“新”标记、安全地渲染 Ed 的正文格式，还支持了 Ed 的 API 令牌。"
ref: ed-web-redesign
lang: zh-Hans
title: "在浏览器里刷新 Ed 论坛，不用每次全部重抓"
image: /assets/og/ed-web-redesign-zh.png
---

[Ed Web](https://github.com/Waldo0926/ed-web) 是一个静态网页：直接从 Ed 的接口抓一门课的 Ed Discussion 论坛，存进浏览器的 IndexedDB，离线也能看、筛选和搜索。没有后端，token 存在 `sessionStorage` 里，只发给 `edstem.org`。

它是我自己服务器上一个私人学习工具的公开版。10 月 25 日我给 Ed Web 改了版，把私人工具里能在浏览器里做的部分搬了过来（[#6](https://github.com/Waldo0926/ed-web/pull/6)）。这篇讲这几部分。

## 只刷新变了的帖子

旧版每次刷新都把所有帖子和回复重抓一遍。大的课有几百个帖子，Ed 又限流，刷新要等很久，有时还会遇到 429。

Ed 的帖子列表很便宜，100 个帖子一个请求。抓一个帖子的回复则是一个帖子一个请求。所以现在刷新先读列表，给每个帖子算一个指纹，只有指纹变了才重抓整个帖子：

```js
/* 跟私人工具的 content_stamp 一样：updated_at 之外再带几个计数和状态位，
 * 这样只有内容真变了才重抓正文。 */
function contentStamp(t) {
  return [t.updated_at, t.reply_count, t.unresolved_count, t.vote_count, t.is_staff_answered,
          t.is_answered, t.is_locked, t.title].map((x) => String(x ?? '')).join('|');
}
```

只看 `updated_at` 不够。新回复或者老师回答不一定会改它，但一定会改某个计数或状态位。

Ed 真的返回 429 时，浏览器能读到 `Retry-After` 就按它等，读不到就依次等 1.5、3、4.5 秒。

## “新”是什么意思

“新”标记只有在表示“上次看过之后才出现的”时才有用。现在每个帖子和回复都存一个 `first_seen`，也就是这个浏览器第一次见到它的时间。每次刷新记下开始的时刻，在那之后第一次见到的就是新的：

```js
function isFresh(firstSeen) {
  return !!STATE.prevSyncedAt && !!firstSeen && firstSeen >= STATE.syncedAt;
}
```

第一次抓的时候没有可比的，就退回“48 小时内发的”。以前就有的帖子，显示有几条新回复。

## 安全地渲染 Ed 的正文

Ed 用自己的 XML 存帖子：`<document><paragraph>...`，里面有 `<link>`、`<snippet>`、`<image>`、`<file>`、列表、表格和提示框。旧版把它全部转成纯文本，代码的格式乱了，附件也没了。

现在 `docToHTML` 用 `DOMParser` 解析，再遍历整棵树。有两条规则保证安全：

- 每一段文字写进页面之前都经过 `esc`，帖子里的任何标签都不会原样输出。
- 链接、图片、附件和视频，只有地址以 `http://` 或 `https://` 开头才做成链接。其他的，比如 `javascript:`，只显示成文字。

```js
const safeHref = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null);
```

XML 解析失败的话，退回纯文本，而不是显示一张空卡片。

## 一句话结论取对的人

每张帖子卡片在标题下显示一句话，以前是帖子的开头。对提问帖来说，有用的通常是回答，所以现在取最后一条老师的回复，因为后面的老师回复经常会更正前面的。没有老师回复的提问帖，显示同学的回答，并标明是同学答的。其他帖子显示帖子本身。

## API 令牌

Ed 有两种 token。网页版存在 `localStorage` 里的是 JWT，14 天过期。在 Ed 设置里生成的 API 令牌不会过期，可以在那里撤销。两种用的请求头不一样：

```js
function authHeaders(token) {
  return tokenKind(token) === 'jwt' ? { 'x-token': token } : { authorization: 'Bearer ' + token };
}
```

页面会从 JWT 的 `exp` 字段读出还剩几天。有一点我还没能验证：Ed 的跨域设置允不允许网页发送 API 令牌。README 里写明了这一点，请求被拒的话，页面会提示，并建议换回浏览器 token。

## 其他小改动

- 搜索要求每个词都出现，不是只要有一个。
- 可以按收藏、关注、我发的筛选，也可以筛出 Ed 记录里你还没看过回复的帖子。
- 被删回复下面的子回复保留，因为 Ed 网页上也还显示。
- 课程内容会存阅读页的正文和测验题，也能搜索。

## 没有后端的页面怎么测

抓取和渲染的逻辑都在一个 `app.js` 里，没有构建步骤。`tests/sync.test.mjs` 按标记字符串把需要的函数从 `app.js` 里切出来，在 Node 里执行，不连网。README 里的截图是对着一个假的 Ed 接口拍的，课程、人和帖子都是编的，仓库里没有任何真实的课程数据。

## 小结

- 一个便宜的列表，加上每一项的指纹，就能把全量刷新变成小刷新。
- “新”应该从上次刷新算起，而不是从发帖时间算。
- 渲染别人写的标记时，所有文字都转义，只放行你想要的链接协议。

代码：[app.js](https://github.com/Waldo0926/ed-web/blob/main/app.js)、[ARCHITECTURE.zh-CN.md](https://github.com/Waldo0926/ed-web/blob/main/ARCHITECTURE.zh-CN.md)、[sync.test.mjs](https://github.com/Waldo0926/ed-web/blob/main/tests/sync.test.mjs)。使用指南：[docs.secureview.tech/zh-cn/ed-web](https://docs.secureview.tech/zh-cn/ed-web/)。
