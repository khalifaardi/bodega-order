/* ============================================================
   Bodega — Kasir (pesanan walk-in)

   Satu halaman, tanpa foto, tanpa halaman pembayaran. Keluarannya:
   satu tiket nomor antre, dan satu baris di sheet yang sama dengan
   pesanan web (kanal: "kasir").

   Pembayaran terjadi di POS Sanang, jadi halaman ini tidak menanyakan
   metode bayar. Yang dicatat nomor referensi dari struk Sanang.

   Harga, biaya kemasan, dan daftar topping dibaca dari menu.js, jadi
   kasir dan situs pelanggan tidak mungkin berbeda angka.
   ============================================================ */

// URL web app Apps Script (berakhiran /exec). Selama kosong, pesanan hanya
// tersimpan di perangkat ini dan belum bisa dipastikan sampai ke sheet.
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzKz15pob4Y5HNRgFF-rvvQbIk1NkUSH_YDyFnqC66j5417SC6Tw0uL79fIO0JTueME/exec";

// Harus sama dengan Script Property RAHASIA di Apps Script. Bukan pengaman
// sungguhan (berkas ini publik), hanya penangkal kiriman asal-asalan.
const LOG_KEY = "a4ab1e3d8541ccf8f2e52cdbefa9820e55e4df695d16ae32";

const SHOP_ = SHOP;
const TOPPING = (SECTIONS.find(s => s.id === "topping") || { items: [] }).items;
const PIZZA_IDS = new Set();
SECTIONS.forEach(s => { if (s.pizza) s.items.forEach(i => PIZZA_IDS.add(i.id)); });
const ITEM_MAP = new Map();
SECTIONS.forEach(s => s.items.forEach(i => ITEM_MAP.set(i.id, i)));

const state = { tipe: "", cart: new Map(), tops: new Set(), cari: "", hari: null };   // tipe kosong: kasir wajib memilih

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rupiah = n => "Rp" + Number(n).toLocaleString("id-ID");
const angka = n => Number(n).toLocaleString("id-ID");

/* ---------- hitungan ---------- */

function topSum(l) {
  if (l.pilih) return 0;
  return (l.tops || []).reduce((n, id) => n + ((ITEM_MAP.get(id) || {}).harga || 0), 0);
}
const unit = l => l.harga + topSum(l);
const cartTotal = () => [...state.cart.values()].reduce((n, l) => n + unit(l) * l.qty, 0);

function kemasan() {
  if (state.tipe !== "bawa") return 0;            // makan di tempat (atau belum dipilih) tanpa box
  let n = 0;
  for (const l of state.cart.values()) {
    n += (PIZZA_IDS.has(l.id) ? SHOP_.boxPizza : SHOP_.boxLain) * l.qty;
  }
  return Math.min(n, SHOP_.boxMaks);
}
const total = () => cartTotal() + kemasan();

function namaBaris(l) {
  const t = (l.tops || []).map(id => (ITEM_MAP.get(id) || {}).nama).filter(Boolean);
  return t.length ? `${l.nama} + ${t.join(", ")}` : l.nama;
}

/* ---------- daftar menu ---------- */

const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function renderTabs() {
  const tabs = SECTIONS.filter(s => s.id !== "topping");
  $("#tabs").innerHTML = tabs.map((s, i) =>
    `<button type="button" data-tab="${s.id}" aria-pressed="${i === 0}">${s.judul}</button>`).join("");
}

