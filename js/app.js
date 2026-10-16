// Hauptablauf: Verbinden (Token) → PIN festlegen → App; beim Öffnen und nach 5 min im Hintergrund PIN-Sperre.
// 1.2.8: optional „Mit Face ID entsperren“ (js/faceid.js: Passkey mit PRF, zweiter Umschlag) – die PIN bleibt Rückfall.
// 1.2.9: Face ID startet beim Sperrbildschirm einmal von selbst (lässt iOS das ohne Tipp nicht zu: still der Knopf).
// Daten liegen nur im Arbeitsspeicher (Z), der Token nur verschlüsselt in localStorage und entschlüsselt in github.js.

import { $, h, leeren } from "./dom.js";
import * as T from "./tresor.js";
import * as gh from "./github.js";
import * as A from "./aktionen.js";
import * as V from "./ansichten.js";
import * as P from "./push.js";
import * as F from "./format.js";
import * as K from "./kifrage.js";
import * as AL from "./alarme.js";
import * as AB from "./ausblenden.js";
import * as FI from "./faceid.js";

export const APP_VERSION = "1.2.20";
const SPERRE_NACH_MS = 5 * 60000;
const ALT_AB_MIN = 90;            // ab so alten Daten wird der Stand gelb
const DEMO_BEZUG = Date.parse("2026-10-11T06:38:34Z"); // Bezugszeit der Beispiel-Dateien in demo/

// verlauf: cloud/handy_verlauf.json (Statistik, 1.1.0); fehlerVerlauf: "nichtda" (entsteht erst mit dem nächsten Cloud-Lauf) oder Text
const Z = { handy: null, news: null, verlauf: null, fehlerHandy: null, fehlerNews: null, fehlerVerlauf: null, laedt: false, geladenUm: 0 };
const demo = new URLSearchParams(location.search).get("demo") === "1";
let reiter = "uebersicht";
let entsperrt = false;
let verstecktSeit = 0;
let pushHash = null;
let neuerToken = null;   // nur während der Einrichtung, bis die PIN steht (nie gespeichert)
let pinModus = "eingeben";
let ersterPin = "";
let faceIdStatus = null; // null = noch unbekannt, "ja" | "ohne_prf" | "nein" (FI.pruefen)
let faceIdAnfrage = null;     // AbortController der laufenden Face-ID-Anfrage – nie zwei get() gleichzeitig
let faceIdAutoVersucht = false; // pro Sperre höchstens EIN automatischer Versuch (wieder frei: neu sperren/öffnen, zurück aus dem Hintergrund)
let faceIdEndeUm = 0;         // wann die letzte Face-ID-Anfrage endete
let verstecktBeiFaceId = false; // Seite wurde während/gleich nach einer Face-ID-Anfrage verdeckt (das iOS-Blatt selbst)

const TITEL = { uebersicht: "Übersicht", kern: "Coin-Bot", raster: "Raster-Bot", trend: "Trend-Bot", news: "News", mehr: "Einstellungen" };
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
  faceIdAbbrechen();
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
  // Face ID eingerichtet: zuerst „Mit Face ID entsperren“ anbieten (Knopf – iOS verlangt dafür einen Tipp), PIN darunter
  const mitFaceId = modus === "eingeben" && FI.eingerichtet();
  $("faceid-block").hidden = !mitFaceId;
  $("pin-knopf").className = "knopf voll" + (mitFaceId ? "" : " primaer");
  if (mitFaceId) {
    $("pin-titel").textContent = "Entsperren";
    $("pin-text").textContent = "Mit Face ID oder mit deiner PIN.";
  }
  schirm("pin");
  if (!mitFaceId || fehler) setTimeout(() => $("pin-feld").focus(), 60);
  if (mitFaceId && !fehler) faceIdAuto();
}

/** Laufende Face-ID-Anfrage abbrechen (PIN-Entsperren, Neu verbinden, Seitenwechsel). */
function faceIdAbbrechen() {
  if (faceIdAnfrage) faceIdAnfrage.abort();
}

/**
 * 1.2.9: einmal pro Sperre automatisch Face ID starten – nur bei sichtbarer Seite, gezeigtem Sperrbildschirm und eingerichtetem
 * Face ID, nie parallel zu einer laufenden Anfrage. Lässt iOS das ohne Tipp nicht zu, bleibt still der Knopf.
 */
