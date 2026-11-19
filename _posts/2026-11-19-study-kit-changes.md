---
layout: post
date: 2026-11-19 09:00:00 +0800
project: Study Kit
description: "Study Kit 1.12 adds monash changes: a local log of new files, edited assignment instructions, moved deadlines and staff replies. How it decides what changed without asking Moodle twice, and why it never reports a file as removed."
ref: study-kit-changes
lang: en
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "What changed in my units this week?"
tags: [Python, SQLite, Moodle, Ed]
image: /assets/og/study-kit-changes.png
---

Every week someone in a group chat asks whether the A2 deadline moved or whether the lecturer changed the spec. Moodle doesn't tell you. You have to remember what it said last week and compare. [Study Kit](https://github.com/Waldo0926/monash-study-kit) already syncs a copy of each unit to my laptop, so in 1.12 I made it remember what it saw and tell me what is different.

## What it shows

```bash
monash changes --days 7
```

It lists new or edited course files, assignment instructions that were rewritten, deadline times that moved (with the old and new time), and new staff replies on Ed. Each line has the unit, what kind of change it is, and a link back to the original. The same list shows up when I ask my AI "what changed this week?", and inside `study todo`.

## How it works

All of it lives in `changes.py` and one local SQLite file, `changes.db`. During a normal sync, each item gets a fingerprint. Course files, Ed lesson files and saved assignment instructions get a SHA-256 of the file. Deadlines are compared by their due time. Staff posts and replies on Ed get a SHA-256 of their text. The next sync compares fingerprints. Nothing extra is fetched from Moodle or Ed for this; it only looks at what the sync already downloaded.

Hashing every PDF on every sync would be slow, so for files it keeps the path, modified time and size next to the hash. If those three haven't changed, it reuses the old hash.

## Three rules I care about

**The first sync is only a baseline.** The first time it sees a unit, it records everything and reports nothing. Otherwise a new install would announce that every file in the unit is "new".

**It never reports something as removed.** If an item is missing from one sync, that could be a real removal, or a page that timed out halfway. I can't tell the two apart reliably, so the log only records additions and changes. A false "the brief was deleted" is worse than saying nothing.

**It forgets.** Entries older than 90 days are dropped, and the table keeps at most 5,000 rows.

## The part that made it worth doing

The change log is only useful if syncs are reliable, so most of 1.12 is actually about that. A Moodle outage or rate limit used to look the same as an expired login. Now they are told apart, safe reads retry with backoff, and a sync that only half worked says so instead of reporting success. `monash sync --retry-failed` retries just the activities, posts and Lessons that failed last time, rather than the whole semester.

The [changelog for 1.12.0](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md) lists the rest, including Australian timezones with daylight saving (`monash config timezone Australia/Melbourne`).
