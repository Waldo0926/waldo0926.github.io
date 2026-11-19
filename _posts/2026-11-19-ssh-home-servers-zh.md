---
layout: post
date: 2026-11-19 12:15:00 +0800
project: Homelab
description: "家里的公网 IP 会变，有些机器又藏在别的机器后面，我怎么从端口转发加 DDNS 换成 Tailscale 加 ProxyJump，为什么每台机器有两个名字，以及换地址时靠 HostKeyAlias 这一行，不用盲目接受新密钥"
ref: ssh-home-servers
lang: zh-Hans
source_checked: 2026-11-19
title: "家里 IP 一直变，怎么稳定 SSH 回服务器"
tags: [SSH, Tailscale, Linux, Networking]
image: /assets/og/ssh-home-servers-zh.png
---

在讲[闲置机器]({% post_url 2026-11-01-spare-machines-zh %})那篇里，我留了一个问题：家里公网 IP 变了以后，怎么还能 SSH 进去？现在这个问题解决了，下面是现在实际在跑的做法，地址、端口、域名和密钥名都故意没写

机器有这些：家里两台 J1900（其中一台每天晚上跑[交换 tracker]({% post_url 2026-11-19-exchange-tracker-zh %})），一台跑 Armbian 的 ARM 小盒子，同一个网络里还有一台 N1，以及放我公开网站的 VPS，我的笔记本通常在完全不同的地方

## 一开始的做法

最开始是路由器把一个非标准端口转发到其中一台 J1900，`~/.ssh/config` 里写的是家里的公网 IP，运营商一换地址，配置里的地址就错了

常见的解决办法是动态 DNS，这台机器上现在也还跑着几个脚本，每隔几分钟把当前公网 IP 写进 Cloudflare 的 A 记录

其中一个会同时问两个查 IP 的服务，两边不一致就不更新，地址看起来像运营商 NAT（`100.64.0.0/10`）也不更新，因为那种情况下外面本来就连不进来

但 DNS 只回答“机器在哪”，不决定“谁能登录”，一个转发出去的 SSH 端口，不管叫什么名字，都是对整个互联网开放的

## 现在的做法

十月我在主力那台 J1900 上装了 Tailscale，SSH 改成连它的 Tailscale 地址，Tailscale 能穿过两边的 NAT，所以家里 IP 怎么换都没关系

```sshconfig
Host j1900-main
    HostName <tailscale 地址>
    HostKeyAlias <旧地址>
    IdentitiesOnly yes
    StrictHostKeyChecking yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

第二台 J1900 和我的笔记本不在同一个 tailnet 里，所以通过第一台在家里局域网跳过去：

```sshconfig
Host j1900
    HostName <局域网地址>
    ProxyJump j1900-main

Host j1900-lan
    HostName <局域网地址>
    ProxyJump none
    ProxyCommand none
```

ARM 小盒子那边也是一样：`oes` 走 Tailscale，`n1` 是 `ProxyJump oes`

在笔记本上看 `tailscale status`，主力那台显示的是 IPv6 直连，没有走中继，所以 SSH 用起来和在局域网里差不多

## 两个名字，而不是一个聪明的名字

有一天我试过只用一个 `j1900-main`，在哪都能连：用 `ProxyCommand` 先试局域网地址，2 秒连不上再换 Tailscale 地址：

```sshconfig
ProxyCommand sh -c 'nc -G 2 <局域网地址> 22 || exec nc -G 8 %h %p'
```

能用，但看不出这次连接走的是哪条路，而且不在家的时候，每次连接都要先等局域网那次超时

第二天配置又改回了两个普通的名字：`ssh j1900` 在哪都能用，`ssh j1900-lan` 直接走家里网络，两个名字一眼就知道走的是哪条路，也不用每次等一个注定失败的尝试

## 让密钥检查一直开着的那一行

`StrictHostKeyChecking yes` 会拒绝 `known_hosts` 里没有密钥的主机

同一台机器换了一个地址去连，比如从局域网地址换成 Tailscale 地址，或者从以前的公网地址加端口换成局域网地址，SSH 都会把它当成一台“新”主机，虽然密钥根本没变

最省事的办法是再接受一次新密钥，但我不想这么做，因为那个提示本来就是要你认真看的

`HostKeyAlias` 让 SSH 用旧名字去查密钥，这样我之前核对过的那把密钥会继续被检查，换了一把不同的密钥照样会被拒绝

## 机器上放行了什么

主力那台 J1900 上，`ufw` 只放行家里局域网、`tailscale0` 上的流量，以及 UDP 41641，让 Tailscale 可以直连，其他一律不让进

两台 J1900 和 VPS 上，`sshd -T` 显示 `passwordauthentication no` 和 `kbdinteractiveauthentication no`，root 只能用密钥登录

我没有用 Tailscale SSH，Tailscale 只负责提供一条路，谁能进来还是由 OpenSSH 和我自己的密钥决定

第二台 J1900 的网卡也开了 Wake-on-LAN（magic packet）

## 写这篇时才发现的事

那台机器上的几个 DDNS 脚本里，有一个从 10 月 19 日开始一直在日志里写“读取 DNS 记录失败（token 或记录 ID 失效？）”

什么都没坏，因为 SSH 已经不走那条记录了，一个没人依赖的任务，可以安安静静地失败一个月，这几条记录接下来要一条条看一下
