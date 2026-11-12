// =========================================================
// app.js — logika halaman Dashboard (dashboard.html)
// Fitur: cek login, logout, tambah/lihat/edit/hapus tugas,
//        centang selesai, cari, filter, urutkan, statistik, paginasi
// =========================================================
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, onSnapshot, runTransaction,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------- Ambil elemen HTML ----------------
const formTugas      = document.getElementById("formTugas");
const inputJudul     = document.getElementById("judul");
const inputDeskripsi = document.getElementById("deskripsi");
const inputPrioritas = document.getElementById("prioritas");
const inputKategori  = document.getElementById("kategori");
const inputDeadline  = document.getElementById("deadline");
const judulForm      = document.getElementById("judulForm");
const btnSimpan      = document.getElementById("btnSimpan");
const btnBatal       = document.getElementById("btnBatal");

const inputCari      = document.getElementById("inputCari");
const filterStatus   = document.getElementById("filterStatus");
const filterKategori = document.getElementById("filterKategori");
const urutkan        = document.getElementById("urutkan");
const daftarTugas    = document.getElementById("daftarTugas");
const infoJumlah     = document.getElementById("infoJumlah");
const paginasi       = document.getElementById("paginasi");

// ---------------- Pengaturan ----------------
const PER_HALAMAN = 5;                                    // jumlah tugas per halaman
const NILAI_PRIORITAS = { tinggi: 1, sedang: 2, rendah: 3 }; // angka kecil = lebih penting
const hariIni = new Date().toLocaleDateString("en-CA");   // tanggal hari ini, format YYYY-MM-DD

// ---------------- Variabel global ----------------
let user = null;        // user yang sedang login
let semuaTugas = [];    // semua tugas milik user (dari Firestore)
let editId = null;      // null = mode tambah, berisi id = mode edit
let halaman = 1;        // halaman daftar yang sedang dibuka

// Lokasi tugas di Firestore: users/{uid}/tasks
function koleksiTugas() {
  return collection(db, "users", user.uid, "tasks");
}

// Lokasi satu tugas: users/{uid}/tasks/{id}
function dokumenTugas(id) {
  return doc(db, "users", user.uid, "tasks", id);
}

// =========================================================
// 1. CEK LOGIN (proteksi halaman)
// =========================================================
onAuthStateChanged(auth, (u) => {
  if (u === null) {
    // belum login → kembali ke halaman login
    window.location.href = "index.html";
    return;
  }

  user = u;
  document.body.classList.remove("memuat");   // tampilkan isi halaman
  tampilkanNama();
  muatTugas();
});

async function tampilkanNama() {
  const snap = await getDoc(doc(db, "users", user.uid));

  let nama = user.email;          // cadangan jika profil tidak ditemukan
  if (snap.exists()) {
    nama = snap.data().nama;
  }

  document.getElementById("sapaan").textContent = "Halo, " + nama + " 👋";
}

// =========================================================
// 2. LOGOUT
// =========================================================
document.getElementById("btnLogout").addEventListener("click", async () => {
  const yakin = confirm("Yakin ingin keluar?");
  if (yakin) {
    await signOut(auth);
    window.location.href = "index.html";
  }
});

// =========================================================
// 3. READ — ambil tugas secara realtime
// =========================================================
function muatTugas() {
  onSnapshot(koleksiTugas(), (snapshot) => {
    semuaTugas = [];

    snapshot.docs.forEach((dokumen) => {
      // "estimate" = pakai waktu perkiraan jika waktu dari server belum datang
      const tugas = dokumen.data({ serverTimestamps: "estimate" });
      tugas.id = dokumen.id;

      // simpan waktu dibuat dalam bentuk angka, untuk mengurutkan
      if (tugas.createdAt) {
        tugas.dibuat = tugas.createdAt.toMillis();
      } else {
        tugas.dibuat = Date.now();
      }

      semuaTugas.push(tugas);
    });

    render();
  }, (err) => {
    tampilkanToast("Gagal memuat data: " + err.message, true);
  });
}

