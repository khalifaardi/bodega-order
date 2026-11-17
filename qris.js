/* ============================================================
   QRIS dinamis — mengubah QRIS statis milik merchant menjadi QRIS
   bertagihan tetap sesuai total pesanan.

   Standar: EMVCo Merchant-Presented Mode + Bank Indonesia.
   - Tag 01 "11" (statis)  ->  "12" (dinamis)
   - Tag 54 = nominal
   - CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) dihitung ulang
   Tidak ada server, tidak ada API, tidak ada biaya MDR tambahan.
   ============================================================ */

window.QRIS = (function () {

  /* ---------- CRC16-CCITT-FALSE ---------- */
  function crc16(str) {
    let crc = 0xFFFF;
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (let b = 0; b < 8; b++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  /* ---------- TLV ---------- */
  function parseTLV(s) {
    const out = [];
    let i = 0;
    while (i + 4 <= s.length) {
      const tag = s.substr(i, 2);
      const len = parseInt(s.substr(i + 2, 2), 10);
      if (!/^\d{2}$/.test(tag) || isNaN(len) || len < 0) break;
      const val = s.substr(i + 4, len);
      if (val.length !== len) break;
      out.push({ tag, val });
      i += 4 + len;
    }
    return out;
  }

  const build = arr => arr.map(e => e.tag + String(e.val.length).padStart(2, "0") + e.val).join("");

  /* ---------- validasi ---------- */
  function validate(payload) {
    if (!payload || typeof payload !== "string") return { ok: false, why: "kosong" };
    if (!payload.startsWith("000201")) return { ok: false, why: "bukan payload QRIS" };
    if (payload.length < 20) return { ok: false, why: "terlalu pendek" };
    const body = payload.slice(0, -4);
    const given = payload.slice(-4).toUpperCase();
    if (crc16(body) !== given) return { ok: false, why: "CRC tidak cocok" };
    return { ok: true };
  }

  /* ---------- tag 62: nomor pesanan sebagai bill number ---------- */
  function withBillRef(els, ref) {
    const clean = String(ref).replace(/[^A-Za-z0-9-]/g, "").slice(0, 25);
    if (!clean) return els;

    const i62 = els.findIndex(e => e.tag === "62");
    const subs = (i62 >= 0 ? parseTLV(els[i62].val) : [])
      .filter(s => s.tag !== "01");
    subs.push({ tag: "01", val: clean });          // 01 = Bill Number
    subs.sort((a, b) => Number(a.tag) - Number(b.tag));

    const el = { tag: "62", val: build(subs) };
    if (i62 >= 0) els[i62] = el;
    else {
      const at = els.findIndex(e => Number(e.tag) > 62);
      els.splice(at < 0 ? els.length : at, 0, el);
    }
    return els;
  }

  /* ---------- statis -> dinamis ---------- */
  function buildDynamic(staticPayload, amount, opts) {
    const nominal = Math.round(Number(amount));
    if (!Number.isFinite(nominal) || nominal < 1) throw new Error("nominal tidak valid");

    // hati-hati: nama merchant bisa mengandung spasi — jangan dihapus
    let payload = String(staticPayload).replace(/[\r\n\t]/g, "").trim();
    const check = validate(payload);
    if (!check.ok) throw new Error(check.why);

    let els = parseTLV(payload);
    // buang CRC lama dan tag nominal/biaya lama kalau ada
    els = els.filter(e => !["54", "55", "56", "57", "63"].includes(e.tag));

    // tag 01: statis (11) -> dinamis (12)
    const p01 = els.find(e => e.tag === "01");
    if (p01) p01.val = "12";
    else {
      const idx = els.findIndex(e => e.tag === "00");
      els.splice(idx + 1, 0, { tag: "01", val: "12" });
    }

    // tag 54 harus naik setelah tag 53 (mata uang)
    const amountEl = { tag: "54", val: String(nominal) };
    const i53 = els.findIndex(e => e.tag === "53");
    const i52 = els.findIndex(e => e.tag === "52");
    const at = i53 >= 0 ? i53 + 1 : (i52 >= 0 ? i52 + 1 : 1);
    els.splice(at, 0, amountEl);

    if (opts && opts.billRef) withBillRef(els, opts.billRef);

    const body = build(els) + "6304";
    return body + crc16(body);
  }

  /* ---------- render QR ---------- */
  function renderQR(container, payload, size) {
    if (!container) return false;
    try {
      const qr = qrcode(0, "M");
      qr.addData(payload);
      qr.make();

      const n = qr.getModuleCount();
      const px = size || 300;
      const scale = Math.max(2, Math.floor((px * (window.devicePixelRatio || 1)) / (n + 8)));
      const side = (n + 8) * scale;

      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      canvas.style.width = "100%";
      canvas.style.maxWidth = px + "px";
      canvas.style.height = "auto";
      canvas.style.borderRadius = "10px";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Kode QRIS untuk nominal pesanan");

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, side, side);
      ctx.fillStyle = "#14202B";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
        }
      }

      container.innerHTML = "";
      container.appendChild(canvas);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { crc16, parseTLV, validate, buildDynamic, renderQR };
})();
