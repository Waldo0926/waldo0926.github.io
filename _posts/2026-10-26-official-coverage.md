---
layout: post
date: 2026-10-26 11:30:00 +0800
project: Monash Hub
description: "Monash Hub's guides went from 662 official pages to about 3,100 in one weekend. How the list is built from two sitemaps, what gets left out, and why a failed fetch no longer takes a page down."
ref: official-coverage
lang: en
preview: official-coverage
title: "From 662 official pages to 3,100, without losing any when a crawl fails"
image: /assets/og/official-coverage.png
---

Besides the Handbook, [Monash Hub](https://monashhub.secureview.tech) keeps a copy of Monash's official student pages: enrolment, exams, visas, fees, graduation. It translates them into Chinese, searches them and answers questions from them. Until 25 October that copy had 662 pages, found by walking links out from a few hub pages.

This post covers the weekend I widened it to both Monash sites, and the failures that came with it.

## Read the sitemap instead of walking links

Walking from hubs only finds what menus link to. Both Monash sites publish sitemaps, and a sitemap lists every page, including ones no menu points at. So the crawler now reads them ([#215](https://github.com/Waldo0926/monash-hub/pull/215)):

- monash.edu.my: the whole site.
- monash.edu: the sitemaps of students, admissions and the IT, Business, Engineering and Science faculties, keeping only `/students`, `/admissions` and each faculty's `current-students` section.

A whole-site sitemap is mostly not for students. One regex drops news, events, alumni, staff profiles, open day pages, sign-in and feedback forms, verification files and attached PDFs and images. What was left was about 3,100 pages.

A page that was already listed stays even when no sitemap has it, as long as it still has text. A page Monash moved keeps its slug and its translations at the new address.

## Then take out what is not guidance

The first full list was too wide. The 选课与课程规划 category held 1,331 pages, because every faculty page defaulted to enrolment. Three passes cleaned it up:

1. **School pages that are not guidance** ([#221](https://github.com/Waldo0926/monash-hub/pull/221)): 174 pages of leadership lists, rankings, competitions and their galleries, study-trip posts from 2005 to 2017, lab pages and test copies. A school page now counts as enrolment only when its address is about courses.
2. **Pages students cannot open** ([#222](https://github.com/Waldo0926/monash-hub/pull/222)): five eExam pages answer "Access Denied" even to a signed-in student, so they leave instead of keeping old text. The fee calculator is listed as a link, because the page only forwards to an app.
3. **Pages about years that are over** ([#223](https://github.com/Waldo0926/monash-hub/pull/223)): 152 pages, such as OSHC price lists from 2016 to 2025 and past principal dates.

The third one is a rule, so it keeps working next January:

```python
COMMENCEMENT_YEARS = 6  # five years for the longest double degree, one more for a semester off

def outdated(url, title, year=None):
    year = year or date.today().year
    years = [int(y) for y in YEAR.findall(f"{urlparse(url).path} {title}")]
    if not years:
        return False
    if BY_COMMENCEMENT.search(f"{url} {title}"):   # course maps, "commenced"
        return max(years) <= year - COMMENCEMENT_YEARS
    return max(years) < year
```

Course maps are the exception. A student follows the map of the year they started, so in 2026 the maps from 2021 on stay. The `YEAR` pattern skips course codes like C2001 and "students who commenced from 2014", which are not about a past year.

Later a staff tool turned up too: "Welcome to the Connect Tutor" is Monash Connect's tool for checking an email reply before sending it ([#230](https://github.com/Waldo0926/monash-hub/pull/230)). It was in the support guides because it is in the sitemap.

## A failed fetch used to hide a page

Before this change, any failed fetch set the page's status to error. That took it off the guides, search, key dates and the assistant until a later fetch worked. One timeout or one bot challenge hid a page whose text was still right.

That stopped being rare. On 25 October, Monash Malaysia's site started refusing the server's address. A full re-crawl that night was refused on 359 pages. Under the old rule all of them would have gone dark.

Now only an answer about the page itself takes it down ([#211](https://github.com/Waldo0926/monash-hub/pull/211)):

```python
def record_failure(db, page, message, *, gone=False):
    page.fetch_error = message[:2000]
    if gone or not page.content_hash:      # 404 or 410, or nothing stored yet
        page.status = "error"
        page.last_checked = datetime.now(UTC)
    elif page.status == "error":           # hidden by the old rule; bring it back
        page.status = "ok"
```

A 403 or a timeout keeps the last good copy, and `last_checked` keeps the date it was last read, because that is the date readers see. `fetch_error` makes the page due on the next run.

Two more cases looked like success but were not:

- A removed page often redirects to the section above it or to the home page. That landing page reads fine, so it would have replaced the real text quietly. A redirect to a parent is now recorded as a failure.
- A long page that suddenly reads short keeps its last good copy. A page that is short on Monash's site too, like a hub of links, is stored, as long as there is no longer copy to keep ([#217](https://github.com/Waldo0926/monash-hub/pull/217)).

## When the site refuses the server

While monash.edu.my refuses the VPS, its pages can be read on another computer and handed to the server as a harvest file. The server stores them with the same code it uses for its own fetches (`deployment/crawl.sh official-harvest FILE`).

The first harvest broke in a new way. A run stopped mid-write tore the file, and reading stopped at the tear, so the server loaded none of 680 pages. Each page is now its own gzip member, and the reader skips a torn member and goes on from the next one ([#216](https://github.com/Waldo0926/monash-hub/pull/216)). It also reads one page at a time, since 723 pages held in memory went past the crawler container's 2 GB.

## Limits on the Handbook side too

The same weekend added limits to the weekly Handbook crawl ([#212](https://github.com/Waldo0926/monash-hub/pull/212)):

- One run marks at most 25 units inactive, or 2% of its targets if that is more. A Handbook answering 404 for everything would otherwise take every unit off the site for a week.
- A run stops after 30 failures in a row and records why. Before, a Handbook that was down cost three attempts for each of 5,000 units.
- A failed run, or one where more than 5% of targets failed, sends one email a day. `/api/health` shows the last run of each kind.

## Takeaways

- A sitemap is a better list than a crawl from the menu, but it lists everything, so the filter matters more than the fetcher.
- Write "out of date" as a rule with today's year in it, not as a list of pages.
- Only take content down when the source says it is gone. A refusal or a timeout says nothing about the page.

Code: [coverage.py](https://github.com/Waldo0926/monash-hub/blob/main/crawler/official/coverage.py), [discover.py](https://github.com/Waldo0926/monash-hub/blob/main/crawler/official/discover.py), [repository.py](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/knowledge/repository.py). Changelog: [CHANGELOG.md](https://github.com/Waldo0926/monash-hub/blob/main/CHANGELOG.md).
