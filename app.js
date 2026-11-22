/* ============================================================
   Bodega Pizzeria — logika keranjang & checkout
   ============================================================ */

// Isi dengan URL Google Apps Script Web App kalau mau setiap pesanan
// otomatis tercatat di Google Sheets. Kosongkan kalau belum siap.
const LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbzKz15pob4Y5HNRgFF-rvvQbIk1NkUSH_YDyFnqC66j5417SC6Tw0uL79fIO0JTueME/exec";   // URL /exec Apps Script, sama dengan kasir.js
const LOG_KEY = "a4ab1e3d8541ccf8f2e52cdbefa9820e55e4df695d16ae32";   // samakan dengan Script Property RAHASIA

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const rupiah = n => "Rp" + n.toLocaleString("id-ID");
const angka  = n => n.toLocaleString("id-ID");

const cart = new Map();          // key -> { id, nama, harga, tops: [], qty }
const state = { mode: "reservasi", sumber: "", sumberLain: "" };

// Pembungkus pelacakan: halaman harus tetap jalan kalau track.js gagal dimuat.
const lacak = (ev, props) => {
  try { if (typeof TRACK !== "undefined") TRACK.track(ev, props); } catch (e) {}
};
const lacakSekali = (ev, kunci, props) => {
  try { if (typeof TRACK !== "undefined") TRACK.sekali(ev, kunci, props); } catch (e) {}
};

/* ---------------- menu ---------------- */

function renderMenu() {
  const root = $("#menu-root");
  // topping dipilih di dalam detail pizza, bukan section tersendiri
  const blocks = SECTIONS.filter(s => s.id !== "topping");

  root.innerHTML = blocks.map(sec => {
    const withPhotos = sec.items.some(i => i.img);
    const body = withPhotos
      ? `<div class="cards">${sec.items.map(cardHTML).join("")}</div>`
      : `<div class="rows">${sec.items.map(rowHTML).join("")}</div>`;

    return `
    <section class="menu-block" id="${sec.id}">
      <div class="sec-head">
        <h2>${sec.judul}</h2><span class="rule"></span>
      </div>
      ${sec.catatan ? `<p class="sec-note">${sec.catatan}</p>` : ""}
      ${body}
    </section>`;
  }).join("");

  $("#chips").innerHTML = blocks
    .map(s => `<a href="#${s.id}">${s.judul}</a>`).join("");
}

// tombol jumlah: − dan + muncul di kartu begitu item masuk keranjang
// jumlah satu pizza di keranjang, digabung dari semua variasi topping
function qtyOf(id) {
  let n = 0;
  for (const l of cart.values()) if (l.id === id) n += l.qty;
  return n;
}

// kurangi dari variasi yang paling akhir ditambahkan
function decrementAny(id) {
  const keys = [...cart.keys()].filter(k => cart.get(k).id === id);
  if (!keys.length) return;
  changeQty(keys[keys.length - 1], -1);
}

function stepperInner(id, nama) {
  const n = qtyOf(id);
  return (n
      ? `<button type="button" class="stp" data-dec="${id}" aria-label="Decrease ${nama}">−</button>
         <span class="n">${n}</span>`
      : "") +
    `<button type="button" class="stp" data-add="${id}" aria-label="Add ${nama} to order">+</button>`;
}

function stepperHTML(id, nama) {
  return `<span class="stepper${qtyOf(id) ? " has" : ""}" data-step="${id}" data-nama="${nama}">` +
    stepperInner(id, nama) + `</span>`;
}

// perbarui angka di kartu tanpa membangun ulang seluruh menu
function syncSteppers() {
  document.querySelectorAll("[data-step]").forEach(el => {
    const id = el.dataset.step;
    el.innerHTML = stepperInner(id, el.dataset.nama || "");
    el.classList.toggle("has", qtyOf(id) > 0);
  });
}

// kartu foto: seluruh kartu bisa diketuk untuk membuka detail
const cardHTML = it => `
  <div class="card">
    <button type="button" class="card-hit" data-open="${it.id}"
            aria-label="View ${it.nama}, ${rupiah(it.harga)}"></button>
    <span class="ph${it.img ? "" : " empty"}">
      ${it.img
        ? `<img src="${it.img}" alt="" width="400" height="400" loading="lazy" decoding="async">`
        : `<span class="ph-initial">${it.nama.charAt(0)}</span>`}
      ${it.tag ? `<span class="tags">${tagFor(it.tag)}</span>` : ""}
      ${PIZZA_IDS.has(it.id) ? "" : stepperHTML(it.id, it.nama)}
    </span>
    <span class="card-name">${it.nama}</span>
    <span class="card-price">${rupiah(it.harga)}</span>
  </div>`;

// baris ringkas: untuk topping dan saus yang tidak punya foto
const rowHTML = it => `
  <article class="item">
    <div class="txt">
      <h3>${it.nama}${tagFor(it.tag)}</h3>
      ${it.ket ? `<p>${it.ket}</p>` : ""}
      <span class="price">${rupiah(it.harga)}</span>
    </div>
    ${it.pilih
      ? `<button type="button" class="pickbtn" data-open="${it.id}" aria-label="Choose sauces for ${it.nama}">Choose</button>`
      : stepperHTML(it.id, it.nama)}
  </article>`;

// label mengikuti menu cetak: ♥ regular's fav, ★ bodega's recommendation
// dua label ini dipotong langsung dari menu cetak, bukan digambar ulang dengan font
const TAG_LABEL = {
  new:  { img: "img/label-new.png",  w: 340, h: 172, alt: "Baru" },
  fav:  { img: "img/label-fav.png",  w: 846, h: 176, alt: "Regular's Fav" },
  pick: { img: "img/label-pick.png", w: 1305, h: 148, alt: "Bodega's Recommendation" },
};

const tagFor = tag => {
  const list = Array.isArray(tag) ? tag : (tag ? [tag] : []);
  return list
    .map(t => TAG_LABEL[t])
    .filter(Boolean)
    .map(t => t.img
      ? `<img class="tag-img" src="${t.img}" alt="${t.alt}" width="${t.w}" height="${t.h}" loading="lazy" decoding="async">`
      : `<span class="tag ${t.cls}">${t.txt}</span>`)
    .join("");
};

const findItem = id => {
  for (const s of SECTIONS) {
    const hit = s.items.find(i => i.id === id);
    if (hit) return hit;
  }
  return null;
};

/* ---------------- cart ---------------- */

function addToCart(id, qty, tops) {
  const item = findItem(id);
  if (!item) return;
  const add = Math.max(1, Number(qty) || 1);
  const list = (tops || []).filter(t => TOP_MAP.has(t));
  const key = keyFor(id, list);
  const line = cart.get(key);
  if (line) line.qty += add;
  else cart.set(key, {
    id, nama: item.nama, harga: item.harga, tops: list,
    picks: !!item.pilih, qty: add,
  });
  lacak("add_to_cart", {
    id, nama: item.nama, qty: add,
    nilai: add * lineUnit(cart.get(key)),
    tops: list.length,
  });
  paint();
}

function changeQty(id, delta) {
  const line = cart.get(id);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) cart.delete(id);
  paint();
}

