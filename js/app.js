// =========================================================
// app.js — logika halaman Dashboard (dashboard.html)
// Fitur: cek login, logout, CRUD tugas, toggle selesai,
//        cari, filter, statistik, badge deadline & prioritas
// =========================================================
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp
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
const daftarTugas    = document.getElementById("daftarTugas");
const infoJumlah     = document.getElementById("infoJumlah");

// ---------------- Variabel global ----------------
let user = null;          // user yang sedang login
let semuaTugas = [];      // semua tugas milik user (dari Firestore)
let editId = null;        // null = mode tambah, berisi id = mode edit

// Tanggal hari ini format YYYY-MM-DD (waktu lokal)
const hariIni = new Date().toLocaleDateString("en-CA");

// =========================================================
// 1. CEK LOGIN (proteksi halaman)
// =========================================================
onAuthStateChanged(auth, (u) => {
  if (!u) {
    window.location.href = "index.html";   // belum login → ke halaman login
    return;
  }
  user = u;
  document.body.classList.remove("memuat");
  tampilkanNama();
  muatTugas();
});

async function tampilkanNama() {
  const snap = await getDoc(doc(db, "users", user.uid));
  const nama = snap.exists() ? snap.data().nama : user.email;
  document.getElementById("sapaan").textContent = "Halo, " + nama + " 👋";
}

// =========================================================
// 2. LOGOUT
// =========================================================
document.getElementById("btnLogout").addEventListener("click", async () => {
  if (confirm("Yakin ingin keluar?")) {
    await signOut(auth);
    window.location.href = "index.html";
  }
});

// =========================================================
// 3. READ — ambil tugas milik user secara realtime
// =========================================================
function muatTugas() {
  const q = query(collection(db, "tasks"), where("uid", "==", user.uid));

  onSnapshot(q, (snapshot) => {
    semuaTugas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    tampilkanToast("Gagal memuat data: " + err.message, true);
  });
}

// =========================================================
// 4. CREATE & UPDATE — satu form untuk tambah dan edit
// =========================================================
formTugas.addEventListener("submit", async (e) => {
  e.preventDefault();

  const judul = inputJudul.value.trim();
  if (judul === "") {
    tampilkanToast("Judul tugas wajib diisi", true);
    return;
  }

  const data = {
    judul: judul,
    deskripsi: inputDeskripsi.value.trim(),
    prioritas: inputPrioritas.value,
    kategori: inputKategori.value,
    deadline: inputDeadline.value        // "" jika tidak diisi
  };

  btnSimpan.disabled = true;
  try {
    if (editId) {
      // UPDATE
      await updateDoc(doc(db, "tasks", editId), data);
      tampilkanToast("Tugas berhasil diperbarui ✏️");
    } else {
      // CREATE
      await addDoc(collection(db, "tasks"), {
        ...data,
        uid: user.uid,
        selesai: false,
        createdAt: serverTimestamp()
      });
      tampilkanToast("Tugas berhasil ditambahkan ✅");
    }
    resetForm();
  } catch (err) {
    tampilkanToast("Gagal menyimpan: " + err.message, true);
  }
  btnSimpan.disabled = false;
});

// Isi form dengan data tugas yang mau diedit
function mulaiEdit(id) {
  const t = semuaTugas.find((tugas) => tugas.id === id);
  if (!t) return;

  inputJudul.value     = t.judul;
  inputDeskripsi.value = t.deskripsi || "";
  inputPrioritas.value = t.prioritas;
  inputKategori.value  = t.kategori;
  inputDeadline.value  = t.deadline || "";

  editId = id;
  judulForm.textContent = "Edit Tugas";
  btnSimpan.textContent = "Simpan Perubahan";
  btnBatal.classList.remove("tersembunyi");
  inputJudul.focus();
  formTugas.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  formTugas.reset();
  inputPrioritas.value = "sedang";
  editId = null;
  judulForm.textContent = "Tambah Tugas";
  btnSimpan.textContent = "+ Tambah Tugas";
  btnBatal.classList.add("tersembunyi");
}

btnBatal.addEventListener("click", resetForm);

// =========================================================
// 5. DELETE
// =========================================================
async function hapusTugas(id) {
  if (!confirm("Yakin ingin menghapus tugas ini?")) return;
  try {
    await deleteDoc(doc(db, "tasks", id));
    if (editId === id) resetForm();
    tampilkanToast("Tugas dihapus 🗑️");
  } catch (err) {
    tampilkanToast("Gagal menghapus: " + err.message, true);
  }
}

// =========================================================
// 6. TOGGLE SELESAI / BELUM
// =========================================================
async function toggleSelesai(id, statusSekarang) {
  try {
    await updateDoc(doc(db, "tasks", id), { selesai: !statusSekarang });
  } catch (err) {
    tampilkanToast("Gagal mengubah status: " + err.message, true);
  }
}

