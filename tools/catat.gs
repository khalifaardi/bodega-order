/**
 * Bodega — titik sinkron pesanan (Google Sheet + endpoint baca).
 *
 * Dipakai bersama oleh dua halaman:
 *   - index.html  (pesanan pelanggan dari web)
 *   - kasir.html  (pesanan walk-in yang dicatat kasir)
 *
 * Dua pintu:
 *   doPost          menambah satu baris. Nomor antre DIBERIKAN DI SINI, bukan
 *                   di perangkat, supaya dua tablet tidak sama-sama menomori 001.
 *   doGet hariIni   mengembalikan pesanan satu tanggal. Halaman kasir memakainya
 *                   untuk (a) memastikan kiriman benar-benar sampai, dan
 *                   (b) menampilkan daftar hari ini yang sama di semua perangkat.
 *
 * Pintu tambahan untuk pelacakan (track.js, dibaca dasbor.html):
 *   doPost jenis='kejadian'  menambah baris di tab "Kejadian" — tidak menyentuh
 *                            tab Pesanan dan tidak butuh order_id.
 *   doGet action=analitik    ringkasan funnel + asal kunjungan.
 *   doGet action=kejadian    N kejadian terakhir, untuk memeriksa pelacakan.
 *
 * CARA PASANG
 *   1. Buat Google Sheet baru (mis. "Bodega — Pesanan").
 *   2. Extensions → Apps Script, hapus isinya, tempel berkas ini.
 *   3. Project Settings → Script Properties → tambah
 *        RAHASIA = <kunci acak>
 *      Kunci yang sama ditempel ke LOG_KEY di kasir.js dan index.html.
 *      Kalau RAHASIA kosong, endpoint terbuka untuk siapa pun yang punya URL.
 *   4. Deploy → New deployment → Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *      Salin URL yang berakhiran /exec.
 *   5. Tempel URL itu ke LOG_ENDPOINT di kasir.js (dan index.html kalau dipakai).
 *
 * Kalau mengubah kode ini, deploy ulang: Deploy → Manage deployments → Edit →
 * Version: New version. URL tetap sama.
 */

var TAB = 'Pesanan';
var TAB_KEJADIAN = 'Kejadian';
var TZ = 'Asia/Makassar';

/** Kolom baru HARUS ditambahkan di ujung: baris lama tidak boleh bergeser. */
var KOLOM = [
  'waktu', 'order_id', 'kanal', 'tipe', 'status_bayar',
  'meja', 'nama', 'wa', 'no_ref',
  'pickup', 'tanggal', 'jam', 'pax', 'sumber', 'kasir',
  'total_menu', 'kemasan', 'total', 'item_detail', 'pesan',
  'nomor_antre', 'sumber_lain'
];

/**
 * Tab kedua: satu baris per kejadian di halaman pesanan (page_view,
 * view_item, add_to_cart, begin_checkout, form_start, place_order,
 * confirm_wa, wa_fab, session_end). Tanpa nama/telepon — hanya id acak.
 */
var KOLOM_KEJADIAN = [
  'waktu', 'tanggal', 'jam', 'ev', 'sid', 'vid',
  'kanal_asal', 'ref', 'utm_source', 'utm_medium', 'utm_campaign',
  'landing', 'item_id', 'order_id', 'nilai', 'url', 'layar', 'bahasa', 'props'
];