// topping sekarang bagian dari pizza, bukan baris terpisah
const TOPPINGS = (SECTIONS.find(s => s.id === "topping") || { items: [] }).items;
const ITEM_MAP = new Map(SECTIONS.flatMap(s => s.items.map(i => [i.id, i])));
const TOP_MAP = ITEM_MAP;

const keyFor = (id, tops) => id + "|" + [...(tops || [])].sort().join(",");
const topSum = tops => (tops || []).reduce((s, t) => s + ((TOP_MAP.get(t) || {}).harga || 0), 0);
const lineUnit = l => l.harga + (l.picks ? 0 : topSum(l.tops));
const pickNames = l => (l.tops || []).map(t => (TOP_MAP.get(t) || {}).nama || t).join(", ");
const lineName = l => (l.tops && l.tops.length)
  ? l.nama + (l.picks ? ` (${pickNames(l)})` : " + " + pickNames(l))
  : l.nama;

const cartCount = () => Array.from(cart.values()).reduce((n, l) => n + l.qty, 0);
const cartTotal = () => Array.from(cart.values()).reduce((n, l) => n + l.qty * lineUnit(l), 0);

// pizza dihitung per pie, item lain per item; totalnya dibatasi per transaksi
const PIZZA_IDS = new Set(
  SECTIONS.filter(s => s.pizza).flatMap(s => s.items.map(i => i.id))
);

function boxFee() {
  if (state.mode === "reservasi") return 0;      // makan di tempat: tanpa kemasan
  let sum = 0;
  for (const line of cart.values()) {
    sum += line.qty * (PIZZA_IDS.has(line.id) ? SHOP.boxPizza : SHOP.boxLain);
  }
  return Math.min(sum, SHOP.boxMaks);
}

const grandTotal = () => cartTotal() + boxFee() + Math.max(0, SHOP.ongkir || 0);

function syncBar() {
  const inMenu = !$("#view-menu").classList.contains("hidden");
  $("#bar").classList.toggle("show", cartCount() > 0 && inMenu);
  syncFab();
}

/* ---------------- tombol WhatsApp mengambang ----------------
   Ikon hanya tampil di halaman menu: halaman pesanan dan halaman selesai
   sudah punya tombol WhatsApp selebar layar, jadi ikon tambahan di sana
   hanya menghalangi tombol yang harus ditekan.
   --fab-lift dinaikkan setinggi bilah bawah yang sedang tampil, sehingga
   ikon tidak pernah menutupi tombol "Continue" atau "Confirm on WhatsApp". */
function syncFab() {
  const fab = $("#wa-fab");
  if (!fab) return;

  const diMenu = !$("#view-menu").classList.contains("hidden");
  const adaSheet = $("#modal").classList.contains("open")
    || ($("#chooser") && $("#chooser").classList.contains("open"));
  const tampil = diMenu && !adaSheet;
  fab.hidden = !tampil;
  if (!tampil) return;

  let lift = 0;
  for (const sel of ["#bar", ".done-bar"]) {
    const el = $(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.height < 1 || r.top >= window.innerHeight) continue;   // bilah sedang tidak terlihat
    lift = Math.max(lift, Math.round(window.innerHeight - r.top) + 12);
  }
  document.documentElement.style.setProperty("--fab-lift", lift + "px");
}

function paint() {
  const n = cartCount(), total = cartTotal();
  syncBar();
  $("#bar-count").textContent = `${n} item${n === 1 ? "" : "s"}`;
  $("#bar-total").textContent = rupiah(total);
  renderCartLines();
  renderSummary();
  syncSteppers();
  syncCta();
  simpan();
}

// gambar kecil supaya pelanggan ingat apa yang dipesan
function thumb(id, cls) {
  const it = findItem(id);
  if (it && it.img) {
    return `<img class="ln-thumb${cls ? " " + cls : ""}" src="${it.img}" alt="" width="40" height="40" loading="lazy">`;
  }
  // "nofoto", bukan "empty": kelas .empty dipakai untuk state keranjang kosong
  return `<span class="ln-thumb nofoto${cls ? " " + cls : ""}" aria-hidden="true"></span>`;
}

function renderCartLines() {
  const box = $("#cart-lines");
  if (!cart.size) {
    box.innerHTML = `<div class="empty"><strong>Your cart is still empty</strong>
      Pick a pizza on the menu first, then come back here.</div>`;
    $("#to-form").disabled = true;
    return;
  }
  $("#to-form").disabled = false;
  box.innerHTML = Array.from(cart.entries()).map(([key, l]) => `
    <div class="line">
      ${thumb(l.id)}
      <div class="nm">${lineName(l)}<div class="qty">${l.qty > 1 ? `${l.qty} × ${rupiah(lineUnit(l))}` : rupiah(lineUnit(l))}</div>
        ${(PIZZA_IDS.has(l.id) || (ITEM_MAP.get(l.id) || {}).pilih)
          ? `<button type="button" class="edit-link" data-edit="${key}">${
              (ITEM_MAP.get(l.id) || {}).pilih ? "Edit sauces" : "Edit toppings"}</button>`
          : ""}
        ${l.qty > 1 && (PIZZA_IDS.has(l.id) || (ITEM_MAP.get(l.id) || {}).pilih)
          ? `<button type="button" class="edit-link" data-editone="${key}">Edit one</button>`
          : ""}
      </div>
      <div class="qtyctl">
        <button data-minus="${key}" aria-label="Kurangi ${lineName(l)}">−</button>
        <span>${l.qty}</span>
        <button data-plus="${key}" aria-label="Add ${lineName(l)}">+</button>
      </div>
      ${l.qty > 1 ? `<div class="amt">${rupiah(l.qty * lineUnit(l))}</div>` : ""}
    </div>`).join("");
}

function renderSummary() {
  const box = $("#summary-lines");
  if (!box) return;
  const boxAmt = boxFee();
  box.innerHTML = Array.from(cart.entries())
    .map(([key, l]) => `<div class="line">${thumb(l.id)}
      <div class="nm">${l.qty} × ${lineName(l)}</div>
      <div class="amt">${angka(l.qty * lineUnit(l))}</div></div>`).join("")
    + (boxAmt > 0
        ? `<div class="line"><span class="ln-thumb blank" aria-hidden="true"></span><div class="nm">Packaging (box)</div>
             <div class="amt">${angka(boxAmt)}</div></div>`
        : "")
    + `<div class="line total"><div>Total</div><div>${rupiah(grandTotal())}</div></div>`
    ;
}

/* ---------------- views ---------------- */

// keranjang disimpan di sessionStorage: refresh atau pindah tab tidak menghapus pesanan
function simpan() {
  try {
    sessionStorage.setItem("bodega_cart", JSON.stringify({
      mode: state.mode, sumber: state.sumber, sumberLain: state.sumberLain,
      rows: Array.from(cart.entries()),
    }));
  } catch (e) {}
}

