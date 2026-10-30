---
layout: post
date: 2026-10-30 18:00:00 +0800
project: Study Kit
description: "Study Kit 1.4.0 起，ChatGPT 和网页版 Claude 也能连上。它仍然只给一个人用：配对码从你自己的终端拿，回调地址只认几个，令牌会轮换，远程只开放只读的工具。"
ref: study-kit-remote
lang: zh-Hans
title: "让 ChatGPT 也能用 Study Kit，但只给自己用"
image: /assets/og/study-kit-remote-zh.png
---

[Monash Study Kit](https://github.com/Waldo0926/monash-study-kit) 把你自己的 Moodle 和 Ed 同步到电脑上，让 AI 软件通过 MCP 去搜。Claude Desktop 和 Claude Code 是在本机把它当程序启动，用 stdio 通信。ChatGPT 和网页版、手机上的 Claude 做不到这一点，它们跑在别人的服务器上，只能去调一个 HTTPS 地址。

10 月 30 日发布的 1.4.0 加了一个可选的 `monash remote` 模式来解决这个问题。这篇讲它是怎么锁住的，因为一个能读你 Moodle 的公网地址，出错的代价很大。

## 只给一个人，只读自己的数据

我之前就决定不替所有人托管 Study Kit。那样我的服务器上会存着每个同学的 Moodle 登录和 Ed 令牌，被攻破一次就全部泄露。[文档](https://docs.secureview.tech/zh-cn/private-tools/)里也是这么解释的。

所以远程模式只给数据的主人自己用。你在自己的服务器上跑，或者在自己电脑上开一个 Cloudflare 免费的临时隧道，它把你同步好的资料提供给你自己的 AI 软件。setup 不会启动它，安装和更新也不会开任何端口。只有你自己运行 `monash remote serve`，它才开始监听。

服务器还拒绝绑定在本机回环以外的地址：

```python
def make_server(addr, con):
    if addr[0] not in {"127.0.0.1", "localhost"}:
        raise ValueError("Bind remote MCP on loopback behind an HTTPS reverse proxy")
```

HTTPS 由前面的 nginx 或隧道负责。每个请求都会检查 `Host` 和 `Origin` 是否和你给的公网地址一致，所以别的网页把自己的域名指到你机器上（DNS rebinding）会直接拿到 403。

## 用配对码代替密码

ChatGPT 和 Claude 用 OAuth 连接，通常意味着要有一个输密码的登录页。一个只有一个人用的工具，我不想为它做账号系统。所以登录页要的是你在自己终端里拿到的码：

```text
$ monash remote pair
Pairing code: 3F9A-0C21-B7E4
Valid for 10 minutes, single use.
```

数据库里只存它的 SHA-256 哈希。输对一次就作废。输错五次窗口就关掉，要重新运行 `pair`。没有打开的窗口时，页面会直接提示，什么都不接受。别人就算知道了你的地址，不在十分钟内坐在你的电脑前也进不来。

## 谁可以连进来

MCP 软件在登录之前会先自己注册，协议规定注册不需要登录。也就是说谁都能注册。有两点让这件事不要紧。

第一，只有回调地址全部在白名单上，注册才会被接受：`claude.ai`、`claude.com` 和 `chatgpt.com` 上那几条固定的 OAuth 回调路径，整个主机名完全匹配，不能带端口、查询串或片段。想把授权码发到别处的客户端在注册时就被拒了，所以就算授权码被截到，也只能回到 Claude 或 ChatGPT。可以用参数额外加一个精确的地址，但不能写通配。

第二，注册的客户端最多 50 个。满了以后，会清掉注册超过一小时、从来没换到过令牌的客户端。真正在用的客户端一定有刷新令牌，所以不会被清掉。

剩下的是公开客户端的标准 OAuth：

- 必须用 PKCE（S256）。只有 verifier 算出来的哈希和登录时的 challenge 一致，授权码才能换令牌。
- 访问令牌一小时过期。刷新令牌 30 天过期，每用一次就换新的，旧的立刻失效。
- 令牌以哈希形式存在 `secrets/remote-mcp.db`，文件创建时权限就是 0600。
- `monash remote revoke --all` 删掉所有客户端、授权码和令牌，并关掉还开着的配对窗口。

## 远程只开放读的工具

本地的 Study Kit 有 18 个工具。其中两个会启动 Moodle 登录或同步，这需要在那台机器上开浏览器、输密码。远程模式把它们从工具列表里去掉，就算软件硬要按名字调用，也会被拒绝：

```python
if spec and len(spec) > 3 and not spec[3]:
    return {"jsonrpc": "2.0", "id": msg.get("id"), "error": {
        "code": -32602, "message": "Run login or sync on the server's own terminal"}}
```

所以令牌能碰到的只有 16 个查询工具。令牌被偷的话，在它过期或被你撤销之前，对方能读你的课件，这当然不好，但他没法用你的身份登录，也改不了 Moodle 或 Ed 上的任何东西。不管本地还是远程，Study Kit 都没有提交作业、发帖或做测验的工具。

## 怎么验证的

[`tests/test_remote.py`](https://github.com/Waldo0926/monash-study-kit/blob/main/tests/test_remote.py) 里有 22 个测试，用编造的数据在一台机器上走完整个流程：从 401 开始的服务发现、注册、配对、PKCE、令牌过期和轮换、撤销、回调白名单、错误的 Host 和 Origin，以及拒绝登录和同步。有一个测试专门打开旧格式的数据库（令牌还没和服务器地址绑定的时候），确认升级以后之前存的令牌还能用。

10 月 30 日，PyPI 上的 1.4.0 包也在干净环境里用 Claude 和 ChatGPT 真实的回调地址走了一遍同样的登录和查询流程。那次测试没有公网域名。用我自己的域名和服务器，ChatGPT Plus 可以查我的 Moodle 和 Ed。具体步骤在[自己托管](https://docs.secureview.tech/zh-cn/study-kit/remote/)。

## 小结

- 个人工具的远程模式就应该一直是个人的。一个主人，只有他自己的数据，不替别人启动任何东西。
- 只有一个用户的时候，一个从自己终端拿的码就能代替整套账号系统。
- 回调地址在客户端注册时就查清楚，后面每一步都能放心用。
- 想清楚哪些工具可以离开这台机器。会登录或会写东西的，都留在本地。
