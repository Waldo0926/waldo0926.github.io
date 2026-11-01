---
layout: post
date: 2026-11-01 07:20:00 +0800
project: Monash Hub
description: "Putting units into semesters is easy. Checking prerequisites, campus and offering periods against the Handbook is the harder part."
ref: monash-planner-reason
lang: en
title: "Why I built a degree planner for Monash students"
image: /assets/og/site.png
---

The annoying part of planning a Monash degree isn't entering unit codes. It's checking whether each unit is available at your campus, whether it runs in the semester you chose and whether its prerequisites can be completed beforehand.

A spreadsheet can hold a plan. It doesn't automatically verify those constraints. That gap is one reason I built [Monash Hub](https://github.com/Waldo0926/monash-hub).

## Keep the plan local; verify against the source

Students can drag units between terms, undo changes and export their plans. When they ask the app to check a plan, the relevant entries go to an API backed by the Handbook data. The server doesn't need to keep a permanent copy of the personal plan.

The distinction between “not found” and “not allowed” matters. Missing a unit for a year in the local dataset doesn't prove the unit was cancelled. A prerequisite warning also needs a reason and a way back to the official source.

## A warning is not a university ruling

The tool cannot approve a prerequisite exemption, overseas credit transfer or graduation. It can identify possible conflicts early and point the student to the relevant Handbook entry.

Sometimes its most useful answer is not a green check, but a specific question the student knows to take to the faculty.

The [source](https://github.com/Waldo0926/monash-hub) shows the current plan model and rule checks. Comparing different Handbook years properly is still an area for improvement; I don't want newer rules silently replacing what applied to an older study plan.
