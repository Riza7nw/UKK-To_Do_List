// =========================================================
// firebase.js — koneksi ke Firebase
// File ini di-import oleh auth.js dan app.js
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// GANTI isi objek ini dengan config dari:
// Firebase Console → Project settings (ikon gerigi) → Your apps → Web app
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJP2yWGUMt77KV8C_LFPWgS6I7Txq54pk",
  authDomain: "todolist-5d913.firebaseapp.com",
  projectId: "todolist-5d913",
  storageBucket: "todolist-5d913.firebasestorage.app",
  messagingSenderId: "555013584725",
  appId: "1:555013584725:web:4fec9786a3f6d76dbea1dc",
  measurementId: "G-4136G5KEZ7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);     // untuk login / register / logout
export const db = getFirestore(app);  // untuk database Firestore
