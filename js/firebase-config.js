/**
 * firebase-config.js — Configuração do Firebase
 * IMPORTANTE: Substitua os valores abaixo com as chaves reais do seu projeto Firebase!
 */

const firebaseConfig = {
  apiKey: "AIzaSyBHCmTYO8BJCrhRrmT1n143Od4Jj2DxcEo",
  authDomain: "chklist-campo-pwa-26.firebaseapp.com",
  projectId: "chklist-campo-pwa-26",
  storageBucket: "chklist-campo-pwa-26.firebasestorage.app",
  messagingSenderId: "386990043534",
  appId: "1:386990043534:web:a79e0d5b1b408642a7f4df"
};

// Inicializa o Firebase apenas se as credenciais foram preenchidas
let fdb = null;
let fstorage = null;

if (firebaseConfig.apiKey !== "SUA_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  fdb = firebase.firestore();
  fstorage = firebase.storage();
  console.log('[Firebase] Initialized');
} else {
  console.warn('[Firebase] Configuração pendente. O sync real não funcionará até preencher as chaves em firebase-config.js');
}

// Expõe globalmente
window.FirebaseDB = fdb;
window.FirebaseStorage = fstorage;
