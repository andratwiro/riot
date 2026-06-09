// Per-city config for the RIOT viewer. Loaded before data.js/ai_votes.js by the
// `?city=` loader in index.html. Card content language lives in the data itself;
// this only drives chrome (title, brand, document lang) and a few tunables.
window.CITY_CONFIG = {
  id: "reus",
  name: "Reus",
  title: "REUS",
  lang: "ca",                          // Reus cards stay in Catalan (source language)
  logo: "assets/logos/reus_rose_color.svg",
  mapGate: 5                           // votes before the opinion map unlocks
};
