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
var TZ = 'Asia/Makassar';

/** Kolom baru HARUS ditambahkan di ujung: baris lama tidak boleh bergeser. */
var KOLOM = [
  'waktu', 'order_id', 'kanal', 'tipe', 'status_bayar',
  'meja', 'nama', 'wa', 'no_ref',
  'pickup', 'tanggal', 'jam', 'pax', 'sumber', 'kasir',
  'total_menu', 'kemasan', 'total', 'item_detail', 'pesan',
  'nomor_antre', 'sumber_lain'
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
