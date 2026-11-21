---
layout: post
date: 2026-11-01 04:10:00 +0800
project: Homelab
description: "Two J1900 boxes, a Debian N1 and a VPS, and how I decide what stays online and what can be wiped."
ref: spare-machines
lang: en
title: "What runs on my two J1900 boxes and the N1"
image: /assets/og/spare-machines.png
---

I got two old J1900 machines working again. I also have an N1 box running Debian, and a VPS that hosts my public services. Before deciding what else to run on them, I want to know what I'd lose if one of them stopped working.

## Not everything runs at home

The public sites run on the VPS, which already has HTTPS, automatic deploys and monitoring. Copying all of that to home machines doesn't help much. The home IP changes, and power cuts, disk failures and router restarts are harder to deal with.

For now the larger J1900 is meant as a backup or standby, the other J1900 is for experiments, and the N1 is a small Debian test node. These are plans and nothing fails over automatically yet. Some of the machines can just stay off.

## Writing down the restore steps

I want to write down what happens if the VPS or one of the disks fails:

- Which data exists in only one place?
- Can I restore a database and its files on a clean machine?
- How do I SSH in when the home IP changes?
- Which jobs need a schedule and which only run when I start them?
- Does an alert report a new failure, or the same one all day?

Installing Debian doesn't answer any of these.

## Older projects

My [homelab network automation](https://github.com/Waldo0926/homelab-network-automation) and [edge fleet operations](https://github.com/Waldo0926/edge-fleet-ops-automation) repositories are cleaned up rebuilds of earlier tools and don't describe what runs on these machines now.

Some ideas from them I want to reuse: keeping alert state, checking a few times before acting, limiting what automation can do, and running in dry run mode by default. I'll write about a real restore once I've done one.
