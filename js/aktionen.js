// Aufträge an die Cloud (ki.yml): nur Modi aus handy.json → „modi“; Bestätigung wird nach dem Muster aus Formularfeldern gebaut,
// gegen den regulären Ausdruck aus handy.json geprüft und erst dann geschickt. Schalt-Modi mit „ja_noetig“ verlangen ein wörtlich
// getipptes JA. Nach einem Auftrag wartet die App, bis er durch ist (Warteschlange der Cloud), „Alles stoppen“ hat Vorrang.

import { h, $, leeren } from "./dom.js";
import * as gh from "./github.js";
import { datum, vor } from "./format.js";

let hooks = { neuLaden: () => {}, toast: () => {}, handy: () => null, entsperrt: () => true };
let modiListe = [];

const OFFEN_KEY = "fh_auftrag";
const WARTEN_MAX_MIN = 20;

export function init(h0) {
  hooks = Object.assign(hooks, h0);
  setInterval(() => {
    if (offen && document.visibilityState === "visible" && hooks.entsperrt()) pruefen(null);
    bandZeichnen();
  }, 20000);
  bandZeichnen();
}

// ------------------------------------------------------------------ erlaubte Modi

export function modiSetzen(liste) {
  modiListe = Array.isArray(liste) ? liste.filter((m) => m && typeof m.modus === "string" && typeof m.bestaetigung === "string") : [];
}
export function eintrag(m) {
  return modiListe.find((x) => x.modus === m) || null;
}
export function erlaubt(m) {
  return !!eintrag(m) && !!SPEZ[m];
}

/** Muster aus handy.json als „ganzer Text“-Ausdruck (wie Pythons re.fullmatch). */
export function ausdruck(muster) {
  if (muster === "") return /^$/;
  for (const flags of ["u", ""]) {
    try {
      return new RegExp("^(?:" + muster + ")$", flags);
    } catch { /* nächste Variante */ }
  }
  return null;
}
export function passt(m, bestaetigung) {
  const e = eintrag(m);
  if (!e) return false;
  const r = ausdruck(e.bestaetigung);
  return !!r && r.test(bestaetigung);
}

// ------------------------------------------------------------------ Feld-Helfer

function betragText(roh) {
  const s = String(roh ?? "").replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
  return parseFloat(s) > 0 ? s : null;
}
const BETRAG = (label, hilfe) => ({ name: "betrag", art: "betrag", label: label || "Betrag in Euro", hilfe });
const DECKEL = { name: "prozent", art: "zahl", label: "Verlustdeckel in Prozent", hilfe: "0 = kein Deckel, sonst 10 bis 60" };
function deckelPruefen(w) {
  const p = parseInt(w.prozent, 10);
  if (!/^\d{1,2}$/.test(String(w.prozent).trim()) || !(p === 0 || (p >= 10 && p <= 60))) return "Verlustdeckel: 0 oder 10 bis 60.";
  return null;
}
function betragPruefen(w) {
  return betragText(w.betrag) ? null : "Bitte einen Betrag in Euro eingeben (z. B. 200 oder 150,50; höchstens 99.999).";
}

// ------------------------------------------------------------------ was jeder Modus im Dialog zeigt

