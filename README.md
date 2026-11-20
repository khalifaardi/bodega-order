# Bodega Pizzeria — aplikasi pesanan

Satu halaman: menu → keranjang → data pelanggan → kirim ke WhatsApp Bodega.
Tanpa server, tanpa langganan, tanpa aplikasi tambahan. Jalan di HP dan desktop.

## Alur

1. Pelanggan buka tautan.
2. Lihat menu, tekan **+** untuk menambah.
3. **Lanjut** → cek item, isi nama, nomor WhatsApp, cara ambil, dan **tahu Bodega dari mana**.
   - *Reservasi meja*: tanggal, jam, jumlah orang.
   - *Kurir sendiri*: jam kurir pelanggan ambil di toko (paling cepat 45 menit, karena pizza butuh ~30 menit). Alamat tidak ditanyakan di sini — dikirim di chat.
   - *Ambil sendiri*: perkiraan jam ambil.
4. **Kirim pesanan** → pesanan disimpan dulu, baru halaman pembayaran terbuka.
5. Halaman pembayaran menampilkan QRIS dengan nominal terisi otomatis. Di bawahnya ada tombol **Konfirmasi lewat WhatsApp** yang membuka chat berisi ringkasan pesanan.

Reservasi tidak menampilkan QRIS — bayar di tempat.

## Mengubah menu

Semua ada di **`menu.js`** — nama, harga, deskripsi, dan info toko. Harga ditulis penuh: `80000` = Rp80.000.

```js
{ id: "hhr", nama: "Hot Honey Ricotta", harga: 80000, tag: "fav",
  ket: "Pomodoro, mozzarella, ..." }
```

`tag`: `"new"` (label Baru), `"fav"` (Favorit), `"pick"` (Pilihan Bodega), atau kosongkan.
Jangan ganti `id` setelah dipakai — dipakai untuk menghitung keranjang.

## QRIS — nominal otomatis

Ada dua cara, dan yang pertama lebih baik.

**A. QRIS dinamis (nominal terisi sendiri).** Isi `qrisPayload` di `menu.js` dengan
string QRIS statis milik Bodega — string panjang yang dimulai `000201010211...`
dan diakhiri 4 huruf/angka CRC. Halaman akan membuat QR baru dengan nominal sesuai
total pesanan setiap kali, langsung di browser pelanggan.

Cara mengambil string itu: scan QRIS Bodega yang ada di kasir pakai aplikasi
pembaca QR yang bisa menampilkan teks (bukan aplikasi bank), lalu salin seluruh
string-nya. Atau kirim foto QRIS-nya, nanti dibacakan.

**B. Gambar statis (cadangan).** Taruh file **`qris.png`** di folder ini. Pelanggan
mengetik nominalnya sendiri.

Kalau dua-duanya kosong, halaman menampilkan instruksi minta kode lewat WhatsApp —
tidak error.

### Nomor pesanan di dalam QR (opsional, uji dulu)

Set `qrisBillRef: true` di `menu.js` dan nomor pesanan ikut masuk ke tag 62
(Bill Number) — berguna kalau laporan merchant menampilkan kolom referensi.

Cara mengujinya, berurutan, jangan lompat:

1. **Struktur** — `node tools/uji-qris.js` (harus lolos semua).
2. **Scan tanpa bayar** — buka halaman bayar di HP, scan dari HP lain pakai
   aplikasi bank/e-wallet. Layar konfirmasi harus menampilkan
   BODEGA PIZZERIA, nominal benar, dan (kalau didukung aplikasinya) nomor pesanan.
   **Jangan tekan bayar.**
3. **Satu transaksi Rp1.000** — bayar sungguhan, lalu cek di aplikasi merchant BRI:
   apakah nomor pesanan muncul di detail transaksi atau laporan.
4. Kalau ada aplikasi yang gagal scan atau nominal tidak muncul → set balik
   `qrisBillRef: false`. Jangan dipaksakan.

