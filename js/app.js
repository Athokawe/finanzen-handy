// Hauptablauf: Verbinden (Token) → PIN festlegen → App; beim Öffnen und nach 5 min im Hintergrund PIN-Sperre.
// Daten liegen nur im Arbeitsspeicher (Z), der Token nur verschlüsselt in localStorage und entschlüsselt in github.js.

import { $, h, leeren } from "./dom.js";
import * as T from "./tresor.js";
import * as gh from "./github.js";
import * as A from "./aktionen.js";
import * as V from "./ansichten.js";
import * as P from "./push.js";
import * as F from "./format.js";

export const APP_VERSION = "1.0.0";
const SPERRE_NACH_MS = 5 * 60000;
const ALT_AB_MIN = 90;            // ab so alten Daten wird der Stand gelb
const DEMO_BEZUG = Date.parse("2026-10-11T06:38:34Z"); // Bezugszeit der Beispiel-Dateien in demo/

const Z = { handy: null, news: null, fehlerHandy: null, fehlerNews: null, laedt: false, geladenUm: 0 };
const demo = new URLSearchParams(location.search).get("demo") === "1";
let reiter = "uebersicht";
let entsperrt = false;
let verstecktSeit = 0;
let pushHash = null;
let neuerToken = null;   // nur während der Einrichtung, bis die PIN steht (nie gespeichert)
let pinModus = "eingeben";
let ersterPin = "";

const TITEL = { uebersicht: "Übersicht", kern: "Kern-Bot", raster: "Raster-Bot", trend: "Trend-Bot", news: "Nachrichten", mehr: "Einstellungen" };
const ANSICHT = { uebersicht: V.uebersicht, kern: V.kern, raster: V.raster, trend: V.trend, news: V.news };

// ------------------------------------------------------------------ kleine Helfer

function schirm(name) {
  for (const s of ["laden", "verbinden", "pin", "app"]) $("s-" + s).hidden = s !== name;
}