const SPEZ = {
  einschaetzung: { titel: "Frische KI-Einschätzung", text: "Die Cloud holt eine neue Einschätzung des Kern-Bots und schickt sie dir per Mail. Es wird nicht gehandelt.", ok: "Anfordern" },
  bericht_jetzt: { titel: "Bericht jetzt", text: "Frische Einschätzung und Bericht per Mail – es wird nie gehandelt.", ok: "Anfordern" },
  news_jetzt: { titel: "News aktualisieren", ohneFrage: true },
  start: { titel: "Kern-Bot einschalten", text: "Der Kern-Bot entscheidet und handelt dann wieder selbst (mit Notbremse und Gewinnschutz)." },
  stopp: { titel: "Kern-Bot ausschalten", text: "Der Kern-Bot handelt nicht mehr selbst. Der Kern-Topf bleibt, wie er ist." },
  allesstopp: {
    titel: "Alles stoppen", gefahr: true, ok: "Alles stoppen",
    text: "Kern-Bot, Regelwerk und Aktien-Autopilot gehen aus, Raster- und Trend-Bot werden pausiert (offene Orders storniert). Deine Bestände bleiben liegen – es wird nichts verkauft.",
  },
  regelwerk_ein: { titel: "Regelwerk einschalten", text: "Das Regelwerk ohne KI wird eingeschaltet." },
  euro_ein: { titel: "Euro-Automatik einschalten", text: "Euro-Guthaben bei Bitpanda wird dann automatisch eingesetzt." },
  euro_aus: { titel: "Euro-Automatik ausschalten", text: "Euro-Guthaben bleibt liegen, bis du selbst entscheidest." },
  einstellung: {
    titel: "Stufe des Kern-Bots",
    text: "Die Stufe bestimmt die Grenzen von Notbremse und Gewinnschutz.",
    felder: [
      { name: "stufe", art: "wahl", label: "Stufe", optionen: [["sicher", "sicher"], ["normal", "normal"]] },
      { name: "auto", art: "schalter", label: "Stufe folgt automatisch der Empfehlung" },
    ],
    bauen: (w) => "JA;stufe=" + w.stufe + ";auto=" + (w.auto ? "1" : "0"),
  },
  gewinnschutz_ein: { titel: "Gewinnschutz Krypto einschalten", text: "Fällt der Kurs um die Grenze der Stufe unter den Höchststand, parkt der Kern-Bot." },
  gewinnschutz_aus: { titel: "Gewinnschutz Krypto ausschalten", text: "Ohne Gewinnschutz wird bei fallenden Kursen nicht mehr automatisch geparkt (die Notbremse bleibt)." },
  gewinnschutz_aktien_ein: { titel: "Gewinnschutz Aktien/ETF einschalten" },
  gewinnschutz_aktien_aus: { titel: "Gewinnschutz Aktien/ETF ausschalten" },
  aktien_start: { titel: "Aktien-Autopilot einschalten" },
  aktien_stopp: { titel: "Aktien-Autopilot ausschalten" },

  surfen_ein: { titel: "Raster-Bot einschalten", text: "Der Betrag kommt aus dem Kern-Topf.", felder: [BETRAG()], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  surfen_betrag: { titel: "Raster-Topf ändern", text: "Neuer Betrag für den Raster-Topf.", felder: [BETRAG("Neuer Topf in Euro")], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  surfen_zurueck: {
    titel: "Raster-Bot: Teil zurück in den Kern-Topf",
    felder: [BETRAG("Betrag zurück in Euro"), { name: "sofort", art: "schalter", label: "Sofort – auch mit Verlust verkaufen" }],
    pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) + (w.sofort ? ";sofort=JA" : ""),
  },
  surfen_aus: { titel: "Raster-Bot ausschalten", text: "Alles geht zurück in den Kern-Topf.", bauen: () => "JA" },
  surfen_pause: { titel: "Raster-Bot pausieren", text: "Er handelt nicht mehr, sein Bestand bleibt.", bauen: () => "JA" },
  surfen_deckel: { titel: "Raster-Bot: Verlustdeckel", felder: [DECKEL], pruefen: deckelPruefen, bauen: (w) => "JA;prozent=" + parseInt(w.prozent, 10) },
  surfen_recherchen: {
    titel: "Raster-Bot: Recherchen je Tag",
    felder: [{ name: "anzahl", art: "wahl", label: "Feste Recherchen je Tag", optionen: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]] }],
    bauen: (w) => "JA;anzahl=" + w.anzahl,
  },

  trend_ein: { titel: "Trend-Bot einschalten", text: "Der Betrag kommt aus dem Kern-Topf (mindestens 150 €).", felder: [BETRAG()], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  trend_betrag: { titel: "Trend-Topf ändern", felder: [BETRAG("Neuer Topf in Euro")], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  trend_zurueck: { titel: "Trend-Bot: Teil zurück in den Kern-Topf", felder: [BETRAG("Betrag zurück in Euro")], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  trend_aus: { titel: "Trend-Bot ausschalten", bauen: () => "JA" },
  trend_pause: { titel: "Trend-Bot pausieren", text: "Er handelt nicht mehr, sein Bestand bleibt.", bauen: () => "JA" },
  trend_deckel: { titel: "Trend-Bot: Verlustdeckel", felder: [DECKEL], pruefen: deckelPruefen, bauen: (w) => "JA;prozent=" + parseInt(w.prozent, 10) },

  hinweis: {
    titel: "Hinweis an die KI",
    text: "Ein kurzer Hinweis, den der Bot und die KI bei den nächsten Entscheidungen lesen. Er löst nie selbst eine Order aus.",
    ok: "Hinweis senden",
    felder: [
      { name: "text", art: "text", label: "Dein Hinweis", max: 300, hilfe: "höchstens 300 Zeichen, eine Zeile" },
      { name: "tage", art: "wahl", label: "Gültig", optionen: [["1", "1 Tag"], ["3", "3 Tage"], ["7", "7 Tage"], ["0", "bis du ihn löschst"]], vorgabe: "7" },
    ],
    pruefen: (w) => (hinweisText(w.text) ? null : "Bitte einen Hinweis eintippen."),
    bauen: (w) => "app:" + w.tage + "|" + hinweisText(w.text),
  },
  hinweis_loeschen: {
    titel: "Hinweis löschen",
    felder: [{ name: "nr", art: "zahl", label: "Nummer des Hinweises", hilfe: "steht in der Bestätigungs-Mail bzw. in der Laptop-App" }],
    pruefen: (w) => (/^\d{1,6}$/.test(String(w.nr).trim()) ? null : "Bitte die Nummer eingeben."),
    bauen: (w) => String(w.nr).trim(),
  },
  push_abo: { titel: "Benachrichtigungen", ohneFrage: true },
};

function hinweisText(t) {
  return String(t ?? "").split(/\s+/).join(" ").trim().slice(0, 300); // \s trifft auch Zeilenumbrüche und Tabs
}

/** Anzeigename eines Modus (für Band/Toast) */
export function name(m) {
  return (SPEZ[m] && SPEZ[m].titel) || (eintrag(m) && eintrag(m).text) || m;
}

// ------------------------------------------------------------------ Knöpfe

/** Knopf für einen Modus – null, wenn der Modus laut handy.json nicht erlaubt ist. */
export function knopf(m, beschriftung, klasse, vorgaben) {
  if (!erlaubt(m)) return null;
  return h("button", { type: "button", class: "knopf " + (klasse || ""), "data-modus": m, onclick: () => ausfuehren(m, vorgaben || {}) }, beschriftung);
}

// ------------------------------------------------------------------ Dialog

let dialogOk = null;
let dialogNr = 0; // jede Öffnung zählt hoch – öffnet onOk einen neuen Dialog, bleibt der offen

export function dialogZu() {
  $("dialog-huelle").hidden = true;
  dialogOk = null;
}

/**
 * Dialog öffnen. onOk: async () => true (schließen) | false (offen lassen, Fehler steht drin).
 */
export function dialog({ titel, inhalt, okText, okKlasse, nurOk, onOk }) {
  dialogNr++;
  $("dialog-titel").textContent = titel;
  leeren($("dialog-inhalt"));
  for (const n of [].concat(inhalt || [])) if (n) $("dialog-inhalt").appendChild(typeof n === "string" ? h("p", null, n) : n);
  fehlerZeigen(null);
  const ok = $("dialog-ok");
  ok.textContent = okText || "Senden";
  ok.className = "knopf " + (okKlasse || "primaer");
  ok.disabled = false;
  $("dialog-abbrechen").hidden = !!nurOk;
  dialogOk = onOk || (async () => true);
  $("dialog-huelle").hidden = false;
  const erstes = $("dialog-inhalt").querySelector("input, textarea, select");
  if (erstes) setTimeout(() => erstes.focus(), 50);
}

function fehlerZeigen(t) {
  const f = $("dialog-fehler");
  f.textContent = t || "";
  f.hidden = !t;
}

export function dialogVerdrahten() {
  $("dialog-abbrechen").addEventListener("click", dialogZu);
  $("dialog-huelle").addEventListener("click", (e) => { if (e.target === $("dialog-huelle")) dialogZu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("dialog-huelle").hidden) dialogZu(); });
  $("dialog-ok").addEventListener("click", async () => {
    if (!dialogOk) return dialogZu();
    const ok = $("dialog-ok");
    ok.disabled = true;
    const nr = dialogNr;
    try {
      const schliessen = await dialogOk();
      if (schliessen !== false && nr === dialogNr) dialogZu();
    } catch (e) {
      fehlerZeigen(e && e.message ? e.message : "Unbekannter Fehler.");
    } finally {
      ok.disabled = false;
    }
  });
}

function feldBauen(f, vorgaben) {
  const id = "f-" + f.name;
  const wert = vorgaben[f.name] ?? f.vorgabe ?? "";
  let eingabe;
  if (f.art === "wahl") {
    eingabe = h("select", { id, name: f.name }, f.optionen.map(([v, t]) => h("option", { value: v }, t)));
    if (wert !== "") eingabe.value = String(wert);
  } else if (f.art === "schalter") {
    return h("div", { class: "formfeld" }, h("label", { class: "schalter-zeile", for: id },
      h("input", { type: "checkbox", id, name: f.name, checked: !!wert }), f.label));
  } else if (f.art === "text") {
    eingabe = h("textarea", { id, name: f.name, maxlength: f.max || 300, rows: 3 });
    eingabe.value = String(wert);
  } else {
    eingabe = h("input", {
      id, name: f.name, type: "text", value: String(wert),
      inputmode: f.art === "betrag" ? "decimal" : "numeric", autocomplete: "off", enterkeyhint: "done",
    });
  }
  return h("div", { class: "formfeld" }, h("label", { for: id }, f.label), eingabe, f.hilfe ? h("div", { class: "hilfe" }, f.hilfe) : null);
}

function werteLesen(spez) {
  const w = {};
  for (const f of spez.felder || []) {
    const el = $("f-" + f.name);
    if (!el) continue;
    w[f.name] = f.art === "schalter" ? el.checked : el.value;
  }
  return w;
}

/** Bestätigungstext aus den Feldern bauen (ohne Prüfung) */
function bestaetigungBauen(m, spez, w) {
  const e = eintrag(m);
  if (spez.bauen) return spez.bauen(w);
  return e && e.ja_noetig ? "JA" : "";
}

// ------------------------------------------------------------------ ausführen

export async function ausfuehren(m, vorgaben = {}) {
  const spez = SPEZ[m];
  const e = eintrag(m);
  if (!spez || !e) {
    hooks.toast("Dieser Befehl ist gerade nicht erlaubt.");
    return;
  }
  if (offen && m !== "allesstopp" && !gh.istDemo()) {
    dialog({
      titel: "Bitte kurz warten",
      inhalt: [
        "Es läuft noch ein Auftrag: „" + name(offen.modus) + "“ (geschickt " + vor(new Date(offen.zeit).toISOString()) + ").",
        "Die Cloud arbeitet Aufträge nacheinander ab – ein neuer könnte den wartenden verdrängen. Sobald er fertig ist, kannst du den nächsten schicken. „Alles stoppen“ geht immer.",
      ],
      okText: "Verstanden", nurOk: true,
    });
    return;
  }
  if (spez.ohneFrage) {
    await senden(m, bestaetigungBauen(m, spez, {}));
    return;
  }
  const inhalt = [];
  if (spez.text) inhalt.push(h("p", null, spez.text));
  for (const f of spez.felder || []) inhalt.push(feldBauen(f, vorgaben));
  const vorschau = h("div", { class: "vorschau", id: "dialog-vorschau" });
  let jaFeld = null;
  if (e.ja_noetig) {
    jaFeld = h("input", { id: "ja-feld", class: "ja-feld", type: "text", autocomplete: "off", autocapitalize: "characters", autocorrect: "off", spellcheck: "false", placeholder: "JA", enterkeyhint: "send" });
    inhalt.push(h("div", { class: "formfeld" }, h("label", { for: "ja-feld" }, "Wirklich? Zur Bestätigung wörtlich JA eintippen:"), jaFeld));
  }
  inhalt.push(h("p", { class: "klein gedimmt" }, "Wird an die Cloud geschickt:"), vorschau);
  const huelle = h("div", null, inhalt);
  dialog({
    titel: spez.titel, inhalt: [huelle], okText: spez.ok || (e.ja_noetig ? "Mit JA senden" : "Senden"), okKlasse: spez.gefahr ? "gefahr" : "primaer",
    onOk: async () => {
      const w = werteLesen(spez);
      const fehler = spez.pruefen ? spez.pruefen(w) : null;
      if (fehler) { fehlerZeigen(fehler); return false; }
      if (jaFeld && jaFeld.value.trim() !== "JA") { fehlerZeigen("Bitte wörtlich JA (Großbuchstaben) eintippen – sonst wird nichts geschickt."); return false; }
      const best = bestaetigungBauen(m, spez, w);
      if (!passt(m, best)) { fehlerZeigen("Die Bestätigung „" + best + "“ passt nicht zum erlaubten Muster – nichts geschickt."); return false; }
      await senden(m, best);
      return true;
    },
  });
  const aktualisieren = () => {
    const best = bestaetigungBauen(m, spez, werteLesen(spez));
    vorschau.textContent = "modus = " + m + "\nbestaetigung = " + (best === "" ? "(leer)" : best);
  };
  huelle.addEventListener("input", aktualisieren);
  huelle.addEventListener("change", aktualisieren);
  aktualisieren();
}

/** Auftrag wirklich schicken (Bestätigung ist schon geprüft). Wirft ApiFehler mit deutscher Meldung. */
export async function senden(m, best) {
  if (!passt(m, best)) throw new Error("Bestätigung passt nicht zum erlaubten Muster – nichts geschickt.");
  const r = await gh.auftrag(m, best);
  if (r.demo) {
    dialog({
      titel: "Demo – nicht gesendet",
      inhalt: [
        "Im Demo-Modus wird nichts an die Cloud geschickt. Echt würde dieser Auftrag gehen:",
        h("div", { class: "vorschau", id: "demo-auftrag", "data-modus": r.nutzlast.inputs.modus, "data-bestaetigung": r.nutzlast.inputs.bestaetigung },
          JSON.stringify(r.nutzlast)),
      ],
      okText: "OK", nurOk: true,
    });
    return r;
  }
  offenSetzen({ modus: m, zeit: Date.now() });
  hooks.toast("Auftrag an die Cloud geschickt – Ergebnis in ein paar Minuten.");
  setTimeout(() => hooks.entsperrt() && hooks.neuLaden(), 2 * 60000);
  setTimeout(() => hooks.entsperrt() && hooks.neuLaden(), 5 * 60000);
  return r;
}

// ------------------------------------------------------------------ offener Auftrag (Warteschlange)

let offen = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(OFFEN_KEY) || "null");
    return o && typeof o.modus === "string" && Number.isFinite(o.zeit) ? o : null;
  } catch {
    return null;
  }
})();
let laufStatus = null;

