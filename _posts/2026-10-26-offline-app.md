---
layout: post
date: 2026-10-26 09:30:00 +0800
project: Monash Hub
description: "Monash Hub can now be added to a phone's home screen and opens pages you have read with no signal. Why the service worker always tries the network first, what it refuses to save, and how an app left open for days picks up a new deploy."
ref: offline-app
lang: en
preview: offline-app
title: "An offline app that never shows an old page when a new one is there"
image: /assets/og/offline-app.png
---

Students look things up on [Monash Hub](https://monashhub.secureview.tech) on the bus, in a lecture hall basement, or with mobile data off to save money. On 24 October I made it installable: it can go on a phone's home screen with its own icon, open full screen like an app, and show pages you have already read when there is no signal ([#207](https://github.com/Waldo0926/monash-hub/pull/207)).

I did not build a native app. A web app manifest and one service worker cover iPhone Safari, Android browsers and desktop Chrome with the same code. The hard part was deciding what the service worker is allowed to do.

## The one rule: never older than the server

A service worker can make a site feel faster by answering from a cache first. For Monash Hub that is the wrong trade. A unit page or an enrolment guide that is a week old can send a student to the wrong form. So the comment at the top of `sw.js` says what it is for:

> A student who added Monash Hub to their home screen can open the unit, degree and guide pages they have already read when there is no signal. That is all. It is not a way to make the site faster online, and it must never make a student read something older than what the server has.

Every page and API call goes to the network first. A saved copy is used only when the network cannot be reached at all:

```js
async function networkFirst(event, cacheName) {
  try {
    const response = await fetch(event.request)
    save(event, cacheName, response)
    return response
  } catch (error) {
    const saved = await caches.open(cacheName).then(cache => cache.match(event.request))
    if (saved) return saved
    throw error
  }
}
```

A 404 or a 500 from the server is passed through as it is. It is not a network failure, so it never falls back to an older copy. When a saved page is shown, the page says there is no network and the copy may be out of date.

## What is never saved

Only reference pages are worth reading offline: the home page, units, degrees, guides, and the course map, tree and marks pages, which keep their own data in the browser anyway. Everything live or personal is left out on purpose:

```js
/* The API calls those pages make. Reviews, community, auth and search are left out on purpose. */
const OFFLINE_API = [
  /^\/api\/v1\/units(\/|$)/,
  /^\/api\/v1\/courses(\/|$)/,
  /^\/api\/v1\/guides(\/|$)/,
  /^\/api\/v1\/(faq|key-dates)$/,
  /^\/api\/v1\/exchange$/,
  /^\/api\/v1\/marks\/(reference|units)$/
]
```

And only a complete, successful answer is kept:

```js
function save(event, cacheName, response) {
  if (response.status !== 200 || response.type !== 'basic') return
  if ((response.headers.get('Cache-Control') || '').includes('no-store')) return
  ...
}
```

That rule needed one change in the pages. When the API failed, the unit, degree and guide list pages still rendered with status 200, showing an error card. The service worker would have saved that card over a good copy. They now answer 503, like the detail pages already did.

Two smaller details:

- A saved page is in the language it was rendered in. When the reader switches language, the saved pages are deleted. API answers carry the locale in their URL, so they stay.
- `VERSION` in the cache names is bumped whenever the caching rules change. The new worker deletes every cache the old one made, so nothing saved under old rules survives.

## A page you never opened

Offline, a page that was never saved shows an offline page in the reader's language, with links to the pages that are saved. Inside the app, following a link normally fetches data from the API, and only some of that is saved. So when the phone is offline, a link becomes a full page load, which the service worker can answer with the saved page or the offline page.

## An app left open for days

Network first means a new deploy shows up on the next page load. The case left is an app that stays open on a phone for days. Nuxt reloads on the next navigation once it sees a new build, but it only checks once an hour, and phones pause timers while an app is in the background.

So the app also checks when it comes back to the front, at most every five minutes:

```ts
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForNewBuild()
})
```

`checkForNewBuild` asks the browser to update `sw.js` and compares the running build id with `/_nuxt/builds/latest.json`. If they differ, the next link loads the new version.

## Telling people they can install it

Most students do not know a website can go on the home screen, and the steps differ by browser. On phones, after a few pages, a one-line hint explains how for iPhone Safari, Android browsers (including Huawei, Xiaomi, OPPO and vivo) and WeChat. "Don't show again" hides it for good, and the same steps are in the footer.

## How it is tested

Playwright tests in CI cover the parts that are easy to break:

- the manifest returns the right name, description and shortcuts in Chinese and English, and every icon exists
- a unit page read once opens again with the network off and shows the "no network" notice, while ratings and community calls were never saved
- a page never opened gets the offline page, and "retry" works once the network is back
- a unit that was not found is not saved
- the install hint waits a few pages and stays closed once closed

## Takeaways

- Decide what the service worker is for before writing it, and write that at the top of the file.
- Network first, cache only on a real network failure, and never cache an error.
- An installed app can stay open for days. Check for a new build when it comes back to the front.

Code: [sw.js](https://github.com/Waldo0926/monash-hub/blob/main/frontend/public/sw.js), [pwa.client.ts](https://github.com/Waldo0926/monash-hub/blob/main/frontend/plugins/pwa.client.ts), [pwa.spec.ts](https://github.com/Waldo0926/monash-hub/blob/main/e2e/tests/pwa.spec.ts).
