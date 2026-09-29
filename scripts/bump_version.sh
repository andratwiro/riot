#!/usr/bin/env bash
# Bump RIOT's version everywhere it lives in index.html: the options-sheet tag
# and the ?v= cache-buster on every local script/style (GitHub Pages caches
# files for 10 min; without it a phone mixes old and new files after a push).
# Usage: scripts/bump_version.sh 1.35
set -euo pipefail
v="${1:?usage: bump_version.sh X.YY}"
cd "$(dirname "$0")/.."
sed -i -E "s/RIOT · v[0-9]+\.[0-9]+/RIOT · v$v/; s/\?v=[0-9]+\.[0-9]+/?v=$v/g" index.html
grep -o -E "RIOT · v[0-9.]+|\?v=[0-9.]+" index.html | sort | uniq -c
