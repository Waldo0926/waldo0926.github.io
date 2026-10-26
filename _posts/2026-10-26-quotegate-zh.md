---
layout: post
date: 2026-10-26 11:00:00 +0800
project: quotegate
description: "微信机器人里逐字核对摘句的代码，单独做成了一个零依赖的 Python 包。它留下什么、丢掉什么，为什么不用第二个模型当裁判，以及从打 tag 到发上 PyPI 怎么走。"
ref: quotegate
lang: zh-Hans
title: "把机器人的摘句核对做成一个包"
image: /assets/og/quotegate-zh.png
---

我的[微信问答机器人](https://github.com/Waldo0926/mumguide-wechat-bot)只许大模型用资料里的原句回答，每一句发出去之前都要经过代码核对。为什么这样做，我在[《只许大模型摘原句的问答机器人》](/2026/10/25/quote-only-rag-zh/)里写过。

这段核对代码原来在机器人的 `wxbot/rag.py` 里，和检索、校区标签、微信排版混在一起。这个周末我把它抽出来，做成了 [quotegate](https://github.com/Waldo0926/quotegate)，发到了 PyPI，MIT 许可证。这篇讲哪些东西放进了包里，哪些留在外面。

## 它做什么

让模型按 `[2] 原文里的一句话` 这样的格式回答。`check()` 读这些行，只有那句话确实在第 2 段资料里、单独拿出来也读得通，才留下：

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

第一句被扩展成它所在的整句话。第二句确实在资料里，但它以 “This” 开头，指的是读者看不到的上一句，所以被丢掉，并写明原因。

`status` 不是 `"ok"` 的时候，模型给的东西一句都不该发。另外四种状态说明原因：模型说不知道、一句都没摘、摘的都不在资料里、在资料里但单独读不通。机器人遇到这些就把问题转给我。

## 哪些会被丢掉

大部分规则来自机器人差点发出去的真实回复：

| 原因 | 例子 |
| --- | --- |
| `not found` | 改写过的句子，或者标错了是第几段 |
| `needs context` | 以 “This must...”、“However”、“不，” 开头；以 “:” 或 “；并且” 结尾 |
| `list item` | “If you don't meet any of the requirements above:” 下面的 “- you must contact ISP” |
| `table row` | “Oct intake \| OCT-MY-01 \| 6 Jan”，但没有表头 |
| `past year` | 2026 年读到 “From 2022 exams are online” |
| `a question` | 资料自己的 FAQ 问题 |

模型也不一定照格式来。解析每一行的正则接受 `【2†L9-L12】`、全角括号、前面带圆点、数字后面带冒号，这些我都在免费模型的回复里见过。

断句需要两个开关。默认换行就是一句结束，因为网页里换行通常是标题或列表项。公众号文章和 PDF 里的文字会在句子中间换行，这类资料标 `soft_breaks=True`。英文句号只有后面跟空白才算句子结束，所以 “50.0” 和 “monash.edu” 不会被拆开。

## 哪些留在外面

**不用模型。** 检查 RAG 回答常见的办法，是再让一个模型判断每个说法有没有依据，比如 Ragas 的 faithfulness。它给的是事后的分数，裁判本身也会两头出错。在机器人里，用第二个模型核对句子，有的多出来的步骤没拦住，有的对的句子反而被删了。字符串比对每次结果都一样，也没法被说服。

**不联网，没有依赖。** 整个包大约 290 行，只用标准库。四句摘句对五段 500 字的资料，核对一次大约 0.3 毫秒。

**不管检索，提示词只给个起点。** `quotegate.prompts` 里有中英文两个系统提示词，要求模型按这个格式回答，但找对资料是调用方的事。README 里写清楚了它做不到的：一句真实但答非所问的话，照样能通过。

和机器人有关的东西都变成了 `Rules` 里的设置：长度、连接词的正则、判断过去年份用的当前年份，还有一个 `checks` 列表放你自己的规则。机器人按校区排序的那部分，完全没放进包里。

## 从打 tag 到 PyPI

我希望发版是件无聊的事：

- 每次推送都在 Ubuntu、macOS、Windows 上，用 Python 3.10 和 3.13 跑测试，再跑 ruff。
- 另一个任务构建 wheel，装进一个干净的虚拟环境，跑一遍 README 里的例子。这能抓住测试都过了、但打包时漏了文件的情况。
- 推一个 `v0.1.0` tag 会触发 `release.yml`。它先检查 tag 和 `__version__` 一致、`CHANGELOG.md` 有这一节、打 tag 的提交在 `main` 上，然后再跑一遍测试，用 PyPI 的 Trusted Publishing 上传，哪里都不用存令牌。GitHub Release 的内容直接取自更新日志的那一节。

0.1.0 就是 10 月 26 日这样发出去的。

## 接下来

机器人里还留着自己那份核对代码，在 `wxbot/rag.py`。下一步是让它改用这个包，两边就不会越改越不一样。

## 小结

- 输入输出清楚的代码才值得抽出来，懂你产品的那部分留在原地。
- 写清楚这个包拦不住什么。对一个安全检查来说，这比功能列表更重要。
- 发版的检查放进发版流程里：版本号、更新日志、分支，最后从干净环境装一遍。

代码：[core.py](https://github.com/Waldo0926/quotegate/blob/main/src/quotegate/core.py)、[test.yml](https://github.com/Waldo0926/quotegate/blob/main/.github/workflows/test.yml)、[release.yml](https://github.com/Waldo0926/quotegate/blob/main/.github/workflows/release.yml)。PyPI：[pypi.org/project/quotegate](https://pypi.org/project/quotegate/)。
