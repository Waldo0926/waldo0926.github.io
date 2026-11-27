---
layout: post
date: 2026-11-27 10:00:00 +0800
project: Monash Hub
description: "Running a full overseas Monash Hub and a China mainland read-only mirror from one main branch, plus why the WeChat mini program lives in its own repo."
ref: hub-readonly-mirror
lang: en
source_repo: monash-hub
source_checked: 2026-11-27
title: "One codebase for Monash Hub, a China read-only mirror and a WeChat mini program"
tags: [FastAPI, Nuxt, Docker, Architecture, WeChat]
image: /assets/og/hub-readonly-mirror.png
---

Most students who use [Monash Hub](https://monashhub.secureview.tech) are Chinese students preparing for or studying at Monash University Malaysia, and their parents often open it from inside mainland China. Cross-border access to my overseas VPS can be slow or flaky in the evening, so I set up a second stack on a cloud server in Guangzhou, plus a WeChat mini program on top of its API.

The catch is personal-entity compliance in mainland China. Under an individual ICP filing, a site cannot host user accounts, forums, comments, reviews or open AI Q&A. Everything read-only — unit search, degree structures, official guides, key dates, Malaysia tuition tables, the prerequisite tree, the semester planner and the browser-only WAM/GPA calculator — is fine. Accounts, community posts, unit ratings, the site assistant, notifications and screenshot uploads have to stay off.

Addresses, SSH ports, server aliases and credentials are left out of this note on purpose.

## Why a feature flag instead of a fork

My first instinct was to keep a long-lived China branch alongside `main`. That lasted less than a week. As soon as upstream `main` landed official curriculum reference links and scoped elective browsing (PR #299 and #300), including a new Alembic migration (`d7a1e3b5c902`), merging across branches already started creating friction on shared frontend files.

About 98% of the code is identical between the two deployments. The China web stack is not a different product; it is the same FastAPI + Nuxt application running in a stricter mode. So I backported the universal UI cleanups first, then merged the read-only switch (`CN_READONLY_MODE`, defaulting to `false`) back into `main`. Overseas keeps using `docker-compose.yml` unchanged. The mainland host uses `docker-compose.cn.yml` with `CN_READONLY_MODE=true` and `NUXT_PUBLIC_CN_READONLY_MODE=true`.

## Four layers of isolation

Hiding links in the header is not enough on its own, because anyone can still type `/community` or call `/api/v1/auth/...` directly. I split the read-only boundary across four layers:

1. **Backend routers and middleware.** In `backend/app/main.py`, routers are grouped into `_READONLY_MODULES` (`units`, `courses`, `plan`, `search`, `guides`, `exchange`, `marks`, `dates`, `fees`) and `_INTERACTIVE_MODULES` (`ask`, `community`, `auth`, `notifications`, `profile`, `reviews`). When `cn_readonly_mode` is true, interactive routers are never mounted, and an HTTP middleware explicitly returns `403` for disabled prefixes (`/api/v1/community`, `/api/v1/reviews`, `/api/v1/ask`, `/api/v1/auth`, `/api/v1/profile`, `/api/v1/notifications`, `/api/v1/search/missing`, `/api/v1/upload`). Endpoints that stay on also skip rating and community subqueries, and put `Malaysia` first in campus filter dropdowns.
2. **Frontend routes and external dependencies.** A global Nuxt middleware (`middleware/cn-readonly.global.ts`) returns `404` for interactive pages such as `/community`, `/login`, `/register`, `/profile` and `/notifications`. In read-only mode, `app.vue` drops the Google Fonts stylesheet and falls back to system CJK fonts so mainland browsers don't stall waiting on blocked font hosts. On `/marks`, the screenshot OCR button is hidden while manual entry and WES text paste stay local in the browser. A dynamic `server/routes/robots.txt.ts` and filtered `sitemap.xml.ts` keep disabled paths out of crawl hints, and an optional `NUXT_PUBLIC_ICP_NUMBER` slot reserves space for the filing number in the footer.
3. **Database table whitelist.** The mainland Postgres instance never receives a full dump. A sync script exports only 18 whitelisted public tables (Handbook units, degrees, areas of study, official pages, FAQ, translations and crawl job metadata) and audits the dump locally before transfer. All 13 user, auth, notification, community and review tables stay at 0 rows. How that dump crosses a lossy link is a separate story in the [cross-border sync note]({% post_url 2026-11-27-hub-cross-border-sync %}).
4. **Network exposure while ICP is pending.** Until the ICP filing is approved, the mainland server must not serve web traffic on public ports `80` or `443`. PostgreSQL publishes no host port at all, FastAPI and Nuxt bind strictly to `127.0.0.1`, and Nginx listens only on a loopback preview port (`127.0.0.1:18080`) accessed over an SSH tunnel. Checking `ss -tlnp` after every change confirms that only SSH is open to the public internet.

## Why the WeChat mini program is its own repo

Unlike the mainland web site, the WeChat mini program (`monashhub-mini`, kept private) cannot share Nuxt components. Native mini programs use WXML, WXSS and TypeScript, and come with platform rules that shape the UI differently:

- **No arbitrary external links.** WeChat blocks opening third-party domains directly from a mini program without domain verification, which obviously cannot be done for university Handbook or system URLs. Every official Handbook link, curriculum `reference_links` entry and campus system entry uses a consistent copy-to-clipboard action with a toast telling the reader to open it in a browser.
- **No university trademark in app chrome.** Putting a university's name in a mini program's title, navigation bars or registration metadata is a common reason for WeChat review rejection. The mini program uses a separate student-guide name, carries a plain unofficial disclaimer, and includes a Vitest check (`tests/compliance.test.ts`) that scans `app.json`, `project.config.json`, brand config and every page's `navigationBarTitleText` to make sure no university trademark slips in.
- **Reusing the same read-only API.** The mini program talks to the exact same read-only endpoints (`/v1/units`, `/v1/courses`, `/v1/guides`, `/v1/key-dates`, `/v1/fees`, `/v1/marks/reference`). One bug I caught while syncing PR #299 into the mini program was that my initial TypeScript interface had guessed `item_code` and `children` for course structure nodes, whereas the backend actually returns `code`, `name`, `type` and nested `containers`. Checking the live serializer caught that before launch.

## Where it stands

Both the universal UI polish (PR #301) and the `CN_READONLY_MODE` stack (PR #302) are now merged into `main`, with all backend, frontend and Playwright browser tests passing in the default overseas mode. The mainland deployment is running on loopback waiting for ICP approval, and the mini program framework is ready to switch from `touristappid` once registration completes.
