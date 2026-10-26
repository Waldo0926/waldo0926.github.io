---
layout: post
date: 2026-10-26 08:00:00 +0800
project: Study Kit
description: "Monash Study Kit lets an AI read your own Moodle and Ed. When you ask it what an assignment wants, it now follows a fixed order of sources: the brief and rubric, then staff answers on Ed, with dates and a source for every rule. How that rule is written, and the test that keeps the agent instructions true."
ref: assignment-sources
lang: en
preview: assignment-sources
title: "Which source wins when an AI reads your assignment"
image: /assets/og/assignment-sources.png
---

[Monash Study Kit](https://github.com/Waldo0926/monash-study-kit) keeps a local copy of a student's own Moodle and Ed Discussion and lets Claude, or another MCP client, answer questions from it: what is due this week, where a topic is covered, what changed on Ed. It is read-only. It cannot submit work, answer quizzes or post.

A common question is "what does assignment 2 actually want?". Version 1.3.0, released this weekend, changes how that question is answered ([#17](https://github.com/Waldo0926/monash-study-kit/pull/17)).

## The problem: Ed is full of guesses

For one assignment there can be a brief on Moodle, a marking rubric, and dozens of Ed threads. In those threads most replies are from other students. Some are right, some are guesses, and some were right until staff posted a correction two weeks later.

A model given all of that can blend it. A confident student reply, such as "I think you're allowed to use lodash", reads the same as a tutor's. An old line in the brief and a newer staff correction can both end up in the answer as if they agreed.

## The order of sources

The rule is short:

1. **The brief and the marking rubric come first.** Find them and read the original text.
2. **Ed adds to the brief.** Count only replies from teaching staff and answers they endorsed. Other students' replies are leads, not rules.
3. **A later staff correction wins.** But when the brief and Ed disagree, list both with their dates, say which is newer, and suggest the student confirm with staff. Do not decide for them.
4. **Give a source for every rule**: file name and page, or post number, who said it and the date. If there is no source, say so. Do not fill the gap.

Point 3 does not let the model pick a winner when the brief and Ed disagree. It shows both with dates, and the student asks staff.

The rule only works because the data supports it. Study Kit's Ed output already marks each reply as 教师 or 助教 when it is from staff, puts ✅ on endorsed answers, and shows every reply's date. Without those marks, "only count staff replies" would be a hope, not an instruction.

## Three places, one rule

Students use Study Kit in different ways, so the rule is in three places:

- **The MCP server instructions.** Clients read these when they connect, so the rule applies without the student doing anything.
- **A preset prompt.** "作业要求" in the client's "+" menu takes an assignment name, reads the brief, the rubric and staff answers on Ed, and lists what to hand in, how it is marked, deadlines and format, and Ed clarifications, each with its source.
- **An agent skill.** `skills/monash-study-kit/SKILL.md` is for coding agents that call the `monash` CLI instead of MCP. It maps questions to commands, carries the same rule, and lists what only the student does: logging in, submitting, quizzes and posting. It installs with `npx skills add Waldo0926/monash-study-kit`.

The skill also says, in plain words: help the student understand the requirements. The work they hand in has to be their own, and unit rules on AI use apply.

## A test that keeps the skill true

Instructions written for an agent rot quietly. If a command is renamed, the agent runs a command that does not exist and tells the student something failed. So a test reads `SKILL.md` and checks it against the real CLI:

```python
TABLE = sorted(set(re.findall(r"^\|.*`(monash [^`]+)` \|$", TEXT, re.M)))

@pytest.mark.parametrize("cmd", TABLE)
def test_every_command_parses(cmd):
    with redirect_stderr(io.StringIO()):
        args = cli.build_parser().parse_args(shlex.split(cmd)[1:])
    assert getattr(args, "fn", None)

def test_exit_codes_match_cli():
    rows = dict(re.findall(r"^\| (\d+) \| (.+) \|$", TEXT, re.M))
    assert sorted(map(int, rows)) == sorted(cli.EXIT_CODES)

def test_assignment_rules_and_limits():
    assert "brief and the marking rubric come first" in TEXT
    assert "Other students' replies are leads" in TEXT
    assert "Never ask for, accept or repeat an Ed token" in TEXT
```

Every full command in the skill's table must parse with the real argument parser. Every command mentioned in the text must exist. The exit code table must match `EXIT_CODES`. And the key sentences of the rule must still be there, so an edit cannot drop them by accident.

## What this does not guarantee

This is an instruction to a model, not code that checks its answer. A model can still misread a rubric or miss a thread. What the rule changes is what the student gets back: sources and dates they can check in a minute, and a clear "ask staff" when the sources disagree.

## Takeaways

- Tell the model which source wins before it sees the sources, and make it cite every rule.
- An instruction like "only trust staff" needs the data to carry who is staff.
- Test agent instructions against the real program, the same way you test docs examples.

Code: [SKILL.md](https://github.com/Waldo0926/monash-study-kit/blob/main/skills/monash-study-kit/SKILL.md), [mcp_server.py](https://github.com/Waldo0926/monash-study-kit/blob/main/src/monash_study_kit/mcp_server.py), [test_skill.py](https://github.com/Waldo0926/monash-study-kit/blob/main/tests/test_skill.py), [CHANGELOG.md](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md).
