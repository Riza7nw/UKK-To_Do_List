# Planning Website To-Do List — UKK
### HTML + CSS + JavaScript + Firebase

> Target: sederhana, rapi, fiturnya cukup lengkap, logikanya mudah dijelaskan ke penguji.
> Tidak perlu XAMPP atau PHP. Semua kode ada di frontend, database & login ditangani Firebase.

---

## 1. Teknologi yang Dipakai

| Bagian | Pilihan | Fungsi |
|---|---|---|
| Struktur halaman | **HTML** | Kerangka halaman (form, tombol, daftar tugas) |
| Tampilan | **CSS** (murni) | Warna, layout, responsif di HP |
| Logika | **JavaScript** (ES Module) | Mengatur klik, form, menampilkan data, memanggil Firebase |
| Login | **Firebase Authentication** (Email/Password) | Register, login, logout — password otomatis aman (tidak disimpan oleh kita) |
| Database | **Cloud Firestore** (Firebase) | Menyimpan data tugas, realtime |
| Editor & server lokal | **VS Code + extension Live Server** | Menjalankan website di `http://127.0.0.1:5500` |

**Jawaban singkat untuk penguji:**
*"Saya pakai HTML, CSS, dan JavaScript untuk website, lalu Firebase sebagai backend. Firebase Authentication untuk login, dan Cloud Firestore sebagai database. Firestore itu database NoSQL berbasis cloud, datanya berbentuk collection dan document, dan bisa update secara realtime tanpa refresh."*

### Kenapa Firebase cocok
- Tidak perlu membuat server / backend sendiri.
- Gratis (paket Spark) dan cukup untuk UKK.
- Login sudah jadi — tidak perlu membuat hash password sendiri.
- Data realtime: tugas langsung muncul tanpa reload.
- **Kekurangan (jujur jika ditanya):** butuh internet saat ujian.

---

## 2. Daftar Fitur

### Fitur wajib (inti)
1. **Register** — nama, email, password.
2. **Login & Logout**.
3. **Tambah tugas** — judul, deskripsi, prioritas, kategori, deadline.
4. **Lihat daftar tugas** — hanya milik user yang login, update realtime.
5. **Edit tugas**.
6. **Hapus tugas** (dengan konfirmasi).
7. **Tandai selesai / belum selesai**.

### Fitur tambahan (nilai plus, logika tetap mudah)
8. **Cari tugas** berdasarkan judul.
9. **Filter** status (Semua / Belum / Selesai) dan kategori.
10. **Statistik** — total, selesai, belum, terlambat + progress bar.
11. **Penanda deadline** — badge merah "Terlambat", kuning "Hari ini".
12. **Badge prioritas** — Rendah (hijau), Sedang (kuning), Tinggi (merah).

> Kategori dibuat **pilihan tetap** di dropdown (Sekolah, Pribadi, Kerja, Lainnya) supaya logikanya tidak ribet.
> Cari, filter, dan statistik dikerjakan **di JavaScript** (pakai `filter()`), bukan di query database → lebih mudah dan tidak perlu membuat index Firestore.

---

## 3. Desain Database (Firestore)

Firestore tidak memakai tabel, tapi **collection** (≈ tabel) dan **document** (≈ baris). Kolom disebut **field**.

```
Firestore
├── users            (collection)
│   └── {uid}        (document, id = uid dari Authentication)
│         nama: "Budi"
│         email: "budi@mail.com"
│         createdAt: timestamp
│
└── tasks            (collection)
    └── {idOtomatis} (document)
          uid: "uid milik user"        ← penghubung ke user (seperti foreign key)
          judul: "Kerjakan laporan"
          deskripsi: "Bab 1 sampai 3"
          prioritas: "tinggi"           ← rendah | sedang | tinggi
          kategori: "Sekolah"
          deadline: "2026-11-20"        ← string format YYYY-MM-DD
          selesai: false                ← boolean
          createdAt: timestamp
```

**Penjelasan (sering ditanya):**
- `uid` di setiap tugas menandakan pemilik tugas → relasi **one-to-many** (1 user punya banyak tugas).
- Password **tidak** disimpan di Firestore; disimpan dan diamankan oleh Firebase Authentication.
- `deadline` disimpan sebagai teks `YYYY-MM-DD` agar mudah dibandingkan dengan tanggal hari ini.

### Perbandingan istilah SQL vs Firestore
| SQL (MySQL) | Firestore |
|---|---|
| Database | Project Firebase |
| Tabel | Collection |
| Baris | Document |
| Kolom | Field |
| Primary key | Document ID |
| Foreign key | Field berisi ID (mis. `uid`) |

---

## 4. Setup Firebase (sekali saja)