function renderDaftar() {
  const q = norm(state.cari).trim();
  const secs = SECTIONS.filter(s => s.id !== "topping");

  const bagian = secs.map(s => {
    const items = q
      ? s.items.filter(it => norm(it.nama).includes(q) || norm(s.judul).includes(q))
      : s.items;
    if (!items.length) return "";
    return `<section id="sec-${s.id}" style="margin-top:18px">
      <h2 style="font-family:var(--display);font-size:18px;font-weight:400;margin:0">${s.judul}</h2>
      ${items.map(it => {
        const n = qtyOf(it.id);
        const pizza = PIZZA_IDS.has(it.id);
        return `<div class="baris" data-row="${it.id}">
          <div>
            <div class="baris-nama">${it.nama}</div>
            <div class="baris-harga">${rupiah(it.harga)}${it.pilih ? ` · pilih ${it.pilih}` : ""}</div>
            ${pizza && n ? `<button type="button" class="lnk" data-tops="${it.id}">Topping</button>` : ""}
          </div>
          <div class="baris-aksi">
            <div class="stp ${n ? "" : "zero"}">
              <button type="button" data-minus="${it.id}" aria-label="Kurangi ${it.nama}">−</button>
              <span>${n}</span>
              <button type="button" data-plus="${it.id}" aria-label="Tambah ${it.nama}">+</button>
            </div>
          </div>
        </div>`;
      }).join("")}
    </section>`;
  }).join("");

  $("#daftar").innerHTML = bagian ||
    `<p style="color:var(--ink-soft);margin:26px 0">Tidak ada menu yang cocok dengan “${state.cari}”.</p>`;
}

function qtyOf(id) {
  let n = 0;
  for (const l of state.cart.values()) if (l.id === id) n += l.qty;
  return n;
}

function addItem(id, tops = []) {
  const it = ITEM_MAP.get(id);
  if (!it) return;
  if (it.pilih) { state.tops = new Set(); openTops(id, true); return; }
  const key = `${id}|${tops.slice().sort().join(",")}`;
  const l = state.cart.get(key);
  if (l) l.qty += 1;
  else state.cart.set(key, { id, nama: it.nama, harga: it.harga, tops: tops.slice(), qty: 1, pilih: !!it.pilih });
  paint();
}

function decItem(id) {
  const keys = [...state.cart.keys()].filter(k => state.cart.get(k).id === id);
  if (!keys.length) return;
  const last = keys[keys.length - 1];
  const l = state.cart.get(last);
  l.qty -= 1;
  if (l.qty <= 0) state.cart.delete(last);
  paint();
}

function paint() {
  renderDaftar();
  $("#total").textContent = rupiah(total());
  const b = $("#buka-tiket");
  b.disabled = state.cart.size === 0;
  b.textContent = state.cart.size ? `Lihat pesanan (${state.cart.size})` : "Lihat pesanan";
  renderTiket();
}

/* ---------- panel ---------- */

function bukaPanel(html) {
  const isi = $("#panel-isi");
  isi.innerHTML = html;
  isi.style.transform = "";
  isi.style.transition = "";
  isi.scrollTop = 0;
  $("#panel").hidden = false;
}
function tutupPanel() {
  $("#panel").hidden = true;
  const isi = $("#panel-isi");
  isi.style.transform = "";
  isi.style.transition = "";
  isi.innerHTML = "";
}

function openTops(id, pilihMode = false) {
  const it = ITEM_MAP.get(id);
  if (!it) return;
  const daftar = pilihMode ? (SECTIONS.find(s => s.id === it.dari) || { items: [] }).items : TOPPING;
  const terpilih = state.tops;

  bukaPanel(`
    <div class="grip" aria-hidden="true"></div>
    <h2 id="panel-judul">${it.nama}</h2>
    <p class="sub">${pilihMode ? `Pilih ${it.pilih} saus.` : "Topping dihitung per pizza."}</p>
    <div class="top-grid">
      ${daftar.map(t => `
        <label>
          <input type="checkbox" data-top="${t.id}" ${terpilih.has(t.id) ? "checked" : ""}>
          <span>${t.nama}</span><small>${pilihMode ? "" : "+" + angka(t.harga)}</small>
        </label>`).join("")}
    </div>
    <div class="lembar-aksi">
      <button type="button" class="btn primary wide" id="top-simpan">Tambah ke pesanan</button>
      <button type="button" class="btn wide" id="top-batal" style="margin-top:8px">Batal</button>
    </div>`);

  $$("#panel-isi input[data-top]").forEach(inp =>
    inp.addEventListener("change", () => {
      if (inp.checked) terpilih.add(inp.dataset.top);
      else terpilih.delete(inp.dataset.top);
      const btn = $("#top-simpan");
      const cukup = !pilihMode || terpilih.size === it.pilih;
      btn.disabled = !cukup;
      btn.textContent = cukup ? "Tambah ke pesanan" : `Pilih ${it.pilih - terpilih.size} saus lagi`;
    }));

  const simpan = $("#top-simpan");
  if (pilihMode) {
    simpan.disabled = terpilih.size !== it.pilih;
    if (simpan.disabled) simpan.textContent = `Pilih ${it.pilih - terpilih.size} saus lagi`;
  }
  simpan.addEventListener("click", () => {
    const tops = [...terpilih];
    tutupPanel();
    addItem(id, tops);
  });
  $("#top-batal").addEventListener("click", tutupPanel);
  initPanelDrag();
}

