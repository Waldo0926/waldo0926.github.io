---
layout: post
date: 2026-11-19 11:40:00 +0800
project: Q&A bot
description: "The 马莫百科 bot now answers in the Ask panel on Monash Hub, with WeChat-only text removed for website visitors."
ref: bot-on-the-hub
lang: en
source_checked: 2026-11-19
title: "The WeChat bot on Monash Hub"
tags: [Python, FastAPI, Nuxt, WeChat]
image: /assets/og/bot-on-the-hub.png
---

The 马莫百科 WeChat bot answers questions from Monash Malaysia students and parents. Everything it knows comes from official pages it may only [quote word for word]({% post_url 2026-10-25-quote-only-rag %}), and from answers I've [taught it in chat]({% post_url 2026-11-17-bot-learns-from-chat %}).

Monash Hub has its own Ask panel, the round button at the bottom right. That one uses no model at all. It routes the question to the right page, unit or key date on the Hub. It's good at "when does semester 1 start" and "what's FIT2102 like". It knows nothing about printing at the library or how to apply for a Student Pass, which the bot already answers well.

So the Ask panel now asks both.

## How the panel uses the two answers

When you ask something, the page sends the question to the Hub's own router and to the bot at the same time, and waits for both. The bot can take a few seconds when it quotes official pages. If it's slow or down, its part is just missing and the rest still shows.

- If the bot's answer only points back to the Hub, it's hidden, since the panel already shows that page.
- If the bot has its own answer, it appears in a separate bubble labelled as the bot's.
- A greeting or "who are you" gets a short introduction and nothing is searched.

## A website visitor isn't a WeChat follower

The bot runs on a separate server, so the Hub calls a new `POST /web/ask` on it with a shared secret. If the secret isn't set, the route doesn't exist.

Some lines only make sense inside WeChat, like 「回复人工」 or "see more on Monash Hub". Those are removed from web answers.

The bigger difference is what happens when the bot has nothing. In WeChat, a [real question it can't answer is forwarded to me]({% post_url 2026-11-17-bot-forwarding %}). From the website it isn't. I can't reply to an anonymous browser, so forwarding would only give me messages nobody would ever see answered. Instead the panel tells the visitor to ask the 公众号, where I can reply.

Each browser gets a random id, and the bot rate limits that id the same way it limits a WeChat user. On top of that the Hub allows 60 bot questions per address per hour, and the bot gives up on a web answer after 12 seconds. In the bot's logs a visitor shows up as `web:` plus a hash of that random id.

One deployment detail took longer than it should have. The Hub's API runs in a container, and the bot listens on the host's loopback address, which a container can't reach. The fix was an nginx route on the host for `/web/ask`, written up in the operations guide.

## A small fix for 进群

The other change this week was in private chats. People add the MonashGuide WeChat account and ask to join the student group. That account is the one that sends invites, but the bot replied with the 公众号 text telling them to add MonashGuide as a friend. They already had.

Now, in a private chat only, a short request like 进群, 能拉我进群吗 or 群二维码过期了 gets 「请稍等，Waldo 看到后会邀请你进群～」, and I get a note saying who wants to join, at most once a day per person. A longer question that just mentions the group is answered as usual. The 公众号 and group chats didn't change.
