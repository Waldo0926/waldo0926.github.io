---
layout: post
date: 2026-11-01 07:40:00 +0800
project: Homelab
description: "The Linux checks track state, so they alert on a new problem and on recovery instead of every run, and automatic fixes have limits."
ref: stateful-alerts
lang: en
title: "Server alerts that only report changes"
image: /assets/og/stateful-alerts.png
source_repo: edge-fleet-ops-automation
source_checked: 2026-11-01
---

With several Linux machines, the first monitor most people write is a scheduled SSH check that looks at disks and containers and sends a message when something is wrong.

That works at first. But a failure that lasts for hours sends the same message on every run, and dozens of identical alerts make a new problem easy to miss.

## Keeping state between checks

[Edge Fleet Ops Automation](https://github.com/Waldo0926/edge-fleet-ops-automation) is a cleaned up rebuild of tools I used for Linux edge nodes. The parts worth reusing are node discovery, health checks, saved state and deduplicated alerts.

The first time a disk goes over the threshold, I get an alert. The next ten checks don't repeat it. When it recovers, I get one more message. Requiring a few failed checks in a row also avoids alerts from short network drops.

## Limits on automatic fixes

Deleting files, restarting services and freeing disk space can be automated, but a wrong action can make things worse. I run these in dry run mode first, keep each one narrow, and decide case by case which ones can run unattended.

The public repository doesn't mean these tools run on my J1900 or N1 boxes now. It records the approach I want to reuse when I set up their monitoring again.
