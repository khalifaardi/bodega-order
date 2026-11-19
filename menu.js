/* ============================================================
   BODEGA PIZZERIA — DATA MENU
   Edit file ini saja untuk mengubah menu, harga, dan info toko.
   Harga dalam rupiah penuh: 80000 = Rp80.000
   ============================================================ */

const SHOP = {
  nama: "Bodega Pizzeria",
  alamat: "Jl. Opu Daeng Risadju No. 12, Mariso, Makassar",
  partner: "at Sanang Space",
  rating: 5.0,                    // skor Google Maps (per 17 Nov 2026)
  ulasan: 2,                      // jumlah ulasan Google
  maps: "https://www.google.com/maps?cid=13138472507495811387",
  grab: "https://app.grab.com/s/gJAeQXLC",   // tautan GrabFood milik kedai
  grabRating: 5.0,               // skor GrabFood (screenshot pemilik, 17 Nov 2026)
  grabUlasan: 22,                // 5,0 · 22 rating (dikonfirmasi dari aplikasi)
  wa: "6287784456676",          // nomor WhatsApp yang menerima pesanan (format 62…)
  jam: "",                       // contoh: "Setiap hari, 11.00–22.00"
  ongkir: 0,                     // 0 = ongkir dikonfirmasi lewat WhatsApp
  boxPizza: 5000,                // kemasan per pizza
  boxLain: 3000,                 // kemasan per item non-pizza
  boxMaks: 10000,                // batas biaya kemasan per transaksi
  qris: "qris.png",              // gambar QRIS statis (cadangan)
  // QRIS statis Bodega (NMID ID1026483436923, terminal A01). Nominal diisi otomatis.
  qrisBillRef: false,            // true = nomor pesanan ikut masuk ke tag 62 (uji dulu, lihat README)
  qrisPayload: "00020101021126580013ID.CO.BRI.WWW01189360000200180461980208180461980303UMI51440014ID.CO.QRIS.WWW0215ID10264834369230303UMI5204581253033605802ID5915BODEGA PIZZERIA6008MAKASSAR61059012562070703A016304F4C7",
};