Risikonya: sebagian acquirer menolak sub-tag yang tidak dikenal di tag 62.
Karena itu langkah 2 dan 3 wajib sebelum dipakai untuk pesanan sungguhan.

### Yang perlu diingat soal QRIS dinamis

- Nominal ditulis di dalam kode QR (tag 54), jadi pelanggan tidak perlu mengetik.
- **Tidak ada verifikasi otomatis.** Siapa pun tetap bisa mengubah nominal sebelum
  membayar, dan tidak ada notifikasi masuk ke sistem — konfirmasi tetap dari
  notifikasi aplikasi merchant. Untuk pembayaran yang benar-benar terverifikasi,
  itu butuh payment gateway (Midtrans/Xendit/Duitku) dengan webhook.
- Tidak ada biaya tambahan: ini murni menyusun ulang payload EMVCo di sisi browser,
  bukan layanan pihak ketiga.

## Tampilan menu

Menu memakai **grid foto** (2 kolom di ponsel, 3 di tablet, 4 di desktop) mengikuti pola
menu Wolt/Deliveroo: foto besar, nama, harga. Mengetuk kartu membuka **detail** —
lembar bawah di ponsel, dialog di desktop — berisi foto besar, deskripsi, pemilih
jumlah, dan tombol **Tambah ke pesanan**.

Saus cocol tetap berupa baris ringkas dengan tombol **+** (tanpa foto, dan memang barang
terpisah).

**Topping tidak lagi jadi bagian sendiri di menu.** Topping dipilih di dalam detail pizza:
centang berapa pun, harganya langsung menambah harga pizza, dan hasilnya masuk keranjang
sebagai satu baris — misalnya *"1 × Pepperoni + Mozzarella, Jalapeño — Rp91.000"*.
Pizza yang sama dengan topping berbeda menjadi baris terpisah, dan biaya kemasan tetap
dihitung per pizza (bukan per topping).

Item tanpa foto menampilkan huruf awal sebagai penanda sampai fotonya tersedia.

Ukuran huruf memakai lantai 15px (tactile-design): nama 16px, harga dan baris
keranjang 15px, chip 14–15px. Di layar 320px label menu ikut mengecil agar tetap
di dalam kartu.

Pizza **tidak** punya tombol **+** di kartu: satu-satunya jalan masuk adalah membuka
detailnya, supaya daftar topping selalu terlihat. Item lain (sampingan, minuman, saus)
tetap punya **+** untuk tambah cepat.

Kalau pizza yang sama sudah ada di keranjang, mengetuknya lagi memunculkan pilihan:
**tambah pizza baru** (topping berbeda) atau **ubah** salah satu yang sudah ada. Pizza
dengan topping berbeda disimpan sebagai baris terpisah.

Topping juga bisa diubah dari keranjang: tiap baris pizza punya tautan **Ubah topping**
(baris saus: **Ubah saus**) yang membuka detail dengan pilihan sebelumnya sudah tercentang.
Kalau satu baris berisi lebih dari satu pizza, muncul **Ubah satu** — satu unit keluar dari
baris itu, diubah toppingnya, dan sisanya tetap di baris semula. Jadi dua pizza sama dengan
topping berbeda bisa diatur satu per satu.

Sheet di ponsel bisa ditarik: pegangan di atas atau area foto, geser ke bawah melewati
min(64px, 15% tinggi) atau sentakan cepat untuk menutup; kurang dari itu kembali ke tempatnya.

Di halaman pesanan, tiap baris keranjang menampilkan foto kecil item (kalau ada)
supaya pelanggan ingat apa yang dipesan.


### Label menu

Label **Regular's Fav** dan **Bodega's Recommendation** bukan teks yang digambar ulang —
keduanya dipotong langsung dari menu cetak dan disimpan sebagai `img/label-fav.png` dan
`img/label-pick.png` (3x, latar putih bersih). Tinggal ganti berkasnya kalau desain label
berubah. Label **Baru** masih berupa chip teks.