function toast(text) {
  const alt = document.querySelector(".toast");
  if (alt) alt.remove();
  const t = h("div", { class: "toast", role: "status", id: "toast" }, text);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

function meldung(text, art) {
  const m = $("meldung");
  m.textContent = text || "";
  m.className = "meldung" + (art ? " " + art : "");
  m.hidden = !text;
}

function fehlerFeld(id, text) {
  const f = $(id);
  f.textContent = text || "";
  f.hidden = !text;
}

// ------------------------------------------------------------------ Verbinden

function verbindenZeigen(hinweis) {
  entsperrt = false;
  gh.tokenSetzen(null);
  $("token-feld").value = "";
  fehlerFeld("verbinden-fehler", hinweis || "");
  schirm("verbinden");
}

async function verbinden() {
  const knopf = $("verbinden-knopf");
  const token = $("token-feld").value.trim();
  fehlerFeld("verbinden-fehler", "");
  if (!gh.tokenFormatOk(token)) {
    fehlerFeld("verbinden-fehler", "Das sieht nicht wie ein GitHub-Token aus. Er beginnt mit „github_pat_“ und ist sehr lang – bitte komplett kopieren.");
    return;
  }
  knopf.disabled = true;
  knopf.textContent = "Teste die Verbindung …";
  gh.tokenSetzen(token);
  try {
    const d = await gh.lesen("cloud/handy.json");
    Z.handy = d;
    neuerToken = token;
    $("token-feld").value = "";
    pinZeigen("festlegen");
  } catch (e) {
    gh.tokenSetzen(null);
    fehlerFeld("verbinden-fehler", e.message || "Verbindung fehlgeschlagen.");
  } finally {
    knopf.disabled = false;
    knopf.textContent = "Verbinden";
  }
}

// ------------------------------------------------------------------ PIN

function pinZeigen(modus, fehler) {
  pinModus = modus;
  const titel = { eingeben: "PIN eingeben", festlegen: "PIN festlegen", bestaetigen: "PIN wiederholen" }[modus];
  const text = {
    eingeben: "Gib deine PIN ein, um die App zu entsperren.",
    festlegen: "Verbindung klappt ✓. Lege jetzt eine PIN mit 4 bis 6 Ziffern fest. Damit wird der Token auf diesem iPhone verschlüsselt; die App fragt sie beim Öffnen und nach 5 Minuten im Hintergrund.",
    bestaetigen: "Bitte dieselbe PIN noch einmal eingeben.",
  }[modus];
  $("pin-titel").textContent = titel;
  $("pin-text").textContent = text;
  $("pin-knopf").textContent = modus === "eingeben" ? "Entsperren" : modus === "festlegen" ? "Weiter" : "PIN speichern";
  $("pin-vergessen").textContent = modus === "eingeben" ? "PIN vergessen – neu verbinden" : "Abbrechen";
  $("pin-feld").value = "";
  fehlerFeld("pin-fehler", fehler || "");
  schirm("pin");
  setTimeout(() => $("pin-feld").focus(), 60);
}

async function pinWeiter() {
  const pin = $("pin-feld").value.trim();
  const knopf = $("pin-knopf");
  if (!T.pinGueltig(pin)) {
    fehlerFeld("pin-fehler", "Die PIN hat 4 bis 6 Ziffern.");
    return;
  }
  fehlerFeld("pin-fehler", "");
  if (pinModus === "festlegen") {
    ersterPin = pin;
    pinZeigen("bestaetigen");
    return;
  }
  const vorher = knopf.textContent;
  knopf.disabled = true;
  knopf.textContent = "Einen Moment …";
  try {
    if (pinModus === "bestaetigen") {
      if (pin !== ersterPin) {
        ersterPin = "";
        pinZeigen("festlegen", "Die beiden PINs waren verschieden – bitte noch einmal.");
        return;
      }
      await T.speichern(neuerToken, pin);
      gh.tokenSetzen(neuerToken);
      neuerToken = null;
      ersterPin = "";
      appStarten();
      return;
    }
    const r = await T.oeffnen(pin);
    if (r.ok) {
      gh.tokenSetzen(r.token);
      appStarten();
    } else if (r.geloescht) {
      verbindenZeigen("5 falsche PINs – der Token wurde aus Sicherheitsgründen gelöscht. Bitte neu verbinden.");
    } else {
      $("pin-feld").value = "";
      fehlerFeld("pin-fehler", "Falsche PIN – noch " + r.rest + (r.rest === 1 ? " Versuch" : " Versuche") + ", dann wird der Token gelöscht.");
    }
  } catch (e) {
    fehlerFeld("pin-fehler", e.message || "Fehler beim Verschlüsseln.");
  } finally {
    knopf.disabled = false;
    if (knopf.textContent === "Einen Moment …") knopf.textContent = vorher;
  }
}

function pinVergessen() {
  if (pinModus !== "eingeben") {
    neuerToken = null;
    ersterPin = "";
    verbindenZeigen();
    return;
  }
  A.dialog({
    titel: "Neu verbinden?",
    inhalt: ["Der gespeicherte Token wird von diesem iPhone gelöscht. Danach brauchst du einen Token (den alten auf github.com widerrufen und einen neuen anlegen) und legst eine neue PIN fest."],
    okText: "Löschen", okKlasse: "gefahr",
    onOk: async () => { T.loeschen(); verbindenZeigen(); return true; },
  });
}

function sperren() {
  if (demo) return;
  entsperrt = false;
  gh.tokenSetzen(null);
  Z.handy = Z.news = null;
  Z.fehlerHandy = Z.fehlerNews = null;
  for (const k of [...Object.keys(ANSICHT), "mehr"]) leeren($("t-" + k));
  A.dialogZu();
  meldung("");
  if (T.vorhanden()) pinZeigen("eingeben");
  else verbindenZeigen();
}

// ------------------------------------------------------------------ App

function appStarten() {
  entsperrt = true;
  schirm("app");
  $("demo-band").hidden = !demo;
  reiterZeigen(reiter);
  laden();
}

function reiterZeigen(r) {
  reiter = r;
  for (const k of Object.keys(TITEL)) $("t-" + k).hidden = k !== r;
  for (const b of document.querySelectorAll(".reiter")) b.classList.toggle("aktiv", b.dataset.reiter === r);
  $("kopf-titel").textContent = TITEL[r];
  zeichnen();
  window.scrollTo(0, 0);
}

function zeichnen() {
  if (!entsperrt) return;
  A.modiSetzen(Z.handy && Z.handy.modi);
  const el = $("t-" + reiter);
  leeren(el);
  const teile = reiter === "mehr"
    ? V.mehr(Z, { demo, pushHash, appVersion: APP_VERSION, onPushAn: pushAn, onPushAus: pushAus, onSperren: sperren, onAbmelden: abmelden })
    : ANSICHT[reiter](Z);
  for (const t of teile) if (t) el.appendChild(t);
  standZeigen();
}

function standZeigen() {
  const s = $("kopf-stand");
  const d = Z.handy;
  if (!d || !d.stand) {
    s.textContent = Z.laedt ? "lädt …" : "–";
    s.classList.remove("alt");
    return;
  }
  const min = F.minutenSeit(d.stand);
  s.textContent = "Stand " + F.vor(d.stand) + " (" + F.zeit(d.stand) + ")" + (Z.laedt ? " · lädt …" : "");
  s.classList.toggle("alt", min !== null && min > ALT_AB_MIN);
}

/** Demo: alle Zeitangaben so verschieben, als wären die Beispiel-Daten gerade erst entstanden. */
function demoZeiten(x, versatz) {
  if (typeof x === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(x)) {
    const d = F.datum(x);
    return d ? new Date(d.getTime() + versatz).toISOString().replace(/\.\d{3}Z$/, "+00:00") : x;
  }
  if (Array.isArray(x)) return x.map((y) => demoZeiten(y, versatz));
  if (x && typeof x === "object") {
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = demoZeiten(v, versatz);
    return o;
  }
  return x;
}

async function laden() {
  if (Z.laedt || !entsperrt) return;
  Z.laedt = true;
  $("knopf-aktualisieren").classList.add("dreht");
  standZeigen();
  const [a, b] = await Promise.allSettled([gh.lesen("cloud/handy.json"), gh.lesen("cloud/news.json")]);
  Z.laedt = false;
  $("knopf-aktualisieren").classList.remove("dreht");
  if (!entsperrt) return; // inzwischen gesperrt
  const versatz = demo ? Date.now() - 3 * 60000 - DEMO_BEZUG : 0;
  if (a.status === "fulfilled") {
    Z.handy = demo ? demoZeiten(a.value, versatz) : a.value;
    Z.fehlerHandy = null;
  } else {
    Z.fehlerHandy = a.reason && a.reason.message ? a.reason.message : "Daten nicht lesbar.";
  }
  if (b.status === "fulfilled") {
    Z.news = demo ? demoZeiten(b.value, versatz) : b.value;
    Z.fehlerNews = null;
  } else {
    Z.fehlerNews = b.reason && b.reason.message ? b.reason.message : "Nachrichten nicht lesbar.";
  }
  Z.geladenUm = Date.now();
  if (Z.fehlerHandy) meldung((Z.handy ? "Aktualisieren fehlgeschlagen – du siehst den letzten Stand. " : "") + Z.fehlerHandy);
  else if (Z.handy && Z.handy.format > 1) meldung("Die Cloud liefert ein neueres Datenformat – bitte die App neu laden (oben ziehen oder schließen und neu öffnen).", "info");
  else meldung("");
  zeichnen();
  if (Z.handy) {
    A.pruefen(Z.handy);
    pushPruefen();
  }
}

function abmelden() {
  A.dialog({
    titel: "Abmelden?",
    inhalt: ["Token und PIN werden von diesem iPhone gelöscht. Zum Wiederverbinden brauchst du einen Token (am besten den alten auf github.com widerrufen und einen neuen anlegen)."],
    okText: "Abmelden", okKlasse: "gefahr",
    onOk: async () => {
      T.loeschen();
      Z.handy = Z.news = null;
      for (const k of [...Object.keys(ANSICHT), "mehr"]) leeren($("t-" + k));
      verbindenZeigen("Abgemeldet – Token und PIN sind gelöscht.");
      return true;
    },
  });
}

// ------------------------------------------------------------------ Push

async function pushPruefen() {
  if (demo || !P.alsHomeApp() || !P.unterstuetzt() || !P.schluesselDa()) return;
  const sub = await P.aktuellesAbo();
  const vorher = pushHash;
  pushHash = sub ? (await P.aboDaten(sub).catch(() => null))?.hash || null : null;
  if (pushHash !== vorher && reiter === "mehr") zeichnen();
  // Abo am Gerät, aber in der Cloud nicht (mehr) bekannt (z. B. vom Push-Dienst abgelaufen): höchstens alle 6 h still neu anmelden
  const pt = Z.handy && Z.handy.push;
  if (!sub || !pt || pt.vapid_eingerichtet !== true || P.erlaubnis() !== "granted" || A.offenerAuftrag() || !A.erlaubt("push_abo")) return;
  if ((pt.abos || []).some((a) => a.hash === pushHash)) return;
  let zuletzt = 0;
  try { zuletzt = parseInt(localStorage.getItem("fh_push_auto") || "0", 10) || 0; } catch { /* egal */ }
  if (Date.now() - zuletzt < 6 * 3600000) return;
  try { localStorage.setItem("fh_push_auto", String(Date.now())); } catch { /* egal */ }
  try {
    const daten = await P.aboDaten(sub);
    await A.senden("push_abo", daten.json);
  } catch { /* beim nächsten Mal */ }
}

function pushAn() {
  if (A.offenerAuftrag()) {
    A.ausfuehren("push_abo"); // zeigt „Bitte kurz warten“
    return;
  }
  // abonnieren() fragt die Erlaubnis sofort an – muss direkt im Tipp passieren (iOS)
  P.abonnieren().then(async (daten) => {
    pushHash = daten.hash;
    await A.senden("push_abo", daten.json);
    zeichnen();
  }).catch((e) => {
    toast(e && e.message ? e.message : "Benachrichtigungen konnten nicht eingerichtet werden.");
    zeichnen();
  });
}

function pushAus() {
  if (A.offenerAuftrag()) {
    A.ausfuehren("push_abo");
    return;
  }
  A.dialog({
    titel: "Push abbestellen?",
    inhalt: ["Dieses iPhone bekommt dann keine Mitteilungen der Finanz-App mehr."],
    okText: "Abbestellen", okKlasse: "gefahr",
    onOk: async () => {
      const hsh = (await P.abbestellen()) || pushHash;
      pushHash = null;
      if (hsh) await A.senden("push_abo", "loeschen:" + hsh);
      zeichnen();
      return true;
    },
  });
}

// ------------------------------------------------------------------ Start

function verdrahten() {
  $("verbinden-knopf").addEventListener("click", verbinden);
  $("token-feld").addEventListener("keydown", (e) => { if (e.key === "Enter") verbinden(); });
  $("pin-knopf").addEventListener("click", pinWeiter);
  $("pin-feld").addEventListener("keydown", (e) => { if (e.key === "Enter") pinWeiter(); });
  $("pin-feld").addEventListener("input", () => { $("pin-feld").value = $("pin-feld").value.replace(/\D/g, "").slice(0, 6); });
  $("pin-vergessen").addEventListener("click", pinVergessen);
  $("knopf-aktualisieren").addEventListener("click", () => laden());
  $("knopf-mehr").addEventListener("click", () => reiterZeigen(reiter === "mehr" ? "uebersicht" : "mehr"));
  for (const b of document.querySelectorAll(".reiter")) b.addEventListener("click", () => reiterZeigen(b.dataset.reiter));

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      verstecktSeit = Date.now();
      return;
    }
    if (entsperrt && !demo && verstecktSeit && Date.now() - verstecktSeit > SPERRE_NACH_MS) {
      sperren();
      return;
    }
    if (entsperrt && Date.now() - Z.geladenUm > 2 * 60000) laden();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && entsperrt && !demo && verstecktSeit && Date.now() - verstecktSeit > SPERRE_NACH_MS) sperren();
  });
  window.addEventListener("online", () => { if (entsperrt) laden(); });
  window.addEventListener("offline", () => { if (entsperrt) meldung("Du bist offline – du siehst den letzten Stand."); });
  setInterval(() => { if (entsperrt) standZeigen(); }, 30000);
}

function start() {
  verdrahten();
  A.dialogVerdrahten();
  A.init({ neuLaden: laden, toast, handy: () => Z.handy, entsperrt: () => entsperrt });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { /* ohne Offline-Hülle geht es auch */ });
  }
  if (demo) {
    gh.demoSetzen(true);
    appStarten();
    return;
  }
  $("demo-link").hidden = false;
  if (!T.verfuegbar()) {
    verbindenZeigen("Dieser Browser kann den Token nicht sicher verschlüsseln (nur über https möglich).");
    $("verbinden-knopf").disabled = true;
    return;
  }
  if (T.vorhanden()) pinZeigen("eingeben");
  else verbindenZeigen();
}

start();
