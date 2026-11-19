#!/usr/bin/env python3
"""Puts a space between Chinese and Latin letters or digits.

    python3 scripts/spacing.py           # list what is missing, exit 1 if any
    python3 scripts/spacing.py --fix     # write the spaces in

Code blocks, inline code, URLs, HTML tags, Liquid tags and front matter fields
that hold paths or ids are left alone. EXCEPTIONS below are lines that are
meant to read the way they are.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files to read. Everything else in the repo is English or generated.
GLOBS = ["_posts/*.md", "_data/*.yml", "_data/*.json", "_includes/*.html",
         "_layouts/*.html", "zh/**/*.md", "zh/**/*.html", "*.md", "notes/*.md",
         "projects/*.md", "search/*.md", "404.html", "index.html"]

SKIP = {"README.md"}

# Text that keeps its spacing. The translation post quotes a date the
# translator got wrong, so writing it properly would remove the point.
EXCEPTIONS = ["12月2026年"]

CJK = r"㐀-䶿一-鿿豈-﫿぀-ヿ"
LATIN = r"A-Za-z0-9"

# Spans that are copied through untouched.
PROTECTED = re.compile(
    r"```.*?```"              # fenced code
    r"|~~~.*?~~~"
    r"|`[^`\n]*`"             # inline code
    r"|<(?:pre|code|script|style)\b.*?</(?:pre|code|script|style)>"
    r"|<[^>]+>"               # html tag, attributes included
    r"|\{%.*?%\}"             # liquid tag
    r"|\{\{.*?\}\}"           # liquid output
    r"|https?://\S+"          # bare url
    r"|\]\([^)]*\)",          # markdown link target
    re.S | re.M)

# A Markdown code block written with four spaces instead of fences. Only
# Markdown has those; in JSON and HTML a deep indent is just an indent.
INDENTED = re.compile(r"^(?:\s{4,}|\t)\S.*$")

# Front matter keys whose value is a path, an id or a date.
FM_SKIP = re.compile(r"^(image|ref|permalink|alt|layout|lang|date|source_repo|"
                     r"source_checked|preview|tags|categories):", re.M)

# C++, C#, 3% and the like end in a symbol, so the Latin run can finish with
# one and still need a space before the Chinese that follows.
PAIRS = [
    (re.compile(f"([{CJK}])([{LATIN}])"), r"\1 \2"),
    (re.compile(f"([{LATIN}][+#%]*)([{CJK}])"), r"\1 \2"),
]


def space(text):
    for pattern, repl in PAIRS:
        # twice, because one pass misses 中A中 style runs
        text = pattern.sub(repl, text)
        text = pattern.sub(repl, text)
    return text


def fix_line(line, markdown):
    if FM_SKIP.match(line):
        return line
    if markdown and INDENTED.match(line):
        return line
    out, last = [], 0
    for m in PROTECTED.finditer(line):
        out.append(space(line[last:m.start()]))
        out.append(m.group(0))
        last = m.end()
    out.append(space(line[last:]))
    return "".join(out)


def fix_text(text, markdown):
    # Protect fenced blocks first, they span lines.
    parts, last = [], 0
    for m in re.finditer(r"```.*?```|~~~.*?~~~", text, re.S):
        parts.append(("text", text[last:m.start()]))
        parts.append(("keep", m.group(0)))
        last = m.end()
    parts.append(("text", text[last:]))

    done = []
    for kind, chunk in parts:
        if kind == "keep":
            done.append(chunk)
            continue
        done.append("\n".join(fix_line(l, markdown) for l in chunk.split("\n")))
    out = "".join(done)
    for phrase in EXCEPTIONS:
        out = out.replace(space(phrase), phrase)
    return out


def files():
    seen = []
    for pattern in GLOBS:
        for path in sorted(ROOT.glob(pattern)):
            if path.is_file() and path.name not in SKIP and path not in seen:
                seen.append(path)
    return seen


def main():
    write = "--fix" in sys.argv
    changed = []
    for path in files():
        text = path.read_text(encoding="utf-8")
        fixed = fix_text(text, path.suffix == ".md")
        if fixed == text:
            continue
        changed.append(path)
        if write:
            path.write_text(fixed, encoding="utf-8")
        else:
            for before, after in zip(text.split("\n"), fixed.split("\n")):
                if before != after:
                    rel = path.relative_to(ROOT)
                    print(f"{rel}: {before.strip()[:90]}")
    if not changed:
        print("every Chinese and Latin run already has its space")
        return 0
    if write:
        print(f"fixed {len(changed)} files")
        return 0
    print(f"\n{len(changed)} files need a space; run python3 scripts/spacing.py --fix")
    return 1


if __name__ == "__main__":
    sys.exit(main())