function faceIdAuto() {
  if (faceIdAutoVersucht || faceIdAnfrage || entsperrt || demo || pinModus !== "eingeben" || $("s-pin").hidden
    || document.visibilityState !== "visible" || !FI.eingerichtet()) return;
  faceIdStart(true);
}

/** Tipp auf „Mit Face ID entsperren“: get() muss sofort im Tipp starten (FI.oeffnen ruft es ohne vorheriges await auf). */
function faceIdEntsperren() {
  if ($("faceid-knopf").disabled || entsperrt) return;
  faceIdStart(false);
}

async function faceIdStart(auto) {
  if (faceIdAnfrage || entsperrt) return;   // keine zweite Anfrage, solange eine läuft
  faceIdAutoVersucht = true;                 // auch nach einem Tipp kein automatischer Versuch mehr in dieser Sperre
  const ctrl = new AbortController();
  faceIdAnfrage = ctrl;
  const knopf = $("faceid-knopf");
  if (!auto) fehlerFeld("pin-fehler", "");
  knopf.disabled = true;
  knopf.textContent = "Warte auf Face ID …";
  let r;
  try {
    r = await FI.oeffnen(ctrl.signal);
  } catch {
    r = { ok: false, art: "fehler" };
  }
  if (faceIdAnfrage === ctrl) faceIdAnfrage = null;
  faceIdEndeUm = Date.now();
  knopf.disabled = false;
  knopf.textContent = "Mit Face ID entsperren";
  if (ctrl.signal.aborted || entsperrt || pinModus !== "eingeben") return; // abgebrochen / inzwischen mit der PIN entsperrt
  // Automatischer Versuch von iOS abgelehnt (kein Tipp) oder Blatt abgebrochen: still – der Knopf bleibt, kein Zähler
  if (!r.ok && auto && (r.art === "abgebrochen" || r.art === "sicherheit" || r.art === "fehler")) return;
  if (r.ok) {
    T.fehlerZuruecksetzen();
    gh.tokenSetzen(r.token);
    appStarten();
    return;
  }
  // Fehlversuche mit Face ID zählen NICHT zu den PIN-Fehlversuchen – einfach die PIN anbieten
  const nochDa = FI.eingerichtet();
  pinZeigen("eingeben", FI.text(r.art) + (nochDa
    ? " Entsperre mit deiner PIN – oder versuch es noch einmal mit Face ID."
    : " Entsperre mit deiner PIN und richte Face ID in den Einstellungen neu ein."));
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
    inhalt: ["Der gespeicherte Token wird von diesem iPhone gelöscht (auch Face ID, falls eingerichtet). Danach brauchst du einen Token (den alten auf github.com widerrufen und einen neuen anlegen) und legst eine neue PIN fest."],
    okText: "Löschen", okKlasse: "gefahr",
    onOk: async () => { T.loeschen(); verbindenZeigen(); return true; },
  });
}

/** manuell = „Jetzt sperren“ getippt: dann KEIN automatisches Face ID (sonst wäre die App sofort wieder offen). */
function sperren(manuell) {
  if (demo) return;
  entsperrt = false;
  gh.tokenSetzen(null);
  Z.handy = Z.news = Z.verlauf = null;
  Z.fehlerHandy = Z.fehlerNews = Z.fehlerVerlauf = null;
  for (const k of [...Object.keys(ANSICHT), "mehr"]) leeren($("t-" + k));
  V.klappAllesZu();                    // 1.2.19: nach dem Entsperren ist die Übersicht wieder kurz
  A.dialogZu();
  K.vergessen();
  meldung("");
  faceIdAutoVersucht = manuell === true; // neue Sperre: wieder ein automatischer Face-ID-Versuch (nicht nach „Jetzt sperren“)
  if (T.vorhanden()) pinZeigen("eingeben");
  else verbindenZeigen();
}

// ------------------------------------------------------------------ App