/* ---------- tulis ---------- */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return out({ ok: false, error: 'server sibuk, coba lagi' });
  }
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!kunciCocok(data.key)) return out({ ok: false, error: 'kunci salah' });

    // Kejadian funnel punya jalur sendiri: tidak menyentuh tab Pesanan dan
    // tidak butuh order_id, supaya pelacakan tidak pernah mengganggu pesanan.
    if (data.jenis === 'kejadian') {
      return out(catatKejadian(data));
    }

    if (!data.order_id) return out({ ok: false, error: 'order_id kosong' });

    var sh = sheet();
    var tgl = tanggalDari(data.waktu);

    // Nomor antre hanya untuk walk-in. Pesanan web punya kode order_id sendiri.
    if (data.kanal === 'kasir' && tgl) {
      data.nomor_antre = nomorBerikut(sh, tgl);
    }

    sh.appendRow(KOLOM.map(function (k) {
      var v = data[k];
      if (v === undefined || v === null) v = '';
      return typeof v === 'object' ? JSON.stringify(v) : v;
    }));

    return out({ ok: true, order_id: data.order_id, nomor_antre: data.nomor_antre || '' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- kejadian funnel ---------- */

/** Tulis satu kejadian dari halaman pesanan. Dipanggil di dalam lock doPost. */
function catatKejadian(d) {
  if (!d.ev) return { ok: false, error: 'ev kosong' };
  var sh = sheetKejadian();
  var sekarang = new Date();
  var props = d.props;

  sh.appendRow([
    d.waktu || '',
    tanggalDari(d.waktu) || tanggalDari(sekarang),
    jamDari(d.waktu) || jamDari(sekarang),
    String(d.ev).slice(0, 40),
    String(d.sid || ''),
    String(d.vid || ''),
    String(d.kanal_asal || ''),
    String(d.ref || ''),
    String(d.utm_source || ''),
    String(d.utm_medium || ''),
    String(d.utm_campaign || ''),
    String(d.landing || ''),
    String(d.item_id || ''),
    String(d.order_id || ''),
    Number(d.nilai) || '',
    String(d.url || ''),
    String(d.layar || ''),
    String(d.bahasa || ''),
    (props && typeof props === 'object') ? JSON.stringify(props) : String(props || '')
  ]);
  return { ok: true, ev: String(d.ev) };
}

/** Nomor urut berikutnya untuk tanggal itu. Dipanggil di dalam lock. */
function nomorBerikut(sh, tgl) {
  var last = sh.getLastRow();
  if (last < 2) return 1;
  var vals = sh.getRange(2, 1, last - 1, KOLOM.length).getValues();
  var iWaktu = KOLOM.indexOf('waktu');
  var iKanal = KOLOM.indexOf('kanal');
  var n = 0;
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][iKanal]) !== 'kasir') continue;
    if (tanggalDari(vals[r][iWaktu]) !== tgl) continue;
    n += 1;
  }
  return n + 1;
}

/* ---------- baca ---------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!kunciCocok(p.key)) return balas({ ok: false, error: 'kunci salah' }, p.callback);

  var aksi = p.action || 'info';
  if (aksi === 'hariIni') {
    return balas(hariIni(p.tgl || tanggalDari(new Date())), p.callback);
  }
  if (aksi === 'analitik') {
    return balas(analitik(p.dari || hariLalu(7), p.sampai || tanggalDari(new Date())), p.callback);
  }
  if (aksi === 'kejadian') {
    return balas(kejadianTerakhir(p.batas), p.callback);
  }
  return balas({
    ok: true,
    pesan: 'Bodega order endpoint hidup',
    kunci_terpasang: !!kunci()
  }, p.callback);
}

/**
 * Pesanan satu tanggal, plus ringkasan per kanal.
 * Dipakai kasir untuk konfirmasi kiriman dan untuk daftar "hari ini".
 */
function hariIni(tgl) {
  var sh = sheet();
  var last = sh.getLastRow();
  var hasil = { ok: true, tgl: tgl, n: 0, total: 0, ringkas: {}, baris: [] };
  if (last < 2) return hasil;

  var vals = sh.getRange(2, 1, last - 1, KOLOM.length).getValues();
  var i = {};
  KOLOM.forEach(function (k, idx) { i[k] = idx; });

  for (var r = 0; r < vals.length; r++) {
    var row = vals[r];
    if (tanggalDari(row[i.waktu]) !== tgl) continue;

    var kanal = String(row[i.kanal] || 'web');
    var total = Number(row[i.total]) || 0;

    if (!hasil.ringkas[kanal]) hasil.ringkas[kanal] = { n: 0, total: 0 };
    hasil.ringkas[kanal].n += 1;
    hasil.ringkas[kanal].total += total;
    hasil.n += 1;
    hasil.total += total;

    hasil.baris.push({
      nomor_antre: row[i.nomor_antre] || '',
      waktu: jamDari(row[i.waktu]),
      order_id: String(row[i.order_id] || ''),
      kanal: kanal,
      tipe: String(row[i.tipe] || ''),
      meja: String(row[i.meja] || ''),
      nama: String(row[i.nama] || ''),
      wa: String(row[i.wa] || ''),
      no_ref: String(row[i.no_ref] || ''),
      status_bayar: String(row[i.status_bayar] || ''),
      kemasan: Number(row[i.kemasan]) || 0,
      item_detail: String(row[i.item_detail] || ''),
      total: total
    });
  }

  hasil.baris.sort(function (a, b) {
    return (Number(a.nomor_antre) || 0) - (Number(b.nomor_antre) || 0);
  });
  return hasil;
}