function renderTiket() {
  const isi = $("#panel-isi");
  if ($("#panel").hidden || !isi.querySelector("#tiket-form")) return;

  const lines = [...state.cart.entries()].map(([key, l]) => `
    <div class="baris-tiket">
      <div class="n">${l.qty} × ${namaBaris(l)}</div>
      <div class="t">${angka(unit(l) * l.qty)}</div>
      ${(l.tops || []).length ? `<div class="opsi">${(l.tops || []).map(id => (ITEM_MAP.get(id) || {}).nama).join(" · ")}</div>` : ""}
    </div>`).join("");

  const kotak = $("#tiket-lines");
  if (!kotak) return;
  kotak.innerHTML = lines || `<p class="sub">Belum ada item.</p>`;

  const km = $("#tiket-kemasan"), tt = $("#tiket-total"), kr = $("#tiket-kemasan-row");
  if (km) km.textContent = angka(kemasan());
  if (tt) tt.textContent = rupiah(total());
  if (kr) kr.style.display = kemasan() > 0 ? "flex" : "none";

  const meja = $("#field-meja");
  if (meja) meja.style.display = state.tipe === "dinein" ? "block" : "none";   // kosong = disembunyikan
}

function bukaTiket() {
  const optSumber = [`<option value="">— tidak diisi —</option>`]
    .concat((typeof SUMBER !== "undefined" ? SUMBER : []).map(s => `<option value="${s.label}">${s.label}</option>`))
    .join("");

  bukaPanel(`
    <div class="grip" aria-hidden="true"></div>
    <h2 id="panel-judul">Pesanan</h2>
    <p class="sub">${state.cart.size} baris</p>

    <div id="tiket-lines" style="margin-top:6px"></div>
    <div class="total-baris kecil" id="tiket-kemasan-row"><span>Kemasan</span><span id="tiket-kemasan">0</span></div>
    <div class="total-baris"><span>Total</span><span id="tiket-total">Rp0</span></div>

    <div id="tiket-form">
      <div class="field" id="field-tipe">
        <label>Jenis pesanan</label>
        <div class="tipe" role="group" aria-label="Jenis pesanan">
          <button type="button" id="tipe-dinein" aria-pressed="${state.tipe === "dinein"}">Makan di tempat</button>
          <button type="button" id="tipe-bawa" aria-pressed="${state.tipe === "bawa"}">Dibawa pulang</button>
        </div>
        <div class="err" id="tipe-err">Pilih makan di tempat atau dibawa pulang dulu.</div>
      </div>

      <div class="field" id="field-meja">
        <label for="meja">Nomor meja <span class="wajib">wajib</span></label>
        <input id="meja" type="text" inputmode="numeric" placeholder="mis. 4" autocomplete="off">
        <div class="err" id="meja-err">Isi nomor meja dulu.</div>
      </div>

      <div class="field">
        <label for="nama">Nama (opsional)</label>
        <input id="nama" type="text" placeholder="Nama pemesan" autocomplete="off">
      </div>

      <div class="field">
        <label for="wa">WhatsApp (opsional)</label>
        <div class="wa-wrap">
          <span class="wa-cc" aria-hidden="true">+62</span>
          <input id="wa" type="tel" inputmode="numeric" placeholder="812 3456 7890" autocomplete="off">
        </div>
        <div class="hint">Kosongkan kalau tamu tidak mau dihubungi.</div>
      </div>

      <div class="field" id="field-noref">
        <label for="noref">No. referensi Sanang <span class="wajib">wajib</span></label>
        <input id="noref" type="text" placeholder="Nomor struk POS Sanang" autocomplete="off">
        <div class="err" id="noref-err">Isi nomor referensi dari struk Sanang.</div>
      </div>

      <div class="field">
        <label for="sumber-kasir">Tahu Bodega dari mana? (opsional)</label>
        <select id="sumber-kasir">${optSumber}</select>
      </div>

      <div class="field hidden" id="field-sumber-lain">
        <label for="sumber-lain">Dari mana? Tulis sendiri <span class="wajib">wajib</span></label>
        <input id="sumber-lain" type="text" maxlength="60" placeholder="mis. undangan teman, TikTok kakak" autocomplete="off">
        <div class="err" id="sumber-lain-err">Tulis dari mana tamu tahu Bodega.</div>
      </div>

    </div>

    <div class="lembar-aksi">
      <button type="button" class="btn primary wide" id="tiket-simpan">Simpan pesanan</button>
      <button type="button" class="btn wide" id="tiket-batal" style="margin-top:8px">Kembali ke menu</button>
    </div>`);

  $("#tipe-dinein").addEventListener("click", () => setTipe("dinein"));
  $("#tipe-bawa").addEventListener("click", () => setTipe("bawa"));

  // WhatsApp: hanya angka, tanpa 0 atau 62 di depan karena prefiksnya sudah +62
  const wa = $("#wa");
  wa.addEventListener("input", () => {
    const bersih = wa.value.replace(/\D/g, "").replace(/^62/, "").replace(/^0/, "");
    if (wa.value !== bersih) wa.value = bersih;
  });

  // "Lainnya" membuka kolom teks sendiri; pilihan lain menyembunyikannya lagi
  const selSumber = $("#sumber-kasir"), boxLain = $("#field-sumber-lain");
  const toggleLain = () => {
    if (!boxLain) return;
    boxLain.classList.toggle("hidden", selSumber.value !== "Lainnya");
  };
  selSumber.addEventListener("change", () => {
    toggleLain();
    if (selSumber.value === "Lainnya") setTimeout(() => $("#sumber-lain").focus(), 60);
  });
  toggleLain();

  // galat hilang begitu kolom wajib diisi
  [["#meja", "#field-meja", "#meja-err"], ["#noref", "#field-noref", "#noref-err"],
   ["#sumber-lain", "#field-sumber-lain", "#sumber-lain-err"]].forEach(([i, f, e]) => {
    const el = $(i);
    el.addEventListener("input", () => {
      if (!el.value.trim()) return;
      $(f).classList.remove("bad");
      $(e).style.display = "none";
    });
  });

  $("#tiket-simpan").addEventListener("click", simpanPesanan);
  $("#tiket-batal").addEventListener("click", tutupPanel);
  renderTiket();
  initPanelDrag();
}