function appStarten() {
  faceIdAbbrechen();
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
    ? V.mehr(Z, { demo, pushHash, appVersion: APP_VERSION, onPushAn: pushAn, onPushAus: pushAus, onSperren: () => sperren(true), onAbmelden: abmelden,
      faceId: demo ? null : { status: faceIdStatus, eingerichtet: FI.eingerichtet(), seit: FI.seit(), nichtMoeglich: FI.nichtMoeglichGemerkt() },
      onFaceIdEinrichten: faceIdEinrichten, onFaceIdEntfernen: faceIdEntfernen })
    : ANSICHT[reiter](Z);
  for (const t of teile) if (t) el.appendChild(t);
  standZeigen();
  K.knopfZeigen(true);
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
  const [a, b, c] = await Promise.allSettled([gh.lesen("cloud/handy.json"), gh.lesen("cloud/news.json"), gh.lesen("cloud/handy_verlauf.json")]);
  Z.laedt = false;
  $("knopf-aktualisieren").classList.remove("dreht");
  if (!entsperrt) return; // inzwischen gesperrt
  const versatz = demo ? Date.now() - 3 * 60000 - DEMO_BEZUG : 0;
  if (a.status === "fulfilled") {
    Z.handy = demo ? demoZeiten(a.value, versatz) : a.value;
    Z.fehlerHandy = null;
    AL.sichtbar(Z.handy.alarme, true);           // was handy.json nicht mehr zeigt (gelesen), ist bestätigt
  } else {
    Z.fehlerHandy = a.reason && a.reason.message ? a.reason.message : "Daten nicht lesbar.";
  }
  if (b.status === "fulfilled") {
    Z.news = demo ? demoZeiten(b.value, versatz) : b.value;
    Z.fehlerNews = null;
  } else {
    // news.json entsteht erst mit dem ersten Bericht bzw. „News aktualisieren“ – das ist kein Token-Fehler (handy.json kam ja an)
    Z.fehlerNews = (b.reason && b.reason.art === "nichtda" && a.status === "fulfilled")
      ? "Noch keine News geholt. Tippe auf „News aktualisieren“ – in ein paar Minuten sind sie da (sonst kommen sie mit dem nächsten Bericht)."
      : (b.reason && b.reason.message ? b.reason.message : "News nicht lesbar.");
  }
  if (c.status === "fulfilled" && c.value && Array.isArray(c.value.punkte)) {
    Z.verlauf = demo ? demoZeiten(c.value, versatz) : c.value;
    Z.fehlerVerlauf = null;
  } else if (c.status === "fulfilled") {
    Z.fehlerVerlauf = "unbekanntes Format";
  } else if (!Z.verlauf) {
    // handy_verlauf.json entsteht erst mit dem ersten Cloud-Lauf ab Finanz-App V1.2 (11.10.2026) – kein Fehler, nur ein Hinweis
    Z.fehlerVerlauf = c.reason && c.reason.art === "nichtda" && a.status === "fulfilled" ? "nichtda"
      : (c.reason && c.reason.message ? c.reason.message : "nicht lesbar");
  }
  Z.geladenUm = Date.now();
  if (Z.fehlerHandy) meldung((Z.handy ? "Aktualisieren fehlgeschlagen – du siehst den letzten Stand. " : "") + Z.fehlerHandy);
  else if (Z.handy && Z.handy.format > 1) meldung("Die Cloud liefert ein neueres Datenformat – bitte die App neu laden (oben ziehen oder schließen und neu öffnen).", "info");
  else meldung("");
  zeichnen();
  if (Z.handy) {
    A.pruefen(Z.handy);
    pushPruefen();
    if (K.istOffen()) K.laden(true);
  }
}

function abmelden() {
  A.dialog({
    titel: "Abmelden?",
    inhalt: ["Token und PIN (und Face ID, falls eingerichtet) werden von diesem iPhone gelöscht. Zum Wiederverbinden brauchst du einen Token (am besten den alten auf github.com widerrufen und einen neuen anlegen)."],
    okText: "Abmelden", okKlasse: "gefahr",
    onOk: async () => {
      T.loeschen(); // löscht auch den Face-ID-Umschlag
      Z.handy = Z.news = Z.verlauf = null;
      for (const k of [...Object.keys(ANSICHT), "mehr"]) leeren($("t-" + k));
      K.vergessen();
      verbindenZeigen("Abgemeldet – Token und PIN sind gelöscht.");
      return true;
    },
  });
}

// ------------------------------------------------------------------ Face ID (1.2.8)

function passkeyLoeschenText() {
  return "Den Passkey selbst kannst du in der App „Passwörter“ löschen (älteres iOS: Einstellungen → Passwörter): nach „"
    + location.hostname + "“ suchen → Eintrag „Finanzen Handy …“ → Löschen.";
}

/**
 * Einrichten in zwei Schritten: 1. App-PIN (T.oeffnen – falsche PIN zählt wie beim Entsperren, nach 5 ist der Token weg), damit
 * niemand Face ID einrichtet, der nur das kurz entsperrte iPhone (und den iPhone-Code) hat; in den Face-ID-Umschlag kommt GENAU der
 * mit dieser PIN entschlüsselte Token. 2. eigener Knopf „Weiter mit Face ID“ – iOS erlaubt create() nur direkt im Tipp.
 */