/* ---------- util ---------- */

/** Sel tanggal bisa berupa Date (Sheets mengonversi) atau teks ISO. */
function tanggalDari(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  var s = String(v);
  var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function jamDari(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'HH:mm');
  }
  var s = String(v);
  var m = s.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function kunci() {
  return PropertiesService.getScriptProperties().getProperty('RAHASIA') || '';
}

/* ---------- ringkasan funnel (dibaca dasbor.html) ---------- */

/** Tab kejadian, dibuat kalau belum ada (hanya saat menulis). */
function sheetKejadian() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_KEJADIAN);
  if (!sh) sh = ss.insertSheet(TAB_KEJADIAN);
  if (sh.getLastRow() === 0) {
    sh.appendRow(KOLOM_KEJADIAN);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, KOLOM_KEJADIAN.length).setFontWeight('bold');
  }
  return sh;
}

/** Tab kejadian untuk dibaca; null kalau belum pernah ada kejadian. */
function tabKejadian() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_KEJADIAN) || null;
}

function hariLalu(n) {
  var d = new Date();
  d.setDate(d.getDate() - (Math.max(1, Number(n) || 7) - 1));
  return tanggalDari(d);
}

function uniq(obj) {
  return Object.keys(obj).length;
}

/** Nama produk diambil dari props kejadian, supaya dasbor tidak menampilkan id saja. */
function namaDariProps(props) {
  try { return String(JSON.parse(String(props || '{}')).nama || ''); }
  catch (e) { return ''; }
}

/**
 * Ringkasan funnel + asal kunjungan untuk dasbor.
 * dari/sampai: 'yyyy-MM-dd' inklusif. Sesi dihitung unik per langkah,
 * jadi satu orang yang membuka dua produk tetap terhitung satu di langkah itu.
 */
