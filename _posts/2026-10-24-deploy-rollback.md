---
layout: post
date: 2026-10-24 10:00:00 +0800
project: Monash Hub
description: "One VPS, no one watching the deploys. How the deploy script checks the right commit is live and puts the previous images back when it is not."
ref: deploy-rollback
lang: en
preview: deploy-rollback
title: "How Monash Hub deploys itself and rolls back"
image: /assets/og/deploy-rollback.png
---

[Monash Hub](https://monashhub.secureview.tech) is a course information site I built for Monash students. It runs on one VPS: Docker Compose starts PostgreSQL, a FastAPI backend and a Nuxt frontend, with nginx in front. Merging into `main` deploys it.

I maintain it alone and I cannot watch every deploy. So the deploy script has to decide for itself whether a release worked, and put the previous version back when it did not. This post covers how it does that now, and the problems that pushed it there.

## What went wrong before

**1. The code that went live was not the code CI tested.** The first Deploy workflow only opened an SSH session and ran `deploy.sh`, which reset itself to `origin/main`. A commit pushed between CI finishing and the SSH session opening went live untested.

**2. The deploy script replaced itself.** Bash reads a script while it runs it. When `deploy.sh` ran `git checkout` halfway through, the file on disk changed under it, and the remaining lines could come from the new file at the wrong offset.

**3. One moved page broke several deploys in a row.** Monash moved its travel health and safety page from `study-abroad/overseas/` to `study-abroad/outbound/`. Registering official pages matched rows by URL, so it inserted a second row with the same slug and hit a unique constraint. Every deploy from #128 stopped at that step and production stayed on an older build until [#131](https://github.com/Waldo0926/monash-hub/pull/131) fixed it.

**4. A green health check said little.** The only check was a 200 from `/api/health`. An API that answers does not mean the pages render, or that the commit just deployed is the one running.

## The flow now

```
CI passes → the Deploy workflow gets the commit CI tested
          → SSH to the VPS and run deploy.sh <sha>
             1. check the commit is on origin/main, check it out, exec the new copy of the script
             2. back up the database with pg_dump, kept for 14 days
             3. tag the running images :previous
             4. build, migrate, seed curated data, start
             5. wait for /api/health; roll back after about 60 seconds without it
             6. run smoke.sh on the commit and key pages; roll back if it fails
          → run smoke.sh again from GitHub Actions through the public hostname
```

### Deploy only the commit CI tested

The Deploy workflow is triggered by CI's `workflow_run` event and passes the `head_sha` of that CI run, not whatever `main` points at by then. The script refuses a commit that is not on `origin/main`, so a manual run from another branch deploys nothing.

```bash
if ! git merge-base --is-ancestor "$DEPLOY_SHA" origin/main; then
  echo "error: $DEPLOY_SHA is not on origin/main; only reviewed commits are deployed" >&2
  exit 1
fi
git checkout -q --detach "$DEPLOY_SHA"
exec "$PROJECT_DIR/deployment/deploy.sh" --at "$DEPLOY_SHA"
```

The last line fixes problem 2. After the checkout the old file is never read again: `exec` starts the script from the new commit, and `--at` tells it the checkout is done. One side effect: the deploy that shipped this change still ran the old script, which does not exec, so it took effect from the deploy after.

### Keep the previous images

Before building, the running images are tagged `:previous`. Rolling back means moving the tags back and starting with `--no-build`, so nothing is rebuilt:

```bash
rollback() {
  for service in api web; do
    if docker image inspect "monash-hub-$service:previous" >/dev/null 2>&1; then
      docker tag "monash-hub-$service:previous" "monash-hub-$service:latest"
    fi
  done
  docker compose -p monash-hub up -d --no-build api web
}
```

### What counts as success

`/api/health` now reports the commit the image was built from. `smoke.sh` checks what a visitor would see:

- the commit the API reports is the one being deployed
- the home page renders in English and Chinese
- a unit page, a unit search and a search for WAM return data
- `robots.txt` and the sitemap are there
- a missing unit and a missing path return 404, not 500

It runs first on the VPS against the container ports and rolls back on failure. GitHub Actions then runs it through `monashhub.secureview.tech`, so the commit seen through nginx is checked too.

## What a rollback does not undo

A rollback swaps containers. It does not undo database migrations, so the old images run on the new schema, and migrations should work with both the old and the new code. When that is not enough, there is the backup from step 2.

The deploy also used to run two one-off data repairs that fetched two units from the Handbook and checked them. That made every deploy depend on Monash's site being up, and the 2027 Handbook would have failed every deploy. They now live in a separate `verify-handbook-parser.sh`, and the deploy script only deploys.

## Before the deploy

CI runs first: backend tests against a real PostgreSQL with a check that models and migrations agree, dependency audits, the frontend typecheck and build, and Playwright browser tests that go through the unit page, the course map and ratings at desktop and phone sizes. If CI fails, Deploy never starts.

## Takeaways

- Name the deployed commit, and make it visible from the live site.
- Make rollback cheap. Keeping the old images is faster than rebuilding and does not depend on the network or package registries at that moment.
- Keep steps that depend on outside websites out of the deploy script.

Code: [deploy.sh](https://github.com/Waldo0926/monash-hub/blob/main/deployment/deploy.sh), [smoke.sh](https://github.com/Waldo0926/monash-hub/blob/main/deployment/smoke.sh), [deploy.yml](https://github.com/Waldo0926/monash-hub/blob/main/.github/workflows/deploy.yml). Pull requests: [#151](https://github.com/Waldo0926/monash-hub/pull/151), [#188](https://github.com/Waldo0926/monash-hub/pull/188).
