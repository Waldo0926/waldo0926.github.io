#!/bin/sh
# Pull the built blog from the public `site` branch. No GitHub credentials needed.
# Cron (every 10 minutes): */10 * * * * /opt/blog/sync.sh
set -eu
DIR=/opt/blog/site
REPO=https://github.com/Waldo0926/waldo0926.github.io.git

if [ ! -d "$DIR/.git" ]; then
  git clone --depth 1 --branch site "$REPO" "$DIR"
  exit 0
fi
git -C "$DIR" fetch --depth 1 --quiet origin site
git -C "$DIR" reset --hard --quiet FETCH_HEAD
