---
layout: post
date: 2026-10-26 09:00:00 +0800
project: Attendance Helper
description: "签到助手上架 Chrome 应用商店之前，我去掉了一个权限，删掉了一个库里从来不会用到的网址，还让打包脚本遇到远程代码就拒绝打包。商店查什么，以及我怎么先自己查一遍。"
ref: chrome-store
lang: zh-Hans
title: "把 Chrome 扩展准备好上架应用商店"
image: /assets/og/chrome-store-zh.png
---

[Monash 签到助手](https://github.com/Waldo0926/monash-attendance-reminder)是给 Monash 同学用的 Chrome 扩展。它从 Monash Attendance 读出你最近的课，在 Gmail、Moodle 和 Ed 里找教学人员发的签到码，集中在一个页面上给你看。只有你勾选“我参加了这些课”并点提交，才会提交。

之前只能下载 zip、打开开发者模式手动安装，对大部分同学来说太麻烦了。所以 10 月 25 日我把 v1.3.52 提交到了 Chrome 应用商店，现在还在等审核。这篇讲为了上架改了什么。

## 永远不会运行的远程代码也算

签到码经常是截图，所以扩展里打包了 Tesseract.js 做 OCR。它跑在 offscreen 文档里，因为 service worker 没有 DOM 和 canvas；它的 worker、WebAssembly 核心和英文数据都通过 `chrome.runtime.getURL` 从扩展包里加载。

Manifest V3 下商店不允许远程托管的代码，而它的扫描看的是文件内容，不看代码运行时实际做了什么。上游的 Tesseract.js 文件里还留着 jsDelivr 的网址当备用。我的代码一直传本地路径，这些网址根本用不到，但扫描照样会把它们当成远程代码。

v1.3.49 把这些备用网址换成了包里的文件，并加了一个测试：打包的 Tesseract 文件里只要再出现网址，测试就失败：

```js
assert.doesNotMatch(source, /https?:\/\//i, `${asset} must not contain remote URL literals`);
```

## 让打包脚本直接拒绝

只给一个库写一个测试不够。下次升级库，或者哪个页面里多了一个 `<script src>`，问题又回来了。所以商店用的 zip 由 `scripts/build-store-zip.sh` 生成，它把刚打好的包解开检查，发现下面这些就不留这个包：

- 代码、页面或 JSON 里出现 CDN 域名（jsDelivr、unpkg、cdnjs、Google 的字体和 API 域名）
- 打包的 Tesseract 文件里有任何 `http(s)://`
- 页面里有从别的域名加载的 `<script>` 或 `<link>`
- 扩展自己的代码里有远程 `import`、`importScripts`、`eval` 或 `new Function`
- 内容安全策略里允许了远程域名

```bash
if grep -rIEn 'import\(?\s*["'\''](https?:)?//|importScripts\(\s*["'\'']https?:|new Function\(|\beval\(' \
     "$tmp" --include='*.js' --exclude-dir=vendor; then
  flag "remote import or eval in extension code"
fi
...
if [ "$fail" -ne 0 ]; then
  rm -f "$out"
  exit 1
fi
```

CI 在每个 PR 上都跑它，不只是 `main`，所以审核会被拒的改动，在合并之前就会失败。

## 去掉让人害怕的权限

原来 manifest 里申请了 `tabs`。有这个权限，安装时 Chrome 会提示扩展能“读取你的浏览记录”。对一个要用到你 Monash 登录状态的工具来说，这个第一印象很差。

扩展要 `tabs` 只是为了两件事：在后台打开标签页，以及读它自己打开的 Attendance、Moodle、Ed 和 Gmail 标签页的网址。`chrome.tabs.create` 本来就不需要任何权限。而有了这几个网站的权限，扩展本来就能看到这些网站标签页的网址和标题。

去掉之前，我在 Chromium 里装上扩展核对过：`chrome.tabs.query` 照样能拿到打开着的 Ed 帖子网址，其他网站仍然看不到。v1.3.52 不再申请 `tabs`，安装提示也没了。

剩下的权限，在商店表单里每个都用一句话说明：

| 权限 | 用途 |
| --- | --- |
| `scripting` | 扩展重新加载后，给之前已经打开的标签页注入读取脚本 |
| `storage` | 设置、最近一次扫描结果和诊断日志，存在本机 |
| `alarms`、`notifications` | 每周提醒和“扫描完成”通知 |
| `offscreen` | 运行 Tesseract，因为 service worker 没有 canvas |
| 六个网站权限 | Attendance、Gmail、Moodle、Ed、Ed 的图片域名，以及 Moodle 存上传文件用的 CloudFront 域名 |

## 隐私说法自己验证

商店介绍里写着没有服务器、没有统计、没有远程代码。我想自己核对一遍。所以我把 OCR 从头到尾跑了一遍，把所有不是发给扩展自己的请求都记下来。它从测试图片里读出了 “Workshop 02 GU2ZP” 和 “Tutorial 16 ST8CT”，没有发出任何网络请求。

## “成功”必须是真的成功

提交之前还修了一个问题，因为以后会有不认识的人依赖它。v1.3.50 及以前，页面可能显示“已处理 2/2”，Attendance 里却还有一门课是问号。原来的“成功”只表示点到了某个东西。Attendance 是 ASP.NET 页面，整页就是一个表单；找按钮时把页头页脚的链接都算进去了，取的是第一个文字里有 “enter” 这类词的链接。

从 v1.3.51 开始，只找真正的按钮和回发链接，不会点首页、返回、取消或退出。点完之后，扩展会在新标签页重新打开 Attendance 的那一天，只有那一行显示已完成才算签上。确认页会列出每门课各自的结果，失败的写明原因。

## 小结

- 商店的扫描看的是文件。你从来不调用的代码里有网址，也还是网址。
- 把审核规则写进打包脚本，每个 PR 都跑。
- 申请权限之前，先看看更窄的 API 或者网站权限是不是已经够用。

代码：[build-store-zip.sh](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/scripts/build-store-zip.sh)、[manifest.json](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/extension/manifest.json)、[store/LISTING.md](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/store/LISTING.md)、[CHANGELOG.zh-CN.md](https://github.com/Waldo0926/monash-attendance-reminder/blob/main/CHANGELOG.zh-CN.md)。安装指南：[docs.secureview.tech/zh-cn/attendance](https://docs.secureview.tech/zh-cn/attendance/)。