// =========================================================
// 7. CARI + FILTER + URUTKAN (di JavaScript)
// =========================================================
function ambilTugasTerfilter() {
  const kataCari = inputCari.value.toLowerCase().trim();

  return semuaTugas
    // cari berdasarkan judul
    .filter((t) => t.judul.toLowerCase().includes(kataCari))
    // filter status
    .filter((t) => {
      if (filterStatus.value === "selesai") return t.selesai;
      if (filterStatus.value === "belum") return !t.selesai;
      return true;
    })
    // filter kategori
    .filter((t) => filterKategori.value === "semua" || t.kategori === filterKategori.value)
    // urutkan: belum selesai dulu, lalu deadline terdekat
    .sort((a, b) => {
      if (a.selesai !== b.selesai) return a.selesai ? 1 : -1;
      return (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31");
    });
}

inputCari.addEventListener("input", render);
filterStatus.addEventListener("change", render);
filterKategori.addEventListener("change", render);

// =========================================================
// 8. STATISTIK
// =========================================================
function hitungStatistik() {
  const total     = semuaTugas.length;
  const selesai   = semuaTugas.filter((t) => t.selesai).length;
  const belum     = total - selesai;
  const terlambat = semuaTugas.filter((t) => cekTerlambat(t)).length;
  const persen    = total > 0 ? Math.round((selesai / total) * 100) : 0;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statSelesai").textContent = selesai;
  document.getElementById("statBelum").textContent = belum;
  document.getElementById("statTerlambat").textContent = terlambat;
  document.getElementById("persenText").textContent = persen + "%";
  document.getElementById("progressBar").style.width = persen + "%";
}

function cekTerlambat(t) {
  return !t.selesai && t.deadline && t.deadline < hariIni;
}

// =========================================================
// 9. TAMPILKAN DAFTAR TUGAS
// =========================================================
function render() {
  hitungStatistik();

  const list = ambilTugasTerfilter();
  infoJumlah.textContent = "Menampilkan " + list.length + " dari " + semuaTugas.length + " tugas";
  daftarTugas.innerHTML = "";

  if (list.length === 0) {
    const kosong = document.createElement("p");
    kosong.className = "kosong";
    kosong.textContent = semuaTugas.length === 0
      ? "Belum ada tugas. Yuk tambahkan tugas pertamamu! 📝"
      : "Tidak ada tugas yang cocok dengan pencarian/filter.";
    daftarTugas.appendChild(kosong);
    return;
  }

  list.forEach((t) => daftarTugas.appendChild(buatItemTugas(t)));
}

function buatItemTugas(t) {
  const item = document.createElement("div");
  item.className = "tugas prioritas-" + t.prioritas + (t.selesai ? " selesai" : "");

  // Tombol centang
  const cek = document.createElement("button");
  cek.className = "cek";
  cek.title = t.selesai ? "Tandai belum selesai" : "Tandai selesai";
  cek.textContent = t.selesai ? "✓" : "";
  cek.addEventListener("click", () => toggleSelesai(t.id, t.selesai));

  // Isi tugas (pakai textContent agar aman dari XSS)
  const isi = document.createElement("div");
  isi.className = "tugas-isi";

  const judul = document.createElement("h3");
  judul.textContent = t.judul;
  isi.appendChild(judul);

  if (t.deskripsi) {
    const desk = document.createElement("p");
    desk.className = "desk";
    desk.textContent = t.deskripsi;
    isi.appendChild(desk);
  }

  // Badge
  const badges = document.createElement("div");
  badges.className = "badges";

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
  const aksi = document.createElement("div");
  aksi.className = "aksi";

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn-kecil btn-edit";
  btnEdit.textContent = "Edit";
  btnEdit.addEventListener("click", () => mulaiEdit(t.id));

  const btnHapus = document.createElement("button");
  btnHapus.className = "btn-kecil btn-hapus";
  btnHapus.textContent = "Hapus";
  btnHapus.addEventListener("click", () => hapusTugas(t.id));

  aksi.append(btnEdit, btnHapus);
  item.append(cek, isi, aksi);
  return item;
}

function buatBadge(teks, kelas) {
  const span = document.createElement("span");
  span.className = "badge " + kelas;
  span.textContent = teks;
  return span;
}

// "2026-11-20" → "20 Nov 2026"
function formatTanggal(tgl) {
  return new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric"
  });
}

// =========================================================
// 10. NOTIFIKASI (toast)
// =========================================================
let timerToast;
function tampilkanToast(teks, error = false) {
  const toast = document.getElementById("toast");
  toast.textContent = teks;
  toast.className = "toast tampil" + (error ? " error" : "");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => toast.classList.remove("tampil"), 2500);
}
