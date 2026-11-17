#!/usr/bin/env bash
# Ganti token ?v= pada index.html & bayar.html supaya browser mengambil
# CSS/JS terbaru. GitHub Pages mengirim cache-control max-age=600, jadi tanpa
# token baru, perubahan bisa tidak terlihat sampai 10 menit.
#
# Pakai: commit dulu perubahan CSS/JS, lalu jalankan tools/versi.sh, lalu push.
set -euo pipefail
cd "$(dirname "$0")/.."

V="$(date +%Y%m%d%H%M%S)"
for f in index.html bayar.html kasir.html; do
  sed -i -E "s/\?v=[A-Za-z0-9._-]+/?v=${V}/g" "$f"
done

git add index.html bayar.html kasir.html
git commit -q -m "Bump asset version to ${V}" || echo "tidak ada perubahan untuk di-commit"
echo "asset version -> ${V}"
