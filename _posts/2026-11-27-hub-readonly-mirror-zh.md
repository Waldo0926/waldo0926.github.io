---
layout: post
date: 2026-11-27 10:00:00 +0800
project: Monash Hub
description: "用一条 main 分支同时维护 Monash Hub 海外完整站和国内只读镜像，以及为什么微信小程序单独建仓"
ref: hub-readonly-mirror
lang: zh-Hans
source_repo: monash-hub
source_checked: 2026-11-27
title: "一套代码跑海外站和国内只读版，加上一个微信小程序"
tags: [FastAPI, Nuxt, Docker, Architecture, WeChat]
image: /assets/og/hub-readonly-mirror-zh.png
---

用 [Monash Hub](https://monashhub.secureview.tech) 的大多是准备来或者正在马来西亚校区读书的中国同学，家长也经常直接从国内打开。晚高峰从国内直连海外 VPS 偶尔很慢甚至丢包，所以我又在广州的云服务器上搭了一套独立节点，并基于同一套只读 API 写了个微信小程序

这里有个绕不开的约束：国内个人主体备案不能带用户账号、论坛社区、评价评论或开放式 AI 问答。纯信息查询和本地工具都没问题——课程查询、专业与学位结构、官方指南、重要日期、马来西亚学费、先修图、选课规划，以及纯浏览器计算的 WAM/GPA 计算器都可以保留；账号登录、社区发帖、课程评价、站点助手、通知和截图上传则必须彻底关掉

这篇文章里刻意省去了真实 IP、SSH 端口、主机别名和密钥配置

## 为什么做成开关，而不是 fork 第二套仓库

最开始我是在 `monash-hub` 里另拉了一条国内分支长期维护。不到一周就发现不对劲：海外 `main` 刚合并了官方选修参考链接和按级别浏览候选选修课（PR #299 和 #300），还带了一个新的 Alembic 迁移（`d7a1e3b5c902`），两边一同步，共享的前端文件马上开始出合并冲突

两个站点有 98% 以上的代码完全一致。国内版不是另一个产品，而是同一套 FastAPI + Nuxt 应用开了一个更严格的只读模式。后来我先把通用的导航、页脚和首页优化拆出 PR 回流到 `main`，再把 `CN_READONLY_MODE` 开关（默认 `false`）连同国内部署配置一起合回 `main`。海外继续跑原来的 `docker-compose.yml`，行为零变化；国内用 `docker-compose.cn.yml` 开启 `CN_READONLY_MODE=true` 和 `NUXT_PUBLIC_CN_READONLY_MODE=true`

## 四层纵深隔离

只把顶栏里的“社区”和“登录”隐藏掉是不够的，任何人手动输 `/community` 或者直接调 `/api/v1/auth/...` 还是能打到接口。我把只读边界拆成了四层：

1. **后端路由与中间件**：在 `backend/app/main.py` 里，路由按 `_READONLY_MODULES`（`units`、`courses`、`plan`、`search`、`guides`、`exchange`、`marks`、`dates`、`fees`）和 `_INTERACTIVE_MODULES`（`ask`、`community`、`auth`、`notifications`、`profile`、`reviews`）分开。开启 `cn_readonly_mode` 后，交互路由根本不挂载，同时挂一层 HTTP 中间件，对 `/api/v1/community`、`/api/v1/reviews`、`/api/v1/ask`、`/api/v1/auth`、`/api/v1/profile`、`/api/v1/notifications`、`/api/v1/search/missing`、`/api/v1/upload` 统一返回 `403`。保留下来的接口也会跳过评分和社区子查询，并把校区筛选项里的 `Malaysia` 排到第一位
2. **前端路由守卫与外链清理**：Nuxt 全局中间件 `middleware/cn-readonly.global.ts` 会把 `/community`、`/login`、`/register`、`/profile`、`/notifications` 等页面直接拦成 `404`。只读模式下 `app.vue` 不加载 Google Fonts，改走系统自带中文字体回退，避免国内浏览器卡在字体请求上。`/marks` 页面隐藏了截图 OCR 按钮，保留纯浏览器内手动输入和 WES 文本粘贴。另外把静态 `robots.txt` 换成了动态 `server/routes/robots.txt.ts`，同步过滤了 `sitemap.xml.ts`，并在页脚预留了 `NUXT_PUBLIC_ICP_NUMBER` 备案号位
3. **数据库 18 张公开表白名单**：国内 PostgreSQL 从不做整库备份恢复。同步脚本只导出白名单里的 18 张公开业务表（Handbook 课程、学位、专业方向、官方指南、FAQ、翻译表等），上传前先在本地做正则审计，确认不包含任何禁用表。用户、验证码、通知、社区帖子、回答、投票和课程评价这 13 张表在国内库里永远保持 0 行。这套导出怎么跨过丢包严重的链路传到国内，写在另一篇[跨境数据同步笔记]({% post_url 2026-11-27-hub-cross-border-sync-zh %})里
4. **备案通过前的网络隔离**：备案审完之前，国内机不能在公网 `80` 或 `443` 上提供网页服务。PostgreSQL 完全不映射到宿主机端口，FastAPI 和 Nuxt 只绑定 `127.0.0.1`，Nginx 也只监听本地回环预览端口（`127.0.0.1:18080`），自己调试通过 SSH 隧道转发进去看。每次改完都会用 `ss -tlnp` 复核一遍，确认公网只露着 SSH

## 为什么微信小程序要单独建仓库

国内网页可以靠开关合进 `main`，但微信小程序（`monashhub-mini`，保持私有）没法复用 Nuxt 组件，原生开发用的是 WXML、WXSS 和 TypeScript，而且平台规则直接决定了交互方式不同：

- **不能直跳任意外链**：小程序里打不开未配置业务域名的外部网站，学校官网和 Handbook 域名当然不可能配成业务域名。所以所有官方手册原页、学位要求里的 `reference_links` 和常用系统入口，统一做成点击复制链接并弹提示，让用户在浏览器打开
- **标题和品牌文案避开学校商标**：小程序名称、页面导航栏或简介里直接带大学商标很容易在审核阶段被驳回。小程序改用独立的学生攻略名字，写明“非官方，信息以学校官网为准”，还补了一条 Vitest 合规测试（`tests/compliance.test.ts`），自动扫描 `app.json`、`project.config.json`、品牌配置和每个页面的 `navigationBarTitleText`，防止无意中写进商标词
- **复用同一套只读 API**：小程序直接调国内节点的 `/v1/units`、`/v1/courses`、`/v1/guides`、`/v1/key-dates`、`/v1/fees` 和 `/v1/marks/reference`。同步 PR #299 的新功能时顺手抓出一个隐藏 bug：我一开始凭记忆在小程序里把学位结构字段写成了 `item_code` 和 `children`，对照后端代码才发现实际返回的是 `code`、`name`、`type` 和嵌套的 `containers`，上线前一起修掉了

## 现在的状态

通用 UI 改版（PR #301）和 `CN_READONLY_MODE` 只读部署栈（PR #302）都已经合并进了 `main`，海外默认模式下的后端、前端和 Playwright 浏览器测试全部通过。国内节点目前跑在回环地址上等备案通过，小程序框架也已搭好，拿到正式 AppID 替换 `touristappid` 就能提审
