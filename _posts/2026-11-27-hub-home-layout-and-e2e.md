---
layout: post
date: 2026-11-27 10:30:00 +0800
project: Monash Hub
description: "Fixing a lopsided footer, buried parent entry, stretched 4x2 home tiles and two Playwright E2E failures caught before merge."
ref: hub-home-layout-and-e2e
lang: en
source_repo: monash-hub
source_checked: 2026-11-27
title: "Rebalancing the Monash Hub home page, and what Playwright caught"
tags: [Nuxt, CSS, UX, Playwright, E2E]
image: /assets/og/hub-home-layout-and-e2e.png
---

While reviewing the [China read-only mirror]({% post_url 2026-11-27-hub-readonly-mirror %}) on a desktop screen, several layout and wording problems stood out that had been sitting on the main site too. None of them broke functionality, which is why they survived for weeks, but looking at full-page screenshots made them hard to ignore.

## Four small layout and copy issues

1. **The single-column footer.** Under `功能导航`, 8 links ran down one tall column while the three official-link and system columns beside it were only 3 to 4 rows tall, leaving a gap under most of the footer. Splitting `功能导航` into a 2-column grid (10 links including `找选修课` and `学费查询`, 5 rows × 2) leveled the whole footer row, and trimming the last homepage section's bottom padding removed roughly 160 px of dead space above it.
2. **An empty bottom-right hero card.** On the home page, `KeyDatesCard` listed 4 upcoming dates and `常用系统` below it was a pile of small pills with half a blank white box underneath. Raising the homepage date list to 6 rows and turning `常用系统入口` into a 2-column grid of cards with a one-line purpose under each name (`Moodle · 课件与作业`, `WES · 选课与成绩`, `Allocate+ · 排课表选班`) filled the card with useful context instead of padding.
3. **Header wording and hierarchy.** New students didn't immediately tell `课程` (unit lookup) apart from `专业与学位` (degree structure), and `给家长看` sat as plain grey text tucked beside the search bar where families missed it. Renaming the labels to `课程查询`, `学费查询` and `家长入口`, putting `官方指南` first, promoting `WAM/GPA` and `学费查询` to the top bar, keeping `选课工具` focused on the three course-selection tools (`选课规划`, `先修图`, `找选修课`) and styling `家长入口` as a soft blue pill made the top bar much easier to scan.
4. **Sticky guide outlines and unit next steps.** Moving the heading outline on `/guides/[slug]` into a sticky sidebar TOC kept navigation visible while reading long policy pages, and adding a short "Plan next" card at the bottom of `/units/[code]` gave readers a direct jump to the prerequisite tree, semester planner or year comparison.

## What Playwright caught before PR #301 could merge

Local unit tests (`vitest`) and `nuxi typecheck` passed, so I opened PR #301. GitHub Actions ran the Playwright suite across desktop and phone viewports and failed 2 tests (4 runs out of 76):

- **`e2e/tests/pwa.spec.ts:32`** asserted that the Chinese `/manifest.webmanifest` shortcuts list contained `'课程'`. Because the manifest reads `nav.units`, renaming it to `'课程查询'` updated the PWA shortcut automatically — a good reminder that one i18n key can feed surfaces outside the main page chrome.
- **`e2e/tests/units.spec.ts:57`** checked `page.getByRole('link', { name: /比较年份|Compare years/ })` without `.first()`. Adding the bottom planning card on `/units/[code]` introduced a second "Compare years" link on the page, triggering Playwright's strict-mode violation.

Both were two-line test updates, and catching them in CI meant zero surprises on deploy.

## The CSS Grid stretch I only spotted after shipping

Right after PR #301 deployed to the overseas site, one visual bug jumped out immediately on the home page: the 8 entry tiles on the left looked like tall, narrow grey strips with huge empty bottoms.

The cause was simple once I looked at the two columns side by side:

- `.hero` uses `align-items: stretch`, and `.tools` had `flex: 1 1 auto; grid-auto-rows: 1fr;`.
- Expanding the right column (6 key dates + 2-column system cards) added roughly 220 px of height.
- On the China read-only view, `.tools` had **9 tiles in a 3×3 grid** (3 rows), so each tile stayed close to a comfortable square (~175 px tall).
- On the overseas view, `.tools` still had **8 tiles in a 4×2 grid** (only 2 rows) and didn't include `找选修课` (`/electives`) at all — so CSS Grid stretched those 2 rows to ~270 px each, while `align-content: start` pinned the icon and text to the top.

The fix in PR #303 was cleaner than adding a height cap: unify both modes on the same **3×3 grid** by adding `找选修课` to the overseas tiles (keeping `社区` in slot 9 overseas and `马莫百科` in slot 9 on the China mirror), switch `.tool` from `align-content: start` to `align-content: center`, and use `grid-template-rows: 1fr auto` on `.hero-side` so the systems box stays compact regardless of campus.

While looking at the same screenshots, I also changed the WeChat block heading from `马莫同学写的公众号` (slightly awkward phrasing) to `马莫学生运营的公众号`, since the card covers articles, the Q&A bot and the QR code rather than just posts.
