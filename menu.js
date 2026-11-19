/* ============================================================
   BODEGA PIZZERIA — DATA MENU
   Edit file ini saja untuk mengubah menu, harga, dan info toko.
   Harga dalam rupiah penuh: 80000 = Rp80.000
   ============================================================ */

const SHOP = {
  nama: "Bodega Pizzeria",
  alamat: "Jl. Opu Daeng Risadju No. 12, Mariso, Makassar",
  partner: "di Sanang Space",
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
    catatan: "Satu ukuran, 28 cm. Adonan difermentasi, dipanggang per pesanan.",
    items: [
      { id: "hhr", img: "img/hhr.webp", nama: "Hot Honey Ricotta", harga: 80000, tag: "fav",
        ket: "Pomodoro, mozzarella, pepperoni, ricotta, hot honey, parmigiano, minyak zaitun." },
      { id: "dpep", img: "img/dpep.webp", nama: "Double Pepperoni", harga: 85000, tag: ["pick", "new"],
        ket: "Pomodoro, mozzarella, pepperoni, bawang bombai, parmesan, minyak zaitun." },
      { id: "bpp", img: "img/bpp.webp", nama: "Beef Pastrami Pickles", harga: 88000, tag: "pick",
        ket: "Pomodoro, mozzarella, pastrami sapi, acar bawang merah dan gherkin, parmigiana." },
      { id: "tartufo", img: "img/tartufo.webp", nama: "Al Tartufo", harga: 90000, tag: "pick",
        ket: "Saus krim, black pepper, mozzarella, pasta jamur truffle, bawang bombai, parmigiana." },
      { id: "jpep", img: "img/jpep.webp", nama: "Jalapeño Pepperoni", harga: 80000, tag: "new",
        ket: "Pomodoro, mozzarella, jalapeño, basil, cabai kering, bawang bombai, parmesan." },
      { id: "imb", img: "img/imb.webp", nama: "Italian Meatball Pie", harga: 85000, tag: "new",
        ket: "Pomodoro, mozzarella, bakso sapi, bawang merah, parmesan, minyak zaitun." },
      { id: "sbc", img: "img/sbc.webp", nama: "Smoked Beef Carbonara", harga: 80000,
        ket: "Saus krim, mozzarella, smoked beef, saus carbonara, bawang bombai, parmigiano." },
      { id: "godf", img: "img/godf.webp", nama: "Godfather", harga: 95000, tag: "new",
        ket: "Pepperoni, jalapeño, jamur, parmesan." },
    ],
  },
  {
    id: "classic",
    pizza: true,
    judul: "Classic Pies",
    items: [
      { id: "marg", img: "img/marg.webp", nama: "Margherita Cheese", harga: 65000,
        ket: "Pomodoro, mozzarella, oregano, parmesan, minyak zaitun." },
      { id: "pep", img: "img/pep.webp", nama: "Pepperoni", harga: 73000, tag: "fav",
        ket: "Pomodoro, mozzarella, pepperoni, bawang bombai, parmesan, minyak zaitun." },
      { id: "wpep", img: "img/wpep.webp", nama: "White Pepperoni", harga: 73000, tag: "new",
        ket: "Saus krim, oregano, pepperoni, jamur, parsley, parmigiana." },
      { id: "cmush", img: "img/cmush.webp", nama: "Creamy Mushroom", harga: 75000, tag: "fav",
        ket: "Saus krim, black pepper, mozzarella, jamur, parmesan, minyak zaitun." },
      { id: "marinara", img: "img/marinara.webp", nama: "Marinara Tradizionale", harga: 55000,
        ket: "Pomodoro, bawang putih, oregano, teri, caper, basil segar. Tanpa keju." },
      { id: "tuna", img: "img/tuna.webp", nama: "Tuna Special", harga: 75000,
        ket: "Pomodoro, tuna, bawang merah, mozzarella, caper, parmesan." },
    ],
  },
  {
    id: "sides",
    judul: "Sampingan & Penutup",
    items: [
      { id: "fries", img: "img/fries.webp", nama: "Bodega Fries", harga: 42000, tag: "pick",
        ket: "Kentang goreng, stracciatella, keju, chili oil." },
      { id: "parm", img: "img/parm.webp", nama: "The Chicken Parm", harga: 59000,
        ket: "Chicken parm dengan mozzarella dan kentang goreng." },
      { id: "parmSalad", img: "img/parmSalad.webp", nama: "The Chicken Parm + Salad", harga: 65000,
        ket: "Versi lengkap dengan salad." },
      { id: "mozz", img: "img/mozz.webp", nama: "Mozzarella Sticks", harga: 35000,
        ket: "Dengan marinara hangat dan hot honey." },
      { id: "meatball", img: "img/meatball.webp", nama: "Mom's Hearty Meatballs", harga: 58000,
        ket: "Bakso sapi, kentang goreng, salad, saus vodka." },
      { id: "nutella", img: "img/nutella.webp", nama: "Nutella Pie", harga: 65000, tag: "pick",
        ket: "Pai manis dengan nutella dan ricotta." },
    ],
  },
  {
    id: "minum",
    judul: "Minuman",
    items: [
      { id: "shamba", img: "img/shamba.webp", nama: "Shamba Cola", harga: 23000, ket: "Botol." },
      { id: "galigo", img: "img/galigo.webp", nama: "Galigo Lemon", harga: 22000, ket: "Botol." },
    ],
  },
  {
    id: "topping",
    judul: "Topping Tambahan",
    catatan: "Dihitung per pizza. Sebutkan mau dipasang di pizza yang mana lewat WhatsApp.",
    items: [
      { id: "top-mozz", nama: "Mozzarella", harga: 10000 },
      { id: "top-strac", nama: "Stracciatella", harga: 15000 },
      { id: "top-ricotta", nama: "Ricotta", harga: 12000 },
      { id: "top-pep", nama: "Pepperoni", harga: 12000 },
      { id: "top-beef", nama: "Smoked Beef", harga: 12000 },
      { id: "top-past", nama: "Pastrami", harga: 15000 },
      { id: "top-chick", nama: "Chick Parm", harga: 35000 },
      { id: "top-mush", nama: "Jamur", harga: 10000 },
      { id: "top-jal", nama: "Jalapeño", harga: 8000 },
      { id: "top-honey", nama: "Hot Honey", harga: 7000 },
      { id: "top-truffle", nama: "Truffle", harga: 15000 },
    ],
  },
  {
    id: "dips",
    judul: "Saus Cocol",
    catatan: "Rp7.000 per saus, atau House Dip Trio Rp15.000.",
    items: [
      { id: "dip-trio", nama: "House Dip Trio", harga: 15000, pilih: 3, dari: "dips",
        ket: "Pilih tiga saus: Hot Honey, Creamy Chives, Creamy Pesto." },
      { id: "dip-chives", nama: "Creamy Chives", harga: 7000 },
      { id: "dip-honey", nama: "Hot Honey", harga: 7000 },
      { id: "dip-pesto", nama: "Creamy Pesto", harga: 7000 },
    ],
  },
];

// Pilihan "tahu Bodega dari mana" — dipakai untuk mengukur asal pelanggan.
const SUMBER = [
  { id: "lewat", label: "Jalan lewat / Sanang" },
  { id: "ig", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "threads", label: "Threads" },
  { id: "gmaps", label: "Google Maps" },
  { id: "teman", label: "Teman / rekomendasi" },
  // bebas: pelanggan menulis sendiri; halaman menampilkan kolom teks begitu ini dipilih
  { id: "lainnya", label: "Lainnya", bebas: true },
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
