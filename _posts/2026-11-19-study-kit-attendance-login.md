---
layout: post
date: 2026-11-19 10:00:00 +0800
project: Study Kit
description: "Study Kit 1.14 tries to bring back an expired attendance login on its own, using the browser profile already on your computer, and stops when Monash wants a password or MFA. How it decides, how often it tries, and what it can't promise."
ref: study-kit-attendance-login
lang: en
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "Keeping the attendance login alive without touching your password"
tags: [Python, Playwright, SSO, Privacy]
image: /assets/og/study-kit-attendance-login.png
---

Study Kit's optional attendance part reads the Monash attendance portal so the AI can tell you which classes you haven't checked in to. The weak point was the login. It expired every so often, and the first sign was the AI saying it couldn't read attendance. Then I had to run `monash attendance login` again, usually right when I wanted the answer.

Version 1.14 tries to fix that without ever handling a password.

## What it does

```bash
monash attendance maintain
```

This checks whether the attendance login still works. If it has expired, it opens the portal quietly with the separate browser profile Study Kit already keeps on your computer for attendance. If Okta still remembers you in that profile, the portal signs you back in and nothing else happens. If Monash asks for a password or MFA, it stops and reports `needs_login`, and you run `monash attendance login` yourself.

`monash attendance renew --timeout 30` is the same quiet attempt once, by hand.

## The rules it follows

- **It never types for you.** No password, no MFA code. Those stay with you.
- **It backs off.** After a failed authentication it waits an hour before trying again, so it doesn't keep poking Okta. Replacing the login state file (for example after you log in again) makes it check straight away.
- **It doesn't mistake a network problem for an expired login.** A timeout or a certificate error is reported as what it is.
- **It doesn't lose what worked.** If recovery fails, the previous login state is kept rather than overwritten.
- **One at a time.** Use of the local browser profile is serialized, so two Study Kit processes don't fight over it.

## What it can't promise

The Okta part of the login only exists on the computer where you signed in. What gets saved for reuse is the attendance portal's own session, never the identity provider's. So this works on the same computer, and it can't stop a login expiring while the computer is asleep or offline. It makes the common case smoother; it isn't a way around signing in.

Before 1.14, the background job counted a failed keepalive as a success, which hid the problem. It now reports the failure. The [changelog](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md) has the full list.
