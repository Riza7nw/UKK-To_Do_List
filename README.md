# TugasKu — Website To-Do List

Website pencatat tugas untuk pelajar, dibuat sebagai proyek **UKK (Uji Kompetensi Keahlian)**.
Tampilannya bergaya **glassmorphism** dengan konsep *kaca jendela kelas di pagi hari*: panel kaca buram di atas cahaya pagi berwarna biru langit, peach, dan hijau daun.

🔗 **Demo:** https://tugasku-ukk.vercel.app

---

## Fitur

- **Akun** — daftar, masuk, dan keluar (Firebase Authentication).
- **Kelola tugas** — tambah, lihat, edit, dan hapus tugas.
- **Detail tugas** — judul, deskripsi, prioritas (rendah / sedang / tinggi), kategori, dan deadline.
- **Tandai selesai** — tugas selesai otomatis dicoret.
- **Cari, filter, dan urutkan** — berdasarkan judul, status, kategori, deadline, waktu dibuat, atau prioritas.
- **Statistik** — total, selesai, belum selesai, terlambat, dan progres dalam persen.
- **Penanda deadline** — label *Terlambat* dan *Hari ini*.
- **Paginasi** — 5 tugas per halaman.
- **Sampah** — tugas yang dihapus bisa dipulihkan; *Hapus Permanen* baru menghapus data dari database.
- **Realtime** — perubahan data langsung tampil tanpa refresh.
- **Responsif** — nyaman dipakai di HP maupun laptop.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Struktur halaman | HTML |
| Tampilan | CSS (tanpa framework) |
| Logika | JavaScript (ES Module) |
| Login | Firebase Authentication (Email/Password) |
| Database | Cloud Firestore |
| Hosting | Vercel |

## Struktur Folder

```
├── index.html        → halaman login
├── register.html     → halaman daftar
├── dashboard.html    → halaman utama (kelola tugas)
├── css/style.css     → semua tampilan
├── js/firebase.js    → koneksi ke Firebase
├── js/auth.js        → logika login & daftar
├── js/app.js         → logika dashboard
└── firestore.rules   → aturan keamanan database
```

## Struktur Database (Firestore)

Setiap tugas disimpan **di dalam akun pemiliknya**, dengan ID berurutan `0001`, `0002`, dan seterusnya.

```
users/{uid}                 → nama, email, createdAt, nomorTerakhir
└── tasks/{0001, 0002, …}   → nomor, judul, deskripsi, prioritas, kategori,
                              deadline, selesai, dihapus, dihapusPada,
                              createdAt, updatedAt
```

Keamanan dijaga oleh `firestore.rules`: setiap pengguna hanya bisa membaca dan mengubah tugasnya sendiri, dan isi tugas divalidasi di server.

## Menjalankan di Komputer Sendiri

1. **Clone repository**
   ```bash
   git clone https://github.com/Riza7nw/UKK-To_Do_List.git
   ```
2. **Siapkan Firebase** di [console.firebase.google.com](https://console.firebase.google.com):
   - Buat project baru.
   - **Authentication** → aktifkan **Email/Password**.
   - **Firestore Database** → buat database, lalu salin isi `firestore.rules` ke tab **Rules** dan klik **Publish**.
   - **Project settings** → **Your apps** → tambahkan Web app, lalu salin `firebaseConfig` ke `js/firebase.js`.
3. **Jalankan** dengan extension **Live Server** di VS Code: klik kanan `index.html` → *Open with Live Server*.
   > Website memakai `<script type="module">`, jadi harus dibuka lewat server lokal, bukan dengan dobel-klik file HTML.

## Deploy

Website ini di-hosting di Vercel sebagai situs statis. Untuk deploy ulang setelah ada perubahan:

```bash
npx vercel deploy --prod
```

File yang tidak perlu ikut ke website publik (catatan belajar, planning, rules) didaftarkan di `.vercelignore`.