function muat() {
  try {
    const raw = sessionStorage.getItem("bodega_cart");
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.rows)) return;
    d.rows.forEach(([k, l]) => { if (ITEM_MAP.has(l.id) && l.qty > 0) cart.set(k, l); });
    if (d.mode) state.mode = d.mode;
    if (d.sumber) state.sumber = d.sumber;
    if (d.sumberLain) state.sumberLain = d.sumberLain;
  } catch (e) {}
}

function show(view) {
  ["#view-menu", "#view-checkout", "#view-done"].forEach(v =>
    $(v).classList.toggle("hidden", v !== view));
  if (view !== "#view-done") {             // halaman selesai tidak bisa di-"back"
    const label = view === "#view-menu" ? "menu" : "checkout";
    try {
      if (history.state !== label) history.pushState({ view: label }, "", location.href);
    } catch (e) {}
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  const chips = $("#chips");
  if (chips) chips.classList.toggle("hidden", view !== "#view-menu");
  if (typeof syncBar === "function") syncBar();
}

/* ---------------- mode & sumber ---------------- */

// label tombol utama: jangan menjanjikan WhatsApp kalau yang muncul QRIS
function syncCta() {
  const btn = $("#to-form");
  if (!btn) return;
  btn.textContent = state.mode === "reservasi"
    ? "Send reservation on WhatsApp"
    : `Pay by QRIS · ${rupiah(grandTotal())}`;
}

function setMode(mode) {
  state.mode = mode;
  $$('input[name="mode"]').forEach(r => { r.checked = r.value === mode; });
  $("#blk-reservasi").classList.toggle("hidden", mode !== "reservasi");
  $("#blk-antar").classList.toggle("hidden", mode !== "antar");
  $("#blk-ambil").classList.toggle("hidden", mode !== "ambil");
  renderSummary();
  syncCta();
  $("#pay-note").textContent = mode === "reservasi"
    ? "WhatsApp opens right after the order is created. Pay at the table when you arrive."
    : "Payment is by QRIS on the next screen, packaging included.";
}

/* ---------------- validation ---------------- */

function invalid(sel, msg) {
  const f = $(sel).closest(".field");
  f.classList.add("bad");
  const e = $(".err", f);
  if (e) e.textContent = msg;
  return false;
}

function clearErrors() {
  $$(".field.bad").forEach(f => f.classList.remove("bad"));
}

// "Lainnya" membuka kolom teks; pilihan lain menyembunyikannya lagi
function toggleSumberLain() {
  const box = $("#f-sumber-lain"), inp = $("#sumber-lain");
  if (!box || !inp) return;
  const aktif = state.sumber === "Lainnya";
  box.classList.toggle("hidden", !aktif);
  if (aktif && !inp.value) setTimeout(() => inp.focus(), 60);
}

function phoneOK(raw) {
  const d = String(raw).replace(/\D/g, "");
  if (d.startsWith("0")) return { ok: d.length >= 10 && d.length <= 14, norm: "62" + d.slice(1) };
  if (d.startsWith("8")) return { ok: d.length >= 9 && d.length <= 13, norm: "62" + d };
  if (d.startsWith("62")) return { ok: d.length >= 11 && d.length <= 15, norm: d };
  return { ok: false, norm: d };
}

function validate() {
  clearErrors();
  let ok = true;

  if (!$("#nama").value.trim() || $("#nama").value.trim().length < 2)
    ok = invalid("#nama", "Add a name so we can call your order.");

  const p = phoneOK("62" + $("#wa").value.replace(/\D/g, ""));
  if (!p.ok) ok = invalid("#wa", "That number doesn't look right. Example: 0812 3456 7890.");

  if (state.mode === "reservasi") {
    if (!$("#tgl").value) ok = invalid("#tgl", "Pick an arrival date.");
    if (!$("#jam").value) ok = invalid("#jam", "Pick an arrival time.");
    const pax = Number($("#pax").value);
    if (!pax || pax < 1) ok = invalid("#pax", "Enter the number of people, at least 1.");
  }

  // wajib diisi: ini satu-satunya data atribusi yang kami punya
  if (!state.sumber) ok = invalid("#sumber", "Pick one first — it tells us where to promote.");

  // "Lainnya" tanpa teks tidak memberi tahu apa pun: minta isinya di langkah yang sama
  const lainEl = $("#sumber-lain");
  if (state.sumber === "Lainnya" && (!lainEl || lainEl.value.trim().length < 2))
    ok = invalid("#sumber-lain", "Tell us how you found Bodega.");

  if (!cart.size) { show("#view-menu"); ok = false; }
  return ok ? { phone: p.norm } : null;
}

/* ---------------- order ---------------- */

function orderId() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  const stamp = String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
  const jam = p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  return `BOD-${stamp}-${jam}${String(Math.floor(10 + Math.random() * 90))}`;
}

const MODE_LABEL = { reservasi: "Reservasi meja", antar: "Diantar (kurir sendiri)", ambil: "Ambil sendiri" };

// kurir pelanggan datang ke toko; pizza butuh ~30 menit, jadi paling cepat 45 menit
function pickupChoice() {
  const el = document.querySelector('input[name="pickup"]:checked');
  const mins = el ? Number(el.value) : 45;
  const t = new Date(Date.now() + mins * 60000);
  const p = n => String(n).padStart(2, "0");
  return { mins, clock: `${p(t.getHours())}:${p(t.getMinutes())}` };
}

function buildPickupSlots() {
  const wrap = $("#pickup-slots");
  if (!wrap) return;
  const p = n => String(n).padStart(2, "0");
  wrap.innerHTML = [45, 60, 90, 120].map((m, i) => {
    const t = new Date(Date.now() + m * 60000);
    return `<label><input type="radio" name="pickup" value="${m}"${i === 0 ? " checked" : ""}>` +
           `<span>${m} min</span><small>± ${p(t.getHours())}:${p(t.getMinutes())}</small></label>`;
  }).join("");
}
const tglID = v => {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${Number(d)} ${bulan[Number(m) - 1]} ${y}`;
};

function buildMessage(id, phone) {
  const lines = [];
  lines.push("Halo Bodega Pizzeria, saya mau pesan.");
  lines.push("");
  lines.push(`No. pesanan: ${id}`);
  lines.push(`Nama: ${$("#nama").value.trim()}`);
  lines.push(`WhatsApp: ${phone}`);
  lines.push("");
  lines.push("PESANAN");
  for (const l of cart.values()) lines.push(`${l.qty} × ${lineName(l)} — ${angka(l.qty * lineUnit(l))}`);
  lines.push(`Total menu: ${angka(cartTotal())}`);
  if (boxFee() > 0) lines.push(`Kemasan (box): ${angka(boxFee())}`);
  if (SHOP.ongkir > 0) lines.push(`Ongkir: ${angka(SHOP.ongkir)}`);
  lines.push(`Total: ${angka(grandTotal())}`);
  lines.push("");
  lines.push(MODE_LABEL[state.mode].toUpperCase());

  if (state.mode === "reservasi") {
    lines.push(`${tglID($("#tgl").value)}, ${$("#jam").value} — ${$("#pax").value} orang`);
  }
  if (state.mode === "antar") {
    const p = pickupChoice();
    lines.push(`Kurir ambil: ${p.clock} (± ${p.mins} menit dari sekarang)`);
  }
  if (state.mode === "ambil" && $("#jamAmbil").value) {
    lines.push(`Ambil jam: ${$("#jamAmbil").value}`);
  }

  const note = $("#catatan").value.trim();
  if (note) { lines.push(""); lines.push(`Catatan: ${note}`); }

  lines.push("");
  if (state.sumber === "Lainnya") {
    const lain = ($("#sumber-lain").value || "").trim();
    lines.push(`Tahu Bodega dari: Lainnya — ${lain}`);
  } else if (state.sumber) {
    lines.push(`Tahu Bodega dari: ${state.sumber}`);
  }
  return lines.join("\n");
}

function waktuLokal(d) {
  const p = n => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const tz = (off >= 0 ? "+" : "-") + p(Math.floor(Math.abs(off) / 60)) + ":" + p(Math.abs(off) % 60);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz}`;
}

