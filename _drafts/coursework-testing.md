---
layout: post
project: Monash & Study
description: "A coursework project running locally doesn't mean its delivery process is reliable. Many seemingly random failures turn out to depend on time, environment, commit history or edge-case inputs."
ref: coursework-testing
lang: en
title: "The testing and Git habits I kept from coursework"
image: /assets/og/site.png
---

> Editorial draft: verify facts and references before publication. Not published on the site.

A coursework project running locally doesn't mean its delivery process is reliable. Many seemingly random failures turn out to depend on time, environment, commit history or edge-case inputs.

The part worth sharing publicly is the engineering habit: test input boundaries, check timezone handling, rebuild dependencies in a clean environment and verify what Git actually includes. Behavioural tests are stronger than assertions tied to the exact phrasing of the UI.

Git time filtering is particularly easy to misunderstand. Commit timestamps and the environment matter, so a single command's output isn't sufficient evidence of correctness. Container-based reruns also make the result easier to reproduce.

This draft will not publish restricted assignment solutions, marking materials or non-public code. I will add a verified public example before posting it.
