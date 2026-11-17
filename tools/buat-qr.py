"""Buat QR untuk meja, kotak pizza, dan bio Instagram.
Jalankan: python3 tools/buat-qr.py
"""
import qrcode
from PIL import Image, ImageDraw, ImageFont

BASE = "https://khalifaardi.github.io/bodega-order/"
TARGETS = [
    ("qr-meja.png",      BASE + "?dari=lewat", "Pesan langsung dari meja", "Scan, pilih pizza, kirim ke WhatsApp"),
    ("qr-instagram.png", BASE + "?dari=ig",    "Pesan lewat Instagram",     "Tautan ini juga untuk bio IG"),
    ("qr-gmaps.png",     BASE + "?dari=gmaps", "Tautan Google Maps",        "Pasang sebagai website di profil Google"),
]

def font(size, bold=True):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass

for name, url, title, sub in TARGETS:
    qr = qrcode.QRCode(version=None, box_size=14, border=2,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(url); qr.make(fit=True)
    img = qr.make_image(fill_color="#14202B", back_color="#FBF8F3").convert("RGB")

    W = img.width + 120
    card = Image.new("RGB", (W, img.height + 260), "#FBF8F3")
    d = ImageDraw.Draw(card)
    d.text((60, 46), "BODEGA PIZZERIA", font=font(34), fill="#14202B")
    d.text((60, 92), "Sanang Space · Makassar", font=font(20, False), fill="#5A6672")
    card.paste(img, (60, 140))
    d.rectangle([60, 140, 60 + img.width, 140 + img.height], outline="#E4DED3", width=2)
    y = 140 + img.height + 34
    d.text((60, y), title, font=font(24), fill="#0F6367")
    d.text((60, y + 36), sub, font=font(17, False), fill="#5A6672")
    card.save(name)
    print("saved", name, card.size)