## Perbaikan dari QA (Nov 2026)

- Keranjang disimpan di sessionStorage: refresh tidak menghapus pesanan.
- Tombol Back menutup sheet dulu, lalu kembali ke menu; tidak keluar situs.
- ID pesanan memuat jam-menit-detik, bukan 4 angka acak (dulu ~2% bentrok/hari).
- `waktu` dikirim sebagai waktu lokal dengan offset (+08:00), bukan UTC.
- Catatan "belum tercatat" sekarang tampil justru saat belum ada `LOG_ENDPOINT`.
- `sessionStorage`/`localStorage` dibungkus try/catch agar mode privat tidak mematikan alur.
- Sumber pesanan sekarang dropdown dan wajib diisi (dulu chip, sempat opsional).
- Label tombol kirim menyebut QRIS + nominal untuk mode bayar.
- Halaman pembayaran memakai label “Belum dibayar”, bukan centang selesai.


## Perbaikan (Nov 2026, lanjutan)

- **Simpan kode QR**: tombol di halaman pembayaran mengunduh PNG berisi kode QR,
  nominal, dan nomor pesanan. Digambar ulang ke kanvas baru supaya berkas yang
  tersimpan tetap berguna walau halaman sudah ditutup.
- **Keranjang dikosongkan setelah pesanan dibuat**, jadi memuat ulang halaman
  tidak membawa item pesanan lama ke pesanan berikutnya.
- **Foto di detail item penuh selebar sheet** (dulu mengikuti `max-height` dan
  menyisakan ruang kosong di kanan).


## Kasir (pesanan walk-in)

`kasir.html` — halaman staf untuk mencatat pesanan di tempat. Tanpa foto, tanpa
halaman pembayaran, satu layar untuk semua item.

- **Cari menu** di kepala halaman; mengetik menyaring semua bagian sekaligus.
- **Makan di tempat / dibawa pulang** ada di dalam sheet pesanan (bukan di kepala
  halaman). Makan di tempat tidak kena biaya kemasan dan memunculkan field nomor meja.
- Sheet pesanan bisa digeser ke bawah untuk menutup, sama seperti detail item di
  situs pelanggan.
- Kolom terpisah: **nomor meja**, **nama** (opsional), **WhatsApp** (opsional, prefiks
  +62), **no. referensi Sanang** (opsional), dan tahu dari mana (opsional).
- Tidak ada pilihan metode bayar: pembayaran terjadi di POS Sanang, dan yang dicatat
  hanya nomor referensinya.
- Item ditambah lewat stepper; pizza punya tautan **Topping** (chips saja, tanpa gambar).
- Tiket: nomor antre harian (001, 002, …), meja/nama opsional, **tahu dari mana opsional**,
  metode bayar (tunai/QRIS).
- Harga, biaya kemasan, dan daftar topping dibaca dari `menu.js` — sama persis dengan situs
  pelanggan, tidak ada angka kedua yang perlu dijaga.

**Satu sumber data.** `index.html` (kanal `web`) dan `kasir.html` (kanal `kasir`) mengirim
ke `LOG_ENDPOINT` yang sama. Lihat `tools/catat.gs`: satu sheet, kolom `kanal` yang
membedakan, plus `ringkasanHarian()` untuk rekonsiliasi dengan Sanang.

Selama `LOG_ENDPOINT` kosong, pesanan kasir disimpan di perangkat (badge "belum terkirim"
di kepala halaman) dan dikirim ulang saat halaman dibuka.

## Sinkron ke sheet (kirim, lalu baca balik)

Kirim ke Apps Script memakai `mode: "no-cors"`, jadi browser tidak bisa membaca
balasannya — "terkirim" hanya berarti "tidak melempar galat". Karena itu alurnya
tidak mempercayai request, melainkan memeriksa barisnya:

