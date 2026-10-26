---
layout: post
date: 2026-10-26 09:30:00 +0800
project: Monash Hub
description: "Monash Hub 现在可以添加到手机主屏幕，没信号也能打开看过的页面。为什么 service worker 永远先走网络，哪些东西坚决不存，以及开着好几天的应用怎么拿到新版本。"
ref: offline-app
lang: zh-Hans
title: "能离线用，但有新版本时绝不显示旧页面"
image: /assets/og/offline-app-zh.png
---

同学查 [Monash Hub](https://monashhub.secureview.tech) 的时候，可能在公交上、在地下的阶梯教室里，或者为了省流量关了数据。10 月 24 日我让它可以“安装”：能添加到手机主屏幕，有自己的图标，像应用一样全屏打开，没信号时也能打开已经看过的页面（[#207](https://github.com/Waldo0926/monash-hub/pull/207)）。

我没有做原生应用。一个 web app manifest 加一个 service worker，同一套代码就能覆盖 iPhone Safari、安卓浏览器和电脑上的 Chrome。难的是决定 service worker 能做什么、不能做什么。

## 只有一条规则：不能比服务器旧

service worker 可以先从缓存里拿内容，让网站看起来更快。对 Monash Hub 来说这不划算。一个旧了一周的课程页或选课指南，可能让同学填错表。所以 `sw.js` 开头的注释写明了它是干什么的：

> 把 Monash Hub 加到主屏幕的同学，没信号时可以打开已经看过的课程、学位和指南页面。就这些。它不是用来让网站在有网时变快的，也绝不能让同学看到比服务器上更旧的内容。

每个页面和接口请求都先走网络。只有完全连不上网络时，才用存下来的副本：

```js
async function networkFirst(event, cacheName) {
  try {
    const response = await fetch(event.request)
    save(event, cacheName, response)
    return response
  } catch (error) {
    const saved = await caches.open(cacheName).then(cache => cache.match(event.request))
    if (saved) return saved
    throw error
  }
}
```

服务器返回 404 或 500，照原样交给页面。这不算网络故障，所以不会退回旧副本。显示存下来的页面时，页面上会提示现在没有网络，内容可能不是最新的。

## 哪些东西坚决不存

值得离线看的只有资料类页面：首页、课程、学位、指南，还有课程地图、先修树和分数计算器，它们本来就把数据存在浏览器里。所有实时的、个人的东西都故意不存：

```js
/* The API calls those pages make. Reviews, community, auth and search are left out on purpose. */
const OFFLINE_API = [
  /^\/api\/v1\/units(\/|$)/,
  /^\/api\/v1\/courses(\/|$)/,
  /^\/api\/v1\/guides(\/|$)/,
  /^\/api\/v1\/(faq|key-dates)$/,
  /^\/api\/v1\/exchange$/,
  /^\/api\/v1\/marks\/(reference|units)$/
]
```

而且只存完整、成功的响应：

```js
function save(event, cacheName, response) {
  if (response.status !== 200 || response.type !== 'basic') return
  if ((response.headers.get('Cache-Control') || '').includes('no-store')) return
  ...
}
```

这条规则让页面那边也要改一处。接口出错时，课程、学位和指南的列表页面还是返回 200 状态，显示一张错误卡片。service worker 会把这张卡片存下来，盖掉原来好的副本。现在它们和详情页一样返回 503。

还有两个小细节：

- 存下来的页面是当时的语言。读者切换语言时，存的页面全部删掉。接口的响应在网址里带着语言，可以留着。
- 缓存名字里有 `VERSION`，缓存规则一改就加一。新的 worker 会删掉旧 worker 建的所有缓存，按旧规则存的东西一样都不留。

## 从没打开过的页面

离线时，打开一个从没存过的页面，会显示一个离线页，用读者的语言，列出已经存了哪些页面。在应用里点链接，平时是从接口拿数据，而接口的响应只存了一部分。所以手机离线时，点链接会改成整页加载，这样 service worker 就能返回存下来的页面或者离线页。

## 开着好几天的应用

先走网络，意味着下次加载页面就是新版本。剩下的情况是应用在手机上一开好几天。Nuxt 发现新版本后，下次跳转就会重新加载，但它一小时才检查一次，而手机会在应用退到后台时暂停计时器。

所以应用回到前台时也检查一次，最多五分钟一次：

```ts
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForNewBuild()
})
```

`checkForNewBuild` 会让浏览器检查 `sw.js` 有没有更新，并且对比当前运行的版本号和 `/_nuxt/builds/latest.json`。不一样的话，下次点链接就加载新版本。

## 告诉大家可以安装

大部分同学不知道网站可以加到主屏幕，不同浏览器的步骤也不一样。在手机上看过几个页面后，会出现一行提示，说明 iPhone Safari、安卓浏览器（包括华为、小米、OPPO、vivo）和微信里怎么操作。点“不再显示”就永远不出现，页脚里也有同样的步骤。

## 怎么测试

CI 里的 Playwright 测试覆盖了容易坏的地方：

- manifest 的名字、介绍和快捷方式，中英文都对，每个图标都存在
- 看过一次的课程页，断网后还能打开，并显示“现在没有网络”的提示，同时评分和社区的请求从来没被存过
- 从没打开过的页面显示离线页，网络恢复后点“重试”能正常打开
- 找不到的课程不会被存
- 安装提示要看过几个页面才出现，关掉后不再出现

## 小结

- 写 service worker 之前先想清楚它是干什么的，写在文件开头。
- 先走网络，只有真正连不上才用缓存，出错的响应永远不存。
- 装到主屏幕的应用可能一开好几天，回到前台时检查有没有新版本。

代码：[sw.js](https://github.com/Waldo0926/monash-hub/blob/main/frontend/public/sw.js)、[pwa.client.ts](https://github.com/Waldo0926/monash-hub/blob/main/frontend/plugins/pwa.client.ts)、[pwa.spec.ts](https://github.com/Waldo0926/monash-hub/blob/main/e2e/tests/pwa.spec.ts)。
