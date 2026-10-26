---
layout: post
date: 2026-10-26 08:00:00 +0800
project: Study Kit
description: "Monash Study Kit 让 AI 读你自己的 Moodle 和 Ed。现在问它作业要求时，它按固定顺序看资料：先作业说明和评分细则，再看 Ed 上老师的回答，每条规定都标日期和出处。这条规则怎么写的，以及一个让给 AI 的说明书保持准确的测试。"
ref: assignment-sources
lang: zh-Hans
title: "AI 读作业要求时，该信哪个来源"
image: /assets/og/assignment-sources-zh.png
---

[Monash Study Kit](https://github.com/Waldo0926/monash-study-kit) 在本地存一份同学自己的 Moodle 和 Ed Discussion，让 Claude 或其他 MCP 客户端从里面回答问题：这周要交什么、某个知识点在哪份资料里、Ed 上有什么新消息。它是只读的，不能交作业、做测验或发帖。

常见的一个问题是“作业 2 到底要我做什么”。这个周末发布的 1.3.0 版改了回答这类问题的方式（[#17](https://github.com/Waldo0926/monash-study-kit/pull/17)）。

## 问题：Ed 上全是猜测

一份作业，Moodle 上有作业说明，有评分细则，Ed 上还有几十个帖子。这些帖子里大部分回复是同学写的。有的对，有的是猜的，还有的本来是对的，直到两周后老师发了更正。

把这些全给模型，它可能会混在一起。一句很有把握的同学回复，比如“我觉得可以用 lodash”，读起来和助教说的一样。作业说明里的旧说法和老师后来的更正，也可能被当成一致的意思写进答案。

## 资料的顺序

规则很短：

1. **作业说明和评分细则优先。** 先找到它们，读原文。
2. **Ed 是对作业说明的补充。** 只认教师和助教的回复，以及他们 endorsed 的回答。同学的回复只当线索，不当规定。
3. **老师后来的更正优先。** 但作业说明和 Ed 说法不一致时，两边都列出来，标上日期，说明哪个更新，建议同学找老师确认。不替同学做决定。
4. **每条规定都标出处**：文件名和页码，或者帖子编号、谁说的、哪天说的。找不到出处就直说，不自己补。

第 3 条不让模型在作业说明和 Ed 不一致时选一边。它把两边都列出来、标上日期，由同学去问老师。

这条规则能用，是因为数据本身支持。Study Kit 输出 Ed 内容时，老师的回复本来就标着“教师”或“助教”，endorsed 的回答前面有 ✅，每条回复都有日期。没有这些标记，“只认老师的回复”就只是一句愿望，不是一条能执行的指令。

## 一条规则，放在三个地方

同学用 Study Kit 的方式不一样，所以这条规则放在三个地方：

- **MCP 服务器的说明。** 客户端连接时会读，所以同学什么都不用做，规则就生效。
- **一个预设提示。** 客户端输入框“+”菜单里的“作业要求”，填上作业名，它会读作业说明、评分细则和老师在 Ed 上的答疑，列出要交什么、怎么评分、截止时间和格式，以及 Ed 上的补充说明，每条都标出处。
- **一个 agent skill。** `skills/monash-study-kit/SKILL.md` 给不用 MCP、直接调用 `monash` 命令行的编程 agent 用。它把常见问题对应到命令，带着同样的规则，并列出只能由同学自己做的事：登录、交作业、做测验、发帖。用 `npx skills add Waldo0926/monash-study-kit` 安装。

skill 里还直白地写了：帮同学理解作业要求，交上去的作业必须是自己做的，各门课关于 AI 使用的规定照样适用。

## 用测试让说明书保持准确

写给 agent 的说明书会悄悄过时。命令改了名，agent 就会去跑一个不存在的命令，再告诉同学出错了。所以有一个测试读 `SKILL.md`，拿真正的命令行程序来核对：

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

skill 表格里的每条完整命令，都要能被真正的参数解析器解析。正文里提到的每个命令都必须存在。退出码表要和 `EXIT_CODES` 一致。规则里最关键的几句话也必须还在，免得哪次修改不小心删掉。

## 它保证不了的

这是给模型的指令，不是检查答案的代码。模型还是可能看错评分细则，或者漏掉某个帖子。这条规则改变的是同学拿到的东西：一分钟就能核对的出处和日期，来源不一致时一句明确的“去问老师”。

## 小结

- 在模型看到资料之前，先告诉它哪个来源优先，并要求每条规定都标出处。
- “只信老师”这种指令，需要数据里本来就标着谁是老师。
- 给 agent 的说明书要拿真正的程序来测，就像测文档里的示例一样。

代码：[SKILL.md](https://github.com/Waldo0926/monash-study-kit/blob/main/skills/monash-study-kit/SKILL.md)、[mcp_server.py](https://github.com/Waldo0926/monash-study-kit/blob/main/src/monash_study_kit/mcp_server.py)、[test_skill.py](https://github.com/Waldo0926/monash-study-kit/blob/main/tests/test_skill.py)、[CHANGELOG.md](https://github.com/Waldo0926/monash-study-kit/blob/main/CHANGELOG.md)。
