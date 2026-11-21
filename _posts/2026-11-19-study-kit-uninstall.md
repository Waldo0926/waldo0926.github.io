---
layout: post
date: 2026-11-19 11:20:00 +0800
project: Study Kit
description: "monash uninstall now revokes the Google Drive and Gmail grants before deleting data, and deletes nothing if revoking fails."
ref: study-kit-uninstall
lang: en
source_repo: monash-study-kit
source_checked: 2026-11-19
title: "Study Kit 1.15.0: revoking Google access on uninstall"
tags: [Python, OAuth, Google, Privacy]
image: /assets/og/study-kit-uninstall.png
---

[Study Kit](https://github.com/Waldo0926/monash-study-kit) can optionally read your Google Drive (for course files that live in Google Docs) and your school Gmail. Both use Google OAuth, and the tokens sit in a `secrets` folder on your own computer.

Until 1.15.0, `monash uninstall` asked whether to delete all data and then deleted that folder. It looked clean. But deleting the token file only removes your copy of the key. The grant itself stays on Google's side, and Study Kit keeps showing up under "Third-party apps with account access" in your Google account until you remove it there by hand. Most people never would.

## What it does now

Before anything is deleted, `monash uninstall` revokes every Google grant it can find:

- the Drive and Gmail tokens of the default account
- the same two tokens in every named profile (people with more than one Monash account, or a separate materials-only profile)

Revoking is one POST to `https://oauth2.googleapis.com/revoke`, with the token in the request body so it never appears in a URL. It sends the refresh token, because revoking that ends the whole grant.

If Google answers `400 invalid_token`, the grant is already dead: it expired, or you removed it on the Google side earlier. That counts as done.

## When revoking fails, nothing is deleted

Any other failure, like no internet or a Google error, stops the uninstall before it touches your files. It prints the reason and tells you to run it again once you're online, or to remove the access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) first.

The order is important. If it deleted first and revoked second, a failed revoke would leave a live grant and no token left to revoke it with. Keeping the files means you can always retry.

The same rule applies in the smaller commands. Removing a profile revokes its Google tokens first, and logging out of Gmail revokes before it deletes the token file.

## Ed is different

Ed has no API for revoking a token. So at the end, Study Kit prints a link to Ed's API token settings and asks you to delete the token there yourself.

## 1.15.0 on PyPI

1.15.0 is also the first release on PyPI since 1.11.2. Versions 1.12 to 1.14 were merged but never tagged, so anyone installing from PyPI was stuck on 1.11.2. If you installed earlier, `monash update` gets you everything since then: `monash changes`, reading your own submissions, attendance login recovery, and this uninstall fix.

One thing I hit on my own Mac: when uv rebuilds the environment during the update, the old `monash` process can finish with `ImportError: cannot import name 'update_check'`. The new version is already installed by then, so run `monash --version` to check. The fix for that message is merged as 1.15.1.
