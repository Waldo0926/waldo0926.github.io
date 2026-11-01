---
layout: post
date: 2026-11-01 07:10:00 +0800
project: Blog
description: "Writing, building and serving a static blog are different jobs. GitHub Pages remains a mirror; the VPS serves the main domain."
ref: blog-build-rollback
lang: en
title: "Why I use Jekyll but serve the blog from my own VPS"
image: /assets/og/site.png
---

I was tempted to make the blog a full web app. More projects, better navigation and search can all make a database-backed rewrite sound appealing. But the thing this site does most is still simple: it turns Markdown into pages.

I kept Jekyll. It already handles posts, layouts, feeds and the sitemap. Chinese and English versions share a reference so readers can switch languages. A nicer portfolio homepage didn't require throwing that away.

## Building and serving are separate jobs

The source lives in [waldo0926.github.io](https://github.com/Waldo0926/waldo0926.github.io). GitHub Actions builds the static site into a dedicated site branch. My VPS pulls those generated files on a schedule and serves blog.secureview.tech.

Visitors don't need the Jekyll toolchain running on the VPS. The GitHub Pages address stays available as a separate mirror. Two working URLs are useful, but I wouldn't call that automatic failover.

## Small publishing pipelines still break

One accidental broken template can take down an entire page. I added PR checks for the Jekyll build and the social preview images, rather than discovering missing assets after publishing.

Links are the other maintenance cost. Bilingual posts must point to each other, and the project archive needs the same treatment. Domain or navigation changes can break these relationships without touching a line of application code.

The [repository](https://github.com/Waldo0926/waldo0926.github.io) documents the current workflow. This post records how the blog is built today, not a promise that its deployment will never change.
