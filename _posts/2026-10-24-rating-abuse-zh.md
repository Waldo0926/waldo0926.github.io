---
layout: post
date: 2026-10-24 17:30:00 +0800
project: Monash Hub
description: "不登录也能给课程打分。一个浏览器怎么保证每门课只有一条评分，为什么限流按网络而不按密钥，以及这些还挡不住什么。"
ref: rating-abuse
lang: zh-Hans
title: "不用登录的课程评分，以及怎么防刷"
image: /assets/og/rating-abuse-zh.png
---

[Monash Hub](https://monashhub.secureview.tech) 可以给课程打 1 到 5 星，教学、内容、考核、难度、工作量这几项可以选填（[#163](https://github.com/Waldo0926/monash-hub/pull/163)）。我希望不登录也能评分。打个分还要先注册，新网站最后往往一条评分都没有。

问题也很明显：谁都能评，那一个人就能评五十次。这篇讲几层让刷分变难的做法，以及它们管不到的地方。

## 每人每门课一条

登录用户的评分属于账号。没登录的评分属于一个随机密钥：浏览器第一次评分时生成（`crypto.randomUUID()`），存在 `localStorage` 里，之后每次请求都放在 `X-Guest-Key` 请求头里发过来。

数据库保证每个主人每门课只有一条：

```python
UniqueConstraint("author_id", "unit_code", name="uq_unit_review_once"),
UniqueConstraint("guest_key", "unit_code", name="uq_unit_review_guest_once"),
CheckConstraint("author_id IS NOT NULL OR guest_key IS NOT NULL", name="ck_unit_review_owner"),
```

再评一次就是改原来那条，学生可以改主意。如果同一个人的两次保存同时到达，第二次插入会撞上唯一约束，代码接住 `IntegrityError`，把它变成一次修改。

## 密钥不能原样存

访客密钥相当于修改这条评分的密码。如果表泄露了，而密钥是原样存的，任何人都能拿着它去改别人的评分。所以存的是用服务器密钥算的 HMAC：

```python
def guest_hash(raw):
    raw = (raw or "").strip()
    return _keyed(f"guest:{raw}") if GUEST_KEY.match(raw) else None
```

有一个测试专门检查存下来的值里不包含发过来的密钥。

## 密钥限不住人，所以按网络限

浏览器想换密钥随时都能换：清掉存储、开无痕窗口，或者写个脚本。所以密钥只用来认“这条是谁的”，限流按网络地址算：

| 对象 | 限制 |
| --- | --- |
| 一个账号或一个访客密钥 | 每天最多保存 30 次评分 |
| 同一网络地址的未登录评分 | 每天 100 次 |
| 同一地址的所有 API 请求（nginx） | 每秒 20 次 |

每天 100 次看起来很宽松，这是故意的。校园 Wi-Fi 下，一整个大课教室可能只共用几个地址。严到能挡住一个人的限制，会把一整个班挡在外面。地址存的也是 HMAC，不是 IP 本身。

拿到真实地址要小心。`X-Forwarded-For` 客户端想写什么都行，所以 API 只认 nginx 根据连接本身设置的 `X-Real-IP`，而且只在请求来自可信代理时才认。绕过 nginx 直接打到 API 的请求按它自己的地址限流，没法每次换一个地址。

## 加锁再计数

计数放在 PostgreSQL 里而不是内存里，因为 API 有多个 worker，每个 worker 各数各的，限制就变成了好几份。这个限流器最早是给登录写的，当时有个竞态：同时到达的几次猜密码都数到同样的历史次数，结果全部放行。从 [#148](https://github.com/Waldo0926/monash-hub/pull/148) 开始，检查前先对这个键加一把事务级 advisory lock，评分用的就是这个版本：

```python
def check(db, limit, key):
    db.execute(select(func.pg_advisory_xact_lock(func.hashtext(f"{limit.kind}:{key}"))))
    since = _now() - timedelta(seconds=limit.window_seconds)
    count, oldest = db.execute(...).one()  # 这个键在窗口期内的次数
    if (count or 0) >= limit.max_events:
        raise Throttled(retry_after)
```

同一个键的请求会排队，等前一个提交了再数。被限流的请求返回 429，带 `Retry-After`。

## 评分保存之后

- **举报和隐藏。** 评分可以像论坛帖子一样被举报，管理员可以隐藏。被隐藏的评分不计入平均分，但作者自己还能看到和修改。
- **作者信息尽量少。** 登录用户的评分别人只看到名字首字母，未登录的评分连首字母都没有。学生评价教学团队时应该能说实话。
- **平均分读取时现算。** 每页一条分组查询，不存平均分，也就不会和实际数据对不上。选填的每一项都有自己的人数，两个人填的平均分就标两个人。

## 这些挡不住什么

这些做法提高了刷分的成本，但没法让刷分变成不可能。一个人在手机流量、家里 Wi-Fi 和 VPN 之间切换，每个地址又有 100 次。一个人用一个浏览器每门课只评一次，看起来就和真实学生一模一样，因为对方可能本来就是。

对付这种情况主要不靠代码。页面会显示平均分是多少人打的，不到三个人时会提示平均分仅供参考。举报会有人看。如果刷分从偶尔变成常态，下一步是要求评分前验证邮箱，账号系统本来就支持（[ADR 0005](https://github.com/Waldo0926/monash-hub/blob/main/docs/adr/0005-accounts-without-identity.md)）。

## 测试

- `test_signed_out_ratings_are_limited_per_network`：同一地址用三个新密钥评分，第三次返回 429。
- `test_the_browser_key_is_not_stored_as_sent`。
- 一个 Playwright 测试：访客给课程评分，另一个浏览器看到的是别人的评分，第一个浏览器再把评分撤回（[#205](https://github.com/Waldo0926/monash-hub/pull/205)）。

代码：[`reviews.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/api/v1/reviews.py)、[`throttle.py`](https://github.com/Waldo0926/monash-hub/blob/main/backend/app/core/throttle.py)、[`useGuestKey.ts`](https://github.com/Waldo0926/monash-hub/blob/main/frontend/composables/useGuestKey.ts)。
