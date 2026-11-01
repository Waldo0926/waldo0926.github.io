---
layout: post
date: 2026-11-01 04:20:00 +0800
project: Algorithms
description: "A post-course rebuild of Z matching, BWT search, Ukkonen suffix trees and Rabin–Karp, including the limitations I don't want to hide behind complexity claims."
ref: string-algorithms
lang: en
title: "The string algorithms I kept after the course ended"
image: /assets/og/string-algorithms.png
---

When I revisited my algorithms coursework, I didn't want to dump the old assignment directory straight onto GitHub. The code might still run, but without the design choices, complexity notes and boundary tests, it wouldn't mean much to someone else—or to me a year later.

I pulled four areas into a [standalone Python repository](https://github.com/Waldo0926/advanced-string-algorithms): Z-based exact matching, BWT-backed approximate matching, Ukkonen suffix trees with LCP extraction, and Rabin–Karp with Miller–Rabin prime generation.

## What the repository isn't

It isn't a production search engine. The BWT example deliberately has a simple suffix-array builder. The Z matcher has an `O(m²)` shift-preprocessing step in this implementation. Describing either as simply a “fast text-search algorithm” would hide a real cost.

Ukkonen's suffix tree is another good example. It's easy to mention linear-time construction, but the mistakes I kept looking for were in the active point, suffix links and skip/count bookkeeping. I wanted the implementation to make those transitions inspectable.

## How I check the results

For BWT approximate matching, the test cases separate substitution, insertion, deletion and transposition. For the LCP array, I compare against a naive reference on small inputs. Rabin–Karp checks candidate matches against the original text rather than treating equal hashes as proof.

There are runnable examples and pytest tests. The repo leaves out assignment sheets, marking material and private course resources; it is meant to show the algorithms and my implementation work.

The source is [advanced-string-algorithms](https://github.com/Waldo0926/advanced-string-algorithms), with additional notes in [ALGORITHMS.md](https://github.com/Waldo0926/advanced-string-algorithms/blob/main/ALGORITHMS.md). Before using any of it for large-scale indexing I'd benchmark the real workload and replace the intentionally simple construction steps.
