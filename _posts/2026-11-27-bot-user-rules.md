---
layout: post
date: 2026-11-27 10:40:00 +0800
project: Q&A bot
description: "Per-message filtering doesn't stop one user from repeating the same thing or being rude. The bot now supports per-user no-forward and silent mute rules without changing anything for normal users."
ref: bot-user-rules
lang: en
source_checked: 2026-11-27
title: "Stopping forwards from one user, or staying silent"
tags: [Python, SQLite, WeChat]
image: /assets/og/bot-user-rules.png
---

[Filtering individual messages and capping each person at 5 forwards a day]({% post_url 2026-11-17-bot-forwarding %}) cleared out most small talk and noise.

After using it for a while, per-message filtering still missed a different case: one specific person. The bot's main path has no language model and does no tone check. If someone repeats the same question after being answered, or talks rudely while mentioning a unit or visa, up to five messages a day still land in my chat.

I run the account in my own time, not as a support desk. So I added two per-user rules. Everyone else is untouched and still gets forwarded as before.

## Two levels: no-forward and mute

Each forwarded note already has a short pending id (`#42`), so the commands reuse it:

- `不转 42`: the bot still answers anything it knows, but stops forwarding misses, `人工` and private-chat join requests to me, and stops `@`-ing me in groups.
- `拉黑 42`: complete silence. Every message from that user is dropped.
- `黑名单` and `解除 <index>`: list active rules or lift one if I change my mind.

The easy part to miss in `no_forward` is the wording. If the bot stops forwarding a user but still replies "passed on to Waldo" or leaves "reply 「人工」 to ask Waldo" under an article, the user just keeps asking.

So under `no_forward`, misses and `人工` only link Monash Hub and the 马莫百科 archive. Partial answers strip `ask_owner_tail()`, and the greeting intro and `triage.py` replies drop any mention of me. Setting either rule also marks that user's open `pending` rows as `ignored`, so the next day's reminder does not bring them back.

## More than a check in `brain.py`

A two-line check at the top of `Brain.handle` was not enough once I traced all three WeChat channels.

**Official account (`wxbot/mp.py`).** Greetings ("你好"), non-text fallbacks, the first-message welcome and queued `outbox` replies all run before or outside `Brain.handle`. A muted user has to be stopped at the top of `MPServer.handle`, returning plain `success` so WeChat stays quiet without showing an error.

**Personal account across DMs and groups (`wxbot/pcwx.py`).** The same WeChat account arrives as `pc:<wxid>` in a private chat and `pc:<room>@chatroom|<wxid>` in a group. Rules are stored under a normalised `person_key` (`pc:<wxid>`) so one command covers private chats and every group. Muted users are also dropped before the per-group rate limit (`_room_busy`), so one muted account cannot burn the group's quota for other students.

**The SQL `LIKE` underscore trap.** Closing a user's open pending rows across groups queries `user_id LIKE 'pc:%|' + wxid`. WeChat `wxid_` strings contain underscores, which SQLite `LIKE` treats as a single-character wildcard. The code verifies `person_key(row["user_id"]) == key` in Python before updating so it never closes someone else's row.

**Outside `contact`.** Any user can send `删除我的数据` to delete their rows from `log`, `outbox`, `pending` and `contact`. Keeping moderation rules in a separate `user_rule` table means deleting their own data does not clear a block.

Admins and `OWNER_WXID` are also checked before writing a rule so I cannot accidentally lock myself out.

## What this does not cover

In WeChat, an official account `openid` (`mp:...`) and a personal account `wxid` (`pc:...`) are unrelated ids. There is no way to link them automatically, so if the same person writes on both channels, each side has to be set separately.