function analitik(dari, sampai) {
  var hasil = {
    ok: true, dari: dari, sampai: sampai, baris: 0, terpotong: false,
    kpi: { sesi: 0, orang: 0, pesanan: 0, omzet: 0, konfirmasi: 0, fab: 0, detik: 0 },
    langkah: [], kanal: [], harian: [], produk: []
  };
  var sh = tabKejadian();
  if (!sh) { hasil.pesan = 'Belum ada kejadian tercatat.'; return hasil; }

  var last = sh.getLastRow();
  if (last < 2) { hasil.pesan = 'Belum ada kejadian pada rentang ini.'; return hasil; }

  var BATAS = 20000;                 // batas aman kuota Apps Script per permintaan
  var mulai = 2, n = last - 1;
  if (n > BATAS) { mulai = last - BATAS + 1; n = BATAS; hasil.terpotong = true; }

  var vals = sh.getRange(mulai, 1, n, KOLOM_KEJADIAN.length).getValues();
  var i = {};
  KOLOM_KEJADIAN.forEach(function (k, idx) { i[k] = idx; });

  var LANGKAH = ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'form_start', 'place_order', 'confirm_wa'];
  var langkah = {}, kanal = {}, kanalSesi = {}, orderSid = {}, harian = {}, produk = {};
  var sesi = {}, orang = {}, nPergi = 0, detikTotal = 0;

  for (var r = 0; r < vals.length; r++) {
    var row = vals[r];
    var tgl = tanggalDari(row[i.tanggal]) || tanggalDari(row[i.waktu]);
    if (!tgl) continue;
    if (dari && tgl < dari) continue;
    if (sampai && tgl > sampai) continue;
    hasil.baris += 1;

    var ev = String(row[i.ev] || '');
    var sid = String(row[i.sid] || '') || ('-' + r);      // kejadian tanpa id tetap dihitung
    var vid = String(row[i.vid] || '') || sid;
    var nilai = Number(row[i.nilai]) || 0;

    sesi[sid] = 1;
    orang[vid] = 1;

    if (!harian[tgl]) harian[tgl] = { tgl: tgl, sesi: {}, pesanan: 0, omzet: 0, konfirmasi: 0 };
    harian[tgl].sesi[sid] = 1;

    if (!langkah[ev]) langkah[ev] = { n: 0, sesi: {} };
    langkah[ev].n += 1;
    langkah[ev].sesi[sid] = 1;

    if (ev === 'page_view') {
      // satu sesi bisa punya dua page_view (tanpa tanda, lalu lewat tautan
      // bertanda); yang dipakai adalah yang terakhir, sama seperti di klien,
      // supaya jumlah sesi per kanal tidak melebihi total sesi.
      kanalSesi[sid] = String(row[i.kanal_asal] || 'Direct');
    }

    if (ev === 'place_order') {
      hasil.kpi.pesanan += 1;
      hasil.kpi.omzet += nilai;
      harian[tgl].pesanan += 1;
      harian[tgl].omzet += nilai;
      if (!orderSid[sid]) orderSid[sid] = { n: 0, omzet: 0 };
      orderSid[sid].n += 1;
      orderSid[sid].omzet += nilai;
    }

    if (ev === 'confirm_wa') { hasil.kpi.konfirmasi += 1; harian[tgl].konfirmasi += 1; }
    if (ev === 'wa_fab') hasil.kpi.fab += 1;

    if (ev === 'session_end') {
      var d = 0;
      try { d = Number(JSON.parse(String(row[i.props] || '{}')).detik) || 0; } catch (e2) { d = 0; }
      if (d > 0) { detikTotal += d; nPergi += 1; }
    }

    if (ev === 'view_item' || ev === 'add_to_cart') {
      var iid = String(row[i.item_id] || '');
      if (!iid && ev === 'add_to_cart') {
        try { iid = String((JSON.parse(String(row[i.props] || '{}')).id) || ''); } catch (e3) {}
      }
      if (iid) {
        if (!produk[iid]) produk[iid] = { id: iid, nama: iid, lihat: {}, cart: {} };
        produk[iid][ev === 'view_item' ? 'lihat' : 'cart'][sid] = 1;
        var nm = namaDariProps(row[i.props]);
        if (nm) produk[iid].nama = nm;
      }
    }
  }

  hasil.kpi.sesi = uniq(sesi);
  hasil.kpi.orang = uniq(orang);
  hasil.kpi.detik = nPergi ? Math.round(detikTotal / nPergi) : 0;

  hasil.langkah = LANGKAH.map(function (ev) {
    var d = langkah[ev] || { n: 0, sesi: {} };
    return { ev: ev, n: d.n, sesi: uniq(d.sesi) };
  });

  // Kanal dihitung setelah semua baris terbaca: sesi masuk ke kanal dari
  // page_view terakhirnya, pesanan menyusul ke kanal yang sama.
  Object.keys(kanalSesi).forEach(function (sid) {
    var nama = kanalSesi[sid];
    if (!kanal[nama]) kanal[nama] = { kanal: nama, sesi: {}, pesanan: 0, omzet: 0 };
    kanal[nama].sesi[sid] = 1;
  });
  Object.keys(orderSid).forEach(function (sid) {
    var nama = kanalSesi[sid] || 'Tak diketahui';
    if (!kanal[nama]) kanal[nama] = { kanal: nama, sesi: {}, pesanan: 0, omzet: 0 };
    kanal[nama].pesanan += orderSid[sid].n;
    kanal[nama].omzet += orderSid[sid].omzet;
  });

  hasil.kanal = Object.keys(kanal).map(function (k) {
    var d = kanal[k];
    return { kanal: k, sesi: uniq(d.sesi), pesanan: d.pesanan, omzet: d.omzet };
  }).sort(function (a, b) { return b.sesi - a.sesi; });

  hasil.harian = Object.keys(harian).sort().map(function (t) {
    var d = harian[t];
    return { tgl: t, sesi: uniq(d.sesi), pesanan: d.pesanan, omzet: d.omzet, konfirmasi: d.konfirmasi };
  });

  hasil.produk = Object.keys(produk).map(function (id) {
    var d = produk[id];
    return { id: id, nama: d.nama, lihat: uniq(d.lihat), cart: uniq(d.cart) };
  }).sort(function (a, b) {
    return (b.lihat + b.cart) - (a.lihat + a.cart);
  }).slice(0, 12);

  return hasil;
}

