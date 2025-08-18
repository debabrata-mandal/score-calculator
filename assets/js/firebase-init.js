// Firebase initialization (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6vyITxs4RUKSZt5K6ZhfKqXavgO7CcYU",
  authDomain: "rummy-score-master.firebaseapp.com",
  projectId: "rummy-score-master",
  storageBucket: "rummy-score-master.firebasestorage.app",
  messagingSenderId: "740379545501",
  appId: "1:740379545501:web:48fd959b916386299c2974",
  measurementId: "G-5TVE05Q9Q5",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Expose to window so non-module scripts can use
window.db = db;
window.firestore = { doc, setDoc, getDoc, onSnapshot, serverTimestamp };

console.log("Firebase initialized successfully!");

