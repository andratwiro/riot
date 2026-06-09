// Multiplayer backend. The app reads window.FIREBASE_CONFIG; set it to your Firebase web
// config to turn on the shared per-city rooms (presence + live dots + "reset everyone").
// Set it back to null for single-player. The apiKey is NOT a secret for a web app —
// access is governed by the Realtime Database rules, not by hiding the key.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCv9sMMIOUERPiQP4roiYxuKA-WRfSUUxk",
  authDomain: "riot-e8c73.firebaseapp.com",
  projectId: "riot-e8c73",
  storageBucket: "riot-e8c73.firebasestorage.app",
  messagingSenderId: "60627806636",
  appId: "1:60627806636:web:72789a4d64839d6b413209",
  databaseURL: "https://riot-e8c73-default-rtdb.europe-west1.firebasedatabase.app/"
};
