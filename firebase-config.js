// Multiplayer backend (OPTIONAL). Paste your Firebase web config below to turn on the
// shared per-city rooms (presence + live dots + "reset everyone"). Leave it null and the
// app runs single-player exactly as before.
//
// The apiKey is NOT a secret for a Firebase *web* app — access is governed by the Realtime
// Database security rules, not by hiding the key. See SETUP below.
window.FIREBASE_CONFIG = null;

/* ── SETUP (≈3 min, free) ───────────────────────────────────────────────────────────
 1. console.firebase.google.com → Add project (no Google Analytics needed).
 2. Build → Realtime Database → Create database → pick a region (europe-west1) →
    start in "test mode" (or set the rules below).
 3. Project settings → General → "Your apps" → Web (</>) → register → copy the config.
 4. Replace the line above with, e.g.:

    window.FIREBASE_CONFIG = {
      apiKey: "AIza………",
      authDomain: "your-app.firebaseapp.com",
      databaseURL: "https://your-app-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "your-app"
    };

 5. Commit + push (GitHub Pages serves it). Both cities now share live rooms.

 Demo-grade rules (open; fine for an ephemeral demo you wipe afterward):
   { "rules": { "rooms": { ".read": true, ".write": true } } }
 ──────────────────────────────────────────────────────────────────────────────────── */
