// =========================================================
// auth.js — logika halaman Login (index.html) & Register (register.html)
// =========================================================
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------- Ambil elemen HTML ----------------
const pesan = document.getElementById("pesan");
const formLogin = document.getElementById("formLogin");         // hanya ada di index.html
const formRegister = document.getElementById("formRegister");   // hanya ada di register.html

// ---------------- Jika sudah login, langsung ke dashboard ----------------
// "sedangProses" mencegah pindah halaman sebelum data register selesai disimpan.
let sedangProses = false;

onAuthStateChanged(auth, (user) => {
  if (user !== null && sedangProses === false) {
    window.location.href = "dashboard.html";
  }
});

// ---------------- Helper ----------------
// Ubah kode error Firebase menjadi pesan bahasa Indonesia
function pesanError(kode) {
  const daftar = {
    "auth/email-already-in-use": "Email sudah terdaftar, silakan login.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/user-not-found": "Email atau password salah.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan, coba lagi nanti.",
    "auth/network-request-failed": "Tidak ada koneksi internet."
  };

  if (daftar[kode]) {
    return daftar[kode];
  }
  return "Terjadi kesalahan (" + kode + ").";
}

// Ubah tombol menjadi "loading" agar tidak diklik dua kali
function setLoading(form, loading, teks) {
  const tombol = form.querySelector("button[type=submit]");
  tombol.disabled = loading;
  tombol.textContent = teks;
}

// =========================================================
// LOGIN
// =========================================================
if (formLogin !== null) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();   // cegah halaman reload
    pesan.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    sedangProses = true;
    setLoading(formLogin, true, "Memproses...");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      sedangProses = false;
      pesan.textContent = pesanError(err.code);
      setLoading(formLogin, false, "Masuk");
    }
  });
}

// =========================================================
// REGISTER
// =========================================================
if (formRegister !== null) {
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    pesan.textContent = "";

    const nama = document.getElementById("nama").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const konfirmasi = document.getElementById("konfirmasi").value;

    // Validasi
    if (nama === "") {
      pesan.textContent = "Nama wajib diisi.";
      return;
    }
    if (password !== konfirmasi) {
      pesan.textContent = "Ulangi password tidak sama.";
      return;
    }

    sedangProses = true;
    setLoading(formRegister, true, "Memproses...");

    try {
      // 1. Buat akun di Firebase Authentication
      const hasil = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Simpan profil ke Firestore: users/{uid}
      await setDoc(doc(db, "users", hasil.user.uid), {
        nama: nama,
        email: email,
        createdAt: serverTimestamp()
      });

      // 3. Pindah ke dashboard
      window.location.href = "dashboard.html";
    } catch (err) {
      sedangProses = false;
      pesan.textContent = pesanError(err.code);
      setLoading(formRegister, false, "Daftar");
    }
  });
}