1. `POST` pesanan (tanpa bisa dibaca balasannya).
2. Baca `?action=hariIni&tgl=…` lewat JSONP (Apps Script tidak mengirim header CORS,
   jadi `<script>` lebih andal daripada `fetch`).
3. Kalau `order_id` muncul di daftar, pesanan dianggap benar-benar masuk dan
   dihapus dari antrean. Kalau tidak, tetap di antrean dan dicoba lagi.

Antrean dikirim ulang saat halaman dibuka, saat peristiwa `online`, saat tab kembali
aktif, dan tiap 60 detik selama tab terlihat (tab tersembunyi tidak memanggil apa pun,
supaya kuota Apps Script tidak habis).

**Nomor antre diberikan server, bukan perangkat.** `doPost` menghitung nomor urut
pesanan `kanal: "kasir"` pada tanggal itu di dalam `LockService`, jadi dua tablet tidak
bisa sama-sama memberi nomor 001. Selama pesanan belum terkonfirmasi, halaman
menampilkan nomor sementara dan label "Belum terkirim"; nomor resminya muncul di
daftar hari ini setelah tersinkron.

**Daftar "Hari ini"** (tombol di kepala halaman) membaca `hariIni` dari sheet, jadi
semua perangkat melihat daftar yang sama, ditambah baris yang masih mengantre di
perangkat itu sendiri (chip merah "belum").

### Kunci endpoint

`doPost`/`doGet` memeriksa `key` terhadap Script Property `RAHASIA`. Isi `LOG_KEY`
di `kasir.js` dan `app.js` dengan nilai yang sama. Kalau `RAHASIA` kosong, endpoint
terbuka — jadi isi sebelum URL dibagikan. Ini bukan pengaman sungguhan (berkas
klien publik), hanya penangkal kiriman asal-asalan; pengaman sesungguhnya adalah
Cloudflare Access di depan `kasir.html`.

Halaman ini `noindex` — jangan ditautkan dari menu pelanggan.

## Cache

GitHub Pages mengirim `cache-control: max-age=600`, jadi berkas bisa tertahan di
browser sampai 10 menit. Setiap kali mengubah CSS/JS: jalankan `tools/versi.sh` tepat sebelum push —
skrip itu menulis token `?v=` baru ke `index.html` dan `bayar.html` dan
meng-commit-nya sendiri, jadi browser selalu mengambil berkas terbaru.
Untuk sekali lihat, buka tautannya dengan parameter acak, mis. `?v=2`.

## Skor Google Maps

Header menampilkan skor dan jumlah ulasan dari Google Maps, ditautkan ke lokasi.
Datanya di `menu.js`: `rating`, `ulasan`, `maps` (pakai tautan `?cid=` supaya
tidak bergantung pada place_id). Perbarui angkanya kalau ulasan bertambah.

## Ulasan

Bagian ulasan bisa digeser ke samping (scroll-snap), bukan menumpuk ke bawah:
1 kartu per layar di ponsel (86% lebar, kartu berikutnya mengintip), 2 di tablet,
3 di desktop. Titik di bawah kartu bisa diklik dan ikut bergeser saat diseret.


Bagian "Apa kata mereka" membaca `ULASAN` di `menu.js`. Tiap entri: `bintang`,
`teks`, `nama`, `kapan`, `sumber` (Google / GrabFood), opsional `terjemahan`.

- **Google**: skor dan ulasan ditarik manual dari listing (API Serper, endpoint
  `reviews` dengan `cid`). Perbarui angkanya kalau ada ulasan baru.
- **GrabFood**: belum ada API publik dan halaman Grab memblokir bot (403) serta
  tidak bisa di-iframe. Ulasan Grab ditempel manual: salin teksnya dari Grab
  Merchant, lalu tambahkan entri dengan `sumber: "GrabFood"`.

## Biaya kemasan

Berlaku untuk **Diantar** dan **Ambil sendiri**; reservasi (makan di tempat) tidak dikenakan.

