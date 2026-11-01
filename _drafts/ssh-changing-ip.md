---
layout: post
project: Homelab
description: "My J1900 can be reached on the LAN and awakened remotely from another machine, but a changing residential IPv4 address makes a hard-coded SSH hostname unreliable."
ref: ssh-changing-ip
lang: en
title: "How I'm thinking about SSH access with a changing home IP"
image: /assets/og/site.png
---

> Editorial draft: verify facts and references before publication. Not published on the site.

My J1900 can be reached on the LAN and awakened remotely from another machine, but a changing residential IPv4 address makes a hard-coded SSH hostname unreliable.

There are two different problems: locating the current network address and controlling who can authenticate. Dynamic DNS solves the first, not the second.

The next design pass needs to separate DNS updates, router forwarding, SSH keys, jump hosts and LAN recovery. Cloudflare can host the DNS records, but a DNS record isn't a security boundary or an SSH tunnel.

This is a review draft rather than a verified setup guide. It intentionally excludes my residential IP, port mappings, device addresses and all credentials. I'll publish exact configuration advice only after checking the real setup and recovery path.
