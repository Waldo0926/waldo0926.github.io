---
layout: post
date: 2026-10-24 18:20:00 +0800
project: SecureView
description: "At 100 concurrent users, up to 78% of uploads failed while the CPU sat at 3%. How the cause was found, a first fix that made things worse, and the fix that brought failures to zero."
ref: secureview-pool
lang: en
preview: secureview-pool
title: "100 users, 3% CPU, and most uploads failing"
---

[SecureView](https://github.com/Waldo0926/SecureView), our final year project, has a load test tool in `loadtest/`. It signs in as many users at once, uploads, downloads and shares files, and checks the SHA-256 of every downloaded file against the original. Up to 50 concurrent users the server returned no errors. At 100, 65% to 78% of uploads failed with HTTP 500.

The server's CPU averaged 3% and memory was flat. So the server was not busy. It was stuck waiting on something.

## The error

Every failure had the same message in the log:

```
QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00
```

The API ran as one uvicorn process with SQLAlchemy's default pool: 5 connections plus 10 overflow, so at most 15 database transactions at once. A request that waits 30 seconds for a connection gets a 500. But 15 connections should be plenty for 100 users if each request holds one for a few milliseconds. Something was holding them much longer.

## The first guess was wrong

The test report guessed that a file transfer kept its database connection open for the whole transfer. That sounded likely, so I checked it rather than fixing it straight away. I ran three deliberately slow downloads of a 30 MB file while watching MySQL. There were **no open transactions** during the transfers. The download commits before it starts streaming, which gives the connection back.

So downloads were fine. I reproduced the failure on my laptop at 100 users (80% of uploads failed, throughput fell to 0.33 operations a second), which meant I could study it without the shared server. The log showed every timeout happening inside authentication.

## The cause: a deadlock between two pools

The upload endpoint is `async`. Here is what one upload did:

1. Authentication checked out a database connection and did not give it back.
2. The upload ran its database calls on the event loop.
3. To write the uploaded file to disk, it awaited the thread pool once per chunk, still holding the connection.

The thread pool has 40 threads. With 100 users, 15 uploads held all 15 connections while waiting for a free thread, and all 40 threads were other requests waiting for a connection. Each side was waiting for the other. Nothing moved until the 30 second pool timeout, and then the requests failed.

This explains the 3% CPU. Nothing was computing. Everything was waiting.

## The fix that made it worse

The obvious fix was to release the connection after authentication, before writing the file. I tried only that, and **50 users** became slow too: download p95 went to 30 seconds.

The upload's remaining database calls still ran on the event loop. Now they waited for a connection *on the event loop*, which blocks every request in the process, not just the upload. I did not ship it.

## The fix that worked

The upload is split into three parts so that no database call runs on the event loop and no connection is held while waiting for a thread:

```python
async def upload(self, *, actor, metadata, ciphertext, context):
    # 1. checks in the thread pool: keys, limits. The connection is released after.
    owner_key, recovery_key = await run_in_threadpool(self._check_upload, actor, metadata)

    # 2. write the encrypted file to a staging object. No connection held.
    staged = await self.storage.stage_upload(ciphertext, max_size_bytes=...)

    # 3. back in the thread pool: rows, audit event, publish, commit.
    return await run_in_threadpool(
        self._record_upload, actor, metadata, context, staged, owner_key, recovery_key
    )
```

Authentication also ends its read-only transaction now, so no request carries a connection from authentication into the endpoint. (Error handling is left out above. A failure in step 2 still rolls back and removes the staged object.)

## Results

Same laptop, same tool, same accounts, 30 seconds per step with 1 MiB files:

| Concurrent users | Failed before | ops/s before | Failed after | ops/s after |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 0% | 53.6 | 0% | 58.4 |
| 50 | 0% | 54.5 | 0% | 56.1 |
| **100** | **80%** | **0.33** | **0%** | **56.1** |

After the fix, throughput stays at about 56 operations a second at every step and latency grows with the queue, which is the machine's real limit. I ran it again on the real server that night: 102 of 102 uploads succeeded at 100 users, and every download matched its original hash.

## Tests that keep it fixed

- A unit test checks that the connection is released before staging starts.
- The fault injection test kills the database connection at the exact commit that writes the file row, and checks that the cleanup job removes the orphaned object.
- The full backend suite passed on MySQL after the change: 633 tests, 85% coverage.

## Takeaways

- Low CPU with failing requests means something is waiting. Look for pools, locks and timeouts, not for slow code.
- Check a guess before fixing it. The first theory here sounded right and was wrong, and one measurement showed it.
- In async Python, a blocking database call on the event loop stalls everything. Either make the call async or run it in the thread pool, and do not hold a connection across an `await`.
- Keep the before and after numbers from the same tool. Then the fix is a measurement, not a claim.

The full write-up with raw data is in [`docs/performance/pool-fix-2026-10-04/`](https://github.com/Waldo0926/SecureView/tree/main/docs/performance/pool-fix-2026-10-04), and the code is [`file_service.py`](https://github.com/Waldo0926/SecureView/blob/main/backend/app/services/file_service.py).
