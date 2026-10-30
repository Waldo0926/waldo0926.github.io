---
layout: post
date: 2026-10-24 17:00:00 +0800
project: Monash Hub
description: "五千多门课和几百个官方页面，不花钱翻成中文。为什么模型前面要挡一层术语表，翻不好的时候怎么退回英文。"
ref: translation-pipeline
lang: zh-Hans
title: "不花钱翻译 Monash Handbook"
image: /assets/og/translation-pipeline-zh.png
---

[Monash Hub](https://monashhub.secureview.tech) 的读者大部分是中国学生，但要看的内容都是英文：Handbook 里五千多门课、学位结构，还有几百个 Monash 官方页面。这些内容一直在变，Handbook 每周重新抓一次。付费翻译 API 的价格学生项目扛不住，所以网站用的是免费引擎。这篇讲用免费引擎会出什么问题，以及翻译流程是怎么处理的。

## 普通翻译器偏偏错在关键词上

最早用的是 Argos Translate，一个跑在同一台 VPS 上的离线模型，不要钱，也没有调用次数限制。在真实的 Handbook 页面上，它把：

- *census date* 译成“人口普查日期”
- *unit* 译成“单位”
- *Exercise* 译成“锻炼”
- *Breadth studies* 译成“面包研究”

这些恰好是学生要据此行动的词。错过 census date，退掉的课也要交钱。所以这些词不能交给模型决定。

## 翻译流程

每个句子都走同样的几步：

```
有固定译法吗？ ->  把术语保护起来  ->  翻译  ->  把术语放回去
```

**固定值不进模型。** 校区、教学时段、考核类型、学院名这些都来自固定列表。[`glossary.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/glossary.py) 给每一个都写好了中日韩三种核对过的译法，包括全部 120 个学院和系的名字。学位名是拼出来的，不是翻出来的，因为英文学位名从前往后读，中文要倒过来。

**句子里的术语先遮住。** 句子交给模型之前，里面的术语表词汇都换成占位符，翻完再换回固定译法。占位符用字母（`Zqa`、`Zqb`……），因为数字会被模型改掉。

字母也不是绝对安全。“What is Zqa?” 回来变成了“什么是兹卡?”，模型把占位符音译了。我拿线上指南里 59 个失败的句子试了几种占位符，每种丢掉的句子都不一样，所以现在一种不行就换下一种，一共五种，直到占位符完整回来为止。这样救回了 59 句里的 50 句。

## 聊天模型也要先看术语表

Argos 的语法还是不行，“WAM of 65” 被译成 65 岁。所以我加了一个引擎，可以接任何兼容 OpenAI 接口的聊天模型（[#115](https://github.com/Waldo0926/monash-hub/pull/115)），默认用智谱的 `glm-4-flash`，因为它免费。网站上现在大部分中文都是它翻的。

聊天模型反而不擅长处理占位符。让它翻 “Zqa units”，它会把两个都译成“课程”。所以给它的方式改成在提示词里直接列出固定译法，回复只有在什么都没丢的时候才算数（[#116](https://github.com/Waldo0926/monash-hub/pull/116)）：

```python
# 从 crawler/translate/llm.py 简化
def faithful(source, reply, terms):
    if any(agreed not in reply for _english, agreed in terms):
        return False
    if any(code not in reply for code in _CODE.findall(source)):
        return False
    if bullets(source) != bullets(reply):
        return False
    return all(n in reply for n in _NUMBER.findall(source))
```

没通过检查的句子，再走一遍遮术语的流程，那条路不会丢术语。

## 拿不准就保留英文

聊天模型还可能直接回答问题而不是翻译，或者开头先说一句“以下是翻译”。遇到下面这些情况，引擎会直接丢掉回复：

- 回复是空的，或者比原文长太多
- 开头有客套话，或者把提示词原样吐回来
- 文字不对，比如日文回复里夹着简体中文
- 和英文原文一模一样

翻不好的句子就保留英文。读者至少还能看英文，一句没人写过却说得很肯定的中文更糟。

## 译文存在哪里

译文都存在 `content_translations` 这张表里，和英文原文并排放，不覆盖原文。每一行有两个关键字段：

- **`source_hash`**：生成这条译文时英文原文的哈希。Monash 改了页面，哈希就变了，页面会提示译文可能过时。重跑时哈希没变的直接跳过，所以每周刷新只把新句子发给模型。
- **`provenance`**：`machine`（机器）、`curated`（对照英文核对过）或 `human`（人工）。读取时人工的优先。机器重跑永远不会覆盖人写的译文，页面上也会告诉读者现在看的是哪一种。

Handbook 里同样的段落在几千门课里重复出现，所以引擎按句子缓存。有没有这层缓存，是跑一小时和跑一周的差别。

## 日文和韩文

日文和韩文读者很少，所以只用同一套术语表加机器翻译，不做日常人工检查。即便这样，第一批样本还是要修（[#182](https://github.com/Waldo0926/monash-hub/pull/182)、[#183](https://github.com/Waldo0926/monash-hub/pull/183)）：

- 韩文的空格全没了，因为一条在术语后面拼接中文的规则也作用到了韩文上。
- 韩文助词是按模型自己的词选的，不是按换回去的术语选的（写成了 과목를，应该是 과목을）。
- 日文在术语前后重复（マレーシアキャンパスキャンパス）。
- 日期写成了 12月2026年。

免费模型大约十秒一句，日文和韩文全部翻完要一天以上。所以它在抓取结束后用单独的锁跑，中文先跑。

*10 月 29 日更新：日文和韩文已经下线了（[#251](https://github.com/Waldo0926/monash-hub/pull/251)）。看这个网站的主要是中国同学，多维护两种语言的翻译要花时间和免费额度，几乎没人用。现在网站只有英文和中文。*

## 小结

- 质量主要靠术语表。大部分翻译错误加一个术语就能修好，下次运行所有页面都会跟着改。
- 存之前先检查模型返回的内容，固定译法、课程代码和数字一个都不能少。
- 译文和原文并排存，带上哈希，原文变了才知道译文过时了。
- 翻不好的句子就保留原文。

代码：[`engine.py`](https://github.com/Waldo0926/monash-hub/blob/main/crawler/translate/engine.py)、[`llm.py`](https://github.com/Waldo0926/monash-hub/blob/main/crawler/translate/llm.py)、[`glossary.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/glossary.py)，决策记录见 [ADR 0004](https://github.com/Waldo0926/monash-hub/blob/main/docs/adr/0004-glossary-before-machine-translation.md)。