function faceIdEinrichten() {
  if (demo || !entsperrt || !T.vorhanden()) {
    toast("Face ID lässt sich nur einrichten, wenn die App mit Token und PIN entsperrt ist.");
    return;
  }
  const feld = h("input", {
    id: "faceid-pin", class: "pin-feld", type: "password", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "off",
    maxlength: 6, "aria-label": "App-PIN", enterkeyhint: "done",
    oninput: () => { feld.value = feld.value.replace(/\D/g, "").slice(0, 6); },
    onkeydown: (e) => { if (e.key === "Enter") $("dialog-ok").click(); },
  });
  A.dialog({
    titel: "Face ID einrichten",
    inhalt: [
      "Zuerst deine App-PIN – so kann niemand Face ID einrichten, der nur das entsperrte iPhone in der Hand hat. Eine falsche PIN zählt wie beim Entsperren (5 falsche löschen den Token).",
      feld,
    ],
    okText: "PIN prüfen",
    onOk: async () => {
      const pin = feld.value.trim();
      if (!T.pinGueltig(pin)) throw new Error("Die PIN hat 4 bis 6 Ziffern.");
      const r = await T.oeffnen(pin);
      if (r.geloescht) {
        tokenWegNachFehlversuchen();
        return true;
      }
      if (!r.ok) {
        feld.value = "";
        throw new Error("Falsche PIN – noch " + r.rest + (r.rest === 1 ? " Versuch" : " Versuche") + ", dann wird der Token gelöscht.");
      }
      if (!entsperrt) return true; // inzwischen gesperrt
      const token = r.token; // genau dieser Token kommt in den Face-ID-Umschlag
      A.dialog({
        titel: "PIN stimmt ✓",
        inhalt: [
          "Jetzt legt das iPhone einen Passkey für diese App an und fragt Face ID ab. Mit einem Schlüssel aus dem Passkey wird dein Token zusätzlich verschlüsselt auf diesem iPhone gespeichert.",
          "Dein Gesicht verlässt das iPhone nie. Der Passkey wird über den iCloud-Schlüsselbund synchronisiert. Die PIN bleibt als Rückfall.",
        ],
        okText: "Weiter mit Face ID",
        onOk: () => faceIdAnlegen(token), // create() startet sofort im Tipp auf „Weiter mit Face ID“
      });
      return true;
    },
  });
}

/** 5. falsche PIN im Einrichten-Dialog: Token ist gelöscht (wie beim Entsperren) -> alles weg, neu verbinden. */
function tokenWegNachFehlversuchen() {
  A.dialogZu();
  Z.handy = Z.news = Z.verlauf = null;
  for (const k of [...Object.keys(ANSICHT), "mehr"]) leeren($("t-" + k));
  K.vergessen();
  verbindenZeigen("5 falsche PINs – der Token wurde aus Sicherheitsgründen gelöscht. Bitte neu verbinden.");
}

async function faceIdAnlegen(token) {
  const a = await FI.anlegen();
  if (a.art === "prf") return faceIdAbschliessen(token, a.id, a.salz, a.prf);
  if (a.art !== "get_noetig") return faceIdNichtEingerichtet(a.art, false);
  // create() lieferte keine PRF-Ausgabe (iOS teils erst bei get()) -> gleich mit demselben Passkey holen
  const b = await FI.prfHolen(a.id, a.salz);
  if (b.art === "prf") return faceIdAbschliessen(token, a.id, a.salz, b.prf);
  if (b.art === "abgebrochen") {
    // iOS lässt get() direkt nach create() oft nicht ohne neuen Tipp zu -> eigener Schritt mit Knopf
    A.dialog({
      titel: "Noch ein Schritt",
      inhalt: ["Der Passkey ist angelegt. Bestätige jetzt noch einmal mit Face ID, damit er den Schlüssel liefert.",
        "Brichst du ab, bleibt es bei der PIN. " + passkeyLoeschenText()],
      okText: "Mit Face ID bestätigen",
      onOk: async () => {
        const c = await FI.prfHolen(a.id, a.salz); // get() sofort im Tipp
        return c.art === "prf" ? faceIdAbschliessen(token, a.id, a.salz, c.prf) : faceIdNichtEingerichtet(c.art, true);
      },
    });
    return true;
  }
  return faceIdNichtEingerichtet(b.art, true);
}

