---
layout: post
date: 2026-11-19 11:00:00 +0800
project: Monash Hub
description: "Monash Hub shows the 2027 Malaysia fees. A published fee is not proof that a degree takes students in a given intake, and neither is proof that applications are open today. How the fees page keeps the three apart, and why every row currently says not verified."
ref: hub-fees-intake
lang: en
source_repo: monash-hub
source_checked: 2026-11-19
title: "A fee table doesn't mean applications are open"
tags: [Python, FastAPI, Nuxt, Data provenance]
image: /assets/og/hub-fees-intake.png
---

The [fees page](https://monashhub.secureview.tech/fees) on Monash Hub lists what each Monash Malaysia degree costs in 2027, with the change from 2026. Parents read it a lot. The question I kept getting back was some version of "it has a 2027 price, so I can apply for February, right?"

Not necessarily. There are three separate facts here, and Monash publishes them on different pages:

1. **A fee for a year.** The fee tables say what a degree costs in 2027.
2. **An intake list.** The intake pages say which degrees are offered in an intake. For 2027, only the October page has a degree by degree list. February and July only give general deadlines.
3. **Whether applications are open now.** Only a degree's own page can say this, and most of them don't say it in words.

The old page blurred the three together. It even had a fixed note claiming one missing degree was closed, with nothing behind it at run time. That note is gone.

## What counts as evidence

When I reviewed the sources on 3 November, the Master of Professional Counselling page said in plain words that applications were closed. The intake page still listed future deadlines for postgraduate degrees. A future deadline on a general page doesn't override a closure on the degree's own page, so the rules are strict:

- Only a complete sentence on that programme's own page, about that programme, can produce **open**, **closed** or **suspended**.
- An "Apply now" button, a general deadline table, or a sentence with "may" or "unless" in it produces nothing.
- Two pages that disagree produce **conflict**, and a person has to look.
- A source that is missing, failed to fetch, needs a login, or was last checked more than 30 days ago produces **not verified**. The 30 days is my own rule for this page, not an official one.

No model makes any of these calls, and nothing is fetched while you load the page. It reads pages the normal crawler already stored, with their URL, check time and content hash, and shows them under each row.

## Matching the right degree

Before a notice can attach to a row, the row has to be the same degree as the page. The fee table links each row to a programme page, and the fetched page title has to match too. On the 8 November review, 62 of 63 titles matched. The one that didn't was Master of Science against Master of Science (Research). I left it flagged instead of writing a rule that treats them as the same, because they aren't.

Handbook course codes come only from an explicit Handbook link on the page. If there isn't one, the code stays empty.

## The selection guard

The page has year and intake filters, and they stay in the URL. The API sends back the selection it answered, and the page won't show an answer for a different selection. Without that, switching from October to February quickly could leave October's answer on screen under a February label. I had the same bug once on the [year comparison page]({% post_url 2026-11-19-hub-compare-years %}).

## Where it stands today

I called the live API while writing this. For October 2027 there are 58 fee rows. 53 link to a programme page, and 52 of those were fetched and matched by title. None of them has an explicit sentence about applications, so all 58 say **not verified** for the intake.

That looks like an empty result, but it is the honest one. The page still shows the fee, the October list and the general deadlines, each with its own source, and tells you to check the degree page or ask Monash before deciding anything.

## What's still missing

February and July 2027 have no degree list on Monash's site, so they stay not verified for every degree. The counselling page is the only explicit notice I've reviewed so far. Wider coverage is still an open issue in the repo, and the rest of the review notes are in `docs/ADMISSIONS-EVIDENCE.md`.