function payload(id, phone, message) {
  return {
    waktu: waktuLokal(new Date()),
    order_id: id,
    kanal: "web",                       // pembeda dari pesanan kasir di sheet yang sama
    status_bayar: state.mode === "reservasi" ? "di tempat" : "menunggu qris",
    meja: "",
    kasir: "",
    tipe: state.mode,
    nama: $("#nama").value.trim(),
    wa: phone,
    pickup: state.mode === "antar" ? pickupChoice().clock : "",
    tanggal: state.mode === "reservasi" ? $("#tgl").value : "",
    jam: state.mode === "reservasi" ? $("#jam").value : (state.mode === "ambil" ? ($("#jamAmbil").value || "") : ""),
    pax: state.mode === "reservasi" ? $("#pax").value : "",
    item: Array.from(cart.values()).map(l => `${l.qty}x ${lineName(l)}`).join("; "),
    item_detail: Array.from(cart.values()).map(l => ({
      id: l.id, qty: l.qty, harga: lineUnit(l), tops: l.tops,
    })),
    total: grandTotal(),
    box: boxFee(),
    sumber: state.sumber,
    sumber_lain: state.sumber === "Lainnya" ? ($("#sumber-lain").value || "").trim() : "",
    catatan: $("#catatan").value.trim(),
    pesan: message,
    url: location.href,
  };
}

function queueOrder(data) {
  if (!LOG_ENDPOINT) return;               // tidak ada tujuan: jangan simpan data pribadi
  try {
    const q = JSON.parse(localStorage.getItem("bodega_queue") || "[]");
    q.push(data);
    while (q.length > 50) q.shift();        // batas aman, buang yang paling lama
    localStorage.setItem("bodega_queue", JSON.stringify(q));
  } catch (e) { /* penyimpanan penuh: pesanan tetap lanjut */ }
}

// Menunggu sampai pesanan benar-benar terkirim sebelum halaman pembayaran tampil.
// null = belum ada tujuan pencatatan (LOG_ENDPOINT kosong), false = gagal kirim.
async function saveOrder(data) {
  queueOrder(data);
  if (!LOG_ENDPOINT) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({}, data, { key: LOG_KEY })),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    try {
      const q = JSON.parse(localStorage.getItem("bodega_queue") || "[]")
        .filter(r => r.order_id !== data.order_id);
      localStorage.setItem("bodega_queue", JSON.stringify(q));
    } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

async function flushQueue() {
  if (!LOG_ENDPOINT) return;
  let queue;
  try { queue = JSON.parse(localStorage.getItem("bodega_queue") || "[]"); }
  catch (e) { localStorage.removeItem("bodega_queue"); return; }
  if (!Array.isArray(queue)) return;
  if (!queue.length) return;
  const keep = [];
  for (const row of queue) {
    try {
      await fetch(LOG_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({}, row, { key: LOG_KEY })),
      });
    } catch (e) {
      keep.push(row);
    }
  }
  try { localStorage.setItem("bodega_queue", JSON.stringify(keep)); } catch (e) {}
}

