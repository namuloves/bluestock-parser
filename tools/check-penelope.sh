#!/usr/bin/env bash
set -euo pipefail

URL="https://bluestock-parser.up.railway.app/scrape"
PAYLOAD='{"url":"https://penelopechilvers.com/products/arctic-pony-slide-mist?bs_cache_bust=1734"}'

tmp_body=$(mktemp)
tmp_header=$(mktemp)

curl -sS -o "$tmp_body" -D "$tmp_header" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "User-Agent: BluestockParserCheck/1.0" \
  -d "$PAYLOAD" 2>/tmp/check-penelope-curl.log || true

status=$(awk 'NR==1 {print $2}' "$tmp_header")

export TMP_BODY="$tmp_body"
export HTTP_STATUS="$status"

python3 - "$@" <<'PY'
import json
import sys
import os

body_path = os.environ.get("TMP_BODY")
status = os.environ.get("HTTP_STATUS")
stderr_path = "/tmp/check-penelope-curl.log"

with open(body_path, 'r', encoding='utf-8', errors='replace') as f:
    raw = f.read()

if not status or status != '200':
    print(f"Request failed with status {status or 'unknown'}")
    if os.path.exists(stderr_path):
        print('Curl stderr:\n' + open(stderr_path).read())
    print('Response body:\n' + raw)
    sys.exit(1)

try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("Failed to decode JSON. Raw response:\n")
    print(raw)
    sys.exit(1)

images = data.get("product", {}).get("image_urls", [])
print(f"image count: {len(images)}")
for idx, url in enumerate(images, start=1):
    print(f"{idx}. {url}")
PY

rm -f "$tmp_body" "$tmp_header"