const SECTIONS = [
  {
    id: "special",
    pizza: true,
    judul: "Special Pies",
    catatan: "One size, 28 cm. Fermented dough, baked to order.",
    items: [
      { id: "hhr", img: "img/hhr.webp?v=20261119", nama: "Hot Honey Ricotta", harga: 80000, tag: "fav",
        ket: "Pomodoro, mozzarella, pepperoni, ricotta, hot honey, parmagiana, EVOO." },
      { id: "dpep", img: "img/dpep.webp?v=20261119", nama: "Double Pepperoni", harga: 85000, tag: ["pick", "new"],
        ket: "Pomodoro, mozzarella, pepperoni, onion, parmesan, EVOO." },
      { id: "bpp", img: "img/bpp.webp", nama: "Beef Pastrami Pickles", harga: 88000, tag: "pick",
        ket: "Pomodoro, mozzarella, pastrami, pickled red onion & gherkins, honey mustard, parmagiana, EVOO." },
      { id: "tartufo", img: "img/tartufo.webp", nama: "Al Tartufo (Truffle)", harga: 90000, tag: "pick",
        ket: "Cream sauce, black pepper, mozzarella, truffle mushroom pâté, oregano, parmagiana." },
      { id: "jpep", img: "img/jpep.webp", nama: "Jalapeño Pepperoni", harga: 80000, tag: "new",
        ket: "Pomodoro, pepperoni, jalapeño, chili flakes, onion, parmesan, EVOO." },
      { id: "imb", img: "img/imb.webp", nama: "Italian Meatball Pie", harga: 85000, tag: "new",
        ket: "Pomodoro, mozzarella, beef meatballs, red onion, parsley, EVOO." },
      { id: "sbc", img: "img/sbc.webp", nama: "Smoked Beef Carbonara", harga: 80000,
        ket: "Cream sauce, black pepper, smoked beef carbonara, omega yolk, hollandaise." },
      { id: "godf", img: "img/godf.webp", nama: "Godfather", harga: 95000, tag: "new",
        ket: "Cream, mozzarella, italian beef, pepperoni, jalapeño, mushroom, parmesan." },
    ],
  },
  {
    id: "classic",
    pizza: true,
    judul: "Classic Pies",
    items: [
      { id: "marg", img: "img/marg.webp", nama: "Margherita Cheese", harga: 65000,
        ket: "Pomodoro, mozzarella, oregano, grana padano, EVOO." },
      { id: "pep", img: "img/pep.webp", nama: "Pepperoni", harga: 73000, tag: "fav",
        ket: "Pomodoro, mozzarella, pepperoni, onion, parmesan, EVOO." },
      { id: "wpep", img: "img/wpep.webp", nama: "White Pepperoni", harga: 73000, tag: "new",
        ket: "Cream sauce, oregano, pepperoni, hot honey, pesto, parmagiana, EVOO." },
      { id: "cmush", img: "img/cmush.webp", nama: "Creamy Mushroom", harga: 75000, tag: "fav",
        ket: "Cream sauce, black pepper, mozzarella, mushrooms, parmesan, EVOO." },
      { id: "marinara", img: "img/marinara.webp", nama: "Marinara Tradizionale", harga: 55000,
        ket: "Pomodoro, garlic infused, oregano, capers, fresh basil, EVOO." },
      { id: "tuna", img: "img/tuna.webp", nama: "Tuna Special", harga: 75000,
        ket: "Pomodoro, tuna, red onion, mozzarella, capers, parmesan, EVOO." },
    ],
  },
  {
    id: "sides",
    judul: "Sides & Desserts",
    items: [
      { id: "fries", img: "img/fries.webp", nama: "Bodega Fries", harga: 42000, tag: "pick",
        ket: "Fries, stracciatella cheese and chili oil." },
      { id: "parm", img: "img/parm.webp", nama: "The Chicken Parmi", harga: 59000,
        ket: "Chicken parm w/ mozz, fries." },
      { id: "parmSalad", img: "img/parmSalad.webp", nama: "The Chicken Parm + Salad", harga: 65000,
        ket: "Chicken parm w/ mozz, fries, + salad." },
      { id: "mozz", img: "img/mozz.webp", nama: "Mozzarella Sticks", harga: 35000,
        ket: "With warm marinara & hot honey." },
      { id: "meatball", img: "img/meatball.webp", nama: "Mom's Hearty Meatballs", harga: 58000,
        ket: "Beef meatballs, fries, halal vodka sauce (VHS)." },
      { id: "nutella", img: "img/nutella.webp", nama: "Nutella Pie", harga: 65000, tag: "pick",
        ket: "Sweet pie w/ nutella n ricotta dollops." },
    ],
  },
  {
    id: "minum",
    judul: "Drinks",
    items: [
      { id: "shamba", img: "img/shamba.webp", nama: "Shamba Cola", harga: 23000, ket: "Cola." },
      { id: "galigo", img: "img/galigo.webp", nama: "Galigo Lemon", harga: 22000, ket: "Lemon galigo taste." },
    ],
  },
  {
    id: "topping",
    judul: "Extra Toppings",
    catatan: "Charged per pizza. Tell us which pizza it goes on in the WhatsApp chat.",
    items: [
      { id: "top-mozz", nama: "Mozzarella", harga: 10000 },
      { id: "top-strac", nama: "Stracciatella", harga: 15000 },
      { id: "top-ricotta", nama: "Ricotta", harga: 12000 },
      { id: "top-pep", nama: "Pepperoni", harga: 12000 },
      { id: "top-beef", nama: "Smoked Beef", harga: 12000 },
      { id: "top-past", nama: "Pastrami", harga: 15000 },
      { id: "top-chick", nama: "Chick Parm", harga: 35000 },
      { id: "top-mush", nama: "Mushrooms", harga: 10000 },
      { id: "top-jal", nama: "Jalapeño", harga: 8000 },
      { id: "top-honey", nama: "Hot Honey", harga: 7000 },
      { id: "top-truffle", nama: "Truffle", harga: 15000 },
    ],
  },
  {
    id: "dips",
    judul: "Dips",
    catatan: "Rp7.000 per dip, or Rp15.000 for the House Dip Trio.",
    items: [
      { id: "dip-trio", nama: "House Dip Trio", harga: 15000, pilih: 3, dari: "dips",
        ket: "Choose three dips: hot honey, cream chives, creamy pesto." },
      { id: "dip-chives", nama: "Cream Chives", harga: 7000 },
      { id: "dip-honey", nama: "Hot Honey", harga: 7000 },
      { id: "dip-pesto", nama: "Creamy Pesto", harga: 7000 },
    ],
  },
];

