---
layout: post
date: 2026-10-24 10:00:00 +0800
project: Monash Hub
description: "一台 VPS，部署没人盯着。部署脚本怎么确认上线的是对的提交，不对时怎么退回上一版镜像。"
ref: deploy-rollback
lang: zh-Hans
title: "Monash Hub 的自动部署和失败回滚"
image: /assets/og/deploy-rollback-zh.png
---

[Monash Hub](https://monashhub.secureview.tech) 是我做的 Monash 课程信息网站，给中国学生用。它跑在一台 VPS 上，用 Docker Compose 起 PostgreSQL、FastAPI 后端和 Nuxt 前端，前面是 nginx。代码合并到 `main` 就自动部署。

网站只有我一个人维护，我不可能每次部署都守着。所以部署脚本要自己判断这次上线成没成功，没成功就退回上一个版本。这篇讲它现在怎么做，以及我是被哪些问题逼着改成这样的。

## 出过的问题

**1. 上线的代码不是 CI 测过的那份。** 最早的 Deploy workflow 只是 SSH 到服务器跑 `deploy.sh`，脚本自己 `git reset` 到 `origin/main`。如果 CI 跑完到 SSH 连上之间，`main` 上又多了一个提交，这个没测过的提交就直接上线了。

**2. 部署脚本把自己换掉了。** bash 是边读边执行脚本的。`deploy.sh` 在执行中途 `git checkout` 新提交，磁盘上的脚本文件就变了，后面几行可能读到新文件里错位的内容。

**3. 一个官方页面换了地址，部署连续失败。** Monash 把出国健康与安全那一页从 `study-abroad/overseas/` 挪到了 `study-abroad/outbound/`。部署时登记页面列表会按 URL 插入新行，结果撞了 slug 的唯一约束。从 #128 开始的几次部署都停在这一步，线上一直是旧版本，直到 [#131](https://github.com/Waldo0926/monash-hub/pull/131) 修好。

**4. 健康检查说没问题，其实不知道上线的是什么。** 原来只看 `/api/health` 返回 200。API 能响应，不代表页面能渲染，也不代表跑的是刚部署的那个提交。

## 现在的流程

```
CI 通过 → Deploy workflow 拿到 CI 测过的提交号
       → SSH 到 VPS 跑 deploy.sh <提交号>
          1. 确认这个提交在 origin/main 上，checkout，再 exec 新版本的自己
          2. pg_dump 备份数据库，保留 14 天
          3. 把正在运行的镜像打上 :previous 标签
          4. 构建、跑迁移、写入种子数据、启动
          5. 等 /api/health，大约 60 秒还没好就回滚
          6. smoke.sh 检查提交号和几个关键页面，失败也回滚
       → 在 GitHub Actions 上通过公网域名再跑一次 smoke.sh
```

### 只部署 CI 测过的提交

Deploy workflow 由 CI 的 `workflow_run` 事件触发，传给服务器的是 CI 那次运行的 `head_sha`，不是 `main` 当时指向的提交。脚本收到后先检查它在不在 `origin/main` 上，不在就拒绝，所以从别的分支手动触发也部署不了。

```bash
if ! git merge-base --is-ancestor "$DEPLOY_SHA" origin/main; then
  echo "error: $DEPLOY_SHA is not on origin/main; only reviewed commits are deployed" >&2
  exit 1
fi
git checkout -q --detach "$DEPLOY_SHA"
exec "$PROJECT_DIR/deployment/deploy.sh" --at "$DEPLOY_SHA"
```

最后一行解决的是问题 2：checkout 之后不再往下读旧文件，直接用 `exec` 运行新提交里的脚本，`--at` 告诉它不用再 checkout 一次。这个改动有个副作用：合并这个改动的那次部署跑的还是旧脚本，因为旧脚本不会 exec，从下一次部署才开始生效。

### 保留上一版镜像

构建之前，把正在跑的 `api`、`web` 等镜像从 `:latest` 复制一个 `:previous` 标签。回滚就是把标签换回来，再用 `--no-build` 启动，不用重新构建：

```bash
rollback() {
  for service in api web; do
    if docker image inspect "monash-hub-$service:previous" >/dev/null 2>&1; then
      docker tag "monash-hub-$service:previous" "monash-hub-$service:latest"
    fi
  done
  docker compose -p monash-hub up -d --no-build api web
}
```

### 成功要看三件事

`/api/health` 现在会返回构建时传进去的提交号。`smoke.sh` 按访客的角度检查：

- API 报告的提交号是不是这次要部署的
- 首页的中文和英文能不能渲染
- 一个课程页、课程搜索和 WAM 搜索有没有数据
- `robots.txt`、sitemap 在不在
- 不存在的课程和路径返回 404，不是 500

服务器上先对容器端口跑一遍，失败就回滚。GitHub Actions 再通过 `monashhub.secureview.tech` 跑一遍，确认经过 nginx 之后看到的也是这个提交。

## 回滚不了的东西

回滚只换容器，不撤销数据库迁移。旧镜像会在新的表结构上运行，所以迁移最好写成新旧代码都能用的样子。真遇到撤不回的情况，就用第 2 步的备份。

另外，原来部署里有两段一次性的数据修复，会去 Handbook 抓两门课并检查结果。这让每次部署都依赖 Monash 的网站在线，而且到了 2027 年 Handbook 换版本时会让所有部署失败。我把它们挪到了单独的 `verify-handbook-parser.sh`，部署脚本只做部署。

## 部署之前

部署之前，CI 先跑后端测试（连真实 PostgreSQL，并检查模型和迁移有没有对不上）、依赖漏洞扫描、前端类型检查和构建，还有 Playwright 浏览器测试，在桌面和手机尺寸下点一遍课程页、选课规划和评分。CI 不过，Deploy 根本不会触发。

## 小结

- 部署的对象要明确到提交号，并且能从线上查回来。
- 回滚要便宜。留一份旧镜像比重新构建快，也不依赖当时的网络和依赖源。
- 部署脚本里不要放依赖外部网站的步骤。

代码：[deploy.sh](https://github.com/Waldo0926/monash-hub/blob/main/deployment/deploy.sh)、[smoke.sh](https://github.com/Waldo0926/monash-hub/blob/main/deployment/smoke.sh)、[deploy.yml](https://github.com/Waldo0926/monash-hub/blob/main/.github/workflows/deploy.yml)。相关 PR：[#151](https://github.com/Waldo0926/monash-hub/pull/151)、[#188](https://github.com/Waldo0926/monash-hub/pull/188)。
