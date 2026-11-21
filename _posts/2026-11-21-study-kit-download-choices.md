---
layout: post
date: 2026-11-21 11:45:00 +0800
project: Study Kit
description: "Study Kit 1.16.0 lets you cap file size, leave out kinds of files and skip videos, then shows what it skipped so you can get any of it back with one command."
ref: study-kit-download-choices
lang: en
source_repo: monash-study-kit
source_checked: 2026-11-21
title: "Skip the 2 GB dataset, but keep a list of what you skipped"
tags: [Python, Moodle, CLI, MCP]
image: /assets/og/study-kit-download-choices.png
---

[Study Kit](https://github.com/Waldo0926/monash-study-kit) copies every file your units put on Moodle to your computer, so your AI app can search and read them. Videos were already left out by default. Everything else came down, including the odd 2 GB dataset or a zip of last year's recordings.

The Chrome extension [Monash Moodle Downloader](https://github.com/Zetanegative1/Monash-Moodle-Downloader), added a size limit and type filters in 4.7.0. That made me look at what Study Kit was missing.

## Choosing what gets downloaded

1.16.0 adds two settings next to `download_videos`:

- `max_file_mb`, 300 by default. Bigger files become a link with their size
- `skip_types`, for whole kinds of files: `pdf`, `slides`, `docs`, `sheets`, `archives`, `images`, `audio`, `code`

For one sync only, `monash sync --videos`, `--max-mb 50` or `--skip-types archives` change them without touching your settings.

Moodle addresses often say nothing about the file. A resource is `view.php?id=…`, and the real file can sit behind a CloudFront link with no extension. So the check runs on the response headers, before anything is written: the real name from `Content-Disposition`, the type from `Content-Type`, the size from `Content-Length`. If the server sends no length, the download counts bytes and stops at the limit, and the partial file is removed.

The same rules now apply inside Moodle folders, which come down as one zip. That fixed an old bug: videos inside a folder zip were extracted even with `download_videos` off.

## Skipping is only half of it

A limit is only useful if you can see what it caught. Otherwise you find out the night before the exam that the dataset for the assignment never came down.

So every skip goes into a table, and `monash sync` names the files it skipped for the first time. `monash skipped` lists all of them:

```text
FIT2109
  [3] Week 05/Dataset.csv (too big, 512 MB)
  [7] Week 09/Project data/raw.zip (too big, 1200 MB)
```

(The real output is in Chinese, like the rest of the CLI.)

From there you have two ways back:

- `monash skipped --get 3` for one or two files. It ignores the limit and checks your free disk space first
- `monash sync --max-mb 2000` for many. Files you already have are not downloaded again, only the skipped ones are

You can also just ask your AI app "which files weren't downloaded?" and then "get the dataset one".

The numbers are the table's row IDs. Sync updates rows in place instead of deleting and inserting them again, so the number you saw stays the same after the next background sync. That small choice is what makes `--get 3` safe to type a few minutes later.

## Two bugs found on the way

**Partial syncs had no lock.** The full sync takes a lock so the AI app's hourly sync and a terminal sync never run together. `monash sync FIT2109`, `monash export --sync` did not. If both ran on the same unit, one could delete the other's partly downloaded files. All of them, and the new `--get`, now share the lock and say "try again when it's done" when it's busy.

**Windows reserved names.** A file called `CON.pdf` or `NUL` can't be saved on Windows, so that file failed every sync. Those names now get a `_` in front.

## What I left out

I looked at downloading in parallel. Folders already come as one zip, and the kit keeps a 0.4 second gap between requests so Moodle never sees a burst. Parallel downloads would need locks around the cookie jar and the database for not much gain, so it stays one at a time.

Everything above is in the [changelog](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md), and the guide is on [docs.secureview.tech](https://docs.secureview.tech/study-kit/cli/#choose-what-gets-downloaded).
