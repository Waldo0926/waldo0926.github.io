#!/usr/bin/env python3
"""Check built internal links and fragments without network access."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
import sys


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.ids, self.links = set(), []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag in ("img", "script") and a.get("src"):
            self.links.append(a["src"])


def check(root, origin):
    pages = {p: Page(p) for p in root.rglob("*.html")}
    errors = []
    for path, page in pages.items():
        rel = path.relative_to(root).as_posix()
        base = origin + "/" + (rel[:-10] if rel.endswith("index.html") else rel)
        for href in page.links:
            url = urlsplit(urljoin(base, href))
            if url.netloc != urlsplit(origin).netloc or url.scheme not in ("http", "https"):
                continue
            # Release packaging produces this download after the site build.
            if url.path.startswith("/downloads/"):
                continue
            target = root / unquote(url.path).lstrip("/")
            if target.is_dir():
                target /= "index.html"
            if not target.exists():
                errors.append(f"{rel}: missing {href}")
            elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                errors.append(f"{rel}: missing fragment {href}")
    if errors:
        print("\n".join(sorted(set(errors))))
        return 1
    print(f"Checked internal links and fragments in {len(pages)} HTML pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(check(Path(sys.argv[1]).resolve(), sys.argv[2].rstrip("/")))