// =========================================================
// 4. CREATE & UPDATE — satu form untuk tambah dan edit
// =========================================================
formTugas.addEventListener("submit", async (e) => {
  e.preventDefault();   // cegah halaman reload

  const judul = inputJudul.value.trim();
  if (judul === "") {
    tampilkanToast("Judul tugas wajib diisi", true);
    return;
  }

  let deadline = inputDeadline.value;
  if (deadline === "") {
    deadline = null;    // deadline kosong disimpan sebagai null
  }

  const data = {
    judul: judul,
    deskripsi: inputDeskripsi.value.trim(),
    prioritas: inputPrioritas.value,
    kategori: inputKategori.value,
    deadline: deadline
  };

  btnSimpan.disabled = true;
  try {
    if (editId !== null) {
      // UPDATE
      data.updatedAt = serverTimestamp();
      await updateDoc(dokumenTugas(editId), data);
      tampilkanToast("Tugas berhasil diperbarui ✏️");
    } else {
      // CREATE
      await tambahTugasBernomor(data);
      halaman = 1;   // kembali ke halaman 1 agar tugas baru terlihat
      tampilkanToast("Tugas berhasil ditambahkan ✅");
    }
    resetForm();
  } catch (err) {
    tampilkanToast("Gagal menyimpan: " + err.message, true);
  }
  btnSimpan.disabled = false;
});

// Menambah tugas dengan ID berurutan 0001, 0002, ... (mirip AUTO_INCREMENT).
// runTransaction = baca + tulis dalam satu paket, jadi nomor tidak bisa dobel.
async function tambahTugasBernomor(data) {
  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async (tx) => {
    // 1. Baca nomor terakhir dari dokumen user
    const snapUser = await tx.get(userRef);
    let nomorTerakhir = 0;
    if (snapUser.exists() && snapUser.data().nomorTerakhir) {
      nomorTerakhir = snapUser.data().nomorTerakhir;
    }

    // 2. Nomor baru = nomor terakhir + 1
    const nomorBaru = nomorTerakhir + 1;

    // 3. Ubah jadi 4 digit: 1 → "0001"
    const idTugas = String(nomorBaru).padStart(4, "0");

    // 4. Simpan nomor terakhir yang baru ke dokumen user
    tx.set(userRef, { nomorTerakhir: nomorBaru }, { merge: true });

    // 5. Simpan tugas dengan ID "0001"
    data.nomor = nomorBaru;
    data.selesai = false;
    data.dikerjakan = false;
    data.createdAt = serverTimestamp();
    tx.set(dokumenTugas(idTugas), data);
  });
}

// Ubah tampilan form: mode Tambah atau mode Edit
function aturModeForm(modeEdit) {
  if (modeEdit) {
    judulForm.textContent = "Edit Tugas";
    btnSimpan.textContent = "Simpan Perubahan";
    btnBatal.classList.remove("tersembunyi");
  } else {
    judulForm.textContent = "Tambah Tugas";
    btnSimpan.textContent = "+ Tambah Tugas";
    btnBatal.classList.add("tersembunyi");
  }
}