/** Kejadian terakhir mentah — untuk memastikan pelacakan benar-benar masuk. */
function kejadianTerakhir(batas) {
  var sh = tabKejadian();
  if (!sh) return { ok: true, baris: [] };
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, baris: [] };

  var n = Math.min(Math.max(Number(batas) || 50, 1), 200);
  var mulai = Math.max(2, last - n + 1);
  var vals = sh.getRange(mulai, 1, last - mulai + 1, KOLOM_KEJADIAN.length).getValues();

  var baris = vals.map(function (row) {
    var o = {};
    KOLOM_KEJADIAN.forEach(function (k, idx) { o[k] = row[idx]; });
    return o;
  }).reverse();
  return { ok: true, baris: baris };
}

/** Kalau RAHASIA belum diisi, endpoint sengaja dibiarkan terbuka saat awal pasang. */
function kunciCocok(kiriman) {
  var asli = kunci();
  if (!asli) return true;
  return String(kiriman || '') === asli;
}

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB);
  if (!sh) sh = ss.insertSheet(TAB);

  if (sh.getLastRow() === 0) {
    sh.appendRow(KOLOM);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, KOLOM.length).setFontWeight('bold');
  } else {
    // tambah kolom yang belum ada tanpa menggeser data lama
    var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var kurang = [];
    KOLOM.forEach(function (k) { if (head.indexOf(k) === -1) kurang.push(k); });
    if (kurang.length) {
      sh.getRange(1, head.length + 1, 1, kurang.length).setValues([kurang]).setFontWeight('bold');
    }
  }
  return sh;
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** JSON, atau JSONP kalau ada ?callback= — halaman statis tidak bisa membaca CORS. */
function balas(obj, callback) {
  if (callback && /^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out(obj);
}

/**
 * Ringkasan harian untuk rekonsiliasi dengan Sanang.
 * Jalankan manual dari editor, atau pasang trigger harian.
 * Menulis ke sheet "Harian": tanggal, kanal, jumlah pesanan, omzet.
 */
function ringkasanHarian() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = sheet();
  var semua = src.getDataRange().getValues();
  if (semua.length < 2) return;

  var head = semua[0];
  var iWaktu = head.indexOf('waktu');
  var iKanal = head.indexOf('kanal');
  var iTotal = head.indexOf('total');

  var perHari = {};
  for (var r = 1; r < semua.length; r++) {
    var row = semua[r];
    var hari = tanggalDari(row[iWaktu]);
    if (!hari) continue;
    var kanal = row[iKanal] || 'web';
    var kunciBaris = hari + '|' + kanal;
    if (!perHari[kunciBaris]) perHari[kunciBaris] = { hari: hari, kanal: kanal, n: 0, total: 0 };
    perHari[kunciBaris].n += 1;
    perHari[kunciBaris].total += Number(row[iTotal]) || 0;
  }

  var tujuan = ss.getSheetByName('Harian');
  if (!tujuan) tujuan = ss.insertSheet('Harian');
  tujuan.clear();
  tujuan.appendRow(['tanggal', 'kanal', 'jumlah_pesanan', 'omzet']);
  Object.keys(perHari).sort().forEach(function (k) {
    var d = perHari[k];
    tujuan.appendRow([d.hari, d.kanal, d.n, d.total]);
  });
}