function offenSetzen(o) {
  offen = o;
  laufStatus = null;
  try {
    if (o) localStorage.setItem(OFFEN_KEY, JSON.stringify(o));
    else localStorage.removeItem(OFFEN_KEY);
  } catch { /* egal */ }
  bandZeichnen();
}

export function offenerAuftrag() {
  return offen;
}

function bandZeichnen() {
  const b = $("auftrag-band");
  if (!b) return;
  if (!offen) { b.hidden = true; return; }
  leeren(b);
  const st = laufStatus === "in_progress" ? "läuft gerade" : laufStatus === "queued" || laufStatus === "waiting" || laufStatus === "pending" ? "wartet in der Cloud" : "unterwegs";
  b.appendChild(h("span", null, "⏳ „" + name(offen.modus) + "“ " + st + " (geschickt " + vor(new Date(offen.zeit).toISOString()) + ")"));
  b.appendChild(h("button", { type: "button", class: "knopf leise", onclick: () => { offenSetzen(null); hooks.toast("Auftrag wird nicht mehr verfolgt."); } }, "Nicht mehr warten"));
  b.hidden = false;
}

function fertig(ergebnis) {
  const m = offen.modus;
  offenSetzen(null);
  const t = ergebnis === "success" ? "erledigt ✓"
    : ergebnis === "failure" ? "fehlgeschlagen – die Cloud hat ihn abgelehnt oder es gab einen Fehler (Details in der Mail)"
    : ergebnis === "cancelled" ? "abgebrochen (vermutlich von einem neueren Auftrag verdrängt)"
    : ergebnis ? "beendet (" + ergebnis + ")" : "beendet";
  hooks.toast("„" + name(m) + "“: " + t);
  hooks.neuLaden();
}

