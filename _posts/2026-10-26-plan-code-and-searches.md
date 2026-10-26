---
layout: post
date: 2026-10-26 10:00:00 +0800
project: Monash Hub
description: "Monash Hub has no accounts for course plans. How a plan moves to another device in a link the server never receives, how the home page shows real searches while storing only a word, a day and a count, and a privacy note that had to be corrected."
ref: plan-code-and-searches
lang: en
preview: plan-code-and-searches
title: "A plan code the server never sees, and searches counted without people"
image: /assets/og/plan-code-and-searches.png
---

[Monash Hub](https://monashhub.secureview.tech) lets students plan their degree semester by semester without signing in. The plan lives in the browser's `localStorage`. That keeps the server out of it, but it also means the plan stays on one device.

Two changes this week ran into the same question: how much does the server need to know? This post covers both, and one place where the site said less than the truth.

## Moving a plan without an account

Export already wrote a JSON file. On a laptop that is fine. On a phone the file lands in Downloads and has to be sent on and opened, which most people will not do.

A line of text is easier. It goes through any chat app, including WeChat's file transfer chat with yourself. So "Copy plan code" in the course map's More menu now writes the plan as one readable line ([#235](https://github.com/Waldo0926/monash-hub/pull/235)):

```
MH1|<name>|<start year>|<years>|<campus>|<degree>|<periods>|<entries>

MH1|My%20plan|2026|3|Malaysia|C2001|S1;S2|FIT1008@0.0,FIT2004@1.1
```

Periods are short codes. Each entry is `CODE@year.period`, with the year counted from the start year and the period as an index into the list. Text fields are URI-encoded, so the `|` only ever separates fields. I kept it readable instead of compressing it, so a student can see what it says and chat apps do not mangle it with link detection.

The button copies a link with the code after the `#`:

```ts
function planLink(): string {
  return `${window.location.origin}/plan#plan=${encodeURIComponent(encodePlan(plan.value))}`
}
```

A browser never sends the part after `#` to the server. The page reads it, opens the plan as a new plan, and removes the code from the address bar so a reload does not import it twice:

```ts
function readHash() {
  const hash = window.location.hash
  if (!hash.includes('plan=')) return
  const code = findPlanCode(hash)
  if (code) importCode(code)
  history.replaceState(history.state, '', window.location.pathname + window.location.search)
}
```

`findPlanCode` accepts a bare code, a whole link, or a message with a code somewhere inside it, because people paste whatever their chat app gives them. The decoded plan goes through the same `sanitise` function as an imported file, so a hand-edited code cannot put nonsense into storage.

What this does not do: anyone with the link can open the plan. That is the point of a link, and the plan holds unit codes, not grades or names, unless the student types a name into the plan's title.

## The privacy note was wrong

While working on the course map I reread the note under it. It said the plan is "not uploaded". That was not true. Checking a plan sends the unit codes, teaching periods and campus to `/v1/plan/check`, which works out prerequisites and problems.

The note now says exactly that, and that the server does not keep them ([#231](https://github.com/Waldo0926/monash-hub/pull/231)). "Saved in this browser only" also moved next to the plan name, so nobody mistakes the plan for something saved to an account.

## The home page's "popular searches" were made up

Under the home search box there was a row of six searches labelled "Often searched" (热门搜索 in Chinese). They were a fixed list in the code. The site did not log searches at all. In [#227](https://github.com/Waldo0926/monash-hub/pull/227) I relabelled them as examples: Try, 试试搜, 検索例, 검색 예시.

Then I made the real version ([#237](https://github.com/Waldo0926/monash-hub/pull/237)). The question was how to count searches without keeping anything about the people who make them.

## A word, a day and a count

Each row in the new `search_terms` table holds a term, a day and a count. No IP, no account, no time of day. A search is counted once, and only when it found something:

```python
def normalise(query):
    term = " ".join(query.split())
    if not 2 <= len(term) <= 60 or len(term.split()) > 4:
        return None          # sentences are not search terms
    if "@" in term or "://" in term or LONG_NUMBER.search(term):
        return None          # an email, a link, a phone or student number
    return term
```

An email address, a pasted link or a run of six or more digits is never stored, whatever it found.

## One person should not be able to put words on the home page

The site is small. Without limits, one person searching the same word thirty times would put it on the front page for everyone. So the list the home page reads has two guards:

```python
capped = func.sum(func.least(SearchTerm.hits, DAILY_CAP))   # at most 20 a day
rows = db.execute(
    select(SearchTerm.term, func.max(SearchTerm.label), capped.label("hits"))
    .where(SearchTerm.day >= since)                            # the last 14 days
    .group_by(SearchTerm.term)
    .having(func.count(func.distinct(SearchTerm.day)) >= 2)   # on two different days
    .order_by(capped.desc(), SearchTerm.term)
    .limit(limit)
).all()
```

A day adds at most 20 to a term, and a term has to have been searched on two different days. Rows older than 60 days are deleted. Until at least three terms pass, the home page shows the six examples again, labelled as examples.

These guards raise the cost. They do not make it impossible: someone who searches the same real term on two days can still get it listed. Since a term only counts when it finds something on the site, the worst case is a real unit code or topic showing up that not many people searched.

## Takeaways

- The part of a URL after `#` is a free way to pass data between two copies of your own page without the server.
- Read your privacy notes again after each feature. Mine was true when written and wrong a few features later.
- Before showing "popular" anything, decide what one person can do to it. Caps per day and a minimum number of days are cheap.

Code: [planCode.ts](https://github.com/Waldo0926/monash-hub/blob/main/frontend/utils/planCode.ts), [plan.vue](https://github.com/Waldo0926/monash-hub/blob/main/frontend/pages/plan.vue), [popular.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/search/popular.py).
