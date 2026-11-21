---
layout: post
date: 2026-11-01 07:20:00 +0800
project: Monash Hub
description: "按 Handbook 检查先修课、校区和开课学期，每个结果都附上来源"
ref: monash-planner-reason
lang: zh-Hans
title: "我为什么做 Monash 选课规划工具"
image: /assets/og/monash-planner-reason-zh.png
source_repo: monash-hub
source_checked: 2026-11-01
---

规划 Monash 的课程时，输入课号很快，花时间的是检查每门课在不在自己校区开、选的学期有没有开、先修课能不能在之前修完

表格可以记规划，但不会帮你检查这些，这是我做 [Monash Hub](https://github.com/Waldo0926/monash-hub) 的原因之一

## 规划留在浏览器里

可以把课拖到不同学期、撤销修改、导出规划，需要检查时，规划里的课会发给一个用 Handbook 数据的接口，服务器不保存规划

“没找到”和“不允许”分开处理，本地数据里某一年没有这门课，不代表这门课停开了，先修课的提醒会写明原因，并附上 Handbook 的链接

## 只是提醒，不是批准

这个工具不能批准先修课豁免、学分转换或者毕业审核，它只是提前指出可能的问题，附上 Handbook 页面，让同学知道该去问学院什么

规划模型和检查规则在[源码](https://github.com/Waldo0926/monash-hub)里，不同 Handbook 年份的对比还需要改进，学生入学时适用的规则不应该被新规则覆盖
