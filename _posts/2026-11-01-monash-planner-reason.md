---
layout: post
date: 2026-11-01 07:20:00 +0800
project: Monash Hub
description: "Checking prerequisites, campuses and teaching periods against the Handbook, with a source for each result."
ref: monash-planner-reason
lang: en
title: "Why I built a degree planner for Monash"
image: /assets/og/monash-planner-reason.png
source_repo: monash-hub
source_checked: 2026-11-01
---

When I plan a Monash degree, typing in unit codes is quick. What takes time is checking whether each unit runs at my campus, whether it is offered in the semester I picked, and whether I can finish its prerequisites before then.

A spreadsheet can hold a plan but it doesn't check any of that. That is one of the reasons I built [Monash Hub](https://github.com/Waldo0926/monash-hub).

## The plan stays in the browser

Students drag units between semesters, undo changes and export the plan. When they ask for a check, the units in the plan are sent to an API that uses Handbook data. The server doesn't keep a copy of the plan.

"Not found" and "not allowed" are treated differently. If the local data has no record of a unit for a year, that doesn't mean the unit was cancelled. A prerequisite warning comes with the reason and a link to the Handbook entry.

## Warnings, not approvals

The tool can't approve a prerequisite exemption, credit transfer or graduation. It points out possible problems early and links to the Handbook page, so the student knows what to ask the faculty.

The [source](https://github.com/Waldo0926/monash-hub) has the plan model and the checks. Comparing different Handbook years still needs work, because newer rules shouldn't replace the ones that applied when a student started.