async function faceIdAbschliessen(token, id, salz, prf) {
  if (!entsperrt) {
    prf.fill(0);
    throw new Error("Die App wurde inzwischen gesperrt – bitte mit der PIN entsperren und Face ID neu einrichten.");
  }
  await FI.speichern(token, id, salz, prf);
  toast("Face ID ist eingerichtet ✓ – beim nächsten Entsperren kannst du Face ID statt der PIN nehmen.");
  if (reiter === "mehr") zeichnen();
  return true;
}

function faceIdNichtEingerichtet(art, passkeyAngelegt) {
  if (art === "kein_prf") {
    FI.nichtMoeglichMerken();
    A.dialog({
      titel: "Face ID hier nicht möglich",
      inhalt: ["Face ID ist auf diesem Gerät nicht möglich – die PIN bleibt.",
        "Dein iPhone hat für den Passkey keinen Schlüssel geliefert (Passkey-Erweiterung „PRF“, braucht ein neueres iOS). Ohne diesen Schlüssel könnte die App den Token nicht sicher verschlüsseln – eine schwächere Variante gibt es bewusst nicht.",
        passkeyLoeschenText()],
      okText: "Verstanden", nurOk: true,
    });
    if (reiter === "mehr") zeichnen();
    return true;
  }
  if (art === "abgebrochen") {
    toast("Face ID wurde nicht eingerichtet – es bleibt bei der PIN." + (passkeyAngelegt ? " " + passkeyLoeschenText() : ""));
    return true;
  }
  throw new Error(FI.text(art) + " Face ID wurde nicht eingerichtet – es bleibt bei der PIN.");
}

function faceIdEntfernen() {
  A.dialog({
    titel: "Face ID entfernen?",
    inhalt: ["Der Face-ID-Umschlag wird von diesem iPhone gelöscht – entsperren geht dann nur noch mit der PIN.",
      "Der Passkey bleibt im iCloud-Schlüsselbund. " + passkeyLoeschenText()],
    okText: "Entfernen", okKlasse: "gefahr",
    onOk: async () => {
      FI.entfernen();
      toast("Face ID entfernt – es gilt wieder nur die PIN.");
      zeichnen();
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
  $("faceid-knopf").addEventListener("click", faceIdEntsperren);
  $("knopf-aktualisieren").addEventListener("click", () => laden());
  $("knopf-mehr").addEventListener("click", () => reiterZeigen(reiter === "mehr" ? "uebersicht" : "mehr"));
  for (const b of document.querySelectorAll(".reiter")) b.addEventListener("click", () => reiterZeigen(b.dataset.reiter));

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      verstecktSeit = Date.now();
      // verdeckt das iOS-Face-ID-Blatt selbst die Seite, ist das kein „zurück aus dem Hintergrund“ (sonst Endlosschleife)
      verstecktBeiFaceId = !!faceIdAnfrage || Date.now() - faceIdEndeUm < 1000;
      return;
    }
    if (entsperrt && !demo && verstecktSeit && Date.now() - verstecktSeit > SPERRE_NACH_MS) {
      sperren();
      return;
    }
    // gesperrt und zurück aus dem Hintergrund: wieder EIN automatischer Face-ID-Versuch
    if (!entsperrt && !demo && !verstecktBeiFaceId && !faceIdAnfrage) {
      faceIdAutoVersucht = false;
      faceIdAuto();
    }
    verstecktBeiFaceId = false;
    if (entsperrt && Date.now() - Z.geladenUm > 2 * 60000) laden();
  });
  window.addEventListener("pagehide", faceIdAbbrechen);
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
  A.init({ neuLaden: laden, toast, handy: () => Z.handy, entsperrt: () => entsperrt, fertig: (a) => K.auftragFertig(a), geaendert: () => K.zeichnen() });
  K.init({ toast, entsperrt: () => entsperrt, handy: () => Z.handy, neuZeichnen: () => { if (entsperrt) zeichnen(); } });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { /* ohne Offline-Hülle geht es auch */ });
  }
  AL.init({ neuZeichnen: () => { if (entsperrt) zeichnen(); }, toast, entsperrt: () => entsperrt }, demo);
  AB.init({ neuZeichnen: () => { if (entsperrt) zeichnen(); }, toast, entsperrt: () => entsperrt }, demo);
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
  FI.pruefen().then((s) => {
    faceIdStatus = s;
    if (entsperrt && reiter === "mehr") zeichnen();
  });
  if (T.vorhanden()) pinZeigen("eingeben");
  else verbindenZeigen();
}

start();
