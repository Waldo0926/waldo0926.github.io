---
layout: post
date: 2026-10-26 10:00:00 +0800
project: Monash Hub
description: "Monash Hub 的选课规划不用注册账号。规划怎么通过一个服务器收不到的链接搬到另一台设备，首页怎么显示真实的搜索词却只存词、日期和次数，以及一条要改正的隐私说明。"
ref: plan-code-and-searches
lang: zh-Hans
title: "服务器看不到的规划码，和不记人的热门搜索"
image: /assets/og/plan-code-and-searches-zh.png
---

[Monash Hub](https://monashhub.secureview.tech) 的选课规划不用登录，规划存在浏览器的 `localStorage` 里。这样服务器碰不到规划，但规划也就只能留在一台设备上。

这周有两个改动碰到同一个问题：服务器到底需要知道多少？这篇讲这两个改动，还有一处网站说得不够实在的地方。

## 不用账号，把规划搬到另一台设备

原来已经有导出 JSON 文件的功能。电脑上没问题，手机上文件会进下载文件夹，还要发出去再打开，大部分人不会这么做。

一行文字就方便多了，任何聊天软件都能发，包括微信的“文件传输助手”。所以课程地图“更多”菜单里新加了“复制规划码”，把规划写成一行能看懂的文字（[#235](https://github.com/Waldo0926/monash-hub/pull/235)）：

```
MH1|<名称>|<入学年份>|<年数>|<校区>|<专业>|<学期>|<课程>

MH1|My%20plan|2026|3|Malaysia|C2001|S1;S2|FIT1008@0.0,FIT2004@1.1
```

学期用简写。每门课写成 `代码@第几年.第几个学期`，年份从入学那年算起，学期是在学期列表里的位置。文字字段做了 URI 编码，所以 `|` 只会是分隔符。我没有压缩它，这样同学能看出里面写了什么，聊天软件识别链接时也不会把它弄乱。

按钮复制的是一个链接，规划码放在 `#` 后面：

```ts
function planLink(): string {
  return `${window.location.origin}/plan#plan=${encodeURIComponent(encodePlan(plan.value))}`
}
```

浏览器从来不会把 `#` 后面的部分发给服务器。页面自己读出来，作为一个新规划打开，再把规划码从地址栏去掉，免得刷新时又导入一次：

```ts
function readHash() {
  const hash = window.location.hash
  if (!hash.includes('plan=')) return
  const code = findPlanCode(hash)
  if (code) importCode(code)
  history.replaceState(history.state, '', window.location.pathname + window.location.search)
}
```

`findPlanCode` 接受单独的规划码、整个链接，或者中间夹着规划码的一段消息，因为大家会把聊天软件给的东西整段粘进来。解出来的规划和导入文件走同一个 `sanitise` 函数，手动改坏的规划码也写不进奇怪的数据。

它做不到的：拿到链接的人都能打开这个规划。链接本来就是干这个的。规划里只有课程代码，没有成绩，也没有名字，除非同学自己把名字写进规划标题。

## 隐私说明写错了

改课程地图的时候，我重新读了下面那行说明。它写的是规划“不会上传”。这不对。检查规划时，课程代码、学期和校区会发给 `/v1/plan/check`，由它算先修课和冲突。

现在说明照实写了这一点，并说明服务器不保存这些内容（[#231](https://github.com/Waldo0926/monash-hub/pull/231)）。“只保存在这个浏览器”也挪到了规划名字旁边，免得有人以为规划存进了账号。

## 首页的“热门搜索”是编的

首页搜索框下面原来有一排六个词，标着“热门搜索”（英文是 Often searched）。其实是代码里写死的，网站根本不记录搜索。在 [#227](https://github.com/Waldo0926/monash-hub/pull/227) 里我先把它们改成“试试搜”，标明是例子。

然后才做了真正的版本（[#237](https://github.com/Waldo0926/monash-hub/pull/237)）。问题是：怎么统计搜索，又不留下任何关于搜索的人的信息。

## 只存一个词、一个日期和一个次数

新的 `search_terms` 表里，每一行只有搜索词、日期和次数。没有 IP，没有账号，也没有具体时间。一次搜索只算一次，而且只有搜到了东西才算：

```python
def normalise(query):
    term = " ".join(query.split())
    if not 2 <= len(term) <= 60 or len(term.split()) > 4:
        return None          # 一整句话不算搜索词
    if "@" in term or "://" in term or LONG_NUMBER.search(term):
        return None          # 邮箱、链接、电话或学号
    return term
```

邮箱、粘贴的链接，或者连着六位以上的数字，不管搜到什么都不存。

## 一个人不应该能决定首页显示什么

网站不大。如果不加限制，一个人把同一个词搜三十遍，它就会出现在所有人的首页上。所以首页读的列表有两道限制：

```python
capped = func.sum(func.least(SearchTerm.hits, DAILY_CAP))   # 每天最多算 20 次
rows = db.execute(
    select(SearchTerm.term, func.max(SearchTerm.label), capped.label("hits"))
    .where(SearchTerm.day >= since)                            # 最近 14 天
    .group_by(SearchTerm.term)
    .having(func.count(func.distinct(SearchTerm.day)) >= 2)   # 至少两天有人搜
    .order_by(capped.desc(), SearchTerm.term)
    .limit(limit)
).all()
```

一个词一天最多加 20 次，而且要在两个不同的日子被搜过。超过 60 天的记录会删掉。符合条件的词不到三个时，首页还是显示那六个例子，并标明是例子。

这两道限制只是提高了成本，不是做不到：有人连着两天搜同一个真实的词，还是能让它上榜。不过只有在站内搜到东西的词才会被统计，所以最坏的情况是，一个真实的课程代码或话题上了榜，其实没多少人搜过。

## 小结

- 网址 `#` 后面的部分，可以在你自己网站的两个页面之间传数据，不经过服务器。
- 每加一个功能，都重新读一遍隐私说明。我的那句写的时候是对的，过了几个功能就不对了。
- 要显示“热门”之前，先想清楚一个人能对它做什么。每天封顶、至少几天，这种限制成本很低。

代码：[planCode.ts](https://github.com/Waldo0926/monash-hub/blob/main/frontend/utils/planCode.ts)、[plan.vue](https://github.com/Waldo0926/monash-hub/blob/main/frontend/pages/plan.vue)、[popular.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/search/popular.py)。
