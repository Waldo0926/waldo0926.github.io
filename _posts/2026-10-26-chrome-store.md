---
layout: post
date: 2026-10-26 09:00:00 +0800
project: Attendance Helper
description: "Before putting my attendance extension on the Chrome Web Store, I removed a permission, deleted URLs from a library I never call, and made the build refuse to package remote code. What the store checks, and how I checked it myself first."
ref: chrome-store
lang: en
preview: chrome-store
title: "Getting a Chrome extension ready for the Web Store"
image: /assets/og/chrome-store.png
---

[Monash Attendance Helper](https://github.com/Waldo0926/monash-attendance-reminder) is a Chrome extension for Monash students. It reads your recent classes from Monash Attendance, finds the codes teaching staff posted in Gmail, Moodle and Ed, and shows them on one page. Nothing is submitted until you tick that you attended and press submit.

Until now it was installed from a zip in developer mode, which is too much to ask of most students. So on 25 October I submitted v1.3.52 to the Chrome Web Store. It is still waiting for review. This post is about what I changed to get there.

*Update, 30 October: it passed review and is now [on the Chrome Web Store](https://chromewebstore.google.com/detail/monash-attendance-helper/mnbkcmgkjmfngcifndchaidndhdfafcd). The zip is still on GitHub for anyone who wants to load it unpacked.*

## Remote code that never runs still counts

Codes are often posted as screenshots, so the extension bundles Tesseract.js for OCR. It runs in an offscreen document, because a service worker has no DOM or canvas, and it loads its worker, WebAssembly core and English data from the package with `chrome.runtime.getURL`.

The store forbids remotely hosted code under Manifest V3, and its scan reads the files, not what the code does at runtime. The upstream Tesseract.js files still had jsDelivr URLs as fallbacks. My code always passed local paths, so those URLs were never used, but the scan treats them as remote code anyway.

v1.3.49 replaced the fallback URLs with the packaged files, and a test fails if any URL literal comes back in the bundled Tesseract files:

```js
assert.doesNotMatch(source, /https?:\/\//i, `${asset} must not contain remote URL literals`);
```

## Make the build refuse

One test for one library is not enough. The next library update, or a stray `<script src>` in a page, would bring the problem back. So the store zip is built by `scripts/build-store-zip.sh`, which unpacks what it just zipped and refuses to keep it if it finds:

- a CDN host (jsDelivr, unpkg, cdnjs, Google's font and API hosts) anywhere in code, pages or JSON
- any `http(s)://` inside the bundled Tesseract files
- a `<script>` or `<link>` that loads from another origin
- a remote `import`, `importScripts`, `eval` or `new Function` in the extension's own code
- a remote origin in the content security policy

```bash
if grep -rIEn 'import\(?\s*["'\''](https?:)?//|importScripts\(\s*["'\'']https?:|new Function\(|\beval\(' \
     "$tmp" --include='*.js' --exclude-dir=vendor; then
  flag "remote import or eval in extension code"
fi
...
if [ "$fail" -ne 0 ]; then
  rm -f "$out"
  exit 1
fi
```

CI runs it on every pull request, not only on `main`, so a change that would fail review fails before it is merged.

## Drop the permission that scares people

The manifest asked for `tabs`. With it, Chrome warns on install that the extension can "read your browsing history". That is a bad first impression for a tool that touches your Monash login.

The extension only needed `tabs` for two things: opening background tabs and reading the URL of its own Attendance, Moodle, Ed and Gmail tabs. `chrome.tabs.create` needs no permission at all. And host permissions already let an extension see the URL and title of tabs on those hosts.

I checked that in Chromium with the extension loaded before removing it. `chrome.tabs.query` still returned the URL of an open Ed thread and still hid other sites. v1.3.52 ships without `tabs`, and the warning is gone.

What is left, each with one sentence in the store form:

| Permission | Why |
| --- | --- |
| `scripting` | Injects the page reader into a tab that was open before the extension was reloaded |
| `storage` | Settings, the latest scan and a diagnostic log, on the device |
| `alarms`, `notifications` | The weekly reminder and the "scan finished" notice |
| `offscreen` | Runs Tesseract, since a service worker has no canvas |
| Six host permissions | Attendance, Gmail, Moodle, Ed, Ed's image host, and the CloudFront host Moodle serves uploaded files from |

## Check the privacy claim yourself

The listing says no server, no analytics and no remote code. I wanted to check it myself. So I ran OCR end to end with every request that did not go to the extension itself logged. It read "Workshop 02 GU2ZP" and "Tutorial 16 ST8CT" from a test image and made no network request.

## Success has to mean success

One more fix went in before submitting, because strangers would now rely on it. In v1.3.50 and earlier, the page could say "已处理 2/2" while Attendance still showed a question mark for one class. "Success" only meant something had been clicked. Attendance is an ASP.NET page where the whole page is one form. The button search ran over every link in it, header and footer included, and took the first one with a word like "enter" in it.

Since v1.3.51 the search only takes real buttons and postback links, never home, back, cancel or logout. After the click, the extension reopens that day in Attendance in a fresh tab and only counts a class as done when its row shows completed. The confirm page lists each class with its own result and the reason when it failed.

## Takeaways

- Store scans read files. A URL in code you never call is still a URL.
- Put the review rules in your build script, and run it on every pull request.
- Before asking for a permission, check whether a narrower API or a host permission already gives you what you need.

Code: [build-store-zip.sh](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/scripts/build-store-zip.sh), [manifest.json](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/extension/manifest.json), [store/LISTING.md](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/store/LISTING.md), [CHANGELOG.md](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/CHANGELOG.md). Install guide: [docs.secureview.tech/attendance](https://docs.secureview.tech/attendance/).
