---
layout: post
date: 2026-10-26 08:30:00 +0800
project: Ed Web
description: "Ed Web reads a course's Ed forum in the browser with no backend. The redesign added a refresh that only fetches posts that changed, an honest meaning for \"new\", Ed's post format rendered safely, and support for Ed's API tokens."
ref: ed-web-redesign
lang: en
preview: ed-web-redesign
title: "Refreshing an Ed forum in the browser without fetching it all again"
image: /assets/og/ed-web-redesign.png
---

[Ed Web](https://github.com/Waldo0926/ed-web) is a static page that fetches a unit's Ed Discussion forum straight from Ed's API, stores it in the browser's IndexedDB, and lets you read, filter and search it offline. There is no backend: the token stays in `sessionStorage` and is only sent to `edstem.org`.

It is the public version of a private tool I run on my own server for my study workflow. On 25 October I redesigned Ed Web and brought over the parts of the private tool that work in a browser ([#6](https://github.com/Waldo0926/ed-web/pull/6)). This post is about those parts.

## Refresh only what changed

The old page fetched every thread and every reply on each refresh. A big unit has hundreds of threads, and Ed rate-limits, so a refresh took a while and sometimes hit 429.

Ed's thread list is cheap, one request per 100 threads. Fetching a thread's replies is one request per thread. So the refresh now reads the list, works out a fingerprint for each thread, and only fetches the full thread when its fingerprint changed:

```js
/* Same as the private tool's content_stamp: updated_at plus a few counts and flags,
 * so a thread's body is fetched again only when something in it really changed. */
function contentStamp(t) {
  return [t.updated_at, t.reply_count, t.unresolved_count, t.vote_count, t.is_staff_answered,
          t.is_answered, t.is_locked, t.title].map((x) => String(x ?? '')).join('|');
}
```

`updated_at` alone is not enough. A new reply or a staff answer does not always move it, but it does change a count or a flag.

When Ed does answer 429, the page waits for `Retry-After` if the browser can read it, and otherwise backs off 1.5, 3 and 4.5 seconds.

## What "new" means

A "new" badge is only useful if it means "new since I last looked". Each thread and reply now stores `first_seen`, the time this browser first saw it. A refresh records when it started, and anything first seen at or after that moment is new:

```js
function isFresh(firstSeen) {
  return !!STATE.prevSyncedAt && !!firstSeen && firstSeen >= STATE.syncedAt;
}
```

The first fetch has nothing to compare with, so it falls back to "posted in the last 48 hours". A thread you already had shows how many replies are new.

## Render Ed's format, safely

Ed stores a post as its own XML: `<document><paragraph>...`, with `<link>`, `<snippet>`, `<image>`, `<file>`, lists, tables and callouts. The old page stripped it to plain text, so code lost its layout and attachments were gone.

`docToHTML` now parses it with `DOMParser` and walks the tree. Two rules keep it safe:

- Every piece of text goes through `esc` before it is written into the page. No markup from the post is passed through.
- Links, images, files and videos are only linked when the address starts with `http://` or `https://`. Anything else, such as `javascript:`, becomes plain text.

```js
const safeHref = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null);
```

If the XML does not parse, the post falls back to plain text instead of a blank card.

## A one-line takeaway from the right person

Each thread card shows one line under the title. It used to be the start of the post. For a question, the useful line is usually the answer, so the card now takes the last staff reply, because a later staff reply often corrects an earlier one. With no staff reply, a question shows a student's answer, labelled as such. Otherwise it shows the post itself.

## API tokens

Ed has two kinds of token. The one the web app keeps in `localStorage` is a JWT that expires after 14 days. The ones you create under Ed's settings are long-lived and can be revoked there. They use different headers:

```js
function authHeaders(token) {
  return tokenKind(token) === 'jwt' ? { 'x-token': token } : { authorization: 'Bearer ' + token };
}
```

The page shows how many days a JWT has left, read from its `exp` field. One thing I have not been able to check: whether Ed's cross-origin settings let a browser page send an API token. The README says so, and if the request is refused the page says so and suggests the browser token.

## Smaller things

- Search needs every word to appear.
- Filters for starred, watched and my own threads, and for threads with replies Ed says you have not read.
- Replies under a deleted reply are kept, since Ed still shows them.
- Lessons save the text of reading pages and quiz questions, so they can be searched too.

## Testing a page with no backend

The fetch and render logic lives in one `app.js` with no build step. The tests in `tests/sync.test.mjs` cut the functions they need out of `app.js` by marker strings and run them in Node, with no network. The screenshots in the README were taken against a fake Ed API with made-up units, people and posts, so no real course data is in the repository.

## Takeaways

- A cheap list plus a fingerprint per item turns a full refresh into a small one.
- "New" should be measured from the last refresh, not from the post date.
- When rendering someone else's markup, escape all text and allow only the link schemes you mean.

Code: [app.js](https://github.com/Waldo0926/ed-web/blob/main/app.js), [ARCHITECTURE.md](https://github.com/Waldo0926/ed-web/blob/main/ARCHITECTURE.md), [sync.test.mjs](https://github.com/Waldo0926/ed-web/blob/main/tests/sync.test.mjs). Guide: [docs.secureview.tech/ed-web](https://docs.secureview.tech/ed-web/).
