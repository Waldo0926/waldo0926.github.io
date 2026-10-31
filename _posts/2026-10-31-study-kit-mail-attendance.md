---
layout: post
date: 2026-10-31 18:00:00 +0800
project: Study Kit
description: "Study Kit 1.5.0 can optionally read your school mail and attendance. Anything that changes something shows you a full preview first and runs only after you confirm. Attendance reads two weeks in seconds without a browser, and students who never open a terminal can connect it by asking their AI app."
ref: study-kit-mail-attendance
lang: en
title: "Study Kit gets school mail and attendance, and asks before it changes anything"
image: /assets/og/study-kit-mail-attendance.png
---

[Monash Study Kit](https://github.com/Waldo0926/monash-study-kit) used to read only Moodle and Ed. I had been using mail and attendance on my private deployment for a while, and 1.5.0, released on 31 October, brings them into the public version. Both are optional; nothing changes until you connect them.

The big difference from earlier releases is that it can now change things for the first time. Drafting mail, sending a draft, archiving and checking in to a class cannot be taken back if they go wrong. So this post is mostly about how those actions are kept in check, plus a few trade-offs I made so that students would actually use it.

## Anything that changes something takes two steps

The AI cannot run a write in one step. It first calls a prepare tool and gets the full preview: recipients, Bcc, body and attachments, the label change, or the class and the code. The preview is stored as a ticket together with its SHA-256:

```python
body = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(body.encode()).hexdigest()
```

To run it, the AI has to send the ticket ID, that hash and `user_confirmed=true`. The server's instructions tell it to show the preview as it is and never confirm on the user's behalf. A ticket expires after 10 minutes and works once. It is marked as executing before Gmail is contacted, so two clicks at the same time cannot send two emails. Before a draft is sent, its content is checked again, and a draft that changed after the preview is refused.

Failures come in two kinds. If a check fails before anything is sent, the ticket is marked rejected and you know nothing went out. If the request itself fails, it is marked unknown and is never retried by itself; you look at the mailbox first. Check-in is only prepared when you say you actually attended, and never for a class that has not started or is already done.

At first I left these writes off until the user turned them on in the settings. That felt broken in practice: a student logs in, asks the AI to archive a message, and the AI says it cannot. What actually protects the student is the two-step flow, not a switch. So in 1.5.0 they are on after login, and the switches stay for anyone who wants them off. The decision is written down in [ADR 0004](https://github.com/Waldo0926/monash-study-kit/blob/main/docs/adr/0004-confirmed-mail-and-attendance-actions.md). Moodle and Ed are still read-only.

## Each remote app picks what it gets

Remote mode in 1.4.0 had a single `monash` scope, so until now the remote server simply refused mail and attendance. Opening them up directly would have let a ChatGPT you paired last week read your whole mailbox without you knowing.

Now the pairing page shows a checkbox for each part the server owner has turned on: read-only ones start ticked, actions start unticked. The choice is stored with the authorization code and the tokens and survives refresh. Every call intersects it with the server's current settings, so turning something off on the server takes it away from every app at once. Tokens from before 1.5.0 were set to `monash` when the database was upgraded, so old apps gain nothing. Tickets and background jobs belong to one client, so one app cannot run an action another app prepared.

## Attendance without a browser

The attendance portal is an ASP.NET page where you switch days with a `#daySel` menu. My Chrome extension has always opened the page, switched to the day and run a JavaScript parser. Doing that in the background meant starting a headless browser and switching day by day, which is heavy for something that runs several times a day.

Switching days did not seem to load anything new; it only showed the matching `dayPanel_<date>` block. So every day was probably already in the HTML. I wrote a Python version of the parser that only looks inside that day's block, and fetched the page once with the cookies saved at login.

A guess is not enough to ship, so there are two layers of comparison. In the tests, several differently structured pages go through the original JavaScript in a real browser and through the Python version, and the rows must match field by field, including the label text. There is also `monash attendance probe`, which reads the real portal both ways and prints only counts and whether they match, never course content. On the Malaysia campus portal, all 15 days it offers matched, and the page is 5 KB. So the fast read is on by default, and it falls back to the browser whenever the page looks different.

The first probe on my Mac failed with `CERTIFICATE_VERIFY_FAILED`. The portal most likely does not send its intermediate certificate; Chrome fetches it by itself, Python does not. The fix was `truststore`, which makes Python use the operating system's verifier, and macOS fills in the missing certificate the same way Chrome does. Verification stays on the whole time.

When to read changed too. Instead of every hour, reads follow the timetable: weekday mornings at 8, and 15 minutes after each class you have not checked in to. Nothing runs at night, at weekends or for classes already done. I do not know yet how long the portal login lasts, so the program records each login, each successful read and the first expiry, and I will decide on a keepalive once there is data.

## No terminal for students

Once it worked, there was another problem. Connecting Gmail meant creating a Google Cloud project, enabling the API, downloading a JSON file and typing a command. For most students that is so much work that Claude's built-in Gmail connector is simply easier.

I did two things. First, the package now includes a desktop app client made just for the public version. Google designs these files to ship with the program; it only tells Google which app is asking and cannot read anyone's mail. GitHub's push protection still flagged it and I had to allow it by hand. The cost is the "this app isn't verified" warning, and a limit of 100 users for an app Google has not reviewed, which is fine for a group of friends.

Second, a new tool, `start_school_service_setup`. A student says "connect my school email" in their AI app, and it installs the missing packages into the running install, opens the sign-in window and leaves only the sign-in to them. When it is done it tells the AI app to refresh its tool list. The tool costs about 145 tokens per conversation, so it hides itself once both parts are connected. The parameters of the original 17 tools are pinned by a hash in the tests, and none of them changed.

## Takeaways

- Writes are kept safe by the flow, not by a switch: a full preview, a single-use ticket bound to that content, the user's confirmation, and no automatic retries.
- When an existing remote grant could gain a new ability, do not let it grow on its own. Ask the user to choose again.
- Before replacing a parser that already works, run old and new side by side on real data, then make the new one the default.
- When certificate verification fails, find out why. Do not turn verification off.
- A feature is not done until an ordinary student can get through the steps to connect it.
