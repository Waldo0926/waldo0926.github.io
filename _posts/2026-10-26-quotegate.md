---
layout: post
date: 2026-10-26 11:00:00 +0800
project: quotegate
description: "The word-for-word check in my WeChat bot is now its own Python package with no dependencies. What it keeps and drops, why it does not use a second model as a judge, and how a release gets from a tag to PyPI."
ref: quotegate
lang: en
preview: quotegate
title: "Turning a bot's quote check into a package"
image: /assets/og/quotegate.png
---

My [WeChat Q&A bot](https://github.com/Waldo0926/mumguide-wechat-bot) lets a language model answer only with sentences copied from the passages it was given. Code checks each one before anything is sent. I wrote about why in [A Q&A bot where the model is only allowed to quote](/2026/10/25/quote-only-rag/).

That check lived inside the bot's `wxbot/rag.py`, mixed up with retrieval, campus labels and WeChat formatting. This weekend I pulled it out into [quotegate](https://github.com/Waldo0926/quotegate), a Python package on PyPI under MIT. This post is about what went into the package and what stayed out.

## What it does

The model is told to reply with lines like `[2] a sentence, copied`. `check()` reads those lines and keeps a quote only when it really is in passage 2 and still reads right on its own:

```python
from quotegate import Passage, check

passages = [
    Passage("Special consideration\nApply online within two working days of the due date. "
            "This must include supporting documents.", title="Special consideration"),
]
reply = "[1] Apply online within two working days\n[1] This must include supporting documents"

result = check(reply, passages)
result.status    # "ok"
result.kept      # [Quote(passage=1, text="Apply online within two working days of the due date.", start=22, end=75)]
result.dropped   # [Dropped(passage=1, quote="This must include supporting documents.", reason="needs context")]
```

The first quote is widened to the whole sentence it sits in. The second is in the passage, but it starts with "This", which leans on a sentence the reader will not see, so it is dropped with a reason.

When `status` is not `"ok"`, nothing from the model should be sent. The four other statuses say why: the model said it does not know, it quoted nothing, none of its quotes are in the passages, or the ones that are cannot be read alone. The bot forwards those questions to me.

## What gets dropped

Most of the rules came from real replies the bot almost sent:

| Reason | Example |
| --- | --- |
| `not found` | A paraphrase, or a quote credited to the wrong passage |
| `needs context` | Starts with "This must...", "However", "不，"; ends with ":" or "；并且" |
| `list item` | "- you must contact ISP" under "If you don't meet any of the requirements above:" |
| `table row` | "Oct intake \| OCT-MY-01 \| 6 Jan", without the header row |
| `past year` | "From 2022 exams are online", read in 2026 |
| `a question` | The passage's own FAQ question |

Models do not always follow the format either. The line parser accepts `【2†L9-L12】`, full-width brackets, a bullet in front and a colon after the number, because I saw all of them from free models.

Sentence splitting needed two switches. A line break ends a sentence by default, since in web pages it is usually a heading or a list item. WeChat articles and PDF text break lines mid-sentence, so those passages are marked `soft_breaks=True`. A latin full stop only ends a sentence before whitespace, so "50.0" and "monash.edu" stay whole.

## What stayed out

**No model.** A popular way to check a RAG answer is to ask a second model whether each claim is supported, like Ragas faithfulness. That gives a score after the fact, and the judge can be wrong both ways. In the bot, a second model checking sentences missed some added steps and cut correct ones. A string check gives the same answer every time and cannot be talked round.

**No network and no dependencies.** The whole package is about 290 lines of standard library Python. It takes about 0.3 ms to check four quotes against five 500-character passages.

**No retrieval, no prompts beyond a starting point.** `quotegate.prompts` has an English and a Chinese system prompt that ask for the format, but finding the right passages is the caller's job. The README says plainly what the package cannot do: a true sentence that answers a different question still passes.

Everything that was specific to the bot became a setting in `Rules`: lengths, the connective patterns, the current year for the past-year check, and a `checks` list for your own rules. The bot's campus sorting is not in the package at all.

## From a tag to PyPI

I wanted releases to be boring:

- Every push runs the tests on Ubuntu, macOS and Windows with Python 3.10 and 3.13, and runs ruff.
- A separate job builds the wheel, installs it into a clean virtual environment and runs the README example. That catches a package that passes its tests but ships without a file.
- Pushing a `v0.1.0` tag runs `release.yml`. It checks that the tag matches `__version__`, that `CHANGELOG.md` has that section, and that the tagged commit is on `main`. Then it runs the tests again and uploads with PyPI Trusted Publishing, so no token is stored anywhere. The GitHub Release is made from the changelog section.

0.1.0 went out this way on 26 October.

## What is next

The bot still has its own copy of the check in `wxbot/rag.py`. Moving it onto the package is the next step, so the two cannot drift apart.

## Takeaways

- Pull code out when it has a clear input and output, and leave the parts that know about your product behind.
- Write down what the package does not stop. For a safety check that matters more than the feature list.
- Check the release in the release workflow: version, changelog and branch, then a clean install.

Code: [core.py](https://github.com/Waldo0926/quotegate/blob/main/src/quotegate/core.py), [test.yml](https://github.com/Waldo0926/quotegate/blob/main/.github/workflows/test.yml), [release.yml](https://github.com/Waldo0926/quotegate/blob/main/.github/workflows/release.yml). Package: [pypi.org/project/quotegate](https://pypi.org/project/quotegate/).
