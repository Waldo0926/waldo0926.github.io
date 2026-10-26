---
layout: post
date: 2026-10-26 10:30:00 +0800
project: Monash Hub
description: "签证、保险、休学和课程停开，Monash 澳洲校区和马来西亚校区规定不一样。Monash Hub 怎么把两边并排答出来，以及一个测试怎么拦住忘了写国家的回答。"
ref: two-campuses
lang: zh-Hans
title: "一个问题，两个校区"
image: /assets/og/two-campuses-zh.png
---

[Monash Hub](https://monashhub.secureview.tech) 的读者里有不少是马来西亚校区的同学和家长，但 Monash 自己的页面大多是写给澳洲校区的。问题一旦和国家的法规或者校区的安排有关，对一个校区是对的答案，对另一个校区可能就是错的。

这篇讲网站和[微信问答机器人](https://github.com/Waldo0926/mumguide-wechat-bot)现在怎么回答这类问题，内容来自 10 月 25 日的几个 PR。

## 对一半读者是错的答案

“可以休学一个学期吗”这条整理好的回答，以前告诉所有持学生签证的同学：休学会改变你的 CoE。CoE（Confirmation of Enrolment）是澳洲学生签证的东西。马来西亚校区看的是 Student Pass 的规定，而且不一样：因为生病休学可以保留 Student Pass，其他原因要注销，回来时要在开学前 4 到 2 个月重新申请 eVAL。

这段话对澳洲来说没有错，只是没写是哪国的，马来西亚校区的同学就会当成自己的规定。

## 分两段写，各有出处

和国家有关的回答，现在分成澳大利亚和马来西亚两段，每段按那个校区的官方页面写（[#219](https://github.com/Waldo0926/monash-hub/pull/219)）。FAQ 条目在澳洲页面旁边列出马来西亚的页面，两边都会引用：

```python
FaqSeed(
    "apply-for-intermission",
    "Can I take a semester off?",
    "Yes - it is called intermission, and approval is not automatic. The rules for "
    "international students depend on the campus. "
    "Australia: you can take up to 12 months ... a new Confirmation of Enrolment (CoE) ... "
    "Malaysia: you can take up to two semesters or 12 months ... "
    "you must cancel your Student Pass and leave Malaysia ...",
    ...
    malaysia_pages=("malaysia-changing-your-enrolment-intermission",
                    "malaysia-international-students-during-your-studies"),
)
```

退课、打工时长、census date、医疗保险（澳洲是 OSHC，马来西亚校区是学校随 Student Pass 一起买的保险）、减课和多修课，都按同样的方式拆开写。马来西亚的减课部分来自 SORS 表格自己的说明：用哪张表、第 2 周周五截止、提交前先联系 International Student Pass Office。

对照官网核对的时候，还发现一条对所有人都错的回答：它说挂科在 GPA 里算 0 分。按 Monash 的标准是 0.3。现在这条回答列出整个分数表，还有马来西亚校区的 CGPA。

## 用测试检查有没有标国家

手动拆分只能管住现有的回答，下一条新回答可能又忘了。所以加了一个测试，读每一条 FAQ：回答里提到只属于某个国家的规定，却没写是哪个国家，英文和中文翻译任何一边漏了，测试就失败：

```python
AUSTRALIA_ONLY = re.compile(
    r"\b(?:CoE|OSHC|ESOS|Centrelink|HECS|HELP|Home Affairs|student visa)\b")
MALAYSIA_ONLY = re.compile(r"\b(?:Student Pass|EMGS|eVAL|MOHE|WD-LATE|CGPA)\b")

def test_a_rule_of_one_country_says_which_country(seed):
    zh = "".join(FAQ_ZH.get(seed.slug, ()))
    text = seed.question + " " + seed.answer
    if AUSTRALIA_ONLY.search(seed.answer):
        assert "Australia" in text, seed.slug
        assert not zh or "澳大利亚" in zh, seed.slug
    if MALAYSIA_ONLY.search(seed.answer):
        assert "Malaysia" in text, seed.slug
        assert not zh or "马来西亚" in zh, seed.slug
```

另一个测试检查回答引用的马来西亚页面确实存在，而且标的是马来西亚校区。

## 课程停开，两个校区日期不同

IT 学院在改学位结构，两个校区各自发布一张 teach-out 表：哪些课停开，用什么课替换。这两张表对不上。FIT3161 在澳洲已经停了，在马来西亚开到 2027 年 S2。FIT1043 在马来西亚还开最后一次，是 2027 年 S1。

以前搜一门停开的课，只会说 Handbook 里没有这门课。现在会说最后一次出现在哪一年的 Handbook，并且把两个校区的停开通知都列出来，读者所在的校区在前，各自附上学院页面的链接（[#225](https://github.com/Waldo0926/monash-hub/pull/225)）。

有两条规则：

- 通知就是学院自己的表格，原样显示。网站自己从来不推算替换课程。
- 一个校区的表不拿来补另一个校区的空。某个校区的表里没有这门课，页面就照实说没有，因为“没列出来”不等于“没问题”。

## 机器人也一样

微信机器人用的是同一套 FAQ，再加上我教它的问答和公众号文章。签证、保险、修课量这些教过的问答，现在分【马来西亚校区】和【澳洲校区】两段写。需要问大模型的时候，模型只能摘原句；来自澳洲页面的句子，或者带 CoE、OSHC 这类词的句子，放在最后，单独加标题。这部分我在[《只许大模型摘原句的问答机器人》](/2026/10/25/quote-only-rag-zh/)里写过。

## 小结

- 两个来源说的不一样，是因为它们讲的是不同的地方，那就两边都列出来、标清楚，不要合成一句。
- 一张词表就能抓住大部分没标国家的规定。CoE、OSHC、Student Pass 各自只属于一个国家。
- “我们没有这门课的通知”和“这门课没问题”是两个答案。要说的是前一个。

代码：[faq_seed.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/faq_seed.py)、[teach_out.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/teach_out.py)、[test_faq_matching.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/tests/test_faq_matching.py)。
