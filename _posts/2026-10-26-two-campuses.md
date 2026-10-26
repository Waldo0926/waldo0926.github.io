---
layout: post
date: 2026-10-26 10:30:00 +0800
project: Monash Hub
description: "Visas, insurance, intermission and closing units follow different rules at Monash's Australian and Malaysian campuses. How Monash Hub answers both side by side, and the test that fails an answer that forgets which country it is about."
ref: two-campuses
lang: en
preview: two-campuses
title: "One question, two campuses"
image: /assets/og/two-campuses.png
---

Many readers of [Monash Hub](https://monashhub.secureview.tech) study at the Malaysia campus, or are parents of students there. Most of Monash's own pages are written for the Australian campuses. When a question depends on a country's law or a campus's timetable, a right answer for one campus can be a wrong answer for the other.

This post covers how the site and the [WeChat bot](https://github.com/Waldo0926/mumguide-wechat-bot) now answer those questions, from the pull requests of 25 October.

## The answer that was wrong for half the readers

The curated answer to "Can I take a semester off?" told every student on a student visa that intermission changes their CoE. A Confirmation of Enrolment is part of the Australian student visa. In Malaysia the Student Pass rules apply, and they are different: intermission for medical reasons can keep the pass, any other reason cancels it, and coming back needs a new eVAL 4 to 2 months before the semester.

Nothing in the answer was false for Australia. It was just not labelled, so a Malaysia student read it as their rule.

## Two parts, two sources

Answers that depend on a country now have an Australia part and a Malaysia part, each written from that campus's official page ([#219](https://github.com/Waldo0926/monash-hub/pull/219)). The FAQ entry lists the Malaysia pages next to the Australian one, so both are cited:

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

The same split went into withdrawing from a unit, work hours, census dates, health insurance (OSHC in Australia, the insurance Monash Malaysia buys with the Student Pass), underload and overload. The Malaysia underload part comes from the notes on the SORS form itself: the form, the Friday of Week 2 deadline, and talking to the International Student Pass Office first.

While checking these against the pages, one more answer turned out wrong for everyone: it said a fail is worth 0 in the GPA. On Monash's scale it is 0.3. The answer now gives the whole scale and Malaysia's CGPA values.

## A test for the label

Splitting answers by hand only works until the next answer is added. So a test reads every FAQ entry and fails when an answer names a rule of one country without naming the country, in English or in the Chinese translation:

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

A second test checks that every Malaysia page an answer cites exists and is marked as a Malaysia page.

## Closing units close on different dates

The Faculty of IT is revising its degrees, and each campus publishes its own teach-out table: which units close and what replaces them. The two tables do not agree. FIT3161 is gone in Australia and runs to S2 2027 in Malaysia. FIT1043 runs once more in Malaysia, with its final offering in S1 2027.

Searching a closed unit used to say only that the Handbook has no such unit. Now it says which Handbook last had it and shows the teach-out notice for both campuses, the reader's campus first, each with a link to its faculty page ([#225](https://github.com/Waldo0926/monash-hub/pull/225)).

Two rules keep this honest:

- The notice is the faculty's own table, shown word for word. The site never works out a replacement itself.
- Neither campus's list fills a gap in the other. When a campus's table leaves a unit out, the page says so, because "not listed" is not the same as "safe".

## The bot does the same

The WeChat bot answers from the same FAQ, plus Q&As I taught it and the account's articles. Its taught answers for visas, insurance and study load now give 【马来西亚校区】 and 【澳洲校区】 separately. When the model is asked, it may only quote, and a quote from an Australian page, or one with CoE, OSHC or similar in it, goes last under its own heading. I wrote about that part in [A Q&A bot where the model is only allowed to quote](/2026/10/25/quote-only-rag/).

## Takeaways

- When two sources disagree because they describe different places, show both and label them. Do not merge them.
- A word list is enough to catch most unlabelled rules. CoE, OSHC and Student Pass each belong to one country.
- "We have no notice for this unit" and "this unit is fine" are different answers. Say the first one.

Code: [faq_seed.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/faq_seed.py), [teach_out.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/teach_out.py), [test_faq_matching.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/tests/test_faq_matching.py).
