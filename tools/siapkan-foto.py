"""Siapkan foto menu: normalisasi latar ke putih, potong persegi, ekspor WebP.

Jalankan:  python3 tools/siapkan-foto.py
Sumber: folder kiriman (native-inputs), hasil: img/<id>.webp
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

SRC = os.path.expanduser("~/.hermes/cache/documents/native-inputs")
OUT = os.path.join(os.path.dirname(__file__), "..", "img")

# indeks -> id SKU di menu.js   (indeks mengikuti urutan unggah)
PICKS = {
    "nutella":   [1],
    "meatball":  [2, 21],
    "marg":      [3, 19],
    "parm":      [4, 23],
    "parmSalad": [4, 23],
    "pep":       [6, 7, 12, 18, 20, 22],
    "galigo":    [8],
    "shamba":    [9],
    "marinara":  [10],
    "cmush":     [11],
    "tuna":      [13],
    "dpep":      [14],
    "imb":       [15],
    "hhr":       [16],
    "sbc":       [17],
    "fries":     [25],
    "mozz":      [26],
    "jpep":      [27],
    "godf":      [28],
}

SIZE = 400
QUALITY = 78


def files_by_index():
    files = sorted(glob.glob(os.path.join(SRC, "./*/img_*.png")), key=os.path.getmtime)
    return {i: f for i, f in enumerate(files, 1)}


def on_white(im):
    """PNG berlatar transparan harus diletakkan di atas putih dulu."""
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    return im.convert("RGB")


def white_balance(im):
    """Samakan latar ke putih bersih: skala tiap kanal agar sudut ~255."""
    a = np.asarray(on_white(im)).astype(np.float32)
    h, w, _ = a.shape
    k = max(4, min(h, w) // 24)
    corners = np.concatenate([
        a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
        a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3),
    ])
    ref = np.percentile(corners, 60, axis=0)
    ref = np.maximum(ref, 1)
    scale = np.clip(255.0 / ref, 1.0, 1.6)
    return Image.fromarray(np.clip(a * scale, 0, 255).astype(np.uint8))


def content_bbox(im, thresh=246):
    g = np.asarray(im.convert("L"))
    mask = g < thresh
    if not mask.any():
        return (0, 0, im.width, im.height)
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    return (int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)


def square_crop(im, pad=0.06):
    """Potong persegi di sekitar isi. PIL mengisi hitam kalau kotak keluar batas,
    jadi tempelkan gambar ke kanvas putih dan biarkan PIL memotongnya."""
    x0, y0, x1, y1 = content_bbox(im)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = int(max(x1 - x0, y1 - y0) * (1 + pad * 2))
    left, top = int(cx - side / 2), int(cy - side / 2)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(im, (-left, -top))
    return canvas


def normalise(im, share=0.86, size=SIZE):
    """Perbesar/perkecil isi supaya semua piring tampil seukuran di grid."""
    x0, y0, x1, y1 = content_bbox(im)
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    scale = (size * share) / max(w, h)
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    canvas.paste(im, (((size - nw) // 2), ((size - nh) // 2)))
    return canvas


def fill_ratio(im):
    """Seberapa besar isi mengisi frame — dipakai memilih foto terbaik dari duplikat."""
    x0, y0, x1, y1 = content_bbox(im)
    return ((x1 - x0) * (y1 - y0)) / (im.width * im.height)


def main():
    idx = files_by_index()
    os.makedirs(OUT, exist_ok=True)
    total = 0

    for sku, candidates in PICKS.items():
        best, best_score, best_idx = None, -1, None
        for i in candidates:
            path = idx.get(i)
            if not path:
                print(f"  ! indeks {i} tidak ada")
                continue
            im = white_balance(Image.open(path))
            score = fill_ratio(im)
            if score > best_score:
                best, best_score, best_idx = im, score, i
        if best is None:
            continue

        out = square_crop(best)
        out = normalise(out)
        dst = os.path.join(OUT, f"{sku}.webp")
        out.save(dst, "WEBP", quality=QUALITY, method=6)
        kb = os.path.getsize(dst) / 1024
        total += kb
        print(f"  {sku:<10} <- foto #{best_idx:<3} fill={best_score:.2f}  {kb:5.1f} KB")

    print(f"\n{len(PICKS)} gambar, total {total/1024:.2f} MB")


if __name__ == "__main__":
    sys.exit(main())