/** Nach jedem Laden und alle 20 s: ist der offene Auftrag durch? */
export async function pruefen(handy) {
  if (!offen) return;
  const alterMin = (Date.now() - offen.zeit) / 60000;
  const d = handy || hooks.handy();
  const lauf = d && d.lauf;
  const stand = d && datum(d.stand);
  if (lauf && lauf.ausloeser === "dispatch" && lauf.modus === offen.modus && stand && stand.getTime() >= offen.zeit - 30000 && lauf.ergebnis) {
    fertig(lauf.ergebnis);
    return;
  }
  try {
    const liste = await gh.laeufe();
    const lauf2 = liste.find((x) => x.titel === "Hand: " + offen.modus && datum(x.erstellt) && datum(x.erstellt).getTime() >= offen.zeit - 120000);
    if (lauf2) {
      if (lauf2.status === "completed") { fertig(lauf2.ergebnis); return; }
      laufStatus = lauf2.status;
    }
  } catch { /* ohne Actions-Leserecht nur über handy.json */ }
  if (offen && alterMin > WARTEN_MAX_MIN) {
    const m = offen.modus;
    offenSetzen(null);
    hooks.toast("Kein Ergebnis für „" + name(m) + "“ gesehen – bitte später in der Übersicht nachsehen.");
    return;
  }
  bandZeichnen();
}
