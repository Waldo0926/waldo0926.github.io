---
layout: post
date: 2026-11-01 07:40:00 +0800
project: Homelab
description: "Monitoring Linux nodes isn't just about running checks on a schedule. State, recovery and safe limits make alerts useful."
ref: stateful-alerts
lang: en
title: "Why I want alerts about changes, not an endless stream of pings"
image: /assets/og/stateful-alerts.png
source_repo: edge-fleet-ops-automation
source_checked: 2026-11-01
---

With several Linux machines running separately, the obvious first monitor is a scheduled SSH check: inspect disks and containers and send a message if something looks wrong.

That is straightforward to write. After a while, though, a single persistent failure can send dozens of identical notifications. More alerts can make it easier to miss the one that matters.

## Store state, not just snapshots

[Edge Fleet Ops Automation](https://github.com/Waldo0926/edge-fleet-ops-automation) is a sanitized reconstruction of tools I used for Linux edge nodes. Its useful ideas are node discovery, health checks, persistent state and deduplicated alerts—not one particular SSH command.

The first disk-space threshold crossing should be visible. Ten subsequent checks shouldn't repeat the same message. Recovery is also an event worth reporting. Consecutive failures can reduce noisy actions during brief network drops.

## Automatic repair needs limits

Removing files, restarting services or reclaiming disk space can be automated, but an incorrect action may make an incident worse. I'd rather use dry-run first, scope operations narrowly and decide which changes really can be unattended.

The public repository doesn't imply that every tool is deployed on my current J1900 or N1 boxes. It's a record of the engineering patterns I want to reuse as I rebuild their monitoring.