// QRIS dinamis kalau payload tersedia, kalau tidak pakai gambar statis
function ensureQrcode() {
  return new Promise((resolve, reject) => {
    if (typeof qrcode !== "undefined") return resolve();
    const s = document.createElement("script");
    s.src = "vendor/qrcode.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function staticQris(slot) {
  const img = document.createElement("img");
  img.alt = "Kode QRIS Bodega Pizzeria";
  img.onerror = () => { img.remove(); $("#qris-missing").classList.remove("hidden"); };
  img.src = SHOP.qris;
  slot.innerHTML = "";
  slot.appendChild(img);
}

// Simpan kode QR: digambar ulang ke kanvas baru bersama nominal dan nomor
// pesanan, supaya berkas yang tersimpan masih bisa dipakai tanpa halaman ini.
function siapkanUnduhQr(qr, amount, ref) {
  const btn = $("#qris-download");
  if (!btn || !qr) return;

  const pad = Math.round(qr.width * 0.075);
  const W = qr.width + pad * 2;
  const maxW = W - pad * 2;

  const out = document.createElement("canvas");
  const c = out.getContext("2d");

  // ukuran huruf mengikuti lebar kartu, lalu dikecilkan sampai muat
  const muat = (text, size, weight) => {
    let s = size;
    for (;;) {
      c.font = `${weight} ${s}px "Courier Prime", ui-monospace, monospace`;
      if (c.measureText(text).width <= maxW || s <= 12) return s;
      s -= 1;
    }
  };

  const nominal = "Rp" + Number(amount).toLocaleString("id-ID");
  const baris = [
    { text: "Bodega Pizzeria", size: Math.round(W * 0.055), weight: 400, color: "#5C5C5C" },
    { text: nominal, size: Math.round(W * 0.105), weight: 700, color: "#0D0D0D" },
    { text: ref, size: Math.round(W * 0.040), weight: 400, color: "#5C5C5C" },
    { text: "Scan with any bank or e-wallet app", size: Math.round(W * 0.040), weight: 400, color: "#5C5C5C" },
  ];
  baris.forEach(b => { b.size = muat(b.text, b.size, b.weight); b.h = Math.round(b.size * 1.9); });

  const teksH = baris.reduce((n, b) => n + b.h, 0);
  out.width = W;
  out.height = qr.height + pad * 2 + teksH + Math.round(pad * 0.6);

  c.fillStyle = "#FFFFFF";
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(qr, pad, pad);

  c.textAlign = "center";
  let y = qr.height + pad + Math.round(pad * 0.4);
  for (const b of baris) {
    y += b.h;
    c.fillStyle = b.color;
    c.font = `${b.weight} ${b.size}px "Courier Prime", ui-monospace, monospace`;
    c.fillText(b.text, W / 2, y - Math.round(b.size * 0.5));
  }

  btn.classList.remove("hidden");
  btn.onclick = () => {
    out.toBlob(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qris-${ref}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
  };
}

function renderPayment(slot, amount, ref) {
  if (!slot) return;
  const payloadStr = (SHOP.qrisPayload || "").trim();

  if (payloadStr && typeof QRIS !== "undefined") {
    let dyn;
    try {
      const opts = (SHOP.qrisBillRef && ref) ? { billRef: ref } : null;
      dyn = QRIS.buildDynamic(payloadStr, amount, opts);
    } catch (e) {
      console.warn("QRIS dinamis gagal:", e.message);
      dyn = null;
    }

    if (dyn) {
      slot.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);text-align:center;margin:18px 0">Menyiapkan kode QRIS…</p>';
      // pustaka pembuat QR baru diunduh di sini, bukan saat halaman dibuka
      ensureQrcode()
        .then(() => {
          slot.innerHTML = "";
          if (!QRIS.renderQR(slot, dyn, 300)) { staticQris(slot); return; }
          $("#qris-missing").classList.add("hidden");
          siapkanUnduhQr(slot.querySelector("canvas"), amount, ref);
        })
        .catch(() => staticQris(slot));
      return;
    }
  }
  staticQris(slot);
  $("#qris-missing").classList.add("hidden");
}

async function submit(ev) {
  ev.preventDefault();

  const v = validate();
  if (!v) {
    const bad = $(".field.bad");
    if (bad) {
      bad.scrollIntoView({ block: "center", behavior: "smooth" });
      const first = bad.querySelector("input,select,textarea");
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 260);
    }
    return;
  }

  const id = orderId();
  const msg = buildMessage(id, v.phone);
  const data = payload(id, v.phone, msg);

  lacak("place_order", {
    order_id: id,
    mode: state.mode,
    total: data.total,
    item: cartCount(),
    kelompok: cart.size,
    sumber: state.sumber,
    // reservasi membuka WhatsApp sendiri saat pesanan dikirim
    wa_otomatis: state.mode === "reservasi" ? 1 : 0,
  });

  // Reservasi: WhatsApp dibuka langsung seperti sebelumnya.
  if (state.mode === "reservasi") {
    window.open(`https://wa.me/${SHOP.wa}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // Tahan dulu: halaman pembayaran baru tampil setelah pesanan tercatat.
  const btn = $("#to-form");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving order…";

  let saved = false;
  try { saved = await saveOrder(data); } catch (e) { saved = false; }

  btn.disabled = false;
  btn.textContent = label;

  try {
    sessionStorage.setItem("bodega_last", JSON.stringify({
      id, total: grandTotal(), mode: state.mode,
    }));
  } catch (e) { /* mode privat / kuota penuh: tidak boleh menghentikan pesanan */ }

  renderDone(id, msg, saved === true);
  $("#record-note").classList.toggle("hidden", saved === true);
  show("#view-done");

  // Pesanan sudah dibuat. Keranjang dikosongkan supaya memuat ulang halaman
  // tidak membawa item pesanan lama ke pesanan berikutnya.
  cart.clear();
  state.sumber = "";
  try { sessionStorage.removeItem("bodega_cart"); } catch (e) {}
  state.sumberLain = "";
  const selS = $("#sumber");
  if (selS) selS.value = "";
  const lainS = $("#sumber-lain");
  if (lainS) lainS.value = "";
  const boxS = $("#f-sumber-lain");
  if (boxS) boxS.classList.add("hidden");
  renderCartLines();
  syncBar();
}

function renderDone(id, msg, recorded) {
  const isReserve = state.mode === "reservasi";

  $("#done-id").textContent = id;
  // jangan mengklaim "tercatat" kalau belum ada tujuan pencatatan
  $("#done-claim").textContent = recorded
    ? "has been recorded at Bodega."
    : "has been created.";
  $("#wa-link").href = `https://wa.me/${SHOP.wa}?text=${encodeURIComponent(msg)}`;

  $("#done-title").textContent = isReserve ? "Complete your reservation" : "Complete your payment";
  $("#done-hint").textContent = isReserve
    ? "WhatsApp already opened in another tab. If it didn't, tap this button so your reservation is recorded."
    : "Already paid? Tap the button below so Bodega starts on your order.";
  $("#done-pill").textContent = isReserve ? "Not confirmed yet" : "Not paid yet";
  $("#done-sub").textContent = isReserve
    ? "WhatsApp already opened in another tab — press send there so Bodega records your reservation. If it didn't open, use the button below."
    : "Pay with the QRIS below — the amount already includes packaging.";

  $("#pay-block").classList.toggle("hidden", isReserve);
  $("#reserve-note").classList.toggle("hidden", !isReserve);

  if (!isReserve) {
    $("#pay-amt").textContent = rupiah(grandTotal());
    renderPayment($("#qris-slot"), grandTotal(), id);
  }

  $("#done-summary").innerHTML = Array.from(cart.entries())
    .map(([key, l]) => `<div class="line">${thumb(l.id)}
      <div class="nm">${l.qty} × ${lineName(l)}</div>
      <div class="amt">${angka(l.qty * lineUnit(l))}</div></div>`).join("")
    + (boxFee() > 0
        ? `<div class="line"><span class="ln-thumb blank" aria-hidden="true"></span><div class="nm">Packaging (box)</div>
             <div class="amt">${angka(boxFee())}</div></div>`
        : "")
    + `<div class="line total"><div>Total</div><div>${rupiah(grandTotal())}</div></div>`;
}


/* ---------------- detail item (bottom sheet / dialog) ---------------- */

let sheetItem = null, sheetQty = 1, lastFocus = null, sheetTops = new Set(), editKey = null, editSplit = false;

/* --- pizza yang sudah ada di keranjang: tambah baru atau ubah? --- */
let chooseId = null;

function openTile(id) {
  const item = ITEM_MAP.get(id) || findItem(id);
  if (!item) return;
  const multivar = PIZZA_IDS.has(id) || item.pilih;
  const lines = [...cart.entries()].filter(([, l]) => l.id === id);
  if (multivar && lines.length) { openChooser(id); return; }
  openItemSheet(id, null);
}

function openChooser(id) {
  const item = ITEM_MAP.get(id) || findItem(id);
  const lines = [...cart.entries()].filter(([, l]) => l.id === id);
  chooseId = id;

  $("#c-title").textContent = `${item.nama} is already in your order`;
  $("#c-sub").textContent = "Add another with different toppings, or edit the one you have?";
  $("#c-cancel").onclick = closeSheet;
  $("#c-list").innerHTML = lines.map(([key, l]) => `
    <button type="button" class="choose-row" data-pick="${key}">
      <span class="choose-name">${l.tops && l.tops.length ? pickNames(l) : "No toppings"}</span>
      <span class="choose-act">Ubah</span>
      <span class="choose-meta">${l.qty} × · ${rupiah(lineUnit(l))}</span>
    </button>`).join("");

  $("#chooser").classList.add("open");
  $("#chooser").setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
  lacakSekali("view_item", id, { id, nama: item.nama, harga: item.harga, dari: "chooser" });
  syncFab();
  $("#c-new").focus();
}

function closeChooser() {
  $("#chooser").classList.remove("open");
  $("#chooser").setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
  syncFab();
}

function sheetTotal() {
  // untuk item "pilih" (trio saus) harga sudah termasuk pilihannya
  const extra = sheetItem.pilih ? 0 : topSum([...sheetTops]);
  return (sheetItem.harga + extra) * sheetQty;
}

function paintSheetPrice() {
  if (sheetItem) $("#m-price").textContent = rupiah(sheetTotal());
}

function sheetOptions() {
  if (!sheetItem) return null;
  if (PIZZA_IDS.has(sheetItem.id) && TOPPINGS.length) {
    return { list: TOPPINGS, max: 99, min: 0, judul: "Add toppings", note: "optional", addPrice: true };
  }
  if (sheetItem.pilih) {
    const sec = SECTIONS.find(s => s.id === sheetItem.dari);
    return {
      // bundle tidak boleh menawarkan dirinya sendiri (atau bundle lain) sebagai pilihan
      list: (sec ? sec.items : []).filter(i => i.id !== sheetItem.id && !i.pilih),
      max: sheetItem.pilih, min: sheetItem.pilih,
      judul: `Choose ${sheetItem.pilih} sauces`, note: "required", addPrice: false,
    };
  }
  return null;
}

function renderSheetTops() {
  const wrap = $("#m-tops");
  if (!wrap) return;

  const opt = sheetOptions();
  if (!opt) {
    wrap.innerHTML = "";
    wrap.hidden = true;
    syncSheetAdd();
    return;
  }

  wrap.hidden = false;
  wrap.innerHTML = `
    <div class="tops-head">${opt.judul}
      <span>${opt.min ? `${sheetTops.size}/${opt.min} chosen` : opt.note}</span>
    </div>
    <div class="tops">
      ${opt.list.map(t => {
        const on = sheetTops.has(t.id);
        const full = sheetTops.size >= opt.max && !on;
        return `
        <label class="top-chip${on ? " on" : ""}${full ? " off" : ""}">
          <input type="checkbox" data-top="${t.id}"${on ? " checked" : ""}${full ? " disabled" : ""}>
          <span class="top-name">${t.nama}</span>
          ${opt.addPrice ? `<b>+${angka(t.harga)}</b>` : ""}
        </label>`;
      }).join("")}
    </div>`;
  syncSheetAdd();
}

// tombol tambah menunggu pilihan wajib (mis. trio saus) terpenuhi
function syncSheetAdd() {
  const btn = $("#m-add");
  const opt = sheetOptions();
  if (!btn) return;
  const kurang = opt && opt.min ? opt.min - sheetTops.size : 0;
  btn.disabled = kurang > 0;
  btn.textContent = kurang > 0
    ? `Choose ${kurang} more sauce${kurang === 1 ? "" : "s"}`
    : (editSplit ? "Simpan 1 pizza" : (editKey ? "Simpan perubahan" : "Add to order"));
}

function openItemSheet(id, key, split) {
  const it = findItem(id);
  if (!it) return;

  const line = key ? cart.get(key) : null;
  sheetItem = it;
  editKey = key || null;
  try { if (history.state !== "sheet") history.pushState({ view: "sheet" }, ""); } catch (e) {}
  editSplit = !!split && !!line && line.qty > 1;
  sheetQty = editSplit ? 1 : (line ? line.qty : 1);
  sheetTops = new Set(line && line.tops ? line.tops : []);
  lastFocus = document.activeElement;
  const sheetEl = $("#modal .sheet");
  if (sheetEl) sheetEl.scrollTop = 0;      // jangan warisi posisi gulir sheet sebelumnya

  const photo = $("#m-photo");
  if (it.img) {
    photo.hidden = false;
    photo.innerHTML = `<img src="${it.img}" alt="${it.nama}" width="400" height="400">`;
  } else {
    photo.hidden = true;          // tanpa foto, jangan sisakan kotak kosong besar
    photo.innerHTML = "";
  }
  $("#m-tag").innerHTML = it.tag ? tagFor(it.tag) : "";
  $("#m-name").textContent = it.nama;
  $("#m-desc").textContent = it.ket || "";
  $("#m-qty").textContent = sheetQty;
  $("#m-plus").disabled = editSplit;
  $("#m-minus").disabled = editSplit;
  renderSheetTops();
  paintSheetPrice();

  const modal = $("#modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
  lacakSekali("view_item", it.id, { id: it.id, nama: it.nama, harga: it.harga });
  syncFab();
  $("#m-close").focus();
}

function closeSheet() {
  const modal = $("#modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
  const sh = document.querySelector("#modal .sheet");
  if (sh) { sh.style.transform = ""; sh.classList.remove("dragging", "settling"); }
  const bgEl = document.querySelector("#modal .modal-bg");
  if (bgEl) bgEl.style.opacity = "";
  sheetItem = null;
  editKey = null;
  editSplit = false;
  syncFab();
  // kartu lama bisa sudah dibuang oleh render ulang menu
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function bumpSheet(delta) {
  if (editSplit) return;
  sheetQty = Math.max(1, Math.min(99, sheetQty + delta));
  $("#m-qty").textContent = sheetQty;
  paintSheetPrice();
}

/* ---------------- ulasan ---------------- */

// tanggal ulasan datang relatif dari API ("12 hari lalu"); labelnya ikut bahasa halaman
function kapanEn(k) {
  const s = String(k || "").trim();
  const m = s.match(/^(\d+)\s+(hari|minggu|bulan|tahun)\s+lalu$/i);
  if (!m) return s;
  const n = Number(m[1]);
  const unit = { hari: "day", minggu: "week", bulan: "month", tahun: "year" }[m[2].toLowerCase()];
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

function renderUlasan() {
  const sec = $("#ulasan"), grid = $("#ulasan-grid");
  if (!sec || !grid || typeof ULASAN === "undefined" || !ULASAN.length) return;

  grid.innerHTML = ULASAN.map(u => `
    <figure class="quote">
      <div class="stars" aria-label="${u.bintang} out of 5 stars">${"★".repeat(u.bintang)}${"☆".repeat(Math.max(0, 5 - u.bintang))}</div>
      <blockquote>${u.teks}</blockquote>
      ${u.terjemahan ? `<p class="terjemahan">${u.terjemahan}</p>` : ""}
      ${u.pesan ? `<p class="pesan">Ordered: ${u.pesan}</p>` : ""}
      <figcaption>${u.nama} · ${kapanEn(u.kapan)}<span class="src">${u.sumber}</span></figcaption>
    </figure>`).join("");

  // geser horizontal + titik penanda
  const dots = $("#ulasan-dots");
  const cards = [...grid.querySelectorAll(".quote")];
  if (dots && cards.length) {
    dots.innerHTML = cards.map((_, i) =>
      `<button type="button" data-dot="${i}" aria-label="Review ${i + 1} of ${cards.length}"></button>`).join("");

    const langkah = () => {
      const r = cards[0].getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(grid).columnGap || "14") || 14;
      return r.width + gap;
    };
    const aktif = i => [...dots.children].forEach((b, k) =>
      b.setAttribute("aria-current", k === i ? "true" : "false"));

    let raf = 0;
    grid.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(grid.scrollLeft / langkah());
        aktif(Math.max(0, Math.min(cards.length - 1, i)));
      });
    }, { passive: true });

    dots.addEventListener("click", e => {
      const b = e.target.closest("[data-dot]");
      if (!b) return;
      grid.scrollTo({ left: Number(b.dataset.dot) * langkah(), behavior: "smooth" });
    });

    // kalau semua kartu muat (desktop lebar), tidak perlu titik
    const semuaMuat = () => { dots.hidden = grid.scrollWidth <= grid.clientWidth + 2; };
    semuaMuat();
    addEventListener("resize", semuaMuat);
    aktif(0);
  }

  const note = $("#ulasan-note");
  if (note) {
    // GrabFood disebut sebagai sumber, tapi tidak ditautkan: halaman ini
    // tidak boleh mengarahkan pelanggan keluar ke Grab.
    note.innerHTML = (typeof ULASAN !== "undefined" && ULASAN.length)
      ? `Quoted from Bodega's GrabFood and Google Maps reviews.${SHOP.maps ? ` <a href="${SHOP.maps}" target="_blank" rel="noopener">See it on Google Maps</a>.` : ""}`
      : "";
  }
  sec.hidden = false;
}

/* ---------------- tarik untuk menutup (ponsel) ---------------- */

function initSheetDrag() {
  const grip = $("#m-grip");
  const sheet = document.querySelector("#modal .sheet");
  const bg = document.querySelector("#modal .modal-bg");
  if (!grip || !sheet) return;

  let startY = 0, dy = 0, t0 = 0, moved = false, active = false, onGrip = false;

  // buang satu klik yang muncul setelah menyeret
  const swallowClick = () => {
    const kill = ev => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener("click", kill, true); };
    document.addEventListener("click", kill, true);
    setTimeout(() => document.removeEventListener("click", kill, true), 90);
  };

  const reset = () => {
    sheet.classList.remove("dragging");
    sheet.style.transform = "";
    if (bg) bg.style.opacity = "";
  };

  // sentuhan: dari mana saja selama isi sheet belum di-scroll
  const begin = (target, y) => {
    if (innerWidth >= 640) return false;              // desktop tetap dialog
    onGrip = !!(target && target.closest && target.closest("#m-grip"));
    if (!onGrip && sheet.scrollTop > 0) return false; // biarkan scroll normal
    active = true; moved = false; dy = 0;
    startY = y; t0 = performance.now();
    sheet.classList.add("dragging");
    return true;
  };

  const apply = y => {
    dy = Math.max(0, y - startY);
    if (dy > 6) moved = true;
    if (!moved) return;
    sheet.style.transform = `translateY(${dy}px)`;
    if (bg) bg.style.opacity = String(Math.max(0, 1 - dy / 320));
  };

  const finish = () => {
    if (!active) return;
    active = false;
    sheet.classList.remove("dragging");

    // ketukan hanya menutup kalau kena pegangan; ketukan di isi sheet
    // harus diteruskan ke tombol di dalamnya
    if (!moved) { reset(); if (onGrip) closeSheet(); return; }

    const h = sheet.getBoundingClientRect().height;
    const speed = dy / Math.max(1, performance.now() - t0);
    if (dy > Math.min(64, h * 0.15) || speed > 0.11) {
      swallowClick();                                  // jangan sampai klik jatuh ke menu di belakang
      reset(); closeSheet(); return;
    }

    sheet.classList.add("settling");
    sheet.style.transform = "";
    if (bg) bg.style.opacity = "";
    setTimeout(() => sheet.classList.remove("settling"), 260);
  };

  // touchmove harus non-passive supaya bisa menahan scroll saat menyeret
  sheet.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    begin(e.target, e.touches[0].clientY);
  }, { passive: true });

  sheet.addEventListener("touchmove", e => {
    if (!active || e.touches.length !== 1) return;
    apply(e.touches[0].clientY);
    if (moved && dy > 0) e.preventDefault();
  }, { passive: false });

  sheet.addEventListener("touchend", finish);
  sheet.addEventListener("touchcancel", finish);

  // mouse (desktop) hanya lewat pegangan
  grip.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch") return;
    if (!begin(grip, e.clientY)) return;
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener("pointermove", e => {
    if (e.pointerType === "touch" || !active) return;
    apply(e.clientY);
  });
  grip.addEventListener("pointerup", e => {
    if (e.pointerType === "touch") return;
    finish();
  });
}

