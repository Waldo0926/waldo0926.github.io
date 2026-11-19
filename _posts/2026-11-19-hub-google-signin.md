---
layout: post
date: 2026-11-19 11:10:00 +0800
project: Monash Hub
description: "Monash Hub now has a Google sign-in button. Accounts are matched by email, so most of the work went into making sure that match can't be abused: a signed state tied to the browser, a verified address, and a session token that never reaches a server log."
ref: hub-google-signin
lang: en
source_repo: monash-hub
source_checked: 2026-11-19
title: "Adding Google sign-in without opening a door into someone else's account"
tags: [Python, FastAPI, OAuth, Security]
image: /assets/og/hub-google-signin.png
---

Monash Hub has had email and password accounts since the start. People asked for "continue with Google", the way MonMap does it, so the sign-in and register pages now have that button. It's live.

The button is the easy part. The decision that matters is how a Google sign-in finds the right Hub account, because that decision is also how it could find the wrong one.

## Matched by email, so the email has to be real

A Google sign-in is matched to an existing account by email address. If you already registered with the same Gmail, you land in that account with your own nickname, instead of getting a second account.

That also means anyone who can make Google vouch for your address can sign in as you. Google sends an `email_verified` claim, and the callback refuses the sign-in if it isn't true. There is a test for exactly that case.

## The state parameter

OAuth sends a `state` value to Google and gets it back on the callback. Mine is signed, not stored. It's an HMAC over the server's secret key, containing a random nonce, an expiry ten minutes out, and the page to return to.

The same nonce goes into an HttpOnly cookie, scoped to the `/api/v1/auth/google` path and set as SameSite=Lax. Lax because the callback is a redirect from Google's site, and a Strict cookie wouldn't come back on it.

The callback checks both. A state the server didn't sign is refused. A genuine state arriving in a browser without the matching cookie is refused too. Without that second check, someone could start a sign-in with their own Google account, stop at the callback, and send you the link. You'd click it and be signed into their account, where anything you save is theirs to read.

The return page travels inside the signed state, and only a path on this site is accepted. An absolute URL like `//evil.example` is replaced with `/`.

## The ID token is not signature checked, on purpose

Normally you verify an ID token's signature. Here the token never comes from the browser. The server sends the one-time code straight to Google's token endpoint over TLS, authenticated with the client secret, and the ID token comes back in that response. Checking the signature again adds nothing in that path. The issuer and audience are still checked, so a token for another app is refused.

## The session token goes in the fragment

After sign-in, the callback redirects to `/auth/google#token=...`. Browsers never send the part after `#` to a server, so the token stays out of access logs on the API, in nginx, and in any proxy in between. The callback page removes it from the address bar before anything else runs.

## Smaller things

- Google remembers the last account. On a shared lab computer that would sign the previous person in without asking, so the request sets `prompt=select_account`.
- Nicknames on Hub can't have spaces, to stop people imitating each other. A Google name like "Waldo Wen" becomes "WaldoWen", and a number is added if it's taken.
- An account made through Google has no password. It stores a hash that nothing typeable can ever match, instead of an empty one.
- A double click or two tabs can try to create the same account at once. The loser of that race picks up the account the other one just made.
- Errors come back as a real message on the login page: cancelled, unverified email, suspended account.
- The button only renders when the server says it's configured, and Google's logo is inlined, so the login page still makes no request to a third party.

## Keys

The PR shipped with no credentials in it. I created the OAuth client in Google Cloud and put the client ID and secret into the server's `.env` myself, then redeployed. Before that the button simply didn't appear and nothing else changed.

The PR has 25 tests: forged, tampered and expired states, a callback opened in another browser, tokens for another client or issuer, an unverified email, a suspended account, a nickname clash, two first sign-ins racing, and the unusable password hash.
