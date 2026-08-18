// =========================================================
// FIREBASE SETUP — fill this in with YOUR project's config.
// See README.md, Step 1, for exactly where to get these values.
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
  runTransaction, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// ---- PASTE YOUR FIREBASE CONFIG HERE ----
const firebaseConfig = {
  apiKey:"GOOGLEAPI",
  authDomain: "dinkoln-pickleball.firebaseapp.com",
  projectId: "dinkoln-pickleball",
  storageBucket: "dinkoln-pickleball.firebasestorage.app",
  messagingSenderId: "235391279662",
  appId: "1:235391279662:web:09fdc05198d47db1e235bf",
  measurementId: "G-7GC0745ELN"
};
// ------------------------------------------

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, runTransaction, writeBatch, increment,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
};