1. Buka **console.firebase.google.com** → *Add project* → beri nama `todolist-ukk` (Google Analytics boleh dimatikan).
2. Menu **Build → Authentication → Get started** → aktifkan **Email/Password**.
3. Menu **Build → Firestore Database → Create database** → pilih lokasi `asia-southeast2 (Jakarta)` → mulai di **production mode**.
4. Tab **Rules** di Firestore → isi dengan aturan di bagian 7 → *Publish*.
5. **Project settings (ikon gerigi) → Your apps → ikon `</>` (Web)** → daftarkan app → salin objek `firebaseConfig`.

---

## 5. Struktur Folder

```
todolist/
├── index.html          ← halaman login
├── register.html       ← halaman daftar
├── dashboard.html      ← halaman utama (statistik + form + daftar tugas)
├── css/
│   └── style.css
└── js/
    ├── firebase.js     ← konfigurasi & koneksi Firebase
    ├── auth.js         ← logika login & register
    └── app.js          ← logika dashboard (CRUD, filter, statistik)
```

Cukup **3 HTML, 1 CSS, 3 JS**.

> ⚠️ Karena memakai `<script type="module">`, website **harus dibuka lewat Live Server** (klik kanan `index.html` → *Open with Live Server*), jangan dobel-klik file HTML-nya.

---

## 6. Logika Program per Fitur

### a. Koneksi — `js/firebase.js`
```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  // tempel dari Firebase Console (Project settings → Your apps)
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```
File lain cukup `import { auth, db } from "./firebase.js";`.

### b. Register — `js/auth.js`
```js
import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();                                   // cegah halaman reload
  try {
    const hasil = await createUserWithEmailAndPassword(auth, email.value, password.value);
    await setDoc(doc(db, "users", hasil.user.uid), {    // simpan profil user
      nama: nama.value,
      email: email.value,
      createdAt: serverTimestamp()
    });
    window.location.href = "dashboard.html";
  } catch (err) {
    pesan.textContent = "Gagal daftar: " + err.message;
  }
});
```
**Alur:** buat akun di Authentication → simpan nama ke collection `users` dengan id = uid → pindah ke dashboard.

### c. Login
```js
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    window.location.href = "dashboard.html";
  } catch {
    pesan.textContent = "Email atau password salah";
  }
});
```

### d. Proteksi halaman dashboard — awal `js/app.js`
```js
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let user = null;

onAuthStateChanged(auth, (u) => {
  if (!u) {
    window.location.href = "index.html";   // belum login → tendang ke halaman login
    return;
  }
  user = u;
  tampilkanNama();
  muatTugas();
});
```
`onAuthStateChanged` = "satpam" yang mengecek apakah ada user yang login.

### e. Logout
```js
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
```

### f. Tampil tugas realtime (Read)
```js
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let semuaTugas = [];

function muatTugas() {
  const q = query(collection(db, "tasks"), where("uid", "==", user.uid));
  onSnapshot(q, (snapshot) => {
    semuaTugas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
}
```
**Penjelasan:** ambil tugas yang `uid`-nya sama dengan user login. `onSnapshot` membuat data **otomatis ter-update** setiap ada perubahan (tambah/edit/hapus) tanpa refresh.

### g. Tambah & Edit tugas (Create & Update) — satu form untuk keduanya
```js
import { addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let editId = null;   // null = mode tambah, berisi id = mode edit

formTugas.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (judul.value.trim() === "") return alert("Judul wajib diisi");

  const data = {
    judul: judul.value.trim(),
    deskripsi: deskripsi.value.trim(),
    prioritas: prioritas.value,
    kategori: kategori.value,
    deadline: deadline.value
  };

  if (editId) {
    await updateDoc(doc(db, "tasks", editId), data);
    editId = null;
  } else {
    await addDoc(collection(db, "tasks"), {
      ...data, uid: user.uid, selesai: false, createdAt: serverTimestamp()
    });
  }
  formTugas.reset();
});

function mulaiEdit(id) {
  const t = semuaTugas.find(t => t.id === id);
  judul.value = t.judul;  deskripsi.value = t.deskripsi;
  prioritas.value = t.prioritas;  kategori.value = t.kategori;  deadline.value = t.deadline;
  editId = id;
}
```

### h. Hapus tugas (Delete)
```js
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function hapusTugas(id) {
  if (confirm("Yakin hapus tugas ini?")) {
    await deleteDoc(doc(db, "tasks", id));
  }
}
```

### i. Toggle selesai
```js
async function toggleSelesai(id, statusSekarang) {
  await updateDoc(doc(db, "tasks", id), { selesai: !statusSekarang });
}
```
Tanda `!` membalik nilai: `true` jadi `false`, `false` jadi `true`.

