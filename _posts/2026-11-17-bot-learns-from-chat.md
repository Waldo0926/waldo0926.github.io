---
layout: post
date: 2026-11-17 11:00:00 +0800
project: Q&A bot
description: "I used to teach the bot with fixed commands, so I often did not bother. Now a plain message from me is read as knowledge. How the bot tells a new fact from a correction or an answer, and what it does when it is not sure."
ref: bot-learns-from-chat
lang: en
preview: bot-learns-from-chat
title: "Letting me teach the bot by just talking to it"
image: /assets/og/bot-learns-from-chat.png
---

Teaching the [bot](https://github.com/Waldo0926/mumguide-wechat-bot) used to need a format: `答 12 …` to answer a waiting question, `教 问题 | 答案` to add a Q&A. I knew the answers, but typing the format each time felt like a chore, so often I did not reply at all and the same question came back the next week. On 17 November I changed it so a plain message from me is read as knowledge.

## Reading the shape of the message

There is no language model in this part. `wxbot/teach.py` looks at the shape of the line and picks the first case that fits:

- A question mark with text after it: `学生证丢了怎么办？去 Student Services 补办`. The part before is the question, the part after is the answer.
- A first line followed by more lines: the first line is the question, the rest is the answer.
- A short label and a colon: `驾校：马莫百科不推荐，自己查`.
- One full statement. Its first clause becomes the phrasing, and the bot tells me that it guessed, so I can send a better phrasing later.

A question with nothing after it is not knowledge. If I send "学费怎么交", I am trying the bot, so it just answers. A line shorter than 8 characters is also not taken as a fact. If I do want a line stored that reads like a question, `记 一句话` forces it.

## Not guessing when it matters

What the bot stores is visible to students, so I made it ask when it is unsure instead of choosing.

If a pair about the same thing already exists, the bot replies with one digit to choose: 1 replaces the old answer, 2 adds to it, 3 stores a new pair, 0 stores nothing. If my line repeats a waiting question and says more than the question did, it is sent to that asker as the answer. If my line is very short, like "可以", the bot asks which waiting question it belongs to. Nothing goes to a student on a guess about that.

Every automatic change can be undone with `撤销`, which removes the last pair the bot stored or changed. It only covers that one, so a mistake from three messages ago is fixed by hand.

## Skipping many at once

Before, a waiting question had to be ignored one at a time. Now `忽略 12 13 14`, `忽略 12-20` and `忽略 全部` all work, with no limit on how many. Quoting a note and replying `跳过` skips that one. I added this because after a busy week there were more notes than I wanted to touch individually.

## What is still manual

The bot cannot tell that an answer from me is out of date. If the visa rules change, I have to say so, and the old pair stays until I do. The 1, 2, 3 choice is also the part I trust least. I will watch whether I keep picking the same digit, because then it should be the default.
