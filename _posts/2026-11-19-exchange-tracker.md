---
layout: post
date: 2026-11-19 12:00:00 +0800
project: Exchange Tracker
description: "Since August a small box at home has read every Monash semester exchange program each evening and recorded what changed: new partners, places, cut-offs, open or closed. What it takes to do that politely, why the comparison is rebuilt from scratch every time, and why a similar course title is not a credit match."
ref: exchange-tracker
lang: en
source_repo: monash-abroad-tracker-demo
source_checked: 2026-11-19
title: "Watching Monash's exchange list change, one evening at a time"
tags: [Python, Web scraping, systemd, Data quality]
image: /assets/og/exchange-tracker.png
---

Monash lists its semester exchange partners on the [program search](https://www.monash.edu/study-abroad/outbound/program-search). Each program shows whether it's open, how many places there are, the cut-off and an availability colour. What the page doesn't show is what it said last week. When I started planning my own exchange, the question I kept asking was "did that one just close, or was it always like this?"

So since August a tracker has read the whole list every evening and kept what changed. The live data and the crawler are private. A [public demo](https://waldo0926.github.io/monash-abroad-tracker-demo/) shows the same viewer with made up data, and [its README](https://github.com/Waldo0926/monash-abroad-tracker-demo) explains the design.

## Reading it politely

There is no list of universities in the code. Each run reads the search page, keeps every card whose type is Semester exchange (about 164 of them), then opens each detail page.

It's one request at a time. `robots.txt` is read live on every run, and its `Crawl-delay: 30` is followed, with 30 seconds as the floor even if the file can't be fetched. That makes a full run about 85 minutes. Slow is fine for something that runs once a day.

Things go wrong on a site you don't control, so the rules are conservative:

- If a detail page fails, the program keeps its previous values. A timeout is not a deletion.
- If the search page fails, the whole run stops and the data isn't touched.
- If the number of programs drops by more than 20% from the last run, a guard trips and nothing is written.

## Keeping what the page actually said

Every field is stored twice: the page's own text and a normalised value. `OPEN.` becomes `Open`, `60% WAM` becomes `60.0` and `WAM`. When the viewer says a cut-off went up, I can always go back to the exact words Monash used.

A new snapshot file is written only when something really changed. Running it again on the same day adds nothing.

## Comparing against the last round

Comparing with yesterday turned out to be useless. On most days nothing changes, so the "changes" column was empty. What students actually want to know is how this round differs from the last application round.

The last round is frozen as a baseline in the repo. The comparison table is rebuilt every time as a function of two inputs, the baseline and today's data. It's never edited in place, so a wrong row can't survive into the next day. Fewer places or a higher cut-off show as harder, and more places or reopening show as better.

When a round closes, its final dataset is archived on its own: the original JSON and CSV byte for byte, an Excel copy people can filter, when the run started and finished, and SHA-256 checksums. That archive can become the next round's baseline.

## Why it runs at home

GitHub's hosted runners get HTTP 403 from the Monash site, so the crawl runs on a small Debian box at home with systemd timers. It runs every evening at 19:00, because the site is edited during office hours. Retries every two hours only crawl if the last scheduled run is more than 20 hours old. A manual run never counts as the evening one.

Running unattended found bugs I wouldn't have found otherwise:

- Git conflict markers ended up inside the generated data, because the script crawled first and pulled second. It now syncs first and refuses to commit if there's a conflict.
- A run takes 90 minutes. Anything written to the data during that time was overwritten when the run saved its own copy at the end.
- Under `set -o pipefail`, `git log | grep -q` sometimes counted as a failure. grep exits as soon as it matches, git gets SIGPIPE and exits with 141, and the whole pipe fails. So "already crawled today" randomly said no and the site got crawled twice.
- An earlier macOS launchd job never ran at all, because the script lived on the Desktop and macOS privacy protection blocked it.

Every refresh now also runs a contract check before anything is published: the schema, one record per program URL, and that the JSON and CSV copies agree. Data-only commits used to skip CI, so this check runs inside the refresh itself.

## What the data can't tell you

Tracking the list made one thing very clear while I planned my own units: a similar course title is a search clue, not a credit match.

What decides it is the unit outline, the assessment, the credit points, the level, and whether the unit is actually taught in the semester you'll be there. A perfect match that only runs in the other semester is no use. I also keep three kinds of match apart: ones that look right from public information, ones a faculty has discussed, and ones with written approval. An old mapping has to be checked again when the partner changes its offerings.

The tracker tells you when a program opens, closes or gets harder. Whether its units count toward your degree is still a question for your faculty.
