---
layout: post
date: 2026-11-01 04:10:00 +0800
project: Homelab
description: "Two J1900 boxes, a Debian N1 and a VPS. Before finding more services to run, I need to decide what should stay online and what should remain disposable."
ref: spare-machines
lang: en
title: "Two J1900 boxes and an N1: why I don't need more production servers"
image: /assets/og/site.png
---

I recently got two older J1900 machines working again. There's also an N1 box running Debian, and the VPS that already hosts my public services. Having spare hardware brought back a familiar question: what else can I run on it?

This time I want to answer a different question first: which things need to survive when one of those machines stops working?

## Not every box needs to run a website

My public sites already run on a VPS with HTTPS, automated deployment and monitoring. Replicating every production service at home isn't automatically useful. A home connection has a changing public address, and power, disks and router restarts introduce failure modes I don't control as easily.

For now I see the larger J1900 as a backup or standby box, the other J1900 as an isolated place to experiment, and the N1 as a small Debian/Linux test node. These are roles I'm working towards, not a claim that failover or a production backup is already implemented. Some machines can simply stay off.

## The restore matters more than the backup

I want to write down exactly what would happen if the VPS or one of the disks failed:

- What data exists in only one place?
- Can I restore a database and the files that belong to it on a clean machine?
- How do I still get in over SSH when the home IP changes?
- Which jobs need a schedule and which should run only on demand?
- Will an alert describe a new failure, or repeat the same message all day?

A working Debian install doesn't answer any of those questions.

## Keeping the useful parts of older projects

My [homelab network automation](https://github.com/Waldo0926/homelab-network-automation) and [edge fleet operations](https://github.com/Waldo0926/edge-fleet-ops-automation) repositories are sanitized reconstructions of earlier tooling, not claims about the current machines.

The ideas that still seem worth carrying forward are stateful alerts, consecutive checks before acting, tight limits on automated operations, and dry-run by default. I'll document an actual restore exercise when I've completed one. That's a more useful result than a list of boxes I happen to own.
