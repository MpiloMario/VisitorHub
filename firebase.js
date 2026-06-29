import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";



const firebaseConfig = {
  apiKey: "AIzaSyCixSl1escwlPr2NHFRX14MRbudzlfbRmU",
  authDomain: "bookme-70673.firebaseapp.com",
  projectId: "bookme-70673",
  storageBucket: "bookme-70673.firebasestorage.app",
  messagingSenderId: "383002758141",
  appId: "1:383002758141:web:48aabab5b42e947ab36794"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export const storage = getStorage(app);


export {
  auth,
  getAuth,
  db,
  ref,
  uploadBytes,
  onSnapshot,
  getDownloadURL,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  doc,
  setDoc,
  getDoc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onAuthStateChanged,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  orderBy
};
