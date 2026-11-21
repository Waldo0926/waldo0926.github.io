---
layout: post
date: 2026-11-01 04:20:00 +0800
project: Algorithms
description: "把 Z 匹配、BWT、Ukkonen 后缀树和 Rabin Karp 整理成单独的仓库，并写明各自的限制"
ref: string-algorithms
lang: zh-Hans
title: "字符串算法课结束后留下的代码"
image: /assets/og/string-algorithms-zh.png
---

回头整理算法课的代码时，我不想把以前的作业文件夹原样放上 GitHub，代码也许还能跑，但没有设计、复杂度和边界情况的说明，别人看不懂，一年后的我也一样

我把四部分整理成一个[单独的 Python 仓库](https://github.com/Waldo0926/advanced-string-algorithms)：Z 算法精确匹配、基于 BWT 的近似匹配、Ukkonen 后缀树和 LCP 提取，以及用 Miller Rabin 生成素数的 Rabin Karp

## 限制

它不是生产用的搜索引擎，BWT 的例子故意用了简单的后缀数组构建方法，这里的 Z 匹配在计算位移时有一步 `O(m²)` 的预处理，直接叫它们“快速文本搜索”会把这些开销藏起来

Ukkonen 后缀树里，我反复排查的问题都在 active point、suffix link 和 skip/count 上，代码写成可以一步一步跟着看的样子

## 测试

BWT 近似匹配的测试把替换、插入、删除和换位分开测，LCP 数组在小输入上和朴素算法对比，Rabin Karp 会拿原文核对每个候选，哈希相同不代表真的匹配

仓库里有能运行的例子和 pytest 测试，不包含作业题目、评分材料和其他课程资料

更多说明在 [ALGORITHMS.md](https://github.com/Waldo0926/advanced-string-algorithms/blob/main/ALGORITHMS.md)，真要拿来做大规模索引的话，我会先按实际数据测一下性能，再把简单的构建步骤换掉
