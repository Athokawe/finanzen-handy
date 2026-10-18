// Service Worker der Handy-App.
// * cacht NUR die App-Hülle (HTML/CSS/JS/Icons) dieses Ordners – NIE Antworten der GitHub-API, nie Daten, nie den Token
//   (Anfragen an andere Adressen werden gar nicht angefasst);
// * zeigt Web-Pushes der Finanz-App ({titel, text, art, zeit}) und öffnet beim Antippen die App.
// Neue Version = VERSION hochzählen (alter Cache wird beim Aktivieren gelöscht).

const VERSION = "1.3.6";
const CACHE = "finanzen-huelle-v" + VERSION;
const HUELLE = [
  "./",
  "index.html",
  "app.css",
  "konfig.js",
  "manifest.webmanifest",
  "js/app.js",
  "js/aktionen.js",
  "js/alarme.js",
  "js/ansichten.js",
  "js/ausblenden.js",
  "js/diagramm.js",
  "js/dom.js",
  "js/faceid.js",
  "js/format.js",
  "js/github.js",
  "js/kifrage.js",
  "js/push.js",
  "js/tresor.js",
  "js/zip.js",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon-32.png",
];
const BASIS = new URL("./", self.location).href;
const HUELLE_URLS = new Set(HUELLE.map((p) => new URL(p, BASIS).href));

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(HUELLE.map((p) => new Request(p, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n.startsWith("finanzen-huelle-") && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Netz zuerst (damit Updates sofort da sind), offline aus dem Cache – nur für die Hülle.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // GitHub-API & Co.: nie anfassen
  const ohneSuche = url.origin + url.pathname;
  const istSeite = req.mode === "navigate" && url.href.startsWith(BASIS);
  if (!istSeite && !HUELLE_URLS.has(ohneSuche)) return;      // z. B. demo/*.json: nicht cachen
  const schluessel = istSeite ? new URL("index.html", BASIS).href : ohneSuche;
  e.respondWith((async () => {
    try {
      const antwort = await fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
      if (antwort.ok && antwort.type === "basic") {
        const c = await caches.open(CACHE);
        await c.put(schluessel, antwort.clone());
      }
      return antwort;
    } catch {
      const c = await caches.open(CACHE);
      const alt = await c.match(schluessel);
      if (alt) return alt;
      throw new Error("offline und nicht im Cache");
    }
  })());
});

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { text: e.data ? e.data.text() : "" };
  }
  const titel = String(d.titel || "Finanzen").slice(0, 60);
  const text = String(d.text || "").slice(0, 240);
  const art = String(d.art || "info");
  e.waitUntil(self.registration.showNotification(titel, {
    body: text,
    icon: new URL("icons/icon-192.png", BASIS).href,
    badge: new URL("icons/icon-192.png", BASIS).href,
    tag: art === "lebenszeichen" ? "lebenszeichen" : undefined,
    timestamp: Date.parse(d.zeit || "") || Date.now(),
    data: { art },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenster) {
      if (f.url.startsWith(BASIS) && "focus" in f) return f.focus();
    }
    return self.clients.openWindow(BASIS);
  })());
});
