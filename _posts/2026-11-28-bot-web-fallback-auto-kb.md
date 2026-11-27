---
layout: post
date: 2026-11-28 01:40:00 +0800
project: Q&A bot
description: "When local rules and RAG miss, policy questions rewrite queries and search Monash websites with verbatim checks, everyday questions get a labelled AI answer, and a 10 pm digest lists auto-additions and merge suggestions."
ref: bot-web-fallback-auto-kb
lang: en
source_checked: 2026-11-28
title: "Searching Monash websites when the KB misses, with a 10 pm review"
tags: [Python, SQLite, RAG, WeChat]
image: /assets/og/bot-web-fallback-auto-kb.png
---

[Quote-only RAG]({% post_url 2026-10-25-quote-only-rag %}) cut down how often the bot missed reworded questions, but two kinds of messages still kept ending up in my chat.

Sometimes a student writes very colloquially, like "下学期不想读了先停半年怎么弄" (stop studying for half a year next semester). The KB already covers `intermission`, but the words barely overlap so local retrieval never pulls it up. Other times a page on `monash.edu.my` or `monash.edu` was missed by my weekly crawl or updated between runs. Mixed in with those were everyday questions like plug adapters or rain gear in Kuala Lumpur that do not need a human answer.

I added `wxbot/websearch.py` to handle what happens after a local miss. Nothing ahead of it changed: taught Q&As, the Monash Hub API, 马莫百科 articles and the local RAG index always run first. If local lookup answers the question, it returns right away without touching Tavily or writing anything to the KB.

## Official search for policy questions, labelled AI for everyday ones

Letting a free model improvise policy answers already burned me once, so misses are split in `is_high_risk()` instead of handing everything to AI. Visas, fees, enrolment, exams, grades, graduation, intermission, special consideration, unit codes and university policies count as high risk. Weather, plug adapters, SIM cards, Grab and nearby food count as low risk.

For a high-risk miss, the model rewrites the colloquial Chinese into two or three short bilingual queries, such as `Monash Malaysia intermission` and `休学 申请`. The bot searches the local RAG index again with those first. Half the time the page was already crawled under formal wording.

If local search still comes up empty, Tavily searches `monash.edu.my` and `monash.edu`, sorting `monash.edu.my` ahead of `monash.edu`. The returned text never goes to free-form summarisation. It runs through the same verbatim quote check in `rag.py`, keeping the Australia campus warning headers intact. If no verified quote survives, the question still forwards to me.

Writing the tests caught an annoying bug in `Brain.answer()`: when local RAG found zero chunks it returned `Result(None, "no chunks")` with `unsure=False`, which hit an `else` branch and returned `miss` early before ever reaching query rewriting or Tavily. Changing that branch to return early only when `reply is not None` fixed it.

Low-risk life questions that miss the local layers go to `life_fallback()`. The reply always ends with a note saying it was written by AI and is not official policy, and it does not auto-forward to me unless the student replies `人工`.

## Auto-adding new answers, proposing changes to old ones

Verified new answers from Layer 2 and Layer 3 are saved into `qa` and synced into the RAG `chunk` table immediately via `chunks.sync_qa_row()`, so the next student asking the same thing hits the KB directly without another search or model call.

A `source` column tracks where each row came from: `owner`, `auto_web` or `auto_ai`. An `auto_ai` row stores the disclaimer as part of the answer text so later hits never look like something I wrote by hand.

Existing Q&As are never overwritten silently. Anything touching them goes into `kb_proposal` for my review. If query rewriting ends up matching an older Q&A, it queues an `add_phrase` suggestion for the student's wording. If a new, broader Q&A is added on the same topic as a short older one (for example, a full hostel appliance answer covering an older rice-cooker Q&A), it queues a `merge_qa` suggestion to fold the old phrasings into the fuller entry and drop the duplicate.

## A 10 pm summary and plain-Chinese edits

A background loop in `wxbot/bot.py` sends one summary at 10 pm listing Q&As auto-added that day and any open proposals. Quiet days send nothing. One small deployment trap: the loop checks server local time, so on a UTC VPS `WXBOT_AUTO_DIGEST_HOUR` has to be `14` to land at 10 pm in Malaysia instead of 6 am.

Proposals take `采纳 P1`, `采纳 全部` or `驳回 P1`, and an approved change can still be rolled back with `撤销`. If an auto-added answer in the 10 pm summary looks slightly off, I also added an admin-only parser (`wxbot/admin_nlp.py`, strictly inside `is_admin` so normal users can never reach it). I can ask "有哪些指令" when I forget a command, or write "把 #128 删掉" or "把 #128 里的 RM50 改成 RM80，去掉旧网址". Every write previews the before and after and waits for `1` before touching SQLite, with `撤销` afterwards.

## Things to watch

Official account replies still have a 5-second timeout, so adding query rewriting and Tavily makes it more likely to fall into late delivery where the student has to send another message to read the reply; private chats and groups do not have that limit. Tavily's free plan gives 1,000 searches a month, which should last with local lookup running first, though I will still need to watch usage. The high-risk versus low-risk split is just a keyword regex for now, so edge cases will need adjusting as I read the nightly summaries.
