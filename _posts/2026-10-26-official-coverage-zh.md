---
layout: post
date: 2026-10-26 11:30:00 +0800
project: Monash Hub
description: "一个周末，Monash Hub 收录的官方页面从 662 页变成 3100 页左右。页面列表怎么从两个网站的 sitemap 来，哪些页要剔掉，以及抓取失败为什么不再让页面下线。"
ref: official-coverage
lang: zh-Hans
title: "官方页面从 662 页到 3100 页，抓取失败也不丢"
image: /assets/og/official-coverage-zh.png
---

除了 Handbook，[Monash Hub](https://monashhub.secureview.tech) 还存了一份 Monash 官方的学生页面：选课、考试、签证、学费、毕业。网站会把它们翻成中文、能搜索，站内助手也从这里找答案。到 10 月 25 日之前，这份副本只有 662 页，是从几个入口页顺着链接走出来的。

这篇讲那个周末我把范围扩到 Monash 两个网站的全部学生页面，以及跟着出现的问题。

## 读 sitemap，不再顺着链接走

从入口页顺着链接走，只能找到菜单里链到的页面。Monash 两个网站都有 sitemap，里面列了每一页，包括没有任何菜单指向的页。所以爬虫现在直接读 sitemap（[#215](https://github.com/Waldo0926/monash-hub/pull/215)）：

- monash.edu.my：整个网站。
- monash.edu：students、admissions，以及 IT、商科、工程、理科几个学院的 sitemap，只留 `/students`、`/admissions` 和各学院的 `current-students` 部分。

整站的 sitemap 大部分不是给学生看的。一个正则把新闻、活动、校友、教职工主页、开放日、登录和反馈表单、验证文件，以及附件里的 PDF 和图片都去掉。剩下大约 3100 页。

已经收录的页面，就算不在 sitemap 里，只要还有正文就保留。Monash 换了地址的页面，保留原来的 slug 和翻译，挪到新地址。

## 再把不是指南的页面去掉

第一版列表太宽了。“选课与课程规划”这一类有 1331 页，因为学院的页面默认都归到选课。后面分三次清理：

1. **学院里不是指南的页面**（[#221](https://github.com/Waldo0926/monash-hub/pull/221)）：174 页，包括领导名单、排名、竞赛和相册、2005 到 2017 年的游学帖子、实验室页面和测试副本。学院页面现在只有地址和课程有关时才算选课。
2. **学生打不开的页面**（[#222](https://github.com/Waldo0926/monash-hub/pull/222)）：5 个 eExam 页面就算登录了也返回 “Access Denied”，所以直接去掉，不再留旧内容。学费计算器只是跳转到一个应用，改成一个链接。
3. **讲已经过去的年份的页面**（[#223](https://github.com/Waldo0926/monash-hub/pull/223)）：152 页，比如 2016 到 2025 年的 OSHC 价目表、往年的校历。

第三条写成了规则，明年一月照样生效：

```python
COMMENCEMENT_YEARS = 6  # 最长的双学位五年，再加一个学期休学

def outdated(url, title, year=None):
    year = year or date.today().year
    years = [int(y) for y in YEAR.findall(f"{urlparse(url).path} {title}")]
    if not years:
        return False
    if BY_COMMENCEMENT.search(f"{url} {title}"):   # 课程地图、“commenced”
        return max(years) <= year - COMMENCEMENT_YEARS
    return max(years) < year
```

课程地图是例外。学生一直按入学那年的课程地图走，所以 2026 年保留 2021 年以后的。`YEAR` 这个正则会跳过 C2001 这种课程代码，还有 “students who commenced from 2014” 这种写法，它们说的不是过去的某一年。

后来又发现一个员工工具：“Welcome to the Connect Tutor” 是 Monash Connect 给工作人员检查邮件回复用的（[#230](https://github.com/Waldo0926/monash-hub/pull/230)）。它在 sitemap 里，所以被放进了支持类指南。

## 以前一次抓取失败就会让页面下线

以前只要抓取失败，页面状态就变成 error，指南、搜索、重要日期和站内助手里都看不到它，直到下次抓成功。一次超时或者一次机器人验证，就能把内容还是对的页面藏起来。

这种情况后来不少见了。10 月 25 日起，Monash 马来西亚校区的网站开始拒绝服务器的 IP。当晚一次全量重抓，有 359 页被拒。按旧规则，这些页面会全部下线。

现在只有说明页面本身没了的回应才会让它下线（[#211](https://github.com/Waldo0926/monash-hub/pull/211)）：

```python
def record_failure(db, page, message, *, gone=False):
    page.fetch_error = message[:2000]
    if gone or not page.content_hash:      # 404 或 410，或者还没存过内容
        page.status = "error"
        page.last_checked = datetime.now(UTC)
    elif page.status == "error":           # 被旧规则藏起来的，恢复
        page.status = "ok"
```

403 或者超时，保留上一份好的内容，`last_checked` 也不动，因为读者看到的“最后检查日期”应该是最后一次真正读到的时间。`fetch_error` 会让这一页在下次运行时优先重抓。

还有两种情况看起来成功了，其实没有：

- 被删掉的页面常常跳转到上一级栏目或者首页。跳过去的页面看起来很正常，会悄悄替换掉原来的内容。现在跳到上级页面算失败。
- 很长的页面突然只读到很短的内容，保留上一份好的。官网上本来就短的页面，比如一个只有链接的入口页，在没有更长的旧内容可留时照常存（[#217](https://github.com/Waldo0926/monash-hub/pull/217)）。

## 网站拒绝服务器的时候

monash.edu.my 拒绝 VPS 的这段时间，它的页面可以在另一台电脑上读，打包成一个 harvest 文件交给服务器。服务器用和自己抓取同一套代码存进去（`deployment/crawl.sh official-harvest FILE`）。

第一次 harvest 就出了新问题。一次运行在写文件中途被停掉，文件损坏了，读取到损坏的地方就停，结果服务器 680 页一页都没导入。现在每一页是一个独立的 gzip 成员，读的时候跳过损坏的那个，从下一个接着读（[#216](https://github.com/Waldo0926/monash-hub/pull/216)）。服务器也改成一页一页地读，因为 723 页一起放进内存，超过了爬虫容器的 2 GB。

## Handbook 这边也加了上限

同一个周末，每周的 Handbook 抓取也加了几个上限（[#212](https://github.com/Waldo0926/monash-hub/pull/212)）：

- 一次运行最多把 25 门课标成停开，目标多的时候按 2% 算。不然 Handbook 哪天对所有请求都返回 404，所有课程都会下线一周。
- 连续失败 30 个就停下，并记下原因。以前 Handbook 挂了，5000 门课每门要试三次。
- 运行失败，或者超过 5% 的目标失败，每天最多发一封邮件。`/api/health` 能看到每类抓取最近一次的结果。

## 小结

- sitemap 比顺着菜单爬全，但它什么都列，所以过滤规则比抓取本身更重要。
- “过时”要写成带当前年份的规则，不要写成一张页面清单。
- 只有来源说页面没了，才把内容撤下。被拒绝或者超时，说明不了页面本身。

代码：[coverage.py](https://github.com/Waldo0926/monash-hub/blob/main/crawler/official/coverage.py)、[discover.py](https://github.com/Waldo0926/monash-hub/blob/main/crawler/official/discover.py)、[repository.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/repository.py)。更新日志：[CHANGELOG.md](https://github.com/Waldo0926/monash-hub/blob/main/CHANGELOG.md)。
