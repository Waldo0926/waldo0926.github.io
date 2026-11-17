---
layout: post
date: 2026-11-17 10:00:00 +0800
project: Q&A bot
description: "The WeChat bot used to forward every message it could not answer to me, including small talk and noise. How it now decides what is worth my time, the cap per person, and how I tested it without real logs."
ref: bot-forwarding
lang: en
preview: bot-forwarding
title: "Teaching the bot what not to forward to me"
image: /assets/og/bot-forwarding.png
---

The [马莫百科 bot](https://github.com/Waldo0926/mumguide-wechat-bot) forwards a question to me when it cannot answer it. For a while that also meant "哈哈哈你好可爱", "怎么办", "asdfgh", adverts, and sometimes swearing. Every one of them became a pending note in my admin chat, and I had to read it and decide it was nothing. On 16 November I decided those should not reach me at all.

## Two checks instead of one

The obvious fix is one filter in front of everything. I did not want that, because the knowledge base should still get the first try at anything that might be a question. So there are two checks, in `wxbot/triage.py`.

The first runs before the knowledge base. It catches noise, swearing, small talk, adverts, "有人吗" and requests to do graded work. Running it first matters for a practical reason: a loose match can turn "哈哈哈" into "你问的是不是…" about some unrelated Q&A, which is worse than no answer.

The second runs only after nothing could answer. It catches a message that is too short to act on ("怎么办"), a request for a general chatbot ("帮我翻译一下"), and a remark that has no question in it and nothing about study. The asker gets a short reply that says what kind of message the bot can use, with two examples such as "FIT2102 有期末考试吗". Adverts get no reply.

## When in doubt, forward

A real question that is held back is worse than a silly one that reaches me. So every rule leans towards letting the message through. A message is held only when it clearly matches one of the cases above. Anyone who is held can reply 「人工」 and it is forwarded anyway.

## A cap per person

One person sending question after question would still fill my chat, even if every question is real. Each person can now have 5 forwarded questions in 24 hours. After that the bot says how many it has already passed on and points to Monash Hub. The number is `WXBOT_PENDING_DAILY`, and `0` turns the cap off. `WXBOT_SCREEN=0` turns the whole triage off if it ever misbehaves.

## How I tested it

`tests/test_triage.py` has two lists. 41 messages students and parents might send must be forwarded, such as "没回国能线上报到吗", "我 offer 丢了" and "怎么扔垃圾". 39 messages must be held, such as greetings, keyboard mashing and requests like "帮我写 assignment". If a change breaks either list, the tests fail.

I also wrote 114 questions that students and parents ask into `eval/common-questions.txt`. `python -m wxbot coverage` asks the bot every one of them and lists the ones it cannot answer. That list is what I add Q&As from now.

## What I do not know yet

I could not read the server's real message log while writing this, so both lists are samples I wrote from what I remember being asked. The rules are tuned to those, not to what people really send. After a week of use I will look at what was held and check that nothing real was in it. The counts and the cap are the first thing I will change if it was wrong.
