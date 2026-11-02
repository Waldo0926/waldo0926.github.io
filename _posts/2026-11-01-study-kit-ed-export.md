---
layout: post
date: 2026-11-01 18:30:00 +0800
project: Study Kit
description: "Ed Web could zip a whole unit's Ed materials and Study Kit could not, even though it already downloaded them. Closing that gap meant renaming files without downloading them again, catching attachments, a bug the tests had hidden, and deploying to a server that was not running what I thought it was."
ref: study-kit-ed-export
lang: en
preview: study-kit-ed-export
source_repo: monash-study-kit
source_checked: 2026-11-01
title: "One download button, three codebases: zipping a unit's Ed materials"
image: /assets/og/study-kit-ed-export.png
---

The question was simple, and I should have asked it myself. [Ed Web](https://monashed.secureview.tech/app/) has a button that downloads a whole unit's Ed Lessons as one zip, sorted by week. Why doesn't [Study Kit](https://github.com/Waldo0926/monash-study-kit) have one, when it already syncs those files to your computer?

It did sync them. It just kept them in folders named after Ed's numeric ids, like `39026/116285/201_Workshop 3 Slides.pdf`, skipped files attached inside Ed pages, and had no way to hand you the lot. My private server version had the same gap, from the other side: the zip existed on its website, but Claude could not give it to you in a conversation.

This post is about closing that gap in three places: Study Kit, ed-digest (my server's Ed sync), and the remote MCP server that connects them to claude.ai.

## What it looks like now

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

That is a real run against synthetic course data; the CLI prints in Chinese because most of the people using it read Chinese. The same zip is one click on the local library page, and one sentence in an AI app.

<figure class="shot">
  <div class="shot-frame">
    <div class="shot-bar" aria-hidden="true"><i></i><i></i><i></i><span>127.0.0.1:8766 · monash library</span></div>
    <picture>
      <source srcset="{{ '/assets/posts/study-kit-ed-export/library.webp' | relative_url }}" type="image/webp">
      <img src="{{ '/assets/posts/study-kit-ed-export/library.png' | relative_url }}" width="1600" height="1135" loading="lazy" alt="The Study Kit library page: a unit heading with a Download all Ed files button, followed by Moodle files and Ed lesson files in the same list.">
    </picture>
  </div>
  <figcaption>The local library page with the new button. Moodle and Ed files for a unit now sit in one group. Screenshot of the real page, captured at 2x, with made-up course data.</figcaption>
</figure>

## Renaming files without downloading them again

Readable folders were the easy part to want and the fiddly part to ship. Everyone who upgrades already has a folder of PDFs under the old names. Downloading them all again would be slow and rude to Ed's file server, so the sync looks up where each slide was stored last time and moves it:

```python
def _move_old(old: str | None, new: str) -> None:
    if not old or old == new:
        return
    src, dest = FILES_DIR / old, FILES_DIR / new
    if src.is_file() and not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        os.replace(src, dest)
```

The new path is `<unit>/<NN module>/<NN lesson>/<NN title>`. The numbers matter more than they look. Without them, Finder sorts "Week 10" before "Week 2", and modules come out in the order of their database ids rather than the order on Ed, so the module number comes from the position of its first lesson. Unit codes need care too: `FIT3162/FIT3164` is one unit on Ed, and a slash is a folder separator, so it becomes `FIT3162+FIT3164`.

The same move also covers a lesson that gets renamed on Ed, and files of slides that disappear are deleted along with any folder they leave empty.

## Attachments, and a stable id for something that has none

Starter code usually is not a PDF slide. It is a `<file>` element inside a text page. Those are now downloaded too, but only when the link points at Ed's own file host, and only up to 200 MB, because a link to a dataset is still a link.

Every row in `lesson_files` is keyed by Ed's slide id, and an attachment does not have one. I wanted to reuse the table, so every reader of it (the library, search, the lesson reader) would pick attachments up for free. The id is derived from the URL:

```python
def attachment_id(url: str) -> int:
    return -int.from_bytes(hashlib.sha256(url.encode()).digest()[:7], "big") - 1
```

Negative, so it can never collide with a real slide; stable, so the next sync finds the file it saved last time; and tied to the URL, so when a teacher replaces the file, Ed issues a new URL, the id changes, the new file is downloaded and the old one is cleaned up. PDF slides follow the same rule: a changed `file_url` forces a fresh download instead of keeping the stale copy.

## The zip is built from the database, not the disk

The export does not walk the folder. It reads modules, lessons and files from SQLite, works out the readable path again, and adds a `README.md` with each lesson's progress and Ed link, a `Links.md` for reading pages, and a list of anything that failed to download. Two things fall out of that: a student who exports before their first sync on the new version still gets a properly named zip, and a missing file is reported instead of silently absent.

## A bug the tests had hidden

While wiring the button into the library page I found that the page had never listed Ed files synced by Study Kit itself. The code checked whether a path sat under the Ed folder, but the database stores relative paths, so the check always failed. The existing test passed because it inserted an absolute path. The fix is one line; the lesson is to write fixtures the way production writes data. There is now a test with a relative path.

## Adding a tool without growing every conversation

Every MCP tool's name, description and schema is sent to the model in every conversation, used or not, so the project keeps a budget: a test fails if the catalog grows past a size, and another pins the original tools' contract with a hash. `export_ed_lessons` fits in about 360 characters, and none of the old tools changed.

It is also the first Ed tool that writes something, a zip in your Downloads folder, so it is not marked read-only. That had a useful side effect: remote mode only exposes read-only tools, so a ChatGPT connected to someone's self-hosted Study Kit never writes zips onto their server.

## The server side

My own setup is different. ed-digest syncs Ed on a VPS and already builds a per-unit zip for its website. Rather than write a second packer, the remote MCP server loads ed-digest's `site.py` and calls the same two functions, so the zip from Claude and the zip from the website cannot drift apart. It has to load it by path, because `import site` would quietly give you Python's standard library module.

Claude cannot reach a file on my server, so the tool returns a link:

```python
def download_sig(rel: str, exp: int) -> str:
    return hmac.new(_download_key(), f"{exp}:{rel}".encode(), hashlib.sha256).hexdigest()[:32]
```

The signature covers the path and the expiry, so changing either gives a 403, and the `ed-export/` prefix only resolves to zips sitting directly in the export folder. Because one repository now depends on two functions in another, ed-digest has a contract test that pins their names and parameters. If someone renames them, ed-digest's own CI fails, not a student's request on a Sunday night.

ed-digest also picked up the improvements from Study Kit: numbered weeks in Ed's order and attachments in the zip.

## The server was not running what I thought

The plan was "pull and restart". Before that I checked the service, and the live connector was not running from the repository at all. A systemd drop-in pointed it at a release snapshot, `releases/student-20261031-r2`, with its own virtualenv. The repository on disk was four pull requests behind.

So the deploy followed the snapshot pattern instead:

1. Hash every file in the live snapshot and compare with git. The running code matched `main` before my change exactly, so the release would differ from production by this work only.
2. Record the old symlink target, the drop-in and `pip freeze` for rollback.
3. Unpack the merged commit into a new release, install the new core into a throwaway virtualenv on the server and run the whole suite there: 150 passed.
4. Upgrade the live environment, switch the symlink, update the build SHA, restart.
5. Call the tool with the service's own environment, then download the signed link from outside: 200 with the zip, and 403 with a forged signature.

Then I updated the repository copy too, which runs the timers and the SSH version of the server. The only package that changed in that environment was the core, which I confirmed by diffing `pip freeze` before and after.

## Takeaways

- When renaming user files, move what is there. Downloading it again costs users time and costs the upstream server bandwidth.
- Something without an id still needs a stable one. Derive it from what changes when the content changes.
- Build exports from the source of truth, not from whatever happens to be on disk.
- Test fixtures should look like production data, or they will pass for the wrong reason.
- When one repository calls into another, pin the contract in the one being called.
- Before deploying, check what the server is actually running.

Follow-up: the [whole-course exporter]({% post_url 2026-11-03-study-kit-course-materials %}) adds Moodle bodies, Google files, PDFs and isolated accounts.
