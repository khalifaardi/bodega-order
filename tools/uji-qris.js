/* Uji QRIS di terminal:  node tools/uji-qris.js
   Tidak menyentuh uang, tidak butuh jaringan. */
global.window = {};
require("../qris.js");
const Q = global.window.QRIS;
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "menu.js"), "utf8");
const payload = (src.match(/qrisPayload:\s*"([^"]*)"/) || [])[1];

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " -> " + extra : "")); }
};

console.log("CRC check value (harus 29B1):");
check("crc16('123456789') = 29B1", Q.crc16("123456789") === "29B1", Q.crc16("123456789"));

if (!payload) {
  console.log("\nqrisPayload kosong — halaman memakai gambar QRIS statis. Tidak ada yang bisa diuji.");
  process.exit(0);
}

console.log("\nPayload statis:");
const v = Q.validate(payload);
check("CRC payload statis valid", v.ok, v.why);
const base = Q.parseTLV(payload);
const get = (els, t) => (els.find(e => e.tag === t) || {}).val;
check("merchant = BODEGA PIZZERIA", get(base, "59") === "BODEGA PIZZERIA", get(base, "59"));
check("tipe statis (01=11)", get(base, "01") === "11");

console.log("\nKonversi:");
for (const amount of [1000, 73000, 108000, 276000]) {
  const d = Q.buildDynamic(payload, amount);
  const els = Q.parseTLV(d);
  const ok = Q.validate(d).ok && get(els, "54") === String(amount) && get(els, "01") === "12";
  check("Rp" + amount.toLocaleString("id-ID") + " -> dinamis, nominal benar, CRC valid", ok);
}

const tagged = Q.buildDynamic(payload, 73000, { billRef: "BOD-261117-1234" });
const t62 = get(Q.parseTLV(tagged), "62");
check("billRef masuk tag 62", /^0115BOD-261117-1234/.test(t62), t62);
check("terminal label tetap ada", /0703A01$/.test(t62), t62);
check("CRC tetap valid dengan billRef", Q.validate(tagged).ok);
check("tanpa billRef tag 62 tidak berubah", get(Q.parseTLV(Q.buildDynamic(payload, 73000)), "62") === (get(base, "62") || undefined));

console.log("\n" + pass + " lolos, " + fail + " gagal");
process.exit(fail ? 1 : 0);
