---
layout: post
date: 2026-11-01 07:30:00 +0800
project: SecureView
description: "Connection pool exhaustion and deadlocks only showed up once the file sharing app had many users at the same time."
ref: mysql-concurrency
lang: en
title: "SecureView concurrency testing"
image: /assets/og/mysql-concurrency.png
source_repo: SecureView
source_checked: 2026-11-01
---

SecureView was our four-person final year project, a file sharing app where files are encrypted in the browser. My parts included testing, CI, deployment and some of the security features. In a one-person demo you see encryption, upload, sharing and decryption. Later I spent more time on database connections, concurrent requests and what happens after a failure.

## Upload failures that had nothing to do with encryption

A load test with 100 users found a connection pool problem. Many uploads failed before we found and fixed it. The results are in the project README, and this post doesn't add new benchmark numbers.

We also hit MySQL deadlocks. These came from transaction boundaries and the order rows were locked in. A single upload never runs into them.

## A test for each fix

After fixing a concurrency bug I want a test that reproduces it, since a few manual retries that happen to pass don't prove much. The MySQL tests, browser tests and fault injection cases are there to catch the same bugs again.

To understand a deadlock you need to know which statements lock which rows, how retries work and whether a write finished. The error message alone doesn't tell you that.

The [SecureView repository](https://github.com/Waldo0926/SecureView) has the earlier measurements and environment notes. This post looks back at the testing and doesn't make claims about the current deployment.
