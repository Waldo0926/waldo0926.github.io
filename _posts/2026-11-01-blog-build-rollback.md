---
layout: post
date: 2026-11-01 07:10:00 +0800
project: Blog
description: "Posts are built with Jekyll, served from my VPS, and GitHub Pages stays up as a mirror."
ref: blog-build-rollback
lang: en
title: "How this blog is built and served"
image: /assets/og/blog-build-rollback.png
source_repo: waldo0926.github.io
source_checked: 2026-11-01
---

The blog is built with Jekyll. It handles posts, layouts, the feed and the sitemap, and each Chinese post shares a `ref` with its English version so readers can switch language. I thought about turning it into a web app with a database, but the site mostly turns Markdown into pages, so I kept Jekyll and only redid the home page.

## Where it is built and where it is served

The source is in [waldo0926.github.io](https://github.com/Waldo0926/waldo0926.github.io). GitHub Actions builds the site into a separate `site` branch, and my VPS pulls that branch on a schedule and serves blog.secureview.tech. The VPS only serves static files and doesn't run Jekyll.

The GitHub Pages address still works as a mirror. There is no automatic failover between the two.

## Checks on each PR

A broken template can take down a whole page, so every PR builds the site and checks that each post has its link preview image.

Links are the other thing that breaks. The English and Chinese versions of a post link to each other, and so do the project pages. A change to the domain or the navigation can break these without any code change.

The [repository README](https://github.com/Waldo0926/waldo0926.github.io) has the current setup. This post describes how it works now and may go out of date if I change the deployment.
