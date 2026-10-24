---
layout: post
date: 2026-10-24 17:30:00 +0800
project: Monash Hub
description: "Students can rate a unit without an account. How one browser keeps one rating per unit, why the limit is on the network and not the key, and what this still does not stop."
ref: rating-abuse
lang: en
preview: rating-abuse
title: "Unit ratings without sign-in, and keeping them honest"
---

[Monash Hub](https://monashhub.secureview.tech) lets students rate a unit out of five, with optional scores for teaching, content, assessment, difficulty and workload ([#163](https://github.com/Waldo0926/monash-hub/pull/163)). I wanted it to work without an account. Asking for sign-up before a one-click rating is how a new site ends up with no ratings at all.

The problem is obvious: if anyone can rate, one person can rate fifty times. This post is about the layers that make that harder, and where they stop.

## One rating per person per unit

A signed-in rating belongs to the account. A signed-out rating belongs to a random key that the browser makes the first time it rates (`crypto.randomUUID()`), keeps in `localStorage`, and sends as an `X-Guest-Key` header.

The database enforces one rating per owner per unit:

```python
UniqueConstraint("author_id", "unit_code", name="uq_unit_review_once"),
UniqueConstraint("guest_key", "unit_code", name="uq_unit_review_guest_once"),
CheckConstraint("author_id IS NOT NULL OR guest_key IS NOT NULL", name="ck_unit_review_owner"),
```

Rating again edits the same row, so a student can change their mind. If two saves from the same owner arrive together, the second insert hits the unique constraint, and the handler catches the `IntegrityError` and turns it into an edit.

## Don't store the key as sent

The guest key works like a password for editing that rating. If the table leaked and the keys were stored as sent, anyone could send them back and edit other people's ratings. So the key is stored as an HMAC with the server's secret:

```python
def guest_hash(raw):
    raw = (raw or "").strip()
    return _keyed(f"guest:{raw}") if GUEST_KEY.match(raw) else None
```

A test checks that the stored value never contains the key that was sent.

## The key limits nothing, so limit the network

A browser can make a new key whenever it likes: clear storage, open a private window, or write a script. So the key is only for ownership. The limit is on the network address:

| Who | Limit |
| --- | --- |
| One account, or one guest key | 30 ratings saved per day |
| Signed-out ratings from one network address | 100 per day |
| Any API request from one address (nginx) | 20 per second |

100 a day looks generous, and it is on purpose. On campus Wi-Fi, a whole lecture theatre can share a handful of addresses. A limit strict enough to stop one person would block a whole class. The address is also stored as an HMAC, not as the IP.

Getting the address right takes care. `X-Forwarded-For` is whatever the client writes in it, so the API only believes `X-Real-IP`, which nginx sets from the connection, and only when the request comes from a trusted proxy. Anything that reaches the API some other way is limited by its own address and cannot pick a new one per request.

## Count under a lock

The limits are counted in PostgreSQL rather than in memory, because the API runs more than one worker, and a limit each worker counts on its own becomes several limits. The same limiter was written for sign-in first, and it had a race: guesses arriving together all counted the same past events and all got through. Since [#148](https://github.com/Waldo0926/monash-hub/pull/148) the check takes a transaction-level advisory lock on the key first, and ratings got that version:

```python
def check(db, limit, key):
    db.execute(select(func.pg_advisory_xact_lock(func.hashtext(f"{limit.kind}:{key}"))))
    since = _now() - timedelta(seconds=limit.window_seconds)
    count, oldest = db.execute(...).one()  # events for this key since the window start
    if (count or 0) >= limit.max_events:
        raise Throttled(retry_after)
```

Requests for the same key now queue behind each other until the first one commits. A throttled request gets a 429 with `Retry-After`.

## After a rating is saved

- **Reports and hiding.** A rating can be reported the same way as a forum post, and a moderator can hide it. A hidden rating drops out of the average, but its author still sees it and can edit it.
- **Little about the author.** Other readers see only an initial for a signed-in rating, and no name at all for a signed-out one. A student should be able to be honest about a teaching team.
- **Averages computed on read.** One grouped query per page, so there is no stored average to drift from the rows. Each optional score has its own count, so an average from two answers says two.

## What this does not stop

This raises the cost of faking ratings. It does not make it impossible. Someone switching between phone data, home Wi-Fi and a VPN gets a fresh 100 per address. Someone who rates once per unit from one browser looks exactly like a real student, because they might be one.

What helps against that is mostly not code. The page shows how many ratings an average is based on, and under three it says the average is only a rough sign. Reports go to a person. If abuse becomes a steady problem rather than an occasional one, the next step is to make ratings need a verified email. The account system already supports that ([ADR 0005](https://github.com/Waldo0926/monash-hub/blob/main/docs/adr/0005-accounts-without-identity.md)).

## Tests

- `test_signed_out_ratings_are_limited_per_network`: three fresh keys from one address, and the third gets a 429.
- `test_the_browser_key_is_not_stored_as_sent`.
- A Playwright test where a guest rates a unit, a second browser sees it as someone else's, and the first takes it back ([#205](https://github.com/Waldo0926/monash-hub/pull/205)).

Code: [`reviews.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/api/v1/reviews.py), [`throttle.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/core/throttle.py), [`useGuestKey.ts`](https://github.com/Waldo0926/monash-hub/blob/main/frontend/composables/useGuestKey.ts).
