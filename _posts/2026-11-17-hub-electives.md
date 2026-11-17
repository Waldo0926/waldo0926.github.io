---
layout: post
date: 2026-11-17 12:00:00 +0800
project: Monash Hub
description: "A page on Monash Hub for finding free electives by what students ask: is there an exam, does it need a prerequisite, is it taught at my campus. Why there is no final exam filter, and how the bot sends people there."
ref: hub-electives
lang: en
preview: hub-electives
title: "Finding an elective on Monash Hub"
image: /assets/og/hub-electives.png
---

Choosing a free elective comes down to three questions that I get asked every semester: does it have an exam, does it need a prerequisite, and is it taught at my campus. [Monash Hub](https://monashhub.secureview.tech) could already filter the unit list on all three, but nobody finds a filter they do not know exists. So there is now a [page for electives](https://monashhub.secureview.tech/electives) that links straight into the list with those filters set.

## What the page does

Each shortcut opens the unit list with the filters already applied, and shows how many units are behind it, so nobody opens an empty list. The shortcuts are no exam listed, no prerequisite listed, both together, and level 1 units with no prerequisite listed. A campus switch at the top (Malaysia or Australia) follows the same cookie as the home page. There is also a list of units with no exam listed, grouped by faculty.

The page never says a unit is easy and never recommends one. Whether a unit counts as a free elective depends on the course, so the page says to check the course page or the progression map, and ask the faculty when unsure.

## What "no prerequisite" means

The `no_prereq` filter keeps the units that have no prerequisite group in the Handbook data. It means the Handbook lists none. An entry requirement written only in the unit's description text is not a prerequisite group, so it can still exist. The page says this next to the filter, because "not listed" is not the same as "none".

## Why there is no final exam filter

Students often ask for units with no final exam, and I wanted to add that filter. Then I looked at the data. The exam filter works from assessment names that contain "exam" or "examination". In a sample of 120 live units I found 55 such items. Only 3 were named final and 1 was named mid. The other 51 were just called "Examination".

So the Handbook data cannot tell a final exam from a midterm, and a filter that claimed to would be guessing. I kept one filter, "no exam listed", and the page says that final and midterm exams both count as exams, while quizzes and tests do not. A student who wants to avoid a final still needs to open the unit and read the assessment table.

I also got this wrong once. My first wording on the page and in the bot said units with "no final exam", which the filter does not know. I changed it to "no exam listed" in [#291](https://github.com/Waldo0926/monash-hub/pull/291).

## How the bot sends people there

In `qa/hub-topics.json` there are four answers for the [bot](https://github.com/Waldo0926/mumguide-wechat-bot). When someone asks about electives, units without an exam, units without a prerequisite, or what is taught in a semester, it replies with the electives page and the unit list link with the filter set, for the Malaysia campus, plus a line on how to switch campus. If someone asks for "no final exam", the answer says one filter exists, for no exam listed, and explains what that covers. The answers have to be imported on the server before the bot uses them.