- Rp5.000 per pizza
- Rp3.000 per item non-pizza
- maksimum **Rp10.000 per transaksi**

Angka ada di `menu.js` (`boxPizza`, `boxLain`, `boxMaks`). Pizza dikenali dari
tanda `pizza: true` pada bagian menu, jadi kalau nanti ada section pizza baru,
tambahkan tanda itu.

## Foto menu

Foto disimpan di `img/` sebagai WebP 400×400, latar putih, nama berkas = `id` di
`menu.js`. Kalau sebuah item tidak punya foto, kartunya tetap rapi karena kolom
gambar tetap disediakan.

Mengganti atau menambah foto:

1. Taruh foto asli di folder mana pun.
2. Buka `tools/siapkan-foto.py`, tambahkan id SKU dan nomor fotonya di `PICKS`.
3. Jalankan `python3 tools/siapkan-foto.py` — skrip memotong persegi, menormalkan
   latar jadi putih, menyeragamkan ukuran piring, lalu mengekspor WebP.

Foto dimuat lambat (`loading="lazy"`), jadi halaman tetap ringan walau ada 19 foto.

## Mencatat pesanan ke Google Sheet (endpoint log)

Dua pintu di satu endpoint: `doPost` menambah satu baris (nomor antre diberikan server,
di dalam `LockService`), `doGet?action=hariIni` mengembalikan pesanan satu tanggal lewat
JSONP. Kode lengkapnya `tools/catat.gs` — jangan tulis ulang versi ringkas: kolomnya harus
sama dengan yang dikirim `app.js` dan `kasir.js` (22 kolom, daftar `KOLOM`).

1. Buat Google Sheet baru, mis. "Bodega — Pesanan". Tab `Pesanan` dibuat skrip sendiri.
2. **Extensions → Apps Script**, hapus isi default, tempel seluruh `tools/catat.gs`, simpan.
3. **Project Settings** (roda gigi) → **Script properties** → tambah `RAHASIA` = kunci acak
   (`openssl rand -hex 24`).
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**.
   Salin URL yang berakhiran `/exec`.
5. Isi URL itu ke `LOG_ENDPOINT` di **`app.js` dan `kasir.js`**, dan kunci yang sama ke
   `LOG_KEY` di kedua berkas. Jalankan `tools/versi.sh`, lalu push.
6. Uji tanpa membuka halaman:

```bash
curl -s -X POST "<URL-EXEC>" -H "Content-Type: text/plain" -d '{"key":"<RAHASIA>","order_id":"TES-1","kanal":"web","waktu":"2026-11-19T09:00:00+08:00","total":42000,"sumber":"Lainnya","sumber_lain":"undangan teman"}'
curl -s "<URL-EXEC>?action=hariIni&tgl=2026-11-19&key=<RAHASIA>&callback=cb"
```

Baris harus muncul di sheet dan `hariIni` harus memuat `TES-1`. Hapus baris uji setelahnya.

7. Setiap kali skrip diubah: **Deploy → Manage deployments → ✏️ → Version: New version**.
   URL tetap sama. "New deployment" membuat URL baru dan halaman jadi putus.

Kolom `sumber_lain` menyimpan teks bebas saat pelanggan atau kasir memilih "Lainnya"
(pilihan di `SUMBER`); `nomor_antre` hanya terisi untuk `kanal: "kasir"`. Kalau sheet sudah
ada, skrip menambahkan sendiri kolom yang belum ada **di ujung** baris judul — jangan
menyisipkan kolom di tengah, karena `nomorBerikut` dan `hariIni` membaca kolom menurut posisi.

Batasannya: `RAHASIA` bukan autentikasi — berkas klien publik, jadi siapa pun yang membuka
halaman bisa membaca `LOG_KEY`. Ia hanya menahan kiriman asal-asalan. Kuota Apps Script juga
membatasi frekuensi, dan karena itu poller berhenti saat tab disembunyikan.

