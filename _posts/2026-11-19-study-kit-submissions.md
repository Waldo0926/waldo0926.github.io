---
layout: post
date: 2026-11-19 09:30:00 +0800
project: Study Kit
description: "Study Kit can read what you or your group submitted together with the marking feedback, so your AI app can go through the comments with you."
ref: study-kit-submissions
lang: en
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "Study Kit 1.13: reading your submissions and feedback"
tags: [Python, Moodle, MCP, Privacy]
image: /assets/og/study-kit-submissions.png
---

When marks come back, the feedback sits on one Moodle page and the file I submitted sits on another. To work out where I lost marks I end up with two tabs and a rubric in a third. Study Kit could already show grades, but not what I actually handed in. In 1.13 it can.

## How to use it

In your AI app, ask something like:

> Read what I submitted for A1 and go through the marker's comments with me. Where did I lose marks?

The AI gets your submitted files or online text and the complete feedback for that assignment, then reads them side by side. In a terminal the same thing is:

```bash
monash moodle submission <activity id> --json
```

The activity ID is the number in the assignment list (`cmid`), not the unit's ID.

## What it reads

- Files you or your group submitted, and online text if the assignment uses it.
- The full marking feedback for that assignment.
- PDFs page by page, and PDF, DOCX and PPTX files inside a zip you submitted.

Video isn't transcribed, and a scanned PDF still needs OCR before there is any text to read.

## Where the files go

Submissions are downloaded with your own Moodle login and kept in a separate `data/submissions/` folder. They don't go into the course library, the full-text index or [whole-unit exports]({% post_url 2026-11-03-study-kit-course-materials %}), so sharing an export never shares your work.

Every read checks again that you can still see that assignment and that the file belongs to it. Downloads stop at 256 MiB. Cookies are not sent on to another site if Moodle redirects a download. A materials-only profile, the kind used for exporting another account's course files, can't read submissions at all.

## What it won't do

It is read-only. It can't submit, resubmit or change anything on Moodle. It reads feedback on work that has already been marked; it doesn't attempt quizzes and isn't meant for answering graded work. The point is understanding comments you already have.

## A fix that came right after

In 1.13.1 the assignment list started giving each item a `read_path`, so an AI that starts from grades can go straight to the submission. That release also keeps a complete cached copy if a later download is cut short, treats a login page in a response as an expired session instead of a file, and reads collapsed online text only inside the submission area. Details are in the [changelog](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md).
