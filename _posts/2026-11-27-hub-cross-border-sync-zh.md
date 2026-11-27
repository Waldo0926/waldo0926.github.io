---
layout: post
date: 2026-11-27 10:15:00 +0800
project: Monash Hub
description: "在晚高峰 50% 丢包的跨境链路上，用 xz 压缩、1 MB 并发分片 scp 和事务内 replica 模式恢复，把 18 张 PostgreSQL 公开表安全同步到国内节点"
ref: hub-cross-border-sync
lang: zh-Hans
source_repo: monash-hub
source_checked: 2026-11-27
title: "在 50% 丢包的跨境链路上同步 18 张 PostgreSQL 公开表"
tags: [PostgreSQL, Bash, Linux, Networking, Docker]
image: /assets/og/hub-cross-border-sync-zh.png
---

给 Monash Hub 搭好[国内只读镜像]({% post_url 2026-11-27-hub-readonly-mirror-zh %})以后，国内这台 PostgreSQL 需要从海外主库同步 Handbook 和官方指南数据，但只能同步公开表。海外主库全程只读，用户、认证、通知、评价和社区表一行都不能出库

数据量其实不大，18 张公开表用 gzip 压完大概 100 MB。网络正常时几秒就传完了，但晚高峰实测跨境链路丢包率接近 50%、RTT 约 228 ms，单流 `pg_dump | ssh` 直接卡在 5.5 KB/s，五分钟只挪了 512 KB

下面的记录隐去了真实主机名、IP、端口和密钥

## 让传输在高丢包下跑得动

高延迟叠加高丢包时，单条 TCP 连接会被拥塞控制压得很惨。我把同步脚本（`deployment/sync-cn-public-data.sh`）改成四步后，实测整体提速了约 16 倍：

1. **只读白名单导出 + 更高压缩率**：脚本在海外容器里只对显式列出的 18 张公开表跑 `pg_dump --data-only --no-owner --no-privileges`，经 SSH `gzip -1` 拉回本地后，再用 `xz -T0 -6` 多核重压，体积从约 100 MB 降到约 54 MB
2. **上传前做本地隐私审计**：文件发出前先在本地解压扫描，用正则核对 16 张禁用表（`users`、`email_verification_codes`、`notifications`、`auth_throttle`、`community_*`、`unit_reviews`、`search_terms`、`alembic_version` 等），只要命中任意一张立刻中止
3. **1 MB 分片 + 8 并发 `scp` 重试**：用 `split -b 1m` 把 54 MB 切成 54 个独立分片，`xargs -P 8` 开 8 个 `scp` 并发传，每片失败最多重试 4 次并配 `ServerAliveInterval=10`。哪怕某一片碰上 `scp: Connection closed`，也只重传这 1 MB，不会连累另外 53 片
4. **端到端 SHA256 校验**：目标机把分片拼回完整文件后，比对远端 `sha256sum` 和本地算出的哈希，不一致拒绝导入

最近一次同步（PR #299 给 962 个学位补齐了 `reference_links` 之后），54 个分片在 503 秒内全部传完并校验通过，虽然比不上局域网，但在晚高峰也足够稳

## 顺手踩到的三个坑

### 1. `--data-only` 恢复遇到循环外键

`pg_dump --data-only` 导出时就提示 `unit_requisite_groups` 和 `curriculum_containers` 存在自引用/循环外键约束，直接执行 `COPY` 可能因为行顺序报外键错

因为目标库是隔离的只读镜像，把整个恢复包进单个事务里就能同时保证速度和原子性：

```sql
BEGIN;
SET LOCAL session_replication_role = 'replica';
TRUNCATE TABLE <18 张白名单公开表> RESTART IDENTITY CASCADE;
-- 接 xz -dc 解压流
COMMIT;
ANALYZE;
```

中途任何一步失败都会自动回滚，不会把线上旧数据冲坏；`SET LOCAL` 在事务结束时自动恢复默认行为，最后的 `ANALYZE` 立刻刷新查询规划统计信息

### 2. `xargs -n 1 bash -c` 的参数位置偏移

从交互 shell 整理成独立脚本后，第一次跑立刻报 `cp: <host>: No such file or directory`

原因是原来写成了这样：

```bash
find "$LOCAL_CHUNKS" -maxdepth 1 -name 'part-*' | sort | xargs -n 1 -P "$PARALLEL_CHUNKS" bash -c '
  f="$1"
  dst_host="$2"
  remote_dir="$3"
  ...
' _ "$DST_HOST" "$REMOTE_CHUNKS"
```

`xargs -n 1` 是把管道传进来的文件名拼在整条命令的**最后**，而不是紧跟在 `_` 后面。所以 `$1` 其实是 `$DST_HOST`，`$2` 是 `$REMOTE_CHUNKS`，真正的文件路径在 `$3`。把三个变量的顺序对调后问题立刻消失

### 3. 同步数据前必须先对齐表结构

海外库升级到 Alembic 迁移 `d7a1e3b5c902`（给 `courses`、`areas_of_study` 和 `curriculum_containers` 加了 `reference_links` 字段）之后，如果国内库没先跑迁移就直接同步 `--data-only`，`COPY` 会直接因为列数不一致报错。安全顺序固定为：传新代码 → 跑 `alembic upgrade head` → 重建 `api` 和 `web` → 再跑 `sync-cn-public-data.sh`

## 顺带解决国内机 Docker 构建超时

国内云服务器构建后端镜像时，直接连 `pypi.org` 经常超时。不想把国内镜像源写死进共用 Dockerfile，就在 `backend/Dockerfile` 和 `frontend/Dockerfile` 里各加了一个默认为空的可选构建参数：

```dockerfile
ARG PIP_INDEX_URL=""
RUN pip install --no-cache-dir ${PIP_INDEX_URL:+-i "$PIP_INDEX_URL"} -r /srv/backend/requirements.txt
```

前端用同样的方式加了 `ARG NPM_REGISTRY=""`。海外构建不传参时行为完全不变，国内的 `docker-compose.cn.yml` 传入镜像源地址，构建从反复超时缩短到不到半分钟