Pesanan tetap dikirim ke WhatsApp walau pencatatan gagal — yang gagal disimpan di perangkat
pelanggan dan dicoba ulang saat halaman dibuka lagi.

## Pindai struk Sanang (OCR di perangkat, tanpa server)

Kasir bisa memfoto struk POS Sanang dan mengisi tiket dari foto itu. Yang terbaca:
nomor struk (`#02-418` → `no_ref`), nama tamu (baris di bawah nomor, apa adanya),
waktu struk, jenis pesanan (Dine In / Take Away), petugas + lantai (masuk `pesan`),
dan tiap baris `N x Nama Item` yang dipetakan ke SKU menu.

**Alat:** Tesseract.js + `eng.traineddata`, di-*vendor* di `vendor/tesseract/` (~5,9 MB,
dimuat hanya saat tombol "Pindai struk" ditekan — bukan bagian dari muatan halaman).
Tidak ada permintaan ke pihak ketiga, tidak ada API key, jalan offline setelah sekali muat.

**Aturan yang tidak boleh dilanggar:** hasil OCR **tidak pernah** langsung tersimpan.
Foto membuka lembar tiket yang sudah terisi, dengan ringkasan "Struk terbaca" berisi
ref, waktu, dan tiap baris beserta persentase kecocokan; baris yang tidak cocok ditandai
merah untuk dipilih manual. Kasir memeriksa jumlah (OCR kerap salah angka: contoh nyata
`1 x` terbaca `4 x`), nomor meja, lalu menekan Simpan.

Catatan teknis yang mahal kalau dilupakan:

- **Potong ke kertas dulu.** Foto struk hampir selalu di atas meja ramai; tanpa crop,
  Tesseract membaca pola meja stainless sebagai teks dan hasilnya sampah. `siapkanGambar()`
  mencari kotak terang terbesar lalu memotongnya sebelum OCR.
- **`tessedit_pageseg_mode: "4"`** (satu kolom) — mode otomatis membaca latar sebagai layout.
- Jangan tambahkan autocontrast/upscale buta: percobaan itu justru membuat hasil lebih buruk
  daripada gambar asli yang dipotong. Skala 1,6× setelah crop sudah cukup.
- Pencocokan nama memakai Levenshtein 0–1; ambang terima 0,82 dan peringatan "cek" di bawah
  0,90. "The Chicken Parml" (l untuk i) dan "Margherita chevaa" tetap cocok, jadi OCR tidak
  perlu sempurna.
- Tanggal struk bisa M/D atau D/M; `10/31/26` jelas M/D, format ambigu diperlakukan M/D.
  **Waktu pesanan memakai jam struk**, bukan jam pindai — konsekuensinya pesanan struk lama
  masuk ke tanggal itu di sheet, dan lembar tiket memperingatkan bila bukan hari ini.
- Nama tamu diambil satu baris utuh (`Sassa M.12`) sesuai keputusan pemilik: `M.12` bukan
  nomor meja, jadi **meja tetap harus diisi kasir** (validasi dine-in sudah mewajibkannya).

## Kasir di belakang Cloudflare Access

`kasir.html` menulis uang: satu baris salah merusak rekonsiliasi dengan venue. `noindex`
hanya menyembunyikannya dari mesin pencari, bukan dari orang yang memegang tautannya. GitHub
Pages tidak punya password (Pages privat butuh Enterprise Cloud), jadi gerbangnya harus di
depan host: **Cloudflare Access dengan cakupan path** — gratis pada skala satu kedai.

Prasyarat yang paling sering terlewat: Access hanya menyaring lalu lintas yang **lewat DNS
domain itu sendiri**. DNS `bodega-pizzeria.shop` sekarang di Jagoan Hosting, jadi zone-nya
harus pindah ke Cloudflare dulu.