### j. Cari + filter + urutkan (di JavaScript)
```js
function ambilTugasTerfilter() {
  const kataCari = inputCari.value.toLowerCase();
  return semuaTugas
    .filter(t => t.judul.toLowerCase().includes(kataCari))
    .filter(t => filterStatus.value === "semua"
                 || (filterStatus.value === "selesai" ? t.selesai : !t.selesai))
    .filter(t => filterKategori.value === "semua" || t.kategori === filterKategori.value)
    .sort((a, b) => a.selesai - b.selesai || (a.deadline || "9999").localeCompare(b.deadline || "9999"));
}

inputCari.addEventListener("input", render);
filterStatus.addEventListener("change", render);
filterKategori.addEventListener("change", render);
```
Urutan: yang belum selesai di atas, deadline terdekat duluan.

### k. Statistik
```js
const hariIni = new Date().toLocaleDateString("en-CA");   // format YYYY-MM-DD, waktu lokal

function hitungStatistik() {
  const total     = semuaTugas.length;
  const selesai   = semuaTugas.filter(t => t.selesai).length;
  const belum     = total - selesai;
  const terlambat = semuaTugas.filter(t => !t.selesai && t.deadline && t.deadline < hariIni).length;
  const persen    = total > 0 ? Math.round(selesai / total * 100) : 0;
  // tampilkan ke kartu statistik & lebar progress bar = persen + "%"
}
```

### l. Render daftar tugas + badge deadline
```js
function render() {
  hitungStatistik();
  const list = ambilTugasTerfilter();
  daftarTugas.innerHTML = "";
  if (list.length === 0) { daftarTugas.innerHTML = "<p class='kosong'>Belum ada tugas</p>"; return; }

  list.forEach(t => {
    const item = document.createElement("div");
    item.className = "tugas" + (t.selesai ? " selesai" : "");

    const judulEl = document.createElement("h3");
    judulEl.textContent = t.judul;              // textContent = aman dari XSS
    item.appendChild(judulEl);

    // badge deadline
    if (!t.selesai && t.deadline && t.deadline < hariIni)  tambahBadge(item, "Terlambat", "merah");
    else if (!t.selesai && t.deadline === hariIni)         tambahBadge(item, "Hari ini", "kuning");

    tambahBadge(item, t.prioritas, t.prioritas);   // class: rendah / sedang / tinggi
    tambahBadge(item, t.kategori, "abu");

    // tombol: ✔ toggle, ✎ edit, 🗑 hapus → panggil toggleSelesai / mulaiEdit / hapusTugas
    daftarTugas.appendChild(item);
  });
}
```

### m. Keamanan (sebutkan saat presentasi)
- **Password** diurus Firebase Authentication (otomatis di-hash, kita tidak pernah menyimpannya).
- **Hak akses** dijaga dengan **Firestore Security Rules** (bagian 7) — user hanya bisa membaca/mengubah tugas miliknya.
- **XSS** dicegah dengan menampilkan data memakai `textContent`, bukan `innerHTML`.
- `apiKey` di `firebaseConfig` memang boleh terlihat publik; yang mengamankan data adalah Security Rules.

---

## 7. Firestore Security Rules

Tempel di **Firestore → Rules** lalu *Publish*:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /tasks/{taskId} {
      allow read, update, delete: if request.auth != null
                                  && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
    }
  }
}
```
**Artinya:** harus login, dan hanya boleh mengakses dokumen yang `uid`-nya sama dengan uid user yang login.

---

## 8. Desain Tampilan (CSS murni)

- Font: Google Fonts **Poppins**.
- Warna utama ungu/biru (mis. `#6C63FF`), background abu sangat muda `#F4F5FB`, kartu putih dengan `border-radius: 12px` dan bayangan halus.
- **Login/Register:** kartu di tengah layar (`display: flex; justify-content: center; align-items: center; min-height: 100vh`).
- **Dashboard:**
  - Header: nama aplikasi + "Halo, {nama}" + tombol Logout.
  - 4 kartu statistik (pakai `display: grid`) + progress bar.
  - Form tambah/edit tugas.
  - Baris cari & filter.
  - Daftar tugas: tugas selesai diberi `text-decoration: line-through; opacity: .6`.
  - Badge warna: hijau (rendah), kuning (sedang), merah (tinggi / terlambat).
- **Responsif:** `@media (max-width: 768px)` → kartu statistik jadi 2 kolom, form jadi 1 kolom.

---

## 9. Urutan Pengerjaan (Timeline)