/* ---------------- boot ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  muat();                 // pulihkan keranjang SEBELUM render pertama,
  renderMenu();           // kalau tidak, paint() menimpa simpanan dengan kosong
  paint();

  document.body.addEventListener("click", e => {
    const open = e.target.closest("[data-open]");
    if (open) { openTile(open.dataset.open); return; }
    const editOne = e.target.closest("[data-editone]");
    if (editOne) {
      const line = cart.get(editOne.dataset.editone);
      if (line) openItemSheet(line.id, editOne.dataset.editone, true);
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const line = cart.get(edit.dataset.edit);
      if (line) openItemSheet(line.id, edit.dataset.edit);
      return;
    }
    const dec = e.target.closest("[data-dec]");
    if (dec) { decrementAny(dec.dataset.dec); return; }
    const add = e.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add); return; }
    const plus = e.target.closest("[data-plus]");
    if (plus) { changeQty(plus.dataset.plus, 1); return; }
    const minus = e.target.closest("[data-minus]");
    if (minus) { changeQty(minus.dataset.minus, -1); return; }
  });

  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };

  on("#modal", "click", e => { if (e.target.closest("[data-close]")) closeSheet(); });
  on("#m-plus", "click", () => bumpSheet(1));
  on("#m-minus", "click", () => bumpSheet(-1));
  on("#m-tops", "change", e => {
    const cb = e.target.closest("[data-top]");
    if (!cb) return;
    if (cb.checked) sheetTops.add(cb.dataset.top);
    else sheetTops.delete(cb.dataset.top);
    const opt = sheetOptions();
    if (opt && sheetTops.size > opt.max) {
      sheetTops.delete(cb.dataset.top);
      cb.checked = false;
    }
    renderSheetTops();
    paintSheetPrice();
  });

  on("#m-add", "click", () => {
    if (!sheetItem) return;
    const id = sheetItem.id;
    const tops = [...sheetTops];
    const qty = sheetQty;

    if (editKey && editSplit) {
      // ubah satu pizza saja: satu unit keluar dari baris, sisanya tetap
      const item = findItem(id);
      const old = cart.get(editKey);
      if (old) {
        if (old.qty > 1) cart.set(editKey, Object.assign({}, old, { qty: old.qty - 1 }));
        else cart.delete(editKey);
      }
      const key = keyFor(id, tops);
      const same = cart.get(key);
      if (same) same.qty += 1;
      else cart.set(key, {
        id, nama: item.nama, harga: item.harga, tops,
        picks: !!item.pilih, qty: 1,
      });
      paint();
    } else if (editKey) {
      // ubah seluruh baris
      const item = findItem(id);
      cart.delete(editKey);
      const key = keyFor(id, tops);
      const same = cart.get(key);
      if (same) same.qty += qty;
      else cart.set(key, {
        id, nama: item.nama, harga: item.harga, tops,
        picks: !!item.pilih, qty,
      });
      paint();
    } else {
      addToCart(id, qty, tops);
    }

    closeSheet();
    const back = document.querySelector(`[data-open="${id}"]`);
    if (back) back.focus();
  });

  on("#chooser", "click", e => {
    if (e.target.closest("[data-close]")) { closeChooser(); return; }
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      const line = cart.get(pick.dataset.pick);
      closeChooser();
      if (line) openItemSheet(line.id, pick.dataset.pick);
    }
  });

  on("#c-new", "click", () => {
    const id = chooseId;
    closeChooser();
    if (id) openItemSheet(id, null);
  });
  addEventListener("popstate", () => {
    if ($("#modal").classList.contains("open")) { closeSheet(); return; }
    if (!$("#view-checkout").classList.contains("hidden")) { show("#view-menu"); return; }
    if (!$("#view-done").classList.contains("hidden")) { show("#view-menu"); return; }
  });

  document.addEventListener("keydown", e => {
    if ($("#chooser").classList.contains("open")) {
      if (e.key === "Escape") closeChooser();
      return;
    }
    if (!$("#modal").classList.contains("open")) return;
    if (e.key === "Escape") { closeSheet(); return; }
    if (e.key !== "Tab") return;
    const f = [...$("#modal").querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])")]
      .filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---- funnel: "Continue" dari bilah keranjang = mulai checkout ----
  let formMulai = false;
  on("#open-cart", "click", () => {
    buildPickupSlots();
    formMulai = false;
    lacak("begin_checkout", { item: cartCount(), kelompok: cart.size, nilai: grandTotal() });
    show("#view-checkout");
  });
  on("#back-menu", "click", () => show("#view-menu"));
  on("#order-form", "submit", submit);

  // ---- funnel: "isi data" = kolom pertama di formulir yang benar-benar terisi ----
  on("#order-form", "input", catatFormMulai);
  on("#order-form", "change", catatFormMulai);
  function catatFormMulai(e) {
    if (formMulai) return;
    const f = e.target;
    if (!f || f.type === "radio" || f.type === "submit") return;   // cara ambil bukan "mengisi data"
    if (!String(f.value || "").trim()) return;
    formMulai = true;
    lacak("form_start", { kolom: f.id || f.name || "" });
  }

  // ---- funnel: tombol konfirmasi WhatsApp di halaman akhir ----
  on("#wa-link", "click", () => {
    lacak("confirm_wa", {
      order_id: $("#done-id") ? $("#done-id").textContent : "",
      mode: state.mode,
    });
  });

  $$('input[name="mode"]').forEach(r =>
    r.addEventListener("change", () => setMode(r.value)));

  const selSumber = $("#sumber");
  // opsi tampil berbahasa Inggris; yang disimpan tetap label Indonesia (dipakai di pesan WA + kolom sheet)
  selSumber.innerHTML = `<option value="">Pick one…</option>` +
    SUMBER.map(s => `<option value="${s.id}">${s.en || s.label}</option>`).join("");
  const idTerpilih = () => (SUMBER.some(s => s.id === state.sumber)
    ? state.sumber
    : ((SUMBER.find(s => s.label === state.sumber) || {}).id || ""));
  selSumber.value = idTerpilih();
  selSumber.addEventListener("change", () => {
    state.sumber = (SUMBER.find(s => s.id === selSumber.value) || {}).label || "";
    if (selSumber.value) $("#f-sumber").classList.remove("bad");
    toggleSumberLain();
    simpan();
  });

  // teks "Lainnya" ikut disimpan, jadi refresh tidak menghapus alasan pelanggan
  const inpLain = $("#sumber-lain");
  if (inpLain) {
    inpLain.value = state.sumberLain || "";
    inpLain.addEventListener("input", () => {
      state.sumberLain = inpLain.value;
      if (inpLain.value.trim()) $("#f-sumber-lain").classList.remove("bad");
      simpan();
    });
  }
  toggleSumberLain();

  // tanggal minimal hari ini (pakai waktu lokal, bukan UTC)
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // WhatsApp: prefiks +62 tampil di kiri, jadi yang diketik hanya angka lokal
  const waInput = $("#wa");
  waInput.addEventListener("input", () => {
    const bersih = waInput.value.replace(/\D/g, "").replace(/^62/, "").replace(/^0/, "");
    if (waInput.value !== bersih) waInput.value = bersih;
  });

  $("#tgl").min = iso;
  $("#tgl").value = iso;
  $("#jam").value = "19:00";

  // tautan bertanda: ...?dari=instagram
  const pre = new URLSearchParams(location.search).get("dari");
  if (pre) {
    const match = SUMBER.find(s => s.id === pre.toLowerCase()) ||
                  SUMBER.find(s => (s.en || "").toLowerCase().includes(pre.toLowerCase())) ||
                  SUMBER.find(s => s.label.toLowerCase().includes(pre.toLowerCase()));
    if (match) {
      selSumber.value = match.id;
      state.sumber = match.label;
      toggleSumberLain();
      simpan();
    }
  }

  if (SHOP.jam) $("#shop-hours").textContent = SHOP.jam;


  if (state.sumber === "") state.sumber = "";

  // skor Google Maps + tautan ke lokasi
  const rate = $("#shop-rate");
  if (rate) {
    const skor = v => Number(v).toFixed(1);
    const baris = [];
    if (SHOP.maps && SHOP.rating) {
      baris.push(`<a href="${SHOP.maps}" target="_blank" rel="noopener">
        <span class="star" aria-hidden="true">★</span> ${skor(SHOP.rating)}${SHOP.ulasan ? ` · ${SHOP.ulasan} review${SHOP.ulasan === 1 ? "" : "s"}` : ""} on Google Maps</a>`);
    }
    if (SHOP.grab && SHOP.grabRating) {
      // sengaja bukan tautan: jangan arahkan pelanggan ke Grab dari halaman ini
      baris.push(`<span class="rate-plain">
        <span class="star" aria-hidden="true">★</span> ${skor(SHOP.grabRating)}${SHOP.grabUlasan ? ` · ${SHOP.grabUlasan} review${SHOP.grabUlasan === 1 ? "" : "s"}` : ""} on GrabFood</span>`);
    }
    rate.innerHTML = baris.join("");
  }

  // tautan GrabFood: satu sumber kebenaran di SHOP.grab
  const grabLink = $("#grab-footer");
  if (grabLink && SHOP.grab) grabLink.href = SHOP.grab;

  // ikon WhatsApp mengambang: nomor & pesan awal dari SHOP.wa
  const fab = $("#wa-fab");
  if (fab) {
    fab.href = `https://wa.me/${SHOP.wa}?text=${encodeURIComponent("Hi Bodega! I'd like to ask about the menu.")}`;
    fab.addEventListener("click", () => {
      lacak("wa_fab", {
        dari: $("#view-menu").classList.contains("hidden") ? "checkout" : "menu",
        item: cartCount(),
      });
    });
  }
  syncFab();
  addEventListener("resize", syncFab, { passive: true });
  addEventListener("orientationchange", syncFab, { passive: true });

  renderUlasan();

  initSheetDrag();
  buildPickupSlots();
  flushQueue();
  setMode("reservasi");
});
