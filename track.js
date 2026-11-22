/* ============================================================
   Bodega — pelacak funnel (pihak pertama, tanpa cookie iklan)

   Mengirim satu baris per kejadian ke endpoint Apps Script yang sama
   dengan pesanan (LOG_ENDPOINT), ke tab "Kejadian". Tidak ada data
   pribadi: hanya id acak per sesi/perangkat, asal kunjungan, dan nama
   kejadian.

   Kejadian yang dikirim:
     page_view      halaman dibuka (sekali per pemuatan)
     view_item      detail produk dibuka
     add_to_cart    produk masuk keranjang
     begin_checkout tombol "Lanjut" ditekan
     form_start     kolom pertama di formulir pesanan diisi
     place_order    pesanan lolos validasi dan dibuat
     confirm_wa     tombol konfirmasi WhatsApp di halaman akhir ditekan
     wa_fab         ikon WhatsApp mengambang ditekan
     session_end    halaman ditinggalkan (dipakai untuk lama kunjungan)

   Kalau LOG_ENDPOINT kosong, semua fungsi di sini tidak melakukan apa pun.
   ============================================================ */

const TRACK = (() => {
  const K_SID = "bodega_sid";        // id sesi (per tab, hilang saat tab ditutup)
  const K_VID = "bodega_vid";        // id perangkat (untuk hitung orang, bukan sesi)
  const K_ATTR = "bodega_attr";      // asal kunjungan, disimpan selama sesi
  const sudah = new Set();           // kejadian yang tidak boleh dobel per sesi
  let mulaiPada = Date.now();
  let jumlahLangkah = 0;

  const baca = (store, k) => { try { return store.getItem(k) || ""; } catch (e) { return ""; } };
  const tulis = (store, k, v) => { try { store.setItem(k, v); } catch (e) {} };

  function acak() {
    const b = new Uint8Array(9);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  }

  function id(store, k) {
    let v = baca(store, k);
    if (!v) { v = acak(); tulis(store, k, v); }
    return v;
  }

  /* ---------- asal kunjungan ---------- */

  // pola -> nama kanal yang enak dibaca di dasbor
  const POLA = [
    [/instagram|^ig$|insta|linkin\.bio|linktr/i, "Instagram"],
    [/facebook|^fb$|^meta$|fb\.me|l\.facebook/i, "Facebook"],
    [/twitter|^x$|t\.co|^x\.com$/i, "X"],
    [/tiktok|^tt$/i, "TikTok"],
    [/whatsapp|^wa$|wa\.me/i, "WhatsApp"],
    [/google|gclid|googleads/i, "Google"],
    [/grab/i, "GrabFood"],
    [/gojek|gofood/i, "GoFood"],
    [/bing|duckduckgo|yahoo|ecosia/i, "Search engine"],
    [/mail|email|newsletter/i, "Email"],
  ];

  function kenali(nilai) {
    const s = String(nilai || "").trim();
    if (!s) return "";
    for (const [re, nama] of POLA) if (re.test(s)) return nama;
    return s.replace(/^www\./, "");          // sumber tak dikenal: tampilkan apa adanya
  }

  function atribusi() {
    const q = new URLSearchParams(location.search);
    // Tautan bertanda pada pemuatan ini lebih kuat daripada simpanan sesi:
    // orang yang menekan tautan Instagram harus tercatat sebagai Instagram,
    // walau tab yang sama tadi dibuka tanpa tanda apa pun.
    const eksplisit = q.get("utm_source") || q.get("dari") || "";

    if (!eksplisit) {
      try {
        const simpan = sessionStorage.getItem(K_ATTR);
        if (simpan) {
          const a = JSON.parse(simpan);
          if (a && a.ch) return a;
        }
      } catch (e) { /* mode privat: hitung ulang saja */ }
    }

    const dari = q.get("dari") || "";         // tautan lama: ?dari=instagram
    const utm = {
      source: q.get("utm_source") || dari,
      medium: q.get("utm_medium") || "",
      campaign: q.get("utm_campaign") || "",
      content: q.get("utm_content") || "",
    };

    let ref = "";
    try {
      ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    } catch (e) { ref = ""; }
    if (ref && ref === location.hostname) ref = "";   // pindah halaman di situs sendiri

    const a = {
      ch: kenali(utm.source) || kenali(ref) || "Direct",
      ref: ref,
      utm: utm,
      landing: location.pathname + location.search,
      klik: q.get("gclid") ? "google" : (q.get("fbclid") ? "meta" : ""),
    };
    tulis(sessionStorage, K_ATTR, JSON.stringify(a));
    return a;
  }

  /* ---------- kirim ---------- */

  const endpoint = () => { try { return typeof LOG_ENDPOINT === "string" ? LOG_ENDPOINT : ""; } catch (e) { return ""; } };
  const kunci = () => { try { return typeof LOG_KEY === "string" ? LOG_KEY : ""; } catch (e) { return ""; } };

  // Waktu lokal dengan offset, sama bentuknya dengan yang dipakai pesanan.
  function waktuLokal(d) {
    const p = n => String(n).padStart(2, "0");
    const off = -d.getTimezoneOffset();
    const tz = (off >= 0 ? "+" : "-") + p(Math.floor(Math.abs(off) / 60)) + ":" + p(Math.abs(off) % 60);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz}`;
  }

  function badan(ev, props) {
    const a = atribusi();
    const p = props || {};
    return {
      jenis: "kejadian",
      key: kunci(),
      waktu: waktuLokal(new Date()),
      sid: id(sessionStorage, K_SID),
      vid: id(localStorage, K_VID),
      ev: ev,
      kanal_asal: a.ch,
      ref: a.ref,
      utm_source: a.utm.source,
      utm_medium: a.utm.medium,
      utm_campaign: a.utm.campaign,
      utm_content: a.utm.content,
      landing: a.landing,
      // kolom ringkas supaya Sheet bisa disaring tanpa membuka JSON props
      item_id: p.id || "",
      order_id: p.order_id || "",
      nilai: p.nilai || p.total || "",
      url: location.pathname + location.search,
      layar: window.innerWidth + "x" + window.innerHeight,
      bahasa: navigator.language || "",
      props: p,
    };
  }

  // mode no-cors: Apps Script mengalihkan POST, jadi balasan tidak bisa dibaca —
  // dan memang tidak perlu. Pelacakan tidak boleh pernah menahan pesanan.
  function kirim(ev, props, saatPergi) {
    const ep = endpoint();
    if (!ep) return;
    let isi;
    try { isi = JSON.stringify(badan(ev, props)); } catch (e) { return; }
    try {
      if (saatPergi && navigator.sendBeacon) {
        navigator.sendBeacon(ep, new Blob([isi], { type: "text/plain;charset=utf-8" }));
        return;
      }
      fetch(ep, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: isi,
      }).catch(() => {});
    } catch (e) { /* diabaikan dengan sengaja */ }
  }

  /* ---------- api ---------- */

  function track(ev, props) {
    jumlahLangkah += 1;
    try { kirim(ev, props, false); } catch (e) {}
  }

  // hanya sekali per sesi pemuatan halaman: cukup untuk funnel
  function sekali(ev, kunciUnik, props) {
    const k = ev + "|" + (kunciUnik || "");
    if (sudah.has(k)) return;
    sudah.add(k);
    track(ev, props);
  }

  // halaman ditinggalkan: satu kiriman terakhir berisi lama kunjungan
  addEventListener("pagehide", () => {
    try {
      kirim("session_end", {
        detik: Math.round((Date.now() - mulaiPada) / 1000),
        langkah: jumlahLangkah,
        layar: window.innerWidth + "x" + window.innerHeight,
      }, true);
    } catch (e) {}
  }, { capture: true });

  addEventListener("DOMContentLoaded", () => {
    // bfcache: halaman dipulihkan dari riwayat, bukan kunjungan baru
    let dariCache = false;
    addEventListener("pageshow", e => { if (e.persisted) dariCache = true; }, { once: true });
    setTimeout(() => {
      if (dariCache) return;
      track("page_view", {
        judul: document.title,
        bahasa: document.documentElement.lang || "",
        kembali: (() => { try { return localStorage.getItem("bodega_vid_kunjungan") ? 1 : 0; } catch (e) { return 0; } })(),
      });
      try { localStorage.setItem("bodega_vid_kunjungan", "1"); } catch (e) {}
    }, 0);
    mulaiPada = Date.now();
  });

  return { track, sekali, atribusi, kanal: kenali };
})();