function setTipe(t) {
  state.tipe = t;
  const ft = $("#field-tipe");
  if (ft) ft.classList.remove("bad");
  const te = $("#tipe-err");
  if (te) te.style.display = "none";
  const d = $("#tipe-dinein"), b = $("#tipe-bawa");
  if (d) d.setAttribute("aria-pressed", String(t === "dinein"));
  if (b) b.setAttribute("aria-pressed", String(t === "bawa"));
  renderTiket();
  $("#total").textContent = rupiah(total());
}

/* ---------- geser ke bawah untuk menutup ---------- */

function initPanelDrag() {
  const sheet = $("#panel-isi");
  if (!sheet) return;

  let sy = 0, dy = 0, t0 = 0, aktif = false;

  const mulai = y => { aktif = true; dy = 0; sy = y; t0 = performance.now(); };
  const geser = y => {
    if (!aktif) return false;
    dy = Math.max(0, y - sy);
    if (dy > 4) {
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${dy}px)`;
      return true;
    }
    return false;
  };
  const lepas = () => {
    if (!aktif) return;
    aktif = false;
    const h = sheet.getBoundingClientRect().height;
    const cepat = dy / Math.max(1, performance.now() - t0) > 0.5;
    if (dy > Math.min(96, h * 0.22) || (cepat && dy > 40)) { tutupPanel(); return; }
    sheet.style.transition = "transform 180ms cubic-bezier(.23,1,.32,1)";
    sheet.style.transform = "";
    setTimeout(() => { sheet.style.transition = ""; }, 220);
  };

  sheet.addEventListener("touchstart", e => {
    if (sheet.scrollTop > 0) return;              // biarkan menggulir isi
    mulai(e.touches[0].clientY);
  }, { passive: true });

  sheet.addEventListener("touchmove", e => {
    if (!aktif) return;
    if (geser(e.touches[0].clientY)) e.preventDefault();
  }, { passive: false });

  sheet.addEventListener("touchend", lepas);
  sheet.addEventListener("touchcancel", lepas);
}

/* ---------- simpan ---------- */

function nomorAntre() {
  const today = new Date().toISOString().slice(0, 10);
  let d = { hari: today, n: 0 };
  try {
    const raw = localStorage.getItem("bodega_kasir_urut");
    if (raw) {
      const prev = JSON.parse(raw);
      if (prev && prev.hari === today) d = prev;
    }
  } catch (e) {}
  d.n += 1;
  try { localStorage.setItem("bodega_kasir_urut", JSON.stringify(d)); } catch (e) {}
  return d.n;
}

function orderId() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `KAS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
         `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(Math.floor(Math.random() * 100))}`;
}

function waktuLokal(d) {
  const p = n => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const tz = (off >= 0 ? "+" : "-") + p(Math.floor(Math.abs(off) / 60)) + ":" + p(Math.abs(off) % 60);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz}`;
}

function kumpulkan() {
  const v = id => (($(id) || {}).value || "").trim();
  const meja = state.tipe === "dinein" ? v("#meja") : "";
  const wa = v("#wa").replace(/\D/g, "");
  const detail = [...state.cart.values()]
    .map(l => `${l.qty}x ${namaBaris(l)} = ${unit(l) * l.qty}`).join("; ");

  return {
    waktu: waktuLokal(new Date()),
    order_id: orderId(),
    kanal: "kasir",
    tipe: state.tipe,
    status_bayar: "di sanang pos",
    nama: v("#nama"),
    wa: wa ? "62" + wa : "",
    meja: meja,
    no_ref: v("#noref"),
    pickup: "",
    tanggal: "",
    jam: "",
    pax: "",
    sumber: v("#sumber-kasir"),
    sumber_lain: v("#sumber-kasir") === "Lainnya" ? v("#sumber-lain") : "",
    kasir: "kasir",
    total_menu: cartTotal(),
    kemasan: kemasan(),
    total: total(),
    item_detail: detail,
    pesan: "",
  };
}

async function simpanPesanan() {
  if (!state.cart.size) return;

  // semua syarat diperiksa sekaligus, lalu fokus ke yang pertama kosong
  const kurang = [];
  const wajib = (field, err, isi) => {
    const f = $(field), e = $(err);
    if (isi) { if (f) f.classList.remove("bad"); if (e) e.style.display = "none"; return; }
    if (f) f.classList.add("bad");
    if (e) e.style.display = "block";
    kurang.push(field);
  };

  wajib("#field-tipe", "#tipe-err", !!state.tipe);
  if (state.tipe === "dinein") {
    wajib("#field-meja", "#meja-err", !!($("#meja").value || "").trim());
  }
  wajib("#field-noref", "#noref-err", !!($("#noref").value || "").trim());
  // kalau kasir memilih "Lainnya", teksnya ikut wajib — label saja tidak bisa ditindaklanjuti
  if ((($("#sumber-kasir") || {}).value || "") === "Lainnya") {
    wajib("#field-sumber-lain", "#sumber-lain-err", !!($("#sumber-lain").value || "").trim());
  }

  if (kurang.length) {
    const f = $(kurang[0]);
    if (f) {
      f.scrollIntoView({ block: "center", behavior: "smooth" });
      const input = f.querySelector("input");
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 280);
    }
    return;
  }
  const data = kumpulkan();
  data.nomor_antre = nomorAntre();          // sementara; nomor resmi dari sheet

  const btn = $("#tiket-simpan");
  btn.disabled = true;
  btn.textContent = "Menyimpan…";

  const terkirim = await kirim(data);
  let nomor = data.nomor_antre;
  let sinkron = false;

  if (terkirim) {
    const baris = await tungguBaris(data.order_id);
    if (baris) {
      sinkron = true;
      if (baris.nomor_antre) nomor = Number(baris.nomor_antre);
    }
  }
  if (!sinkron) antre(data);

  state.cart.clear();
  paint();
  layarSelesai(nomor, sinkron);
  muatHariIni();
}

async function kirim(data) {
  if (!LOG_ENDPOINT) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({}, data, { key: LOG_KEY })),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return true;
  } catch (e) {
    return false;
  }
}

function antre(data) {
  try {
    const q = JSON.parse(localStorage.getItem("bodega_kasir_queue") || "[]");
    q.push(data);
    while (q.length > 100) q.shift();
    localStorage.setItem("bodega_kasir_queue", JSON.stringify(q));
  } catch (e) {}
  hitungSisa();
}

let sedangKirim = false;

/**
 * Kirim ulang antrean, lalu SATU kali baca sheet untuk tahu baris mana yang
 * benar-benar masuk. Baris yang tidak muncul di sheet tetap di antrean —
 * tidak dianggap terkirim hanya karena fetch tidak melempar galat.
 */
async function kirimAntrean() {
  if (!LOG_ENDPOINT || sedangKirim) return;
  const q = antreanLokal();
  if (!q.length) return;

  sedangKirim = true;
  try {
    for (const row of q) {
      // eslint-disable-next-line no-await-in-loop
      await kirim(row);
    }
    const tgl = String((q[0] || {}).waktu || "").slice(0, 10) || tanggalLokal();
    let masuk = new Set();
    for (let i = 0; i < 4; i++) {
      try {
        const d = await bacaHari(tgl);
        masuk = new Set((d.baris || []).map(b => b.order_id));
        break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 900));
      }
    }
    const sisa = q.filter(r => !masuk.has(r.order_id));
    try { localStorage.setItem("bodega_kasir_queue", JSON.stringify(sisa)); } catch (e) {}
    hitungSisa();
  } finally {
    sedangKirim = false;
  }
}

function hitungSisa() {
  let n = 0;
  try { n = (JSON.parse(localStorage.getItem("bodega_kasir_queue") || "[]") || []).length; } catch (e) {}
  $("#sisa-antre").textContent = n;
}

function layarSelesai(nomor, terkirim) {
  bukaPanel(`
    <div class="grip" aria-hidden="true"></div>
    <div class="selesai">
      <span class="pill ${terkirim ? "ok" : ""}">${terkirim ? "Tercatat" : "Belum terkirim"}</span>
      <div class="nomor">${String(nomor).padStart(3, "0")}</div>
      <p class="ket">${terkirim
        ? "Pesanan sudah masuk ke catatan Bodega."
        : "Nomor di atas masih sementara. Pesanan dicoba ulang otomatis, dan nomor resminya muncul di daftar hari ini."}</p>
      <button type="button" class="btn primary wide" id="lagi">Pesanan baru</button>
    </div>`);
  $("#lagi").addEventListener("click", () => { tutupPanel(); paint(); });
  initPanelDrag();
}

/* ---------- sinkron dengan sheet ---------- */

function tanggalLokal(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function antreanLokal() {
  try {
    const q = JSON.parse(localStorage.getItem("bodega_kasir_queue") || "[]");
    return Array.isArray(q) ? q : [];
  } catch (e) { return []; }
}

let cbSeq = 0;

/**
 * JSONP: Apps Script tidak mengirim header CORS, jadi <script> lebih andal
 * daripada fetch untuk membaca balasan.
 */
function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!LOG_ENDPOINT) { reject(new Error("endpoint kosong")); return; }
    const nama = "bodegaCb" + (++cbSeq);
    const url = new URL(LOG_ENDPOINT);
    Object.entries(Object.assign({ key: LOG_KEY, callback: nama }, params))
      .forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("_", String(Date.now()));

    const s = document.createElement("script");
    let selesai = false;
    const bersih = () => { delete window[nama]; s.remove(); };

    window[nama] = d => { selesai = true; resolve(d); bersih(); };
    s.onerror = () => { if (!selesai) { bersih(); reject(new Error("gagal memuat")); } };
    s.src = url.toString();
    document.head.appendChild(s);
    setTimeout(() => { if (!selesai) { bersih(); reject(new Error("timeout")); } }, 9000);
  });
}

async function bacaHari(tgl) {
  const d = await jsonp({ action: "hariIni", tgl });
  if (!d || !d.ok) throw new Error((d && d.error) || "gagal membaca");
  return d;
}

/** Tunggu sampai baris ini benar-benar terlihat di sheet. */
async function tungguBaris(order_id) {
  const tgl = tanggalLokal();
  for (let i = 0; i < 6; i++) {
    try {
      const d = await bacaHari(tgl);
      const row = (d.baris || []).find(b => b.order_id === order_id);
      if (row) return row;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 700));
  }
  return null;
}

async function muatHariIni() {
  if (!LOG_ENDPOINT) { paintHari(); return; }
  try { state.hari = await bacaHari(tanggalLokal()); }
  catch (e) { state.hari = null; }
  paintHari();
}

function paintHari() {
  const badge = $("#hari-n");
  if (badge) {
    badge.textContent = state.hari && state.hari.ok ? String(state.hari.n) : "–";
  }
  if (!$("#view-hari").hidden) paintHariIsi();
}

/* Daftar hari ini adalah HALAMAN, bukan sheet: isinya bisa panjang, dan sheet
   yang menutupi menu membuat halaman di belakangnya masih bisa tergulir. */
function bukaHariIni() {
  document.body.classList.add("lihat-hari");
  $("#view-hari").hidden = false;
  window.scrollTo(0, 0);
  paintHariIsi();
  if (!history.state || !history.state.hari) history.pushState({ hari: 1 }, "");
  muatHariIni();
}

function tutupHariIni() {
  document.body.classList.remove("lihat-hari");
  $("#view-hari").hidden = true;
  window.scrollTo(0, 0);
}

window.addEventListener("popstate", () => {
  if (!$("#view-hari").hidden) tutupHariIni();
});

/** Antrean lokal menyimpan waktu ISO penuh; sheet mengirim "HH:MM". Samakan. */
function jamSaja(v) {
  const s = String(v || "");
  const m = s.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : s;
}

/** "1x Hot Honey Ricotta = 80000; 2x Al Tartufo = 180000" → baris rincian. */
function rincianItem(detail) {
  const raw = String(detail || "").trim();

  // Pesanan web mengirim item_detail sebagai JSON ([{id,qty,harga,tops}]); kasir mengirim
  // teks "1x Nama = 80000". Tanpa cabang ini, JSON-nya tampil di kartu sebagai kode mentah.
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.map(o => {
          const it = ITEM_MAP.get(o.id) || {};
          const tops = (Array.isArray(o.tops) ? o.tops : [])
            .map(id => (ITEM_MAP.get(id) || {}).nama)
            .filter(Boolean);
          const qty = Number(o.qty) || 0;
          const harga = Number(o.harga) || 0;
          return {
            qty: qty ? String(qty) : "",
            nama: (it.nama || String(o.id || "?")) + (tops.length ? ` + ${tops.join(", ")}` : ""),
            harga: qty ? qty * harga : null,
          };
        });
      }
    } catch (e) { /* JSON rusak: tampilkan sebagai teks apa adanya di bawah */ }
  }

  return String(detail || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const m = s.match(/^(\d+)x\s+(.+?)\s*=\s*(\d+)$/);
      return m ? { qty: m[1], nama: m[2], harga: Number(m[3]) } : { qty: "", nama: s, harga: null };
    });
}

function kartuHari(o) {
  const item = rincianItem(o.item_detail);
  const judul = o.tipe === "dinein"
    ? `Meja ${o.meja || "?"}`
    : (o.tipe === "bawa" ? "Dibawa pulang" : "Pesanan web");
  const siapa = [o.nama, o.wa ? "+62 " + String(o.wa).replace(/^62/, "") : ""].filter(Boolean).join(" · ");

  return `
  <article class="h-order${o.belum ? " belum" : ""}">
    <div class="h-top">
      <span class="h-num">${o.nomor_antre ? String(o.nomor_antre).padStart(3, "0") : "—"}</span>
      <span class="h-jam">${jamSaja(o.waktu)}</span>
      <span class="h-total">${rupiah(o.total)}</span>
    </div>

    <div class="h-judul">${judul}${siapa ? ` · ${siapa}` : ""}</div>

    <div class="h-meta">
      <span class="h-kanal">${o.kanal || "kasir"}</span>
      ${o.no_ref ? `<span>Ref Sanang <b>${o.no_ref}</b></span>` : `<span class="h-tanpa">tanpa ref</span>`}
      ${o.status_bayar ? `<span>${o.status_bayar}</span>` : ""}
      ${o.belum ? `<span class="h-belum">belum terkirim</span>` : ""}
    </div>

    ${item.length || o.kemasan ? `<ul class="h-items">
      ${item.map(i => `<li><span>${i.qty ? i.qty + "× " : ""}${i.nama}</span><b>${i.harga !== null ? angka(i.harga) : ""}</b></li>`).join("")}
      ${o.kemasan ? `<li class="h-kemasan"><span>Kemasan</span><b>${angka(o.kemasan)}</b></li>` : ""}
    </ul>` : ""}
  </article>`;
}

function paintHariIsi() {
  const isi = $("#hari-isi");
  if (!isi) return;

  const d = state.hari;
  const ringkas = (d && d.ok && d.ringkas) || {};
  const sub = $("#hari-ringkas");

  if (sub) {
    if (!LOG_ENDPOINT) {
      sub.textContent = "Endpoint belum diisi — daftar ini hanya dari perangkat ini.";
    } else if (!d || !d.ok) {
      sub.textContent = "Belum bisa membaca sheet. Periksa koneksi.";
    } else {
      const bagian = Object.keys(ringkas).map(k => `${k} ${ringkas[k].n}`).join(" · ");
      sub.textContent = `${d.n} pesanan · ${rupiah(d.total)}` + (bagian ? ` (${bagian})` : "");
    }
  }

  const belum = antreanLokal().map(l => kartuHari(Object.assign({}, l, { belum: true })));
  const baris = ((d && d.ok && d.baris) || [])
    .slice()
    .sort((a, b) => jamSaja(b.waktu).localeCompare(jamSaja(a.waktu)))
    .map(kartuHari);

  isi.innerHTML = (belum.join("") + baris.join("")) ||
    `<p class="sub" style="margin-top:26px">Belum ada pesanan hari ini.</p>`;
}

/* ---------- interaksi ---------- */

document.addEventListener("click", e => {
  const plus = e.target.closest("[data-plus]");
  if (plus) { addItem(plus.dataset.plus); return; }

  const minus = e.target.closest("[data-minus]");
  if (minus) { decItem(minus.dataset.minus); return; }

  const tops = e.target.closest("[data-tops]");
  if (tops) { state.tops = new Set(); openTops(tops.dataset.tops); return; }

  const tab = e.target.closest("[data-tab]");
  if (tab) {
    $$("#tabs button").forEach(b => b.setAttribute("aria-pressed", String(b === tab)));
    const el = $("#sec-" + tab.dataset.tab);
    if (el) window.scrollTo({ top: el.offsetTop - 210, behavior: "smooth" });
    return;
  }

  if (e.target.id === "buka-tiket") { bukaTiket(); return; }
  if (e.target.closest("#buka-hari")) { bukaHariIni(); return; }
  if (e.target.closest("#hari-kembali")) { tutupHariIni(); return; }
  if (e.target.id === "panel") { tutupPanel(); return; }
});

$("#cari").addEventListener("input", e => {
  state.cari = e.target.value;
  renderDaftar();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("#view-hari").hidden) tutupHariIni();
  else tutupPanel();
});

/* ---------- mulai ---------- */

function jam() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  $("#jam-sekarang").textContent = `${p(d.getHours())}:${p(d.getMinutes())}`;
}

renderTabs();
paint();
jam();
setInterval(jam, 30000);
hitungSisa();
kirimAntrean();
muatHariIni();

window.addEventListener("online", () => { kirimAntrean(); muatHariIni(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  kirimAntrean();
  muatHariIni();
});
setInterval(() => {
  if (document.hidden) return;      // hemat kuota Apps Script saat tab tak dilihat
  kirimAntrean();
  muatHariIni();
}, 60000);
