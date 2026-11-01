---
layout: post
date: 2026-11-01 07:30:00 +0800
project: SecureView
description: "Connection-pool exhaustion and deadlocks became real questions only when the encrypted file-sharing app handled concurrent use."
ref: mysql-concurrency
lang: en
title: "What SecureView's concurrency tests caught that a demo didn't"
image: /assets/og/site.png
---

In a one-person SecureView demo, the visible features were encryption, upload, sharing and decryption. Later, I spent more time on less visible work: database connections, concurrent requests and what happens after a failure.

SecureView was our four-person final-year project. My work included testing, CI, deployment and security features. Correct encryption alone doesn't make a file-sharing service usable under load.

## Upload failures aren't always crypto failures

A capacity test with 100 users exposed a connection-pool problem. Upload failures were substantial before the issue was diagnosed and fixed; the project's README records the test results. I'm not presenting a fresh benchmark in this post.

We also encountered MySQL concurrency deadlocks. These bugs often involve transaction boundaries and lock ordering rather than the most complicated business function. A successful single upload exercises none of that contention.

## Leave a regression test behind

After fixing a concurrency bug, I want a test that recreates the failure. A few successful manual retries aren't enough. The MySQL suite, browser tests and fault-injection cases help protect against regressions.

A deadlock error by itself isn't a complete diagnosis. It matters which statements lock which rows, how retries work, and whether a write's outcome is known.

See the [SecureView repository](https://github.com/Waldo0926/SecureView) for historical measurements and environment notes. This is a retrospective on testing, not a new performance claim about the current deployment.
