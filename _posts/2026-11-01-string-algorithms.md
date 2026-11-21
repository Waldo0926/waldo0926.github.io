---
layout: post
date: 2026-11-01 04:20:00 +0800
project: Algorithms
description: "Z matching, BWT search, Ukkonen suffix trees and Rabin Karp rebuilt as a standalone repo, with their limitations written down."
ref: string-algorithms
lang: en
title: "String algorithms code I kept after the course"
image: /assets/og/string-algorithms.png
---

When I went back to my algorithms coursework, I didn't want to put the old assignment folder on GitHub as it was. The code might still run, but without notes on the design, complexity and edge cases it wouldn't be much use to anyone, including me a year later.

I moved four parts into a [separate Python repository](https://github.com/Waldo0926/advanced-string-algorithms): exact matching with the Z algorithm, approximate matching with BWT, Ukkonen suffix trees with LCP extraction, and Rabin Karp with Miller Rabin prime generation.

## Limitations

It isn't a production search engine. The BWT example uses a simple suffix array builder on purpose, and the Z matcher here has an `O(m²)` preprocessing step for shifts. Calling either a fast text search would hide that cost.

For Ukkonen's suffix tree, the bugs I kept hunting were in the active point, suffix links and skip/count. The code is written so those steps can be followed one at a time.

## Testing

For BWT approximate matching, the tests cover substitution, insertion, deletion and transposition separately. The LCP array is compared against a naive version on small inputs. Rabin Karp checks each candidate against the text, since equal hashes don't prove a match.

There are runnable examples and pytest tests. Assignment sheets, marking material and other course resources are not included.

More notes are in [ALGORITHMS.md](https://github.com/Waldo0926/advanced-string-algorithms/blob/main/ALGORITHMS.md). Before using any of this for indexing at scale, I'd benchmark the real workload and replace the simple construction steps.