// Pilihan "tahu Bodega dari mana" — dipakai untuk mengukur asal pelanggan.
// label  = nilai yang disimpan (kolom `sumber` di sheet + baris "Tahu Bodega dari" di pesan WhatsApp)
// en     = yang dilihat pelanggan di halaman berbahasa Inggris
const SUMBER = [
  { id: "lewat", label: "Jalan lewat / Sanang", en: "Walked past / Sanang" },
  { id: "ig", label: "Instagram", en: "Instagram" },
  { id: "tiktok", label: "TikTok", en: "TikTok" },
  { id: "threads", label: "Threads", en: "Threads" },
  { id: "gmaps", label: "Google Maps", en: "Google Maps" },
  { id: "teman", label: "Teman / rekomendasi", en: "Friend / recommendation" },
  // bebas: pelanggan menulis sendiri; halaman menampilkan kolom teks begitu ini dipilih
  { id: "lainnya", label: "Lainnya", en: "Other", bebas: true },
];

// Ulasan yang tampil di bawah menu. Google diambil dari listing (per 17 Nov 2026);
// ulasan GrabFood belum bisa ditarik otomatis — tempel manual di sini dengan
// sumber: "GrabFood" setelah pemilik menyalinnya dari aplikasi Grab Merchant.
const ULASAN = [
  // --- GrabFood (5,0 · 22 rating, dikutip dari aplikasi 17 Nov 2026) ---
  {
    bintang: 5, sumber: "GrabFood", nama: "Daril", kapan: "12 hari lalu",
    teks: "the BEST pizza in Makassar, OMG Smoky Peachesnya + Jalapeno sedap bangettt 👍 begitu juga dengan Smoked Beef Carbonaranya enak juga 👍. Semoga rasanya dan kualitasnya bisa bertahan selama-lamanya.....",
    pesan: "Smoky Peaches, Smoked Beef Carbonara",
  },
  {
    bintang: 5, sumber: "GrabFood", nama: "azizah", kapan: "24 hari lalu",
    teks: "mi favoritooo pizzanya always fresh and doughnya lembut bgtt, kali ini order yg nonpizza, meatball dan saus hvs nya kawinn bgt top markotopPP ⭐⭐⭐⭐",
    pesan: "Mom's Meatball",
  },
  {
    bintang: 5, sumber: "GrabFood", nama: "ika", kapan: "1 bulan lalu",
    teks: "Neapolitan pizza paling enak se Makassar. Chewy, rasanya balance, harganya juga oke 👌 Chicken parminya juga juicy tidak keras, umami dan kentangnya juga enak ❤️",
    pesan: "The Chicken Parmi, Hot Honey Ricotta",
  },
  // --- Google Maps ---
  {
    bintang: 5, sumber: "Google", nama: "ihwanul ramadhan", kapan: "4 minggu lalu",
    teks: "Pizzanya sangat enak & pelayanan sangat cepat.",
  },
  {
    bintang: 5, sumber: "Google", nama: "Jules Guinard", kapan: "4 minggu lalu",
    teks: "C’est difficile de trouver des bonnes pizza en Asie et encore plus dans des endroits peu touristiques, celle ci était particulièrement savoureuse !",
    terjemahan: "Sulit cari pizza enak di Asia, apalagi di tempat yang jarang wisatawan. Yang ini benar-benar lezat.",
  },
];
