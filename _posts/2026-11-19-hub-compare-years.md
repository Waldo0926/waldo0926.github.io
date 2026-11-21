---
layout: post
date: 2026-11-19 10:30:00 +0800
project: Monash Hub
description: "Compare requisites, campuses, teaching periods, assessments and exams between two Handbook years. A missing year is shown as unknown."
ref: hub-compare-years
lang: en
source_repo: monash-hub
source_checked: 2026-11-19
title: "Comparing a unit across Handbook years"
tags: [Nuxt, FastAPI, PostgreSQL, Handbook]
image: /assets/og/hub-compare-years.png
---

"Did FIT2102 change for 2027?" sounds like a quick question. Answering it means opening two Handbook pages and reading them line by line: prerequisites, campuses, teaching periods, assessment weights, whether there is an exam. [Monash Hub](https://monashhub.secureview.tech) already keeps each Handbook year it loads, so the [compare page](https://monashhub.secureview.tech/units/compare) does that reading for you.

## How to use it

Enter a unit code, pick a From year and a To year, and press Compare. Each part of the unit is marked added, removed, changed, unchanged or unavailable, and every result links back to the original Handbook page with the date it was last checked. It is also linked from unit search as "Compare years".

Optionally add your degree code and the year you started. Your degree's rules come from the year you started, not the year a unit is taught, so the comparison shows that degree edition next to the unit and links to your course map. Those are two separate things and the page keeps them apart.

## A missing year is not a discontinued unit

If Hub has no record of a unit for a year, that can mean the unit stopped running, or that the year hasn't loaded, or that a fetch failed. The page says it is unavailable and stops there. It never falls back to the nearest year. In a check on 8 November, C2001 had a 2025 edition but returned an explicit 404 for 2024, and the page is required to show 2024 as missing rather than quietly use 2025.

## An empty list needs proof

This was the subtle bug. The API always sent a missing collection, like prerequisites, as `[]`. So "this unit has no prerequisites" and "we never read the prerequisites" looked the same, and a comparison could say a prerequisite was removed when it had simply not been loaded.

The parser now stores a small flag for each collection saying whether the source page actually had that section. A comparison only calls an empty list unchanged, added or removed when it has that proof. Old records without the flag stay unknown until the normal Handbook refresh fills it in. The flag doesn't change a unit's content hash, so adding it doesn't look like a policy change or invalidate translations.

## Two smaller fixes

Changing the year after a comparison used to relabel the old result with the new years without loading anything. Now an edited form is marked pending until you compare again, overlapping requests are blocked, and a response for the wrong unit or year is thrown away.

## What it doesn't do

It compares one unit between two years. It doesn't work out whole-degree equivalences, credit transfer or whether you meet a requirement. For those, the page points you to the course map and the official Handbook. The design notes are in [HANDBOOK-COMPARISON.md](https://github.com/Waldo0926/monash-hub/blob/main/docs/HANDBOOK-COMPARISON.md).
