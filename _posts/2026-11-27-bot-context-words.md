---
layout: post
date: 2026-11-27 10:30:00 +0800
project: Q&A bot
description: "'How to print at Malaysia campus' matched the student visa answer because 'Malaysia' produced five tokens against one for 'print'. Now campus and asker words are stripped before matching."
ref: bot-context-words
lang: en
source_checked: 2026-11-27
title: "Why 'how to print at Malaysia campus' matched the student visa answer"
tags: [Python, SQLite, WeChat]
image: /assets/og/bot-context-words.png
---

After [connecting the bot to Monash Hub's Ask panel]({% post_url 2026-11-19-bot-on-the-hub %}), someone typed "马来西亚校区怎么打印" (how to print at the Malaysia campus).

Instead of the printing guide, the bot matched "马来西亚校区在哪" (where is the Malaysia campus) and then the Student Pass answer.

## Why that happened

The bot's Q&A matcher does not use a language model. It splits text with `jieba` plus CJK character bigrams and scores IDF-weighted overlap (`wxbot/kb.py`).

In "马来西亚校区怎么打印", "怎么" is a stopword and "打印" (print) is one token. "马来西亚" alone produces five tokens (the word and its bigrams), plus "校区". Whichever stored Q&A mentioned Malaysia the most pulled the score towards itself, and "打印" lost out.

The same thing happened with "国际生" (international student), "本地生" (local student), "新生" (first-year) and a trailing "学长" (senior).

## Strip those words before matching

The index now keeps two copies of the Q&A phrasings: the full text as before, and `_qa_bare` with campus names, student types, "新生" and "学长" removed.

When a question contains any of those words, matching runs on `_qa_bare` using whatever is left of the question. "马来西亚校区怎么打印" becomes "怎么打印", which lands straight on the printing answer.

Only when nothing is left ("马来西亚校区在哪里") does it fall back to the full index.

## Keeping the distinction without letting it take over

Dropping campus and student words completely would break cases where the answer actually differs. "马来西亚校区学生签证怎么续签" must not tie with the Australian visa answer.

Two rules stay during scoring:

- A Q&A written for a different campus or student type gets weight `0.0` and is skipped.
- A Q&A that names a campus or student type the question did not gets multiplied by `0.95` (far enough below the `0.03` lead margin) so "本地学生通识课" (local student MPU) does not tie with general "通识课".

The reverse applies for student type: if the question says "本地生" or "国际生" and a pair for that group is in the hits, general pairs drop by `0.95`. So "马来西亚校区本地生 MPU" still gets the local MPU answer, while "我是国际生，选课在哪" stays a regular enrolment question.

## Chinese edge cases

Writing the regex turned up a few traps, all now pinned in `tests/test_context_words.py`:

- "马来西亚学生" means a local student, not the campus, except before things a student owns: in "马来西亚学生签证" or "马来西亚学生卡", "马来西亚" is the campus and "学生签证" is the topic.
- "马来语" (Malay language), "马来文" and "马来人" are not the campus and must stay untouched.
- Clause-final particles ("呀", "啊", "呢", "急", "在线等") are stripped before `jieba`. Otherwise `jieba` glues "交呀" into one token that misses "怎么交". "嘛" is kept because "干嘛" is a word.

## Checking against the Q&A set

I took every phrasing in `qa/` and added combinations of campus, student-type and particle prefixes and suffixes, producing 19,446 test questions.

Before this change, about 3,500 matched a different pair. After it, 40 did. Most of those 40 either clash without prefixes too (such as a "没有" opposite handled as a guess in `brain.py`) or are contradictory generated inputs like "我是国际生本地生 MPU".

## What is left

Any new slang for a campus or role that is not in `_CONTEXT` will still be scored as part of the topic until it is added with a test. Questions that explicitly compare two campuses at once are not handled specially either.
