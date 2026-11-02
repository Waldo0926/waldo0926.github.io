---
layout: post
date: 2026-11-01 18:30:00 +0800
project: Study Kit
description: "Ed Web 能把整门课的 Ed 课件打成一个 zip，Study Kit 明明已经把这些文件下载下来了，却做不到。补上它要做几件事：改文件名但不重新下载、把正文里附的文件也抓下来、修一个被测试掩盖的 bug，还有部署到一台跑的不是我以为的那份代码的服务器。"
ref: study-kit-ed-export
lang: zh-Hans
source_repo: monash-study-kit
source_checked: 2026-11-01
title: "一个下载按钮，三个代码库：把整门课的 Ed 课件打包"
image: /assets/og/study-kit-ed-export-zh.png
---

问题很简单，本该我自己先想到。[Ed Web](https://monashed.secureview.tech/app/) 有个按钮，能把一门课的 Ed Lessons 按周打成一个 zip 下载。[Study Kit](https://github.com/Waldo0926/monash-study-kit) 明明已经把这些文件同步到你电脑上了，为什么没有？

文件确实同步了，只是放在按 Ed 数字 id 命名的文件夹里，比如 `39026/116285/201_Workshop 3 Slides.pdf`；Ed 正文页里附的文件不会下载；也没有办法把整门课一次交给你。我服务器上的私人版本缺的是另一头：网站上有 zip，但 Claude 在对话里给不了你。

这篇讲怎么在三个地方把它补上：Study Kit、ed-digest（我服务器上的 Ed 同步），以及把它们接到 claude.ai 的远程 MCP 服务器。

## 现在是什么样

```console
$ monash ed export FIT2109 --module "Week 3"
已打包 FIT2109：3 节 lesson、5 个文件（0.0 MB）
  ~/Downloads/FIT2109 Ed Lessons (Week 3) 2026-11-01.zip
```

```text
FIT2109 Ed Lessons/README.md
FIT2109 Ed Lessons/03 Week 3 - Editor-Modern IDE/07 W3 Pre-Class/Links.md
FIT2109 Ed Lessons/03 Week 3 - Editor-Modern IDE/07 W3 Pre-Class/02 Before class.md
FIT2109 Ed Lessons/03 Week 3 - Editor-Modern IDE/08 W3 Workshop/01 Workshop 3 Slides.pdf
FIT2109 Ed Lessons/03 Week 3 - Editor-Modern IDE/08 W3 Workshop/02 Workshop 3 Handout.pdf
FIT2109 Ed Lessons/03 Week 3 - Editor-Modern IDE/09 W3 Applied Session/01 applied3-starter.zip
FIT2109 Ed Lessons/03 Week 3 - Editor-Modern IDE/09 W3 Applied Session/01 Lab brief.md
```

这是用编造的课程数据真实跑出来的结果。同样的 zip，在本机课件页上点一下就有，在 AI 软件里说一句也行。

<figure class="shot">
  <div class="shot-frame">
    <div class="shot-bar" aria-hidden="true"><i></i><i></i><i></i><span>127.0.0.1:8766 · monash library</span></div>
    <picture>
      <source srcset="{{ '/assets/posts/study-kit-ed-export/library.webp' | relative_url }}" type="image/webp">
      <img src="{{ '/assets/posts/study-kit-ed-export/library.png' | relative_url }}" width="1600" height="1135" loading="lazy" alt="Study Kit 的本机课件页：课号旁边有一键打包 Ed 课件按钮，下面同一组里列着 Moodle 和 Ed 的文件。">
    </picture>
  </div>
  <figcaption>加了按钮的本机课件页。同一门课的 Moodle 和 Ed 文件现在放在同一组。真实页面的 2 倍截图，课程数据是编的。</figcaption>
</figure>

## 改名，但不重新下载

文件夹名好读，是最容易想要、也最麻烦落地的部分。每个升级的人手里都已经有一堆按旧名字存的 PDF。全部重新下载又慢，又给 Ed 的文件服务器添负担。所以同步时先查这一页上次存在哪，直接挪过去：

```python
def _move_old(old: str | None, new: str) -> None:
    if not old or old == new:
        return
    src, dest = FILES_DIR / old, FILES_DIR / new
    if src.is_file() and not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        os.replace(src, dest)
```

新路径是 `课号/NN 模块/NN lesson/NN 标题`。前面的编号比看上去重要：不加的话，访达会把 Week 10 排在 Week 2 前面；模块按数据库 id 排，也不一定是 Ed 上的顺序。所以模块编号取它第一节 lesson 在 Ed 上的位置。课号也要处理：`FIT3162/FIT3164` 在 Ed 上是一门课，但斜杠是路径分隔符，所以变成 `FIT3162+FIT3164`。

Ed 上给 lesson 改了名，也走同一套挪动。页删了，本地文件跟着删，删空的文件夹也一起清掉。

## 附件，以及给没有 id 的东西一个稳定的 id

starter code 通常不是一页 PDF，而是文字页里的一个 `<file>`。现在这些也会下载，但只限 Ed 自己的文件服务器上的链接，单个不超过 200 MB。毕竟一个指向数据集的链接，终归只是个链接。

`lesson_files` 每一行都以 Ed 的 slide id 为键，附件没有这个 id。我想沿用这张表，这样课件页、全文搜索、lesson 阅读器这些读它的地方就都自动认得附件。所以 id 由 URL 算出来：

```python
def attachment_id(url: str) -> int:
    return -int.from_bytes(hashlib.sha256(url.encode()).digest()[:7], "big") - 1
```

负数，永远不会和真的 slide 撞；固定，下次同步能找到上次存的文件；和 URL 绑在一起，老师换了文件，Ed 会给一个新 URL，id 随之改变，新文件被下载，旧的被清掉。PDF 页也用同样的规则：`file_url` 变了就重新下载，不再留着旧版本。

## zip 从数据库生成，不从磁盘

打包不去遍历文件夹，而是从 SQLite 读模块、lesson 和文件，重新算出好读的路径，再写一个 `README.md`（每节的进度和 Ed 链接、没下载到的文件），阅读网页写进 `Links.md`。这样有两个好处：升级后还没同步就导出，zip 里的名字也是对的；文件缺了会写出来，而不是悄悄不见。

## 一个被测试掩盖的 bug

把按钮接进课件页时，我发现这个页面其实从来没列出过 Study Kit 自己同步的 Ed 文件。代码判断路径是否在 Ed 文件夹里，可数据库存的是相对路径，所以永远判断失败。原来的测试能过，是因为它插进去的是绝对路径。修起来只要一行；教训是测试数据要按生产环境写数据的方式来造。现在多了一个用相对路径的测试。

## 加一个工具，但不让每次对话都变长

每个 MCP 工具的名字、说明和参数，每次对话都会整份发给模型，用不用都算。所以项目里有预算：工具清单超过一定大小测试就失败，原有工具的契约还用哈希钉住。`export_ed_lessons` 大约 360 个字符，老工具一个字没改。

它也是第一个会写东西的 Ed 工具（往你的“下载”文件夹写一个 zip），所以没有标成只读。这带来一个好处：远程模式只提供只读工具，所以连到别人自建 Study Kit 的 ChatGPT，永远不会往对方服务器上写 zip。

## 服务器那边

我自己的部署不一样。ed-digest 在 VPS 上同步 Ed，本来就会给网站的每门课打一个 zip。与其再写一个打包器，远程 MCP 服务器直接加载 ed-digest 的 `site.py`，调用同样的两个函数，这样 Claude 给的 zip 和网站上的 zip 不可能对不上。它必须按文件路径加载，因为 `import site` 会悄悄拿到 Python 标准库里的 `site`。

Claude 拿不到我服务器上的文件，所以工具返回一个链接：

```python
def download_sig(rel: str, exp: int) -> str:
    return hmac.new(_download_key(), f"{exp}:{rel}".encode(), hashlib.sha256).hexdigest()[:32]
```

签名同时覆盖路径和过期时间，改哪个都是 403；`ed-export/` 前缀只能解析到导出文件夹里直接放着的 zip。现在一个仓库依赖另一个仓库的两个函数，所以 ed-digest 加了契约测试，钉住它们的名字和参数。谁改了名字，失败的是 ed-digest 自己的 CI，而不是某个同学周日晚上的一次请求。

ed-digest 也顺带吃到了 Study Kit 的改进：周文件夹按 Ed 上的顺序编号，zip 里有附件。

## 服务器跑的不是我以为的那份

原计划是拉代码、重启。动手前我看了一眼服务配置，线上的连接器根本不是从仓库跑的：一个 systemd drop-in 把它指向了一个发布快照 `releases/student-20261031-r2`，用的是另一个 virtualenv。磁盘上的仓库落后了四个 PR。

所以部署改成按快照的方式来：

1. 把线上快照里每个文件算哈希，和 git 对比。运行中的代码和我改动之前的 `main` 完全一致，所以新版本和线上的差别只有这次的工作。
2. 记下旧的软链接目标、drop-in 和 `pip freeze`，用来回滚。
3. 把合并后的提交解到新的 release 目录，在服务器上用一个临时 virtualenv 装新的核心包，跑完整测试：150 个通过。
4. 升级线上环境，切换软链接，更新构建 SHA，重启。
5. 用服务自己的环境调用一次工具，再从外网下载签名链接：正常的拿到 zip（200），伪造签名的返回 403。

之后我也更新了仓库那一份，它跑定时任务和 SSH 版的服务器。这个环境里唯一变化的包是核心包，我用前后两次 `pip freeze` 的差异确认过。

## 几点体会

- 改用户文件的名字时，挪已有的。重新下载既耽误用户，也消耗上游服务器的带宽。
- 没有 id 的东西也需要稳定的 id。从“内容变了它就变”的东西里推出来。
- 导出要从唯一可信的数据源生成，而不是磁盘上碰巧有什么。
- 测试数据要像生产数据，不然测试会因为错误的理由通过。
- 一个仓库调用另一个仓库时，在被调用的那边钉住契约。
- 部署之前，先确认服务器实际在跑什么。

后续：[整课导出系统]({% post_url 2026-11-03-study-kit-course-materials-zh %})补上了 Moodle 正文、Google 文件、PDF 与隔离账号。
