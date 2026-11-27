---
layout: post
date: 2026-11-27 10:15:00 +0800
project: Monash Hub
description: "Moving 18 whitelisted PostgreSQL tables from an overseas VPS to a mainland cloud server across 50% packet loss using xz, parallel 1 MB scp chunks and atomic replica-mode restore."
ref: hub-cross-border-sync
lang: en
source_repo: monash-hub
source_checked: 2026-11-27
title: "Syncing 18 public PostgreSQL tables across a lossy cross-border link"
tags: [PostgreSQL, Bash, Linux, Networking, Docker]
image: /assets/og/hub-cross-border-sync.png
---

When I stood up the [China mainland read-only mirror]({% post_url 2026-11-27-hub-readonly-mirror %}) of Monash Hub, the database on the mainland host needed the public Handbook and official-guide tables from my overseas PostgreSQL instance — and nothing else. The overseas server is treated as strictly read-only for this job, and no user, auth, notification, review or community table may ever leave it.

The data is not huge: 18 public tables, roughly 100 MB when gzipped. On a clean network that takes a few seconds. On an evening cross-border link with roughly 50% packet loss and ~228 ms RTT, a single TCP stream stalled at ~5.5 KB/s and moved only 512 KB in five minutes.

Hostnames, IPs, ports and credentials are omitted below.

## Making the transfer survive packet loss

TCP congestion control punishes a single connection hard when half the packets drop at high latency. Rewriting the sync script (`deployment/sync-cn-public-data.sh`) around four simple changes brought the transfer time down by roughly 16×:

1. **Read-only whitelist dump + stronger compression.** The script runs `pg_dump --data-only --no-owner --no-privileges` against an explicit 18-table whitelist on the overseas container, streams it through `gzip -1` over SSH to my local machine, and re-compresses locally with `xz -T0 -6`. That shrinks the ~100 MB gzip stream to ~54 MB.
2. **Local privacy audit before upload.** Before anything goes to the mainland host, the script checks the decompressed SQL stream against a regex of all 16 forbidden tables (`users`, `email_verification_codes`, `notifications`, `auth_throttle`, `community_*`, `unit_reviews`, `search_terms`, `alembic_version`, etc.) and aborts on any match.
3. **1 MB chunks uploaded in parallel with retries.** `split -b 1m` cuts the 54 MB archive into 54 independent pieces, and `xargs -P 8` runs 8 concurrent `scp` workers, each retrying up to 4 times with `ServerAliveInterval=10`. Even when one worker hits `scp: Connection closed`, it retries that single 1 MB piece without restarting the other 53.
4. **End-to-end SHA256 verification.** The target host concatenates the chunks, checks `sha256sum` against the hash computed locally, and refuses to restore on a mismatch.

On the latest sync (after PR #299 added `reference_links` to 962 degrees), all 54 chunks landed and verified in 503 seconds — still not LAN speed, but completely reliable even during peak cross-border congestion.

## Three snags I hit along the way

### 1. Circular foreign keys on `--data-only` restore

`pg_dump --data-only` immediately warned that `unit_requisite_groups` and `curriculum_containers` have self-referencing / circular foreign-key constraints, meaning plain `COPY` statements can fail depending on row order.

Because the restore runs inside a single transaction on an isolated read-only mirror, wrapping it like this keeps it both fast and atomic:

```sql
BEGIN;
SET LOCAL session_replication_role = 'replica';
TRUNCATE TABLE <18 whitelisted public tables> RESTART IDENTITY CASCADE;
-- xz -dc dump stream
COMMIT;
ANALYZE;
```

If anything fails mid-restore, the transaction rolls back and the previous dataset stays intact. `SET LOCAL` automatically resets `session_replication_role` when the transaction ends, and `ANALYZE` updates planner statistics immediately afterward.

### 2. The `xargs -n 1 bash -c` argument-order bug

When I moved from an interactive shell function to a standalone bash script, the first run failed immediately with `cp: <host>: No such file or directory`.

I had written:

```bash
find "$LOCAL_CHUNKS" -maxdepth 1 -name 'part-*' | sort | xargs -n 1 -P "$PARALLEL_CHUNKS" bash -c '
  f="$1"
  dst_host="$2"
  remote_dir="$3"
  ...
' _ "$DST_HOST" "$REMOTE_CHUNKS"
```

`xargs -n 1` appends the piped filename at the **end** of the command line, not right after `_`. So `$1` was `$DST_HOST`, `$2` was `$REMOTE_CHUNKS`, and the actual chunk path was `$3`. Swapping the assignments fixed it cleanly.

### 3. Schema drift before data sync

Because the overseas database already had Alembic migration `d7a1e3b5c902` (adding `reference_links` JSONB columns to `courses`, `areas_of_study` and `curriculum_containers`), running a `--data-only` sync before migrating the mainland database would have failed on mismatched `COPY` column lists. The safe order is always: deploy code → `alembic upgrade head` → rebuild `api` and `web` → run `sync-cn-public-data.sh`.

## Optional mirror args for slow PyPI and npm builds

Building the backend Docker image on the mainland server also timed out against `pypi.org`. Rather than hardcoding a regional mirror into the shared Dockerfiles, I added optional empty-by-default build args:

```dockerfile
ARG PIP_INDEX_URL=""
RUN pip install --no-cache-dir ${PIP_INDEX_URL:+-i "$PIP_INDEX_URL"} -r /srv/backend/requirements.txt
```

The frontend Dockerfile does the same with `ARG NPM_REGISTRY=""`. Overseas builds leave both empty and use upstream defaults; `docker-compose.cn.yml` passes domestic mirrors so rebuilds finish in under half a minute instead of timing out.
