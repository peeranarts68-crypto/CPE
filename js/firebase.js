/**
 * Firebase Module for CPE Shirt Ordering Web App
 * Exposes Firebase Auth & Cloud Firestore to window.CPEFirebase for browser React execution
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPch8_YKWsu9g8UhloMeSKwWbkSWhj-QQ",
  authDomain: "cpeshirt.firebaseapp.com",
  projectId: "cpeshirt",
  storageBucket: "cpeshirt.firebasestorage.app",
  messagingSenderId: "998516352986",
  appId: "1:998516352986:web:69e2cc6ff55ca40b7782e3",
  measurementId: "G-B7TB1LSMSZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.log("Firebase Analytics init:", e);
}

const auth = getAuth(app);
const db = getFirestore(app);

window.CPEFirebase = {
  app,
  auth,
  db,
  analytics,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp
};
