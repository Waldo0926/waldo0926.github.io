---
layout: post
date: 2026-10-30 18:00:00 +0800
project: Study Kit
description: "Study Kit 1.4.0 can now be reached from ChatGPT and Claude on the web. It stays a server for one person: a pairing code from your own terminal, a short list of callback addresses, rotating tokens, and only the tools that read."
ref: study-kit-remote
lang: en
preview: study-kit-remote
title: "Letting ChatGPT reach Study Kit, for one person only"
image: /assets/og/study-kit-remote.png
---

[Monash Study Kit](https://github.com/Waldo0926/monash-study-kit) syncs your own Moodle and Ed to your computer and lets an AI app search them over MCP. Claude Desktop and Claude Code start it as a local program and talk to it over stdio. ChatGPT and Claude on the web or phone cannot do that. They live on someone else's server, so they need an HTTPS address to call.

Version 1.4.0 came out on 30 October with an optional `monash remote` mode for this. This post is about how it is locked down, because a URL on the internet that can read your Moodle is not something to get wrong.

## One person, their own data

I already decided not to host Study Kit for everyone. That would mean keeping every student's Moodle login and Ed token on my server, and one break in would expose all of them. The [docs](https://docs.secureview.tech/private-tools/) explain the same reason.

So remote mode is for the owner of the data only. You run it on your own server, or on your own laptop behind a free Cloudflare quick tunnel, and it serves your synced files to your own AI apps. Setup never starts it, and installing or updating the package does not open any port. Nothing listens until you run `monash remote serve` yourself.

The server also refuses to bind anywhere except loopback:

```python
def make_server(addr, con):
    if addr[0] not in {"127.0.0.1", "localhost"}:
        raise ValueError("Bind remote MCP on loopback behind an HTTPS reverse proxy")
```

HTTPS comes from nginx or the tunnel in front of it. Every request is checked for a `Host` and `Origin` that match the public address you gave, so a web page that points its own domain at your machine (DNS rebinding) gets a 403.

## A pairing code instead of a password

ChatGPT and Claude connect with OAuth, which normally means a sign in page with a password. I did not want to add accounts to a tool for one person. Instead the sign in page asks for a code you get from your own terminal:

```text
$ monash remote pair
Pairing code: 3F9A-0C21-B7E4
Valid for 10 minutes, single use.
```

The database keeps only its SHA-256 hash. A right code is used up at once. Five wrong codes close the window, and you run `pair` again. If nobody has opened a window, the page says so and does not accept anything. Someone who finds your URL cannot get in without also being at your keyboard in the last ten minutes.

## Who is allowed to connect

MCP apps register themselves before signing in, and the protocol says registration needs no login. That means anyone can register. Two things keep that from mattering.

First, a registration is only accepted when every callback address is on a short list: the exact OAuth callback paths on `claude.ai`, `claude.com` and `chatgpt.com`, matched on the whole host with no port, query or fragment. A client that wants its code sent anywhere else is turned away at the door, so a stolen code can only travel back to Claude or ChatGPT. You can add one exact extra address with a flag, never a pattern.

Second, registrations are capped at 50. When it is full, clients that registered more than an hour ago and never got a token are cleared out. A client that is really in use always has a refresh token, so it stays.

The rest is standard OAuth for public clients:

- PKCE with S256 is required. The code is only exchanged when the verifier hashes to the challenge from the sign in.
- The access token lasts one hour. The refresh token lasts 30 days and is replaced every time it is used, so an old one stops working.
- Tokens are stored as hashes in `secrets/remote-mcp.db`, which is created with mode 0600.
- `monash remote revoke --all` deletes every client, code and token and closes any open pairing window.

## Only the tools that read

Locally Study Kit has 18 tools. Two of them start a Moodle login or a sync, and those need a browser and your password on the machine itself. Remote mode drops them from the tool list and refuses them by name if an app calls them anyway:

```python
if spec and len(spec) > 3 and not spec[3]:
    return {"jsonrpc": "2.0", "id": msg.get("id"), "error": {
        "code": -32602, "message": "Run login or sync on the server's own terminal"}}
```

So the 16 query tools are all a token can reach. With a stolen token someone could read your course files until it expires or you revoke it, which is bad, but they could not log in as you or change anything on Moodle or Ed. Study Kit has no tool that submits, posts or attempts a quiz, locally or remotely.

## How I checked it

[`tests/test_remote.py`](https://github.com/Waldo0926/monash-study-kit/blob/main/tests/test_remote.py) has 22 tests that run the whole flow on one machine with made up data: discovery from a 401, registration, pairing, PKCE, token expiry and rotation, revoke, the callback list, bad hosts and origins, and refusing login and sync. One test opens a database in the older layout, before tokens were tied to the server address, to make sure tokens saved there still work after the upgrade.

On 30 October the 1.4.0 package from PyPI also went through the same sign in and query flow in a clean environment, using the real Claude and ChatGPT callback addresses. That check had no public domain. With my own domain and server, ChatGPT Plus can query my Moodle and Ed. The steps are on [Host it yourself](https://docs.secureview.tech/study-kit/remote/).

## Takeaways

- A remote mode for a personal tool should stay personal. One owner, their own data, nothing started for them.
- A code from your own terminal replaces a whole account system when there is only one user.
- Check callback addresses when a client registers. After that, every later step can trust them.
- Decide which tools leave the machine. Anything that logs in or writes stays local.
