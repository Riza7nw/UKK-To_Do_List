// =========================================================
// auth.js — logika halaman Login (index.html) & Register (register.html)
// =========================================================
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const pesan = document.getElementById("pesan");
const formLogin = document.getElementById("formLogin");
const formRegister = document.getElementById("formRegister");

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
  return daftar[kode] || "Terjadi kesalahan (" + kode + ").";
}

// Ubah tombol menjadi "loading" agar tidak diklik dua kali
function setLoading(form, loading, teks) {
  const tombol = form.querySelector("button[type=submit]");
  tombol.disabled = loading;
  tombol.textContent = teks;
}

// ---------------- LOGIN ----------------
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();                    // cegah halaman reload
    pesan.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    setLoading(formLogin, true, "Memproses...");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      pesan.textContent = pesanError(err.code);
      setLoading(formLogin, false, "Masuk");
    }
  });
}

// ---------------- REGISTER ----------------
if (formRegister) {
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    pesan.textContent = "";

    const nama = document.getElementById("nama").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const konfirmasi = document.getElementById("konfirmasi").value;

    // Validasi sederhana
    if (nama === "") {
      pesan.textContent = "Nama wajib diisi.";
      return;
    }
    if (password !== konfirmasi) {
      pesan.textContent = "Ulangi password tidak sama.";
      return;
    }

    setLoading(formRegister, true, "Memproses...");
    try {
      // 1. Buat akun di Firebase Authentication
      const hasil = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Simpan profil ke Firestore: collection "users", id dokumen = uid
      await setDoc(doc(db, "users", hasil.user.uid), {
        nama: nama,
        email: email,
        createdAt: serverTimestamp()
      });

      // 3. Pindah ke dashboard
      window.location.href = "dashboard.html";
    } catch (err) {
      pesan.textContent = pesanError(err.code);
      setLoading(formRegister, false, "Daftar");
    }
  });
}