// Isi form dengan data tugas yang mau diedit
function mulaiEdit(id) {
  const t = semuaTugas.find((tugas) => tugas.id === id);
  if (!t) return;

  inputJudul.value     = t.judul;
  inputDeskripsi.value = t.deskripsi;
  inputPrioritas.value = t.prioritas;
  inputKategori.value  = t.kategori;

  if (t.deadline) {
    inputDeadline.value = t.deadline;
  } else {
    inputDeadline.value = "";
  }

  editId = id;
  aturModeForm(true);
  inputJudul.focus();
  formTugas.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Kosongkan form dan kembali ke mode Tambah
function resetForm() {
  formTugas.reset();
  editId = null;
  aturModeForm(false);
}

btnBatal.addEventListener("click", resetForm);

// =========================================================
// 5. DELETE — dengan Sampah (soft delete)
// Tombol "Hapus"           → hanya ditandai dihapus: true, data MASIH ADA di Firestore
// Tombol "Pulihkan"        → dihapus: false, tugas kembali ke daftar
// Tombol "Hapus Permanen"  → deleteDoc, data BENAR-BENAR HILANG dari Firestore
// =========================================================
async function hapusTugas(id) {
  try {
    await updateDoc(dokumenTugas(id), {
      dihapus: true,
      dihapusPada: serverTimestamp()
    });
    if (editId === id) {
      resetForm();   // tugas yang sedang diedit ikut pindah ke sampah
    }
    tampilkanToast("Tugas dipindahkan ke Sampah 🗑️ (bisa dipulihkan)");
  } catch (err) {
    tampilkanToast("Gagal menghapus: " + err.message, true);
  }
}

async function pulihkanTugas(id) {
  try {
    await updateDoc(dokumenTugas(id), {
      dihapus: false,
      dihapusPada: null
    });
    tampilkanToast("Tugas berhasil dipulihkan ♻️");
  } catch (err) {
    tampilkanToast("Gagal memulihkan: " + err.message, true);
  }
}

async function hapusPermanen(id) {
  const yakin = confirm("Hapus permanen? Tugas ini TIDAK BISA dikembalikan lagi.");
  if (!yakin) return;

  try {
    await deleteDoc(dokumenTugas(id));
    tampilkanToast("Tugas dihapus permanen");
  } catch (err) {
    tampilkanToast("Gagal menghapus: " + err.message, true);
  }
}

// Cek apakah tugas ada di sampah (tugas lama yang belum punya field "dihapus" dianggap tidak)
function diSampah(t) {
  return t.dihapus === true;
}

// =========================================================
// 6. STATUS TUGAS: Belum → Sedang dikerjakan → Selesai
// =========================================================

// Tombol "Batal selesai": tugas kembali menjadi belum selesai
async function toggleSelesai(id, statusSekarang) {
  try {
    await updateDoc(dokumenTugas(id), {
      selesai: !statusSekarang,   // ! membalik: true jadi false, false jadi true
      dikerjakan: false,          // tugas selesai / dibuka lagi → tidak lagi "sedang dikerjakan"
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    tampilkanToast("Gagal mengubah status: " + err.message, true);
  }
}

// Klik tugas: mulai dikerjakan / batal dikerjakan
async function toggleDikerjakan(id, statusSekarang) {
  try {
    await updateDoc(dokumenTugas(id), {
      dikerjakan: !statusSekarang,
      updatedAt: serverTimestamp()
    });

    if (statusSekarang) {
      tampilkanToast("Batal dikerjakan");
    } else {
      tampilkanToast("Tugas sedang dikerjakan ⏳ Klik Selesai jika sudah beres");
    }
  } catch (err) {
    tampilkanToast("Gagal mengubah status: " + err.message, true);
  }
}

// Tombol "Selesai" pada tugas yang sedang dikerjakan
async function tandaiSelesai(id) {
  try {
    await updateDoc(dokumenTugas(id), {
      selesai: true,
      dikerjakan: false,
      updatedAt: serverTimestamp()
    });
    tampilkanToast("Tugas selesai ✅");
  } catch (err) {
    tampilkanToast("Gagal menyimpan: " + err.message, true);
  }
}

// Cek apakah tugas sedang dikerjakan (tugas lama tanpa field "dikerjakan" dianggap tidak)
function sedangDikerjakan(t) {
  return t.dikerjakan === true && t.selesai === false;
}

// =========================================================
// 7. CARI + FILTER + URUTKAN
// =========================================================
function ambilTugasTerfilter() {
  const hasil = semuaTugas.filter(lolosFilter);
  hasil.sort(bandingkan);
  return hasil;
}

// Mengembalikan true jika tugas boleh ditampilkan
function lolosFilter(t) {
  // 1. Cari berdasarkan judul
  const kataCari = inputCari.value.toLowerCase().trim();
  if (!t.judul.toLowerCase().includes(kataCari)) {
    return false;
  }

  // 2. Sampah: jika memilih "Sampah" tampilkan HANYA tugas di sampah,
  //    selain itu tugas di sampah disembunyikan
  if (filterStatus.value === "sampah") {
    return diSampah(t);
  }
  if (diSampah(t)) {
    return false;
  }

  // 3. Filter status
  if (filterStatus.value === "selesai" && t.selesai === false) {
    return false;
  }
  if (filterStatus.value === "belum" && t.selesai === true) {
    return false;
  }
  if (filterStatus.value === "dikerjakan" && !sedangDikerjakan(t)) {
    return false;
  }

  // 4. Filter kategori
  if (filterKategori.value !== "semua" && t.kategori !== filterKategori.value) {
    return false;
  }

  return true;
}

// Aturan urutan. Hasil negatif = a di atas b, positif = b di atas a.
function bandingkan(a, b) {
  // 1. Tugas belum selesai selalu di atas tugas selesai
  if (a.selesai !== b.selesai) {
    if (a.selesai) {
      return 1;
    } else {
      return -1;
    }
  }

  // 2. Tugas yang sedang dikerjakan di atas tugas lain yang belum selesai
  if (sedangDikerjakan(a) !== sedangDikerjakan(b)) {
    if (sedangDikerjakan(a)) {
      return -1;
    } else {
      return 1;
    }
  }

  // 3. Sesuai pilihan "Urutkan"
  let selisih = 0;
  if (urutkan.value === "terbaru") {
    selisih = b.dibuat - a.dibuat;
  } else if (urutkan.value === "terlama") {
    selisih = a.dibuat - b.dibuat;
  } else if (urutkan.value === "prioritas") {
    selisih = NILAI_PRIORITAS[a.prioritas] - NILAI_PRIORITAS[b.prioritas];
  } else {
    selisih = bandingkanDeadline(a, b);
  }

  if (selisih !== 0) {
    return selisih;
  }

  // 4. Jika masih seri → yang dibuat duluan di atas
  return a.dibuat - b.dibuat;
}

// Deadline terdekat di atas, tugas tanpa deadline paling bawah
function bandingkanDeadline(a, b) {
  let deadlineA = a.deadline;
  let deadlineB = b.deadline;
  if (!deadlineA) deadlineA = "9999-12-31";
  if (!deadlineB) deadlineB = "9999-12-31";
  return deadlineA.localeCompare(deadlineB);
}

// Setiap cari/filter/urutkan berubah → kembali ke halaman 1 lalu tampilkan ulang
function gantiFilter() {
  halaman = 1;
  render();
}

inputCari.addEventListener("input", gantiFilter);
filterStatus.addEventListener("change", gantiFilter);
filterKategori.addEventListener("change", gantiFilter);
urutkan.addEventListener("change", gantiFilter);

// =========================================================
// 8. STATISTIK
// =========================================================
function hitungStatistik() {
  // Tugas di sampah tidak dihitung
  const tugasAktif = semuaTugas.filter((t) => !diSampah(t));
  const jumlahSampah = semuaTugas.length - tugasAktif.length;

  const total     = tugasAktif.length;
  const selesai   = tugasAktif.filter((t) => t.selesai).length;
  const belum     = total - selesai;
  const terlambat = tugasAktif.filter(cekTerlambat).length;

  // Tampilkan jumlah isi sampah di dropdown, contoh: "🗑 Sampah (3)"
  document.getElementById("opsiSampah").textContent = "🗑 Sampah (" + jumlahSampah + ")";

  let persen = 0;
  if (total > 0) {
    persen = Math.round((selesai / total) * 100);
  }

  document.getElementById("statTotal").textContent     = total;
  document.getElementById("statSelesai").textContent   = selesai;
  document.getElementById("statBelum").textContent     = belum;
  document.getElementById("statTerlambat").textContent = terlambat;
  document.getElementById("persenText").textContent    = persen + "%";
  document.getElementById("progressBar").style.width   = persen + "%";
}

// Terlambat = belum selesai, punya deadline, dan deadline sudah lewat
function cekTerlambat(t) {
  if (t.selesai) return false;
  if (!t.deadline) return false;
  return t.deadline < hariIni;
}

// =========================================================
// 9. TAMPILKAN DAFTAR TUGAS + PAGINASI
// =========================================================
function render() {
  hitungStatistik();

  const list = ambilTugasTerfilter();
  daftarTugas.innerHTML = "";
  paginasi.innerHTML = "";

  // Jika tidak ada tugas yang bisa ditampilkan
  if (list.length === 0) {
    infoJumlah.textContent = "0 tugas";

    let teks = "Tidak ada tugas yang cocok dengan pencarian/filter.";
    if (filterStatus.value === "sampah") {
      teks = "Sampah kosong 🗑️";
    } else if (semuaTugas.length === 0) {
      teks = "Belum ada tugas. Yuk tambahkan tugas pertamamu! 📝";
    }
    daftarTugas.appendChild(buatElemen("p", "kosong", teks));
    return;
  }

  // Paginasi: hitung jumlah halaman
  const totalHalaman = Math.ceil(list.length / PER_HALAMAN);   // 12 tugas → 3 halaman
  if (halaman > totalHalaman) {
    halaman = totalHalaman;   // misal setelah tugas terakhir di halaman dihapus
  }

  // Ambil tugas untuk halaman ini saja
  const awal = (halaman - 1) * PER_HALAMAN;                // hal 1 → 0, hal 2 → 5, hal 3 → 10
  const potongan = list.slice(awal, awal + PER_HALAMAN);

  infoJumlah.textContent = "Menampilkan " + (awal + 1) + "–" + (awal + potongan.length)
                         + " dari " + list.length + " tugas";

  for (let i = 0; i < potongan.length; i++) {
    daftarTugas.appendChild(buatItemTugas(potongan[i]));
  }

  if (totalHalaman > 1) {
    buatPaginasi(totalHalaman);
  }
}

// Tombol: « Sebelumnya | 1 2 3 | Berikutnya »
function buatPaginasi(totalHalaman) {
  // tombol Sebelumnya (nonaktif di halaman 1)
  paginasi.appendChild(buatTombolHalaman("« Sebelumnya", halaman - 1, halaman === 1));

  // tombol nomor halaman
  for (let i = 1; i <= totalHalaman; i++) {
    const tombol = buatTombolHalaman(i, i, false);
    if (i === halaman) {
      tombol.classList.add("aktif");
    }
    paginasi.appendChild(tombol);
  }

  // tombol Berikutnya (nonaktif di halaman terakhir)
  paginasi.appendChild(buatTombolHalaman("Berikutnya »", halaman + 1, halaman === totalHalaman));
}

function buatTombolHalaman(teks, tujuan, nonaktif) {
  const tombol = buatElemen("button", "btn-halaman", teks);
  tombol.disabled = nonaktif;
  tombol.addEventListener("click", () => {
    halaman = tujuan;
    render();
    daftarTugas.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return tombol;
}

// Membuat satu kartu tugas
function buatItemTugas(t) {
  // Kartu
  let kelasKartu = "tugas prioritas-" + t.prioritas;
  if (t.selesai) {
    kelasKartu = kelasKartu + " selesai";
  }
  if (diSampah(t)) {
    kelasKartu = kelasKartu + " dihapus";
  }
  if (sedangDikerjakan(t)) {
    kelasKartu = kelasKartu + " dikerjakan";
  }
  const item = buatElemen("div", kelasKartu, "");

  // Kotak centang: HANYA penanda status, tidak bisa diklik.
  // Tercentang otomatis setelah tombol "Selesai" diklik.
  let tandaCentang = "";
  let keterangan = "Belum selesai";
  if (t.selesai) {
    tandaCentang = "✓";
    keterangan = "Selesai";
  } else if (sedangDikerjakan(t)) {
    keterangan = "Sedang dikerjakan";
  }
  const cek = buatElemen("span", "cek", tandaCentang);
  cek.title = keterangan;
  cek.setAttribute("role", "img");
  cek.setAttribute("aria-label", keterangan);

  // Isi: judul & deskripsi
  const isi = buatElemen("div", "tugas-isi", "");
  isi.appendChild(buatElemen("h3", "", t.judul));
  if (t.deskripsi) {
    isi.appendChild(buatElemen("p", "desk", t.deskripsi));
  }

  // Tugas yang belum selesai (dan tidak di sampah) bisa diklik untuk mulai/batal dikerjakan
  if (!t.selesai && !diSampah(t)) {
    isi.classList.add("bisa-diklik");
    isi.tabIndex = 0;                         // bisa dipilih dengan tombol Tab
    isi.setAttribute("role", "button");
    if (sedangDikerjakan(t)) {
      isi.title = "Klik untuk batal mengerjakan";
    } else {
      isi.title = "Klik untuk mulai mengerjakan";
    }

    isi.addEventListener("click", () => toggleDikerjakan(t.id, sedangDikerjakan(t)));
    isi.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        toggleDikerjakan(t.id, sedangDikerjakan(t));
      }
    });
  }

  // Badge
  const badges = buatElemen("div", "badges", "");
  if (sedangDikerjakan(t)) {
    badges.appendChild(buatBadge("⏳ Sedang dikerjakan", "progres"));
  }
  if (cekTerlambat(t)) {
    badges.appendChild(buatBadge("⚠ Terlambat", "merah"));
  } else if (!t.selesai && t.deadline === hariIni) {
    badges.appendChild(buatBadge("⏰ Hari ini", "kuning"));
  }
  badges.appendChild(buatBadge("Prioritas " + t.prioritas, t.prioritas));
  badges.appendChild(buatBadge(t.kategori, "abu"));
  if (t.deadline) {
    badges.appendChild(buatBadge("📅 " + formatTanggal(t.deadline), "abu"));
  }
  if (t.selesai) {
    badges.appendChild(buatBadge("Selesai", "hijau"));
  }
  isi.appendChild(badges);

  // Tombol aksi
  const aksi = buatElemen("div", "aksi", "");

  if (diSampah(t)) {
    // Di sampah: Pulihkan & Hapus Permanen
    const btnPulihkan = buatElemen("button", "btn-kecil btn-pulihkan", "Pulihkan");
    btnPulihkan.addEventListener("click", () => pulihkanTugas(t.id));

    const btnPermanen = buatElemen("button", "btn-kecil btn-hapus", "Hapus Permanen");
    btnPermanen.addEventListener("click", () => hapusPermanen(t.id));

    aksi.appendChild(btnPulihkan);
    aksi.appendChild(btnPermanen);
  } else {
    // Tugas yang sedang dikerjakan: ada tombol "Selesai"
    if (sedangDikerjakan(t)) {
      const btnSelesai = buatElemen("button", "btn-kecil btn-selesai", "Selesai");
      btnSelesai.addEventListener("click", () => tandaiSelesai(t.id));
      aksi.appendChild(btnSelesai);
    }

    // Tugas yang sudah selesai: bisa dibatalkan jika salah tandai
    if (t.selesai) {
      const btnBatalSelesai = buatElemen("button", "btn-kecil btn-batal-selesai", "Batal selesai");
      btnBatalSelesai.addEventListener("click", () => toggleSelesai(t.id, true));
      aksi.appendChild(btnBatalSelesai);
    }

    // Tugas biasa: Edit & Hapus (pindah ke sampah)
    const btnEdit = buatElemen("button", "btn-kecil btn-edit", "Edit");
    btnEdit.addEventListener("click", () => mulaiEdit(t.id));

    const btnHapus = buatElemen("button", "btn-kecil btn-hapus", "Hapus");
    btnHapus.addEventListener("click", () => hapusTugas(t.id));

    aksi.appendChild(btnEdit);
    aksi.appendChild(btnHapus);
  }

  // Gabungkan semua bagian ke dalam kartu
  item.appendChild(cek);
  item.appendChild(isi);
  item.appendChild(aksi);
  return item;
}

// Membuat elemen HTML beserta class dan teksnya.
// Memakai textContent agar aman dari XSS (kode <script> tampil sebagai teks biasa).
function buatElemen(tag, kelas, teks) {
  const elemen = document.createElement(tag);
  elemen.className = kelas;
  elemen.textContent = teks;
  return elemen;
}

function buatBadge(teks, kelas) {
  return buatElemen("span", "badge " + kelas, teks);
}

// "2026-11-20" → "20 Nov 2026"
function formatTanggal(tgl) {
  const tanggal = new Date(tgl + "T00:00:00");
  return tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// =========================================================
// 10. NOTIFIKASI (toast)
// =========================================================
let timerToast;

function tampilkanToast(teks, error = false) {
  const toast = document.getElementById("toast");
  toast.textContent = teks;

  if (error) {
    toast.className = "toast tampil error";
  } else {
    toast.className = "toast tampil";
  }

  clearTimeout(timerToast);   // hentikan timer toast sebelumnya
  timerToast = setTimeout(() => {
    toast.classList.remove("tampil");
  }, 2500);
}
