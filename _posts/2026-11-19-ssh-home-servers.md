---
layout: post
date: 2026-11-19 12:15:00 +0800
project: Homelab
description: "Moving from a forwarded port and DDNS to Tailscale and ProxyJump, with two names per host and HostKeyAlias."
ref: ssh-home-servers
lang: en
source_checked: 2026-11-19
title: "SSH to home servers when the IP changes"
tags: [SSH, Tailscale, Linux, Networking]
image: /assets/og/ssh-home-servers.png
---

In my post about [spare machines]({% post_url 2026-11-01-spare-machines %}) I left one question open: how do I still get in over SSH when the home IP changes? It's answered now, so here is the setup as it runs today. Addresses, ports, domains and key names are left out on purpose.

The machines: two J1900 boxes at home (one of them runs the [exchange tracker]({% post_url 2026-11-19-exchange-tracker %}) every evening), a small ARM box running Armbian with an N1 on the same network, and the VPS that hosts my public sites. My laptop is usually somewhere else entirely.

## Where it started

At first the router forwarded a non-standard port to one J1900, and `~/.ssh/config` pointed at the home public IP. Every time the ISP gave out a new address, the hostname in my config was wrong.

The usual fix is dynamic DNS, and the box still runs scripts that put its current public IP into a Cloudflare A record every few minutes. One of them checks two IP services and refuses to update if they disagree, or if the address looks like carrier NAT (`100.64.0.0/10`), because then there's nothing to reach from outside anyway.

But DNS only answers where the box is. It doesn't decide who may log in, and a forwarded SSH port is open to the whole internet whatever its name.

## What it is now

In October I put Tailscale on the main J1900 and pointed SSH at its Tailscale address instead. Tailscale gets through NAT on both sides, so the home IP can change as often as it likes.

```sshconfig
Host j1900-main
    HostName <tailscale address>
    HostKeyAlias <old address>
    IdentitiesOnly yes
    StrictHostKeyChecking yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

The second J1900 isn't on the same tailnet as my laptop, so I reach it through the first one over the home LAN:

```sshconfig
Host j1900
    HostName <LAN address>
    ProxyJump j1900-main

Host j1900-lan
    HostName <LAN address>
    ProxyJump none
    ProxyCommand none
```

The ARM box works the same way: `oes` is reachable on Tailscale, and `n1` is `ProxyJump oes`.

`tailscale status` on my laptop shows the main box as a direct connection over IPv6, not through a relay, so SSH feels like the LAN.

## Two names instead of one clever one

For one day I tried a single `j1900-main` that worked everywhere. A `ProxyCommand` tried the LAN address with a 2 second timeout and fell back to the Tailscale address:

```sshconfig
ProxyCommand sh -c 'nc -G 2 <LAN address> 22 || exec nc -G 8 %h %p'
```

It worked, but it hid which path a connection had taken, and away from home every connection first waited for the LAN attempt to time out. The next day the config went back to two plain names: `ssh j1900` works from anywhere, and `ssh j1900-lan` goes straight over the home network. With two names the path is obvious, and nothing waits for an attempt that can't succeed.

## The line that kept host key checking on

`StrictHostKeyChecking yes` refuses a host whose key isn't in `known_hosts`. Reaching the same box at a new address, a Tailscale one instead of the LAN one, or a LAN one instead of the old public address and port, means SSH sees a "new" host, even though the key is the same.

I didn't want to just accept the new key, since that warning is there to catch a changed host. `HostKeyAlias` tells SSH to look up the key under the old name instead, so the key I already checked keeps being checked, and a different key still gets refused.

## What the boxes allow

On the main J1900, `ufw` allows the home LAN, anything on `tailscale0`, and UDP 41641 so Tailscale can make direct connections. Nothing else comes in.

On both J1900s and the VPS, `sshd -T` says `passwordauthentication no` and `kbdinteractiveauthentication no`. Root can only log in with a key. I don't use Tailscale SSH. Tailscale only gives a route, and OpenSSH with my own keys still decides who gets in.

The second J1900 also has Wake-on-LAN turned on in its network card (magic packet).

## Something I only found while writing this

Of the DDNS scripts on that box, one has been logging "failed to read the DNS record (token or record ID invalid?)" since 19 October. Nothing broke, because SSH no longer goes through that record. A job nobody depends on any more can fail quietly for a month. Those records are next on the list to go through.
