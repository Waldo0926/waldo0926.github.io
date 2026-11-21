---
layout: post
date: 2026-11-21 11:45:00 +0800
project: Study Kit
description: "Study Kit 1.16.0 adds a file size limit and file type filters. Skipped files can be listed and downloaded with monash skipped."
ref: study-kit-download-choices
lang: en
source_repo: monash-study-kit
source_checked: 2026-11-21
title: "Study Kit 1.16.0: download size limit and skipped files list"
tags: [Python, Moodle, CLI, MCP]
image: /assets/og/study-kit-download-choices.png
---

[Study Kit](https://github.com/Waldo0926/monash-study-kit) syncs your units' Moodle files to your computer so your AI app can search and read them.

Before this release only videos were skipped by default. Everything else was downloaded, including datasets or zipped recordings of a few GB in some units.

The Chrome extension [Monash Moodle Downloader](https://github.com/Zetanegative1/Monash-Moodle-Downloader) added a size limit and type filters in 4.7.0, and I added the same to Study Kit.

## New settings

Two settings next to `download_videos`:

- `max_file_mb`: 300 by default. Larger files are saved as a link with their size
- `skip_types`: kinds of files not to download: `pdf`, `slides`, `docs`, `sheets`, `archives`, `images`, `audio`, `code`

For one sync only, use `monash sync --videos`, `--max-mb 50` or `--skip-types archives`. Settings are not changed.

Moodle addresses often don't show the file type. A resource is `view.php?id=…`, and the actual file can be a CloudFront link with no extension.

So the check happens after the response headers arrive and before anything is written: the name from `Content-Disposition`, the type from `Content-Type`, the size from `Content-Length`.

If the server sends no size, the download counts bytes, stops at the limit and deletes the partial file.

Moodle folders are downloaded as one zip, and the files inside now follow the same rules. This also fixed an old bug: videos inside a folder zip were extracted even with `download_videos` off.

## Listing and downloading skipped files

Skipped files are stored in a table in the database. At the end of `monash sync` it lists the files skipped for the first time.

`monash skipped` lists all of them:

```text
FIT2109
  [3] Week 05/Dataset.csv (too big, 512 MB)
  [7] Week 09/Project data/raw.zip (too big, 1200 MB)
```

The CLI prints this in Chinese; it is translated here.

Two ways to download them:

- A few files: `monash skipped --get 3`. It ignores the limit and checks free disk space first
- Many files: `monash sync --max-mb 2000`. Files already downloaded are not downloaded again

You can also ask your AI app which files were not downloaded and tell it which ones you want.

The numbers are the table's row IDs. Sync updates existing rows, so the numbers stay the same after a background sync.

## Two fixes

**No lock when syncing one unit.** A full sync takes a lock so the AI app's background sync and a terminal sync don't run at the same time, but `monash sync FIT2109` and `monash export --sync` didn't. If both synced the same unit, one could delete the other's partly downloaded files. Both commands and `--get` now use the same lock and ask you to try again later if a sync is running.

**Windows reserved names.** Files named `CON.pdf` or `NUL` can't be saved on Windows, so they failed on every sync. They now get a `_` in front.

## Not done

I considered parallel downloads. Folders already come as one zip, and the kit waits 0.4 seconds between requests to keep load on Moodle low. Parallel downloads would need locks around the cookie jar and the database, so files are still downloaded one at a time.

Details are in the [changelog](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md) and the guide is on [docs.secureview.tech](https://docs.secureview.tech/study-kit/cli/#choose-what-gets-downloaded).
