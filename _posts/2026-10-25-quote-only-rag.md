---
layout: post
date: 2026-10-25 19:00:00 +0800
project: Q&A bot
description: "A WeChat bot answers students and parents about visas, exams and enrolment. Why the language model in it may only quote sentences, how the code checks every quote, and which true sentences it still refuses to send."
ref: quote-only-rag
lang: en
preview: quote-only-rag
title: "A Q&A bot where the model is only allowed to quote"
image: /assets/og/quote-only-rag.png
---

The [马莫百科 bot](https://github.com/Waldo0926/mumguide-wechat-bot) answers questions from Monash Malaysia students and their parents on WeChat. Most answers come from rules: Q&As I taught it, the [Monash Hub](https://monashhub.secureview.tech) API, and the account's own articles. Anything it cannot answer is forwarded to me.

The rules miss questions whose answer is sitting in those same sources, worded differently. So I added an optional RAG step that runs only when the rules found nothing or only a weak match. The rule I set for it: better "不知道" than a wrong procedure. A student who is told "I don't know, I've passed it on" asks again. A student who is told the wrong visa deadline acts on it.

## Letting the model write did not work

The first version let a free model answer in its own words from the retrieved passages. It read well and it was wrong in ways that matter. It added steps no passage has ("老师会替你申请特殊考虑", the teacher will apply for special consideration for you). It turned "ISP 在贴纸剩 14 天或更少时收护照" (ISP collects passports when 14 days or fewer are left on the sticker) into "过期后有 14 天宽限期" (a 14-day grace period after expiry).

I tried a second model to check the first one's sentences. It missed some of these and cut correct ones. A checker that is also a language model has the same problem as the writer.

## The model picks sentences, the code checks them

So the model does not write anymore. The prompt asks it to copy sentences from the numbered passages without changing a character, at most four, one per line as `[passage number] sentence`, or to say "这个我不确定" when nothing answers the question.

Every line is then checked in code. The quote must be in the passage it names, with whitespace ignored, and at least six characters long:

```python
def sentence(quote, h):
    text = h.text
    idx = [i for i, c in enumerate(text) if not c.isspace()]
    q = _squash(quote)
    at = "".join(text[i] for i in idx).find(q)
    if not q or at < 0:
        return None
    ...  # widen to the whole sentence it is in
```

A paraphrase, an added step, or a real sentence put on the wrong passage number all fail this check. A test feeds in exactly those three cases and expects nothing to be sent. What passes is widened to the whole sentence it sits in, so a half sentence never goes out on its own. The reply lists the pages the sentences come from, with links, and a line saying they are excerpts.

When the model says it is unsure, or none of its quotes survive, the question goes to me. A weak rule match ("你问的是不是…") is held back too, because a confident guess about a different question is worse than "已转给作者".

## A true sentence can still mislead

Quoting exactly is not enough. One early reply quoted the renewal page:

> 你必须在到期前四个月提交续签申请；并且

That sentence is on the page. But it sits under "如果你没有满足上述任何一项要求：" (if you meet none of the requirements above), so it only applies to some students. Without the line above it, the sentence tells everyone the wrong deadline.

So `_why_not` also drops sentences that need their surroundings to be read correctly:

- a list item under a heading that ends in a colon,
- a line ending in "；并且" or "：",
- a line starting with "此流程" (this process) or with the "不，" that answers an FAQ question the reader cannot see,
- a table row without its header row,
- a sentence whose years are all in the past, such as last year's exam dates.

Taught Q&As and the Hub's FAQ are written for these students, so when they answer, a general web page is not mixed in next to them. An old page once said "你必须选择参加考核" (you must sit the assessment) right next to a taught answer saying you can skip it.

## Malaysia is not Australia

Most people who ask are at the Malaysia campus, but many Monash pages are written for Australia. The Hub's FAQ once said intermission "会改变你的 CoE". A CoE is part of the Australian student visa and means nothing on a Malaysian Student Pass.

Each quote is now labelled by campus. A sentence from an Australian page, or one that mentions CoE, OSHC, ESOS or Centrelink, counts as Australian. Taught Q&As, the account's articles and Malaysian pages count as Malaysian. Quotes are sorted Malaysia first, then all campuses, then Australia. When anything Australian is in the reply, the quotes get headings, so the Australian rule appears under "澳洲校区（澳大利亚的规定，马来西亚校区不一定一样）". The taught Q&As for visas, insurance and study load now give both campuses separately, and a test fails any answer that mentions CoE, OSHC or subclass 500 without both labels.

## How well it does

The evaluation runs 50 fixed questions through the rules alone and through rules plus RAG. A judge model compares each reply with the expected points. Round 8, on 2026-10-25 ([docs/EVAL.md](https://github.com/Waldo0926/mumguide-wechat-bot/blob/main/docs/EVAL.md)):

| | Rules only | Rules + RAG |
| --- | --- | --- |
| Correct, marked by the judge | 81% (34/42) | 88% (38/43) |
| No-answer questions left to me | 14% (1/7) | 86% (6/7) |

The second row is the one I care about. Seven questions have no answer in any source. The rules alone guessed at six of them. With RAG, six of the seven went to me.

The first row needs a warning. The judge only checks whether the expected points are there, so a reply with an extra wrong step can still be marked correct. That is the reason the quote check is in code and not in another model.

It runs on Groq's free tier (`qwen/qwen3.8-27b`) and has been on in production since 2026-10-24. In round 8, 95% of replies took under a second, well inside WeChat's 5-second limit. Answers are cached for seven days, so a repeated question does not call the model again. If the model is slow or down (the free tier answers 429 when several questions come at once), taught Q&As, the account's articles and the Hub's FAQ still answer. When the rules only have a weak match, the bot does not guess and the question comes to me.

## What it still cannot do

The check makes sure every sentence sent is really on the page it links to. It cannot make sure that page is the right one for the question. When retrieval picks a passage about another situation, the model can quote it correctly and still not answer what was asked. That is why every reply links its pages and says it is an excerpt, and why questions it cannot answer still come to me.

Code: [`rag.py`](https://github.com/Waldo0926/mumguide-wechat-bot/blob/main/wxbot/rag.py), [`test_rag.py`](https://github.com/Waldo0926/mumguide-wechat-bot/blob/main/tests/test_rag.py), [`evaluate.py`](https://github.com/Waldo0926/mumguide-wechat-bot/blob/main/wxbot/evaluate.py).
