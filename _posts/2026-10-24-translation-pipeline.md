---
layout: post
date: 2026-10-24 17:00:00 +0800
project: Monash Hub
description: "Five thousand units and hundreds of official pages, translated into Chinese for free. Why a glossary sits in front of the model, and how a bad translation falls back to English."
ref: translation-pipeline
lang: en
preview: translation-pipeline
title: "Translating the Monash Handbook without paying for it"
image: /assets/og/translation-pipeline.png
---

Most people who read [Monash Hub](https://monashhub.secureview.tech) are Chinese students. What they need to read is in English: about five thousand Handbook units, the degree structures, and several hundred official Monash pages. Monash keeps changing it, so the Handbook is crawled again every week. A paid translation API would cost more than a student project can spend, so the site uses free engines. This post covers what goes wrong when you do that, and what the pipeline does about it.

## A plain translator gets the important words wrong

The first engine was Argos Translate, an offline model that runs on the same VPS. It costs nothing and has no rate limit. On real Handbook pages it translated:

- *census date* as 人口普查日期 (a population census)
- *unit* as 单位 (an organisation, not a subject)
- *Exercise* as 锻炼 (physical exercise)
- *Breadth studies* as 面包研究 (bread studies)

These are exactly the words a student acts on. Miss the census date and you pay for a unit you dropped. So the model is not allowed to decide them.

## The pipeline

Every string goes through the same steps:

```
agreed value?  ->  protect the terms  ->  translate  ->  put the terms back
```

**Agreed values never reach the model.** A campus, a teaching period, an assessment type or a faculty name comes from a closed list. [`glossary.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/glossary.py) has a checked wording for each one in Chinese, Japanese and Korean, including all 120 faculty and school names. Degree names are built from parts rather than translated, because English names a degree front to back and Chinese back to front.

**Terms inside a sentence are masked.** Before a sentence goes to the model, every glossary term in it is swapped for a placeholder, and the agreed wording is put back afterwards. The placeholders are letters (`Zqa`, `Zqb`, ...) because the model rewrote digits.

Letters were not safe either. "What is Zqa?" came back as 什么是兹卡?, where the model had turned the placeholder into Chinese sounds. I tested other tokens on the 59 sentences that were failing on the live guides. Each token lost a different set of sentences, so the engine now tries five masks in turn until one comes back intact. That recovered 50 of the 59.

## The chat model gets the glossary too

Argos was still weak on grammar. "WAM of 65" became 65 years old. So I added an engine for any OpenAI-compatible chat model ([#115](https://github.com/Waldo0926/monash-hub/pull/115)), defaulting to Zhipu's `glm-4-flash` because it is free. Most of the Chinese on the site now comes from it.

A chat model does worse with placeholders. Asked to translate "Zqa units", it writes 课程 for both. So it gets the agreed wordings in the prompt instead, and the reply is only accepted if nothing was lost ([#116](https://github.com/Waldo0926/monash-hub/pull/116)):

```python
# simplified from crawler/translate/llm.py
def faithful(source, reply, terms):
    if any(agreed not in reply for _english, agreed in terms):
        return False
    if any(code not in reply for code in _CODE.findall(source)):
        return False
    if bullets(source) != bullets(reply):
        return False
    return all(n in reply for n in _NUMBER.findall(source))
```

If the reply fails this check, the same sentence goes through the masked path, which cannot drop a term.

## When in doubt, keep the English

A chat model can also answer the question instead of translating it, or start with "Here is the translation". The engine throws a reply away when:

- it is empty, or much longer than the source
- it opens with a preface, or echoes the prompt back
- it is in the wrong script, like Simplified Chinese inside a Japanese answer
- it is identical to the English

A string that fails stays in English. A reader can work with English, but a confident sentence that nobody wrote is worse.

## Where translations live

Translations are stored in one table, `content_translations`, next to the English rather than replacing it. Each row has two things that matter:

- **`source_hash`**: the hash of the English it was made from. When Monash edits the page, the hash changes and the page says the translation may be out of date. A rerun skips everything whose hash has not moved, so the weekly refresh only sends new sentences to the model.
- **`provenance`**: `machine`, `curated` (checked against the English) or `human`. The human row wins on read. A machine run can never overwrite somebody's work, and the page tells the reader which kind they are looking at.

The Handbook repeats the same paragraphs across thousands of units, so the engine caches by sentence. That cache is the difference between an hour and a week.

## Japanese and Korean

Japanese and Korean have very few readers, so they get machine output behind the same glossary with no routine review. The first sample still needed fixes ([#182](https://github.com/Waldo0926/monash-hub/pull/182), [#183](https://github.com/Waldo0926/monash-hub/pull/183)):

- Korean lost all its spaces, because a rule that joins Chinese words after a glossary term also ran over Korean.
- Korean particles were chosen for the model's own word, not the term put back (과목를 instead of 과목을).
- Japanese doubled words around a term (マレーシアキャンパスキャンパス).
- Dates came out as 12月2026年.

At about ten seconds a string on the free model, a full Japanese and Korean fill takes a day or more. So it runs under its own lock after the crawl, and Chinese always goes first.

*Update, 29 October: Japanese and Korean are no longer offered ([#251](https://github.com/Waldo0926/monash-hub/pull/251)). The readers are Chinese students, and keeping two more languages translated cost time and free quota that almost nobody used. The site is now English and Chinese.*

## Takeaways

- The glossary is where quality comes from. Most translation bugs were fixed by adding a term, and the fix reaches every page on the next run.
- Check what the model returns before storing it. Every agreed term, code and number has to be there.
- Store translations beside the source with a hash, so you know when they go stale.
- A string you cannot translate well should stay in the original language.

Code: [`engine.py`](https://github.com/Waldo0926/monash-hub/blob/main/crawler/translate/engine.py), [`llm.py`](https://github.com/Waldo0926/monash-hub/blob/main/crawler/translate/llm.py), [`glossary.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/glossary.py), and the decision record [ADR 0004](https://github.com/Waldo0926/monash-hub/blob/main/docs/adr/0004-glossary-before-machine-translation.md).
