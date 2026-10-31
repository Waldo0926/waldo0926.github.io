---
layout: post
date: 2026-11-01 10:00:00 +0800
project: Algorithms
description: "把以前写的字符串算法重新整理成独立仓库：Z匹配、BWT、后缀树、Rabin–Karp，还有那些不该被隐藏的实现限制。"
ref: string-algorithms
lang: zh-Hans
title: "字符串算法课结束后，我还留着哪些代码"
image: /assets/og/site.png
---

整理以前的算法课代码时，我不太想把每个作业文件原样扔上GitHub。课程已经结束了，有些代码能运行，但如果不把设计思路、复杂度和边界情况说明白，别人看不懂，我隔一段时间也未必记得为什么这么写。

后来我把几个字符串算法整理成了[独立Python仓库](https://github.com/Waldo0926/advanced-string-algorithms)。里面有四组东西：

- Z相关的精确匹配，包含从右向左匹配的跳跃预处理
- BWT和backward search，在索引上尝试一次编辑的近似匹配
- Ukkonen后缀树，以及从树里提取LCP数组
- Rabin–Karp滚动哈希，搭配Miller–Rabin素性测试

## 先讲清楚它不是什么

这是拿来展示算法实现和实验的仓库，不是生产级全文检索引擎。比如BWT部分为了让实现容易读，后缀数组构造仍然用比较直观的方法；Z匹配实现里的位移预处理有`O(m²)`的成本。如果只写“高效字符串匹配”，就把最重要的限制藏起来了。

后缀树也是一样。Ukkonen算法最容易讲得很玄，但写代码时真正会反复出错的是active point、suffix link和skip/count如何更新。比起只给一个理论上的时间复杂度，我更在意用小输入把这些状态跑对。

## 测试怎么安排

我给BWT近似匹配分别覆盖替换、插入、删除和交换四种单步编辑；后缀树的LCP结果拿一个朴素参考实现对照；滚动哈希不仅检查命中位置，也要处理哈希相同但原文不同的情况。

仓库里保留了运行例子和pytest测试。课程作业的说明、评分材料和其他不该公开的资源没有放进去。

代码在[advanced-string-algorithms](https://github.com/Waldo0926/advanced-string-algorithms)，实现笔记在[ALGORITHMS.md](https://github.com/Waldo0926/advanced-string-algorithms/blob/main/ALGORITHMS.md)。以后真要拿去处理大规模文本，我会先重做索引构建和性能评估，不会直接拿课程版的复杂度推断实际吞吐。