| No | Langkah | Estimasi |
|---|---|---|
| 1 | Buat project Firebase, aktifkan Auth & Firestore, pasang Rules | 15 menit |
| 2 | Buat struktur folder + `firebase.js` | 10 menit |
| 3 | HTML + CSS halaman login & register | 30 menit |
| 4 | `auth.js`: register, login | 30 menit |
| 5 | HTML dashboard + proteksi halaman + logout | 30 menit |
| 6 | Tambah tugas + tampil realtime | 45 menit |
| 7 | Edit, hapus, toggle selesai | 45 menit |
| 8 | Cari & filter | 30 menit |
| 9 | Statistik + badge deadline/prioritas | 30 menit |
| 10 | Merapikan CSS + responsif | 30 menit |
| 11 | Testing semua fitur | 20 menit |

**Total ± 5 jam.** Latih minimal 2 kali sebelum hari H.

---

## 10. Checklist Testing Sebelum Ujian

- [ ] Register dengan email yang sudah dipakai → muncul pesan error.
- [ ] Password kurang dari 6 karakter → muncul error (aturan bawaan Firebase).
- [ ] Login dengan password salah → muncul error.
- [ ] Buka `dashboard.html` tanpa login → dilempar ke `index.html`.
- [ ] Tambah tugas dengan judul kosong → ditolak.
- [ ] Tambah, edit, hapus tugas → langsung berubah tanpa refresh.
- [ ] Centang selesai → judul tercoret, statistik berubah.
- [ ] Cari & filter bisa dipakai bersamaan.
- [ ] Login dengan akun lain → tugas akun pertama tidak terlihat.
- [ ] Ketik `<script>alert(1)</script>` di judul → tampil sebagai teks biasa.
- [ ] Data terlihat di Firebase Console → Firestore → collection `tasks`.

---

## 11. Kemungkinan Pertanyaan Penguji + Jawaban

| Pertanyaan | Jawaban singkat |
|---|---|
| Bahasa apa yang dipakai? | HTML (struktur), CSS (tampilan), JavaScript (logika). Database: Cloud Firestore dari Firebase. |
| Firebase itu apa? | Platform backend dari Google: menyediakan login (Authentication), database (Firestore), hosting, dll. tanpa membuat server sendiri. |
| SQL atau NoSQL? | NoSQL. Data disimpan sebagai collection → document → field, bukan tabel. |
| Apa itu CRUD di aplikasimu? | Create = `addDoc`, Read = `onSnapshot`, Update = `updateDoc` (edit & toggle), Delete = `deleteDoc`. |
| Bagaimana login bekerja? | `signInWithEmailAndPassword` mengirim email & password ke Firebase; jika cocok, Firebase menyimpan status login, dan `onAuthStateChanged` memberi tahu halaman siapa yang login. |
| Password disimpan di mana? | Di Firebase Authentication dan sudah di-hash otomatis. Tidak disimpan di Firestore. |
| Kenapa pakai `async/await`? | Karena mengakses Firebase butuh waktu (lewat internet). `await` menunggu hasilnya dulu sebelum lanjut ke baris berikutnya. |
| Apa itu `onSnapshot` / realtime? | Fungsi yang "mendengarkan" database; setiap ada perubahan data, fungsi otomatis jalan lagi dan tampilan diperbarui. |
| Kenapa `e.preventDefault()`? | Supaya form tidak me-reload halaman saat disubmit. |
| Bagaimana user tidak bisa melihat tugas orang lain? | Query memakai `where("uid", "==", user.uid)` dan dijaga oleh Security Rules di server Firebase. |
| Bagaimana tugas terlambat dihitung? | Belum selesai dan `deadline < tanggal hari ini` (keduanya teks `YYYY-MM-DD`, jadi bisa dibandingkan langsung). |
| Bagaimana cari & filter bekerja? | Semua tugas user disimpan di array `semuaTugas`, lalu disaring dengan `.filter()` sesuai kata kunci & pilihan dropdown, kemudian ditampilkan ulang. |
| Apa itu DOM? | Representasi halaman HTML yang bisa diubah lewat JavaScript, contoh `document.createElement`, `textContent`, `addEventListener`. |

---

## 12. Yang Harus Disiapkan Saat Ujian

1. Folder project lengkap + VS Code dengan extension **Live Server**.
2. **Koneksi internet** (Firebase butuh internet) — siapkan hotspot HP sebagai cadangan.
3. Akun Google untuk membuka Firebase Console (untuk menunjukkan isi database ke penguji).
4. Akun demo yang sudah berisi beberapa tugas (supaya demo langsung terlihat ramai).
5. *(Opsional)* Online-kan website lewat **Firebase Hosting**, Netlify, atau GitHub Pages agar bisa dibuka dari HP penguji.
