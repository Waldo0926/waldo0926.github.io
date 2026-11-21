---
layout: post
date: 2026-11-19 10:30:00 +0800
project: Monash Hub
description: "对比两个 Handbook 年份的先修课、校区、开课学期、考核和考试，缺少的年份显示为未知"
ref: hub-compare-years
lang: zh-Hans
source_repo: monash-hub
source_checked: 2026-11-19
title: "对比一门课在不同 Handbook 年份的变化"
tags: [Nuxt, FastAPI, PostgreSQL, Handbook]
image: /assets/og/hub-compare-years-zh.png
---

“FIT2102 2027 年有没有变？”听起来是个小问题，真要回答得打开两年的 Handbook 页面一行行对：先修课、校区、开课学期、考核比例、有没有考试

[Monash Hub](https://monashhub.secureview.tech) 本来就保存了加载过的每一年 Handbook，所以[对比页面](https://monashhub.secureview.tech/units/compare)替你把这件事做了

## 怎么用

输入课号，选好起始年份和对比年份，点对比就行

结果里每一部分都标着新增、删除、修改、没变或者没有数据，旁边是 Handbook 原文链接和最后核对的日期

课程搜索页上点“比较年份”也能进来

还可以填上学位代码和入学年份

学位要求按你入学那年算，不按这门课开课那年算，所以页面会把你那一版学位要求单独放在旁边，再链到选课规划

## 缺了某一年不等于停开

Hub 没有某门课某一年的记录，可能是真停开了，也可能是那年还没加载，或者抓取失败了

所以页面只说“没有数据”，不会拿相邻年份来顶替

11 月 8 日核对时，C2001 有 2025 版，2024 版明确返回 404，页面必须把 2024 显示成缺失，不能悄悄换成 2025

## 空列表要有证据才算空

这是最隐蔽的一个 bug，API 以前把缺失的集合（比如先修课）一律发成 `[]`，于是“这门课没有先修课”和“我们根本没读到先修课”看起来一样，对比时就可能说某个先修课被删了，其实只是没加载到

现在解析器会给每个集合存一个小标记，说明原文页面里到底有没有这一部分

有了这个证据，对比才会说空列表没变、新增或删除

没有标记的旧记录先算未知，等平时的 Handbook 刷新补上

这个标记不计入课程内容的哈希，所以补标记不会被当成政策变化，也不会让翻译失效

## 两个小修复

以前对比完再改年份，旧结果会直接换上新年份的标签，其实什么都没重新加载

现在改过的表单会标成“待对比”，要重新点对比才算数

同时发出的几个请求会被拦住，课号或年份对不上的结果直接丢掉

## 它不做的事

它只对比一门课在两年之间的变化，不算整个学位的对应关系、学分转换，也不判断你符不符合要求，这些页面会引导你去选课规划和官方 Handbook

设计说明在 [HANDBOOK-COMPARISON.md](https://github.com/Waldo0926/monash-hub/blob/main/docs/HANDBOOK-COMPARISON.md)