1. Cloudflare → **Add a site** → `bodega-pizzeria.shop` → paket **Free**.
2. Cloudflare memberi dua nameserver. Di Jagoan: **Domains → domain → Manage Nameservers →
   Use custom nameservers**, isi keduanya.
3. Tunggu status zone **Active** di Cloudflare (biasanya < 1 jam, paling lama 24 jam).
4. Cloudflare → **DNS** → buat ulang record yang sama:
   - `A` `@` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` — empat baris, **Proxied (oranye)**
   - `CNAME` `www` → `khalifaardi.github.io` — **Proxied (oranye)**
5. **SSL/TLS → Overview → Full**, bukan Full (strict). Cloudflare memegang sertifikat untuk
   pengunjung; sertifikat GitHub di belakang proxy bisa gagal diperbarui otomatis, dan mode
   Full tetap jalan kalau itu terjadi — Full (strict) akan memutus situs.
6. **Zero Trust → Access → Applications → Add an application → Self-hosted**:
   - Name: `Bodega kasir`
   - Public hostname: `bodega-pizzeria.shop`, path `kasir.html*`
   - Session duration: 1 week (atau 24 jam kalau lebih ketat)
   - Policy **Allow**, Include → **Emails** → email pemilik + staf yang boleh mencatat
   - Login method: **One-time PIN** (tanpa password, tidak butuh Google Workspace)
7. Uji di jendela private: `/kasir.html` harus memunculkan halaman login Cloudflare,
   sedangkan `/` terbuka seperti biasa. Halaman lain (menu, `bayar.html`) tidak ikut terkunci.

Yang tetap harus dikatakan ke pemilik: `LOG_KEY` masih terlihat di berkas publik, jadi
endpoint tulis bisa dipanggil siapa pun yang tahu URL + kuncinya. Access menjaga **halaman**,
bukan **endpoint**. Kalau nanti ada baris palsu, langkah berikutnya adalah memindahkan
`doPost` ke belakang Worker yang ikut memeriksa sesi Access. Alternatif "tanpa pindah DNS"
tidak ada — membiarkan kasir terbuka adalah pilihan lain, bukan solusi.

## Auto-reply WhatsApp

WhatsApp Business **tidak bisa** mengirim gambar otomatis di pesan sementara.
Yang bisa: auto-reply teks berisi tautan ke halaman QRIS.

Set di **WhatsApp Business → Pengaturan → Alat bisnis → Pesan tidak ada saat offline**:

> Terima kasih sudah pesan di Bodega. Pesananmu kami cek dulu ya.
> Bayar di sini: https://<domain>/bayar.html?amt=<nominal>&id=<nomor pesanan>

Kalau ingin QRIS benar-benar terkirim sebagai gambar otomatis, itu butuh
WhatsApp Cloud API (Meta) + template message — bisa dikerjakan nanti setelah
volume pesanan naik.

## Publikasi

Folder ini statis. Taruh di GitHub Pages, Netlify, atau Cloudflare Pages —
semua gratis. Tidak ada build step.

## QR untuk meja dan kotak pizza

`qr-meja.png` di folder ini berisi QR ke halaman pesanan. Cetak, tempel di meja
Sanang dan di setiap kotak pizza. Ganti URL di `tools/buat-qr.py` kalau domain berubah.

## Catatan teknis

- Setelah mengubah file, GitHub Pages butuh ~1 menit untuk build dan browser
  menyimpan cache ~10 menit. Perubahan tidak langsung terlihat — cek di jendela
  privat kalau ragu.
- Tautan dengan penanda asal: `?dari=lewat`, `?dari=ig` `?dari=tiktok` `?dari=threads`, `?dari=gmaps`, `?dari=teman`.
  Pilihan "tahu Bodega dari mana" langsung terisi otomatis, jadi data asal
  pelanggan tidak bergantung pada pelanggan mengisinya sendiri.
- Repo: github.com/khalifaardi/bodega-order (publik, tanpa data sensitif).
