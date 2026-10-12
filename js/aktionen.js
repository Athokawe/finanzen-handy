// Aufträge an die Cloud: nur Modi aus handy.json → „modi“; die Bestätigung wird nach dem Muster aus Formularfeldern gebaut, gegen
// den regulären Ausdruck aus handy.json geprüft und erst dann geschickt. Schalt-Modi mit „ja_noetig“ verlangen ein wörtlich
// getipptes JA.
// 1.2.4: Direkt-Umschichten zwischen Trend- und Raster-Bot (Modus bot_umschichten) – ein Modus, zwei Knöpfe; die Richtung kommt
// fest aus dem Knopf (Vorgabe „von“), nie aus einem Formularfeld.
// 1.2.0: „An die KI“ (Modus frage, js/kifrage.js) ersetzt den Hinweis-Dialog; Alarme löschen (Modus alarme_gelesen, js/alarme.js).
// 1.1.0: Brems-Befehle (handy.json: express true – „Alles parken“, „Nur anhalten“, Coin-Bot aus, Stufe → sicher, Raster/Trend
// pausieren) gehen an express.yml (eigene Warteschlange, sofort), alles andere an ki.yml. Jeder Auftrag wird über die Actions-API
// anhand des Lauf-Titels verfolgt („Express: <modus>“ bzw. „Hand: <modus>“): gesendet → angekommen → läuft → erledigt ✓ /
// fehlgeschlagen ✗. Verwirft GitHub einen Auftrag (nach ~90 s kein passender Lauf oder Lauf „abgebrochen“), schickt die App ihn
// automatisch noch einmal (Brems-Befehle bis zu 3-mal), danach eine klare Meldung.

import { h, $, leeren } from "./dom.js";
import * as gh from "./github.js";
import { datum, vor } from "./format.js";

let hooks = { neuLaden: () => {}, toast: () => {}, handy: () => null, entsperrt: () => true, fertig: () => {}, geaendert: () => {} };
let modiListe = [];

const LISTE_KEY = "fh_auftraege_v2";
const ALT_KEY = "fh_auftrag";
export const VERWORFEN_NACH_MS = 90 * 1000;   // so lange darf GitHub für das Anlegen des Laufs brauchen
const WARTEN_MAX_MIN = 30;                    // danach wird ein Auftrag nicht mehr verfolgt
const NEU_SENDEN = { normal: 1, bremse: 3 };  // wie oft ein verworfener Auftrag automatisch neu geht
const FERTIG_ZEIGEN_MS = 2 * 60000;           // ✓/✗ bleibt so lange im Band stehen
const BREMSEN = new Set(["allesstopp", "anhalten", "stopp", "surfen_pause", "trend_pause", "einstellung"]);

export function init(h0) {
  hooks = Object.assign(hooks, h0);
  setInterval(() => {
    if (laufendeAuftraege().length && document.visibilityState === "visible" && hooks.entsperrt()) pruefen(null);
    else bandZeichnen();
  }, 10000);
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
  if (typeof muster !== "string") return null;
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

/** "express", wenn der Modus laut handy.json über express.yml darf UND die Bestätigung dessen Muster ganz trifft – sonst "ki". */
export function weg(m, bestaetigung) {
  const e = eintrag(m);
  if (!e || e.express !== true || typeof e.express_bestaetigung !== "string") return "ki";
  const r = ausdruck(e.express_bestaetigung);
  return r && r.test(bestaetigung) ? "express" : "ki";
}

/** Brems-Befehl: wird nie zurückgehalten (stoppt nur). „einstellung“ ist nur mit „sicher“ ohne Automatik eine Bremse (weg). */
export function istBremse(m) {
  return BREMSEN.has(m) && m !== "einstellung";
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

// ------------------------------------------------------------------ 1.2.4: zwischen Trend- und Raster-Bot umschichten

const BOT_NAME = { trend: "Trend-Bot", raster: "Raster-Bot" };
const BOT_TEIL = { trend: "trend_bot", raster: "raster_bot" };

/** Was mit dem empfangenden Bot passiert – nach seinem Status in handy.json (nur bekannte Werte, sonst allgemein). */
function zielText(nach) {
  const d = hooks.handy();
  const b = d && d[BOT_TEIL[nach]];
  const st = b && typeof b === "object" ? b.status : null;
  const n = BOT_NAME[nach];
  if (st === "aus") {
    return "Der " + n + " ist gerade aus – er wird mit dem Betrag eingeschaltet"
      + (nach === "trend" ? " (mindestens 150 €)." : " (ab seinem Mindestbetrag und nur mit einer Raster-Recherche jünger als 24 Stunden).");
  }
  if (st === "pausiert") return "Der " + n + " ist pausiert – das Geld kommt an, er bleibt pausiert.";
  if (st === "an") {
    return nach === "trend" ? "Der Trend-Bot läuft – sein Topf wird größer. Bei grüner Markt-Ampel kauft er sofort zu gleichen Teilen nach "
      + "(ist der heutige Termin noch offen, läuft er zuerst); bei roter Markt-Ampel bleibt es als EURCV im Topf, ein späterer Termin legt "
      + "es in freie Plätze an."
      : "Der Raster-Bot läuft – sein Betrag wird größer, der nächste Lauf legt mehr Stufen.";
  }
  return "Ist der " + n + " aus, wird er mit dem Betrag eingeschaltet; ist er pausiert, bleibt er pausiert.";
}

/** Dialog für eine Richtung („von“ = abgebender Bot) – null bei unbekannter Richtung. */
function umschichtSpez(vorgaben) {
  const von = vorgaben.von === "trend" || vorgaben.von === "raster" ? vorgaben.von : null;
  if (!von) return null;
  const nach = von === "trend" ? "raster" : "trend";
  const geber = BOT_NAME[von];
  const felder = [
    BETRAG("Betrag in Euro", "Der " + geber + " muss danach über seinem Mindestbetrag bleiben – für den ganzen Topf „Alles umschichten“ wählen."),
    { name: "alles", art: "schalter", label: "Alles umschichten – der " + geber + " verkauft alles (auch im Minus) und geht danach aus" },
  ];
  if (von === "raster") felder.push({ name: "sofort", art: "schalter", label: "Sofort – auch Stufen im Minus verkaufen" });
  return {
    titel: "Zum " + BOT_NAME[nach] + " umschichten",
    text: [
      "Das Geld geht direkt vom " + geber + " zum " + BOT_NAME[nach] + " – keine Bitcoin-Order, die Umbuchung selbst kostet nichts.",
      von === "trend"
        ? "Reicht sein freies EURCV nicht, verkauft der Trend-Bot anteilig aus allen Coins – auch im Minus. Kosten nur für diese Verkäufe (Gebühr + Spread)."
        : "Reicht sein freies EURCV nicht, verkauft der Raster-Bot überzählige Kauf-Orders und Stufen im Gewinn – Stufen im Minus nur mit „Sofort“. Kosten nur für diese Verkäufe (Gebühr + Spread).",
      zielText(nach),
    ],
    felder,
    pruefen: (w) => {
      if (w.alles) return w.sofort ? "„Alles umschichten“ verkauft ohnehin alles – „Sofort“ bitte weglassen." : null;
      const f = betragPruefen(w);
      if (f) return f;
      return parseFloat(betragText(w.betrag)) >= 1 ? null : "Mindestens 1 €.";
    },
    bauen: (w) => "JA;von=" + von + ";nach=" + nach + ";" + (w.alles ? "alles=JA" : "betrag=" + (betragText(w.betrag) || ""))
      + (von === "raster" && w.sofort ? ";sofort=JA" : ""),
  };
}

// ------------------------------------------------------------------ was jeder Modus im Dialog zeigt

export const ERKLAERT = {
  allesstopp: "Verkauft alle Krypto-Bestände der Bots in EURCV und schaltet sie aus – Aktien bleiben.",
  anhalten: "Alle Krypto-Bots aus, nichts wird verkauft – auch keine Notbremse mehr.",
  stopp: "Nur die KI aus – das Regelwerk mit Notbremse schützt weiter.",
};

/** 1.2.5 (Nutzer 12.10.2026): wann welcher Bremsknopf sinnvoll ist – in Stichworten, gleiche Worte wie die Laptop-App
 *  (static/markt.js BREMS_ERKLAERUNG). Unter den Knöpfen und in der Rückfrage. */
export const BREMS_WANN = {
  anhalten: {
    wann: ["du selbst in Bitpanda handeln willst", "ein Bot sich seltsam verhält", "du einen Fehler vermutest",
      "du keine Überraschungen willst, aber nicht verkaufen möchtest"],
    dazu: "Bei Absturzangst stattdessen: „Alles parken“.",
  },
  allesstopp: {
    wann: ["du einen Absturz fürchtest", "schlechte Nachrichten kommen", "du raus aus den Coins in EURCV willst"],
    dazu: "Kostet Gebühren und Spread; Coins im Minus werden mit Verlust verkauft.",
  },
};
const wannText = (m) => "Sinnvoll, wenn: " + BREMS_WANN[m].wann.join(" · ");

const SPEZ = {
  einschaetzung: { titel: "Frische KI-Einschätzung", text: "Die Cloud holt eine neue Einschätzung des Coin-Bots und schickt sie dir per Mail. Es wird nicht gehandelt.", ok: "Anfordern" },
  bericht_jetzt: { titel: "Bericht jetzt", text: "Frische Einschätzung und Bericht per Mail – es wird nie gehandelt.", ok: "Anfordern" },
  news_jetzt: { titel: "News aktualisieren", ohneFrage: true },
  start: { titel: "Coin-Bot einschalten", text: "Der Coin-Bot entscheidet und handelt dann wieder selbst (mit Notbremse und Gewinnschutz)." },
  stopp: { titel: "Coin-Bot ausschalten", text: ERKLAERT.stopp + " Der Coin-Topf bleibt, wie er ist." },
  allesstopp: {
    titel: "Alles parken", gefahr: true, ok: "Alles parken",
    text: [ERKLAERT.allesstopp + " Der Coin-Topf wird über Fusion in EURCV verkauft (wie bei der Notbremse), Raster- und Trend-Bot verkaufen ihre Coins in EURCV (das EURCV bleibt in ihrem Topf) und werden pausiert; Coin-Bot und Regelwerk gehen aus. Scheitert ein Verkauf, ist trotzdem alles aus – die Mail sagt es je Bot.",
      wannText("allesstopp"), BREMS_WANN.allesstopp.dazu],
  },
  anhalten: {
    titel: "Nur anhalten", gefahr: true, ok: "Anhalten",
    text: [ERKLAERT.anhalten + " Coin-Bot und Regelwerk gehen aus, Raster- und Trend-Bot werden pausiert (offene Orders storniert, Bestände bleiben liegen). Aktien bleiben.",
      wannText("anhalten"), BREMS_WANN.anhalten.dazu],
  },
  regelwerk_ein: { titel: "Regelwerk einschalten", text: "Das Regelwerk ohne KI wird eingeschaltet." },
  euro_ein: { titel: "Euro-Automatik einschalten", text: "Euro-Guthaben bei Bitpanda wird dann automatisch eingesetzt." },
  euro_aus: { titel: "Euro-Automatik ausschalten", text: "Euro-Guthaben bleibt liegen, bis du selbst entscheidest." },
  einstellung: {
    titel: "Stufe des Coin-Bots",
    text: "Die Stufe bestimmt die Grenzen von Notbremse und Gewinnschutz. „sicher“ ohne Automatik geht als Bremse sofort über den Express-Weg, alles andere über die normale Warteschlange.",
    felder: [
      { name: "stufe", art: "wahl", label: "Stufe", optionen: [["sicher", "sicher"], ["normal", "normal"]] },
      { name: "auto", art: "schalter", label: "Stufe folgt automatisch der Empfehlung" },
    ],
    bauen: (w) => "JA;stufe=" + w.stufe + ";auto=" + (w.auto ? "1" : "0"),
  },
  gewinnschutz_ein: { titel: "Gewinnschutz Krypto einschalten", text: "Fällt der Kurs um die Grenze der Stufe unter den Höchststand, parkt der Coin-Bot." },
  gewinnschutz_aus: { titel: "Gewinnschutz Krypto ausschalten", text: "Ohne Gewinnschutz wird bei fallenden Kursen nicht mehr automatisch geparkt (die Notbremse bleibt)." },
  gewinnschutz_aktien_ein: { titel: "Gewinnschutz Aktien/ETF einschalten" },
  gewinnschutz_aktien_aus: { titel: "Gewinnschutz Aktien/ETF ausschalten" },
  aktien_start: { titel: "Aktien-Autopilot einschalten" },
  aktien_stopp: { titel: "Aktien-Autopilot ausschalten" },

  surfen_ein: { titel: "Raster-Bot einschalten", text: "Der Betrag kommt aus dem Coin-Topf.", felder: [BETRAG()], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  surfen_betrag: { titel: "Raster-Topf ändern", text: "Neuer Betrag für den Raster-Topf.", felder: [BETRAG("Neuer Topf in Euro")], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  surfen_zurueck: {
    titel: "Raster-Bot: Teil zurück in den Coin-Topf",
    felder: [BETRAG("Betrag zurück in Euro"), { name: "sofort", art: "schalter", label: "Sofort – auch mit Verlust verkaufen" }],
    pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) + (w.sofort ? ";sofort=JA" : ""),
  },
  surfen_aus: { titel: "Raster-Bot ausschalten", text: "Alles wird verkauft und geht zurück in den Coin-Topf.", bauen: () => "JA" },
  surfen_pause: { titel: "Raster-Bot pausieren", text: "Er handelt nicht mehr, offene Orders werden storniert, sein Bestand bleibt. Geht als Bremse sofort.", bauen: () => "JA" },
  surfen_deckel: { titel: "Raster-Bot: Verlustdeckel", felder: [DECKEL], pruefen: deckelPruefen, bauen: (w) => "JA;prozent=" + parseInt(w.prozent, 10) },
  surfen_recherchen: {
    titel: "Raster-Bot: Recherchen je Tag",
    felder: [{ name: "anzahl", art: "wahl", label: "Feste Recherchen je Tag", optionen: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]] }],
    bauen: (w) => "JA;anzahl=" + w.anzahl,
  },

  trend_ein: { titel: "Trend-Bot einschalten", text: "Der Betrag kommt aus dem Coin-Topf (mindestens 150 €).", felder: [BETRAG()], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  trend_betrag: { titel: "Trend-Topf ändern", felder: [BETRAG("Neuer Topf in Euro")], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  trend_zurueck: { titel: "Trend-Bot: Teil zurück in den Coin-Topf", felder: [BETRAG("Betrag zurück in Euro")], pruefen: betragPruefen, bauen: (w) => "JA;betrag=" + betragText(w.betrag) },
  trend_aus: { titel: "Trend-Bot ausschalten", text: "Alles wird verkauft und geht zurück in den Coin-Topf.", bauen: () => "JA" },
  trend_pause: { titel: "Trend-Bot pausieren", text: "Er handelt nicht mehr, sein Bestand bleibt. Geht als Bremse sofort.", bauen: () => "JA" },
  trend_deckel: { titel: "Trend-Bot: Verlustdeckel", felder: [DECKEL], pruefen: deckelPruefen, bauen: (w) => "JA;prozent=" + parseInt(w.prozent, 10) },

  // 1.2.4: Knopf „Zum Raster-Bot umschichten“ (Trend-Ansicht, Vorgabe von: "trend") bzw. „Zum Trend-Bot umschichten“ (Raster-Ansicht)
  bot_umschichten: { titel: "Zwischen den Bots umschichten", fuer: umschichtSpez },

  // 1.2.0: „An die KI“ ersetzt den Hinweis-Dialog – die KI merkt Bot-Relevantes selbst als Hinweis (js/kifrage.js)
  frage: { titel: "An die KI", ohneFrage: true },
  alarme_gelesen: { titel: "Alarme löschen", ohneFrage: true },
  // 1.2.5: „Letzte Trades“/„Ereignisse“ ausblenden (✕ je Eintrag, „Liste leeren“) – eigene Logik in js/ausblenden.js, nichts wird gelöscht
  liste_ausblenden: { titel: "Liste ausblenden", ohneFrage: true },
  // 1.2.2: kein Eingabefeld mehr – nur „✕“ in der Liste „Gemerkte Hinweise“ (eigene Bestätigung) und „Rückgängig“, beide mit
  // genau der Nummer aus handy.json bzw. der Antwort (js/kifrage.js)
  hinweis_loeschen: { titel: "Hinweis löschen", ohneFrage: true },
  push_abo: { titel: "Benachrichtigungen", ohneFrage: true },
};

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

function wegText(w) {
  return w === "express" ? "Express-Bremse (express.yml, sofort)" : "normale Warteschlange (ki.yml)";
}

// ------------------------------------------------------------------ ausführen

export async function ausfuehren(m, vorgaben = {}) {
  let spez = SPEZ[m];
  if (spez && spez.fuer) {                     // Dialog hängt von den Vorgaben des Knopfs ab (z. B. Richtung beim Umschichten)
    const s = spez.fuer(vorgaben);
    spez = s ? Object.assign({}, spez, s) : null;
  }
  const e = eintrag(m);
  if (!spez || !e) {
    hooks.toast("Dieser Befehl ist gerade nicht erlaubt.");
    return;
  }
  const kiOffen = laufendeAuftraege().find((a) => a.weg === "ki");
  if (kiOffen && !istBremse(m) && m !== "einstellung" && !gh.istDemo()) {
    dialog({
      titel: "Bitte kurz warten",
      inhalt: [
        "Es läuft noch ein Auftrag: „" + name(kiOffen.modus) + "“ (geschickt " + vor(new Date(kiOffen.zeit).toISOString()) + ").",
        "Die Cloud arbeitet normale Aufträge nacheinander ab – ein neuer könnte den wartenden verdrängen. Sobald er fertig ist, kannst du den nächsten schicken. Brems-Befehle („Alles parken“, „Nur anhalten“, Coin-Bot aus, Pausieren) gehen immer.",
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
  for (const t of [].concat(spez.text || [])) if (t) inhalt.push(h("p", null, t));
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
      if (weg(m, best) === "ki" && !istBremse(m) && laufendeAuftraege().some((a) => a.weg === "ki") && !gh.istDemo()) {
        fehlerZeigen("Gerade läuft noch ein normaler Auftrag – bitte warten, bis er fertig ist. („sicher“ ohne Automatik geht als Bremse sofort.)");
        return false;
      }
      await senden(m, best);
      return true;
    },
  });
  const aktualisieren = () => {
    const best = bestaetigungBauen(m, spez, werteLesen(spez));
    vorschau.textContent = "modus = " + m + "\nbestaetigung = " + (best === "" ? "(leer)" : best) + "\nweg = " + wegText(weg(m, best));
  };
  huelle.addEventListener("input", aktualisieren);
  huelle.addEventListener("change", aktualisieren);
  aktualisieren();
}

/** Auftrag wirklich schicken (Bestätigung ist schon geprüft). Wirft ApiFehler mit deutscher Meldung. */
export async function senden(m, best) {
  if (!passt(m, best)) throw new Error("Bestätigung passt nicht zum erlaubten Muster – nichts geschickt.");
  let w = weg(m, best);
  let r;
  try {
    r = await gh.auftrag(m, best, w);
  } catch (e) {
    if (w === "express" && e && e.art === "nichtda") {         // express.yml (noch) nicht im Repo: über ki.yml (wie bis 1.0.x)
      w = "ki";
      r = await gh.auftrag(m, best, w);
    } else throw e;
  }
  if (r.demo) {
    dialog({
      titel: "Demo – nicht gesendet",
      inhalt: [
        "Im Demo-Modus wird nichts an die Cloud geschickt. Echt würde dieser Auftrag gehen (" + wegText(w) + "):",
        h("div", { class: "vorschau", id: "demo-auftrag", "data-modus": r.nutzlast.inputs.modus, "data-bestaetigung": r.nutzlast.inputs.bestaetigung,
          "data-workflow": r.workflow }, JSON.stringify(Object.assign({ workflow: r.workflow }, r.nutzlast))),
      ],
      okText: "OK", nurOk: true,
    });
    return r;
  }
  verfolgen({ modus: m, best, weg: w, zeit: Date.now(), versuche: 1 });
  hooks.toast((w === "express" ? "Brems-Auftrag" : "Auftrag") + " an die Cloud geschickt – die App verfolgt ihn.");
  setTimeout(() => pruefen(null), 4000);
  setTimeout(() => hooks.entsperrt() && hooks.neuLaden(), 2 * 60000);
  setTimeout(() => hooks.entsperrt() && hooks.neuLaden(), 5 * 60000);
  return r;
}

// ------------------------------------------------------------------ Aufträge verfolgen (Actions-API)

/** Liste der verfolgten Aufträge. Im Speicher mit Bestätigung (zum Neu-Senden), in localStorage OHNE sie (nur Modus/Zeit/Status). */
let auftraege = (() => {
  try {
    const l = JSON.parse(localStorage.getItem(LISTE_KEY) || "[]");
    localStorage.removeItem(ALT_KEY);
    return Array.isArray(l) ? l.filter((a) => a && typeof a.modus === "string" && Number.isFinite(a.zeit)) : [];
  } catch {
    return [];
  }
})();
let naechsteNr = Date.now();

function speichern() {
  try {
    const roh = auftraege.map(({ best, ...rest }) => rest);
    if (roh.length) localStorage.setItem(LISTE_KEY, JSON.stringify(roh));
    else localStorage.removeItem(LISTE_KEY);
  } catch { /* egal */ }
}

const FINAL = new Set(["erledigt", "fehlgeschlagen", "verloren"]);
function istFinal(a) {
  return FINAL.has(a.status);
}
export function laufendeAuftraege() {
  return auftraege.filter((a) => !istFinal(a));
}
/** für app.js (Push-Abo, Hinweise): der älteste laufende Auftrag oder null */
export function offenerAuftrag() {
  return laufendeAuftraege()[0] || null;
}
/** für Tests, Einstellungen und „An die KI“: Kopie der Liste (ohne Bestätigungstext) */
export function auftragsListe() {
  return auftraege.map((a) => Object.assign({}, a, { best: undefined }));
}

function verfolgen(a) {
  a.nr = ++naechsteNr;
  a.status = "gesendet";
  a.runId = null;
  a.max = (BREMSEN.has(a.modus) && a.weg === "express") || a.modus === "allesstopp" || a.modus === "anhalten" ? NEU_SENDEN.bremse : NEU_SENDEN.normal;
  auftraege = auftraege.filter((x) => !istFinal(x) || Date.now() - (x.ende || 0) < FERTIG_ZEIGEN_MS).concat([a]).slice(-6);
  speichern();
  bandZeichnen();
}

function titelVon(a) {
  return (a.weg === "express" ? "Express: " : "Hand: ") + a.modus;
}

const STATUS_TEXT = {
  gesendet: "gesendet – wartet auf GitHub",
  angekommen: "angekommen – wartet in der Cloud",
  laeuft: "läuft gerade",
  erledigt: "erledigt ✓",
  fehlgeschlagen: "fehlgeschlagen ✗",
  verloren: "NICHT angekommen ✗",
};

function abschliessen(a, status, text) {
  a.status = status;
  a.ende = Date.now();
  a.best = undefined;
  speichern();
  if (status === "verloren") {
    dialog({
      titel: "Auftrag nicht angekommen",
      inhalt: ["„" + name(a.modus) + "“ ist nicht in der Cloud angekommen – GitHub hat ihn " + (a.versuche > 1 ? a.versuche + "-mal" : "") + " verworfen.",
        "Bitte noch einmal drücken. Ändert sich nichts, auf github.com → Athokawe/finanzen → Actions nachsehen."],
      okText: "Verstanden", nurOk: true,
    });
  } else {
    hooks.toast("„" + name(a.modus) + "“: " + (text || STATUS_TEXT[status]));
  }
  try { hooks.fertig(a); } catch { /* Anzeige-Fehler stören die Verfolgung nie */ }
  hooks.neuLaden();
}

async function neuSenden(a, grund) {
  if (!a.best && a.best !== "") {
    abschliessen(a, "verloren");
    return;
  }
  try {
    await gh.auftrag(a.modus, a.best, a.weg);
    a.versuche += 1;
    a.zeit = Date.now();
    a.status = "gesendet";
    a.runId = null;
    speichern();
    hooks.toast("„" + name(a.modus) + "“ " + grund + " – automatisch erneut gesendet (" + (a.versuche - 1) + "/" + a.max + ").");
  } catch (e) {
    abschliessen(a, "verloren");
  }
}

let actionsOk = true;
let pruefLaeuft = false;

/** Nach jedem Laden und alle 10 s: Stand der verfolgten Aufträge über die Actions-API (Lauf-Titel) */
export async function pruefen(handy) {
  if (pruefLaeuft) return;
  const offen = laufendeAuftraege();
  if (!offen.length) { bandZeichnen(); return; }
  pruefLaeuft = true;
  try {
    const listen = {};
    for (const w of new Set(offen.map((a) => a.weg))) {
      try {
        listen[w] = await gh.laeufe(w);
        actionsOk = true;
      } catch (e) {
        listen[w] = null;
        if (e && e.art === "rechte") actionsOk = false;
      }
    }
    const vergeben = new Set(auftraege.map((a) => a.runId).filter(Boolean));
    for (const a of offen) {
      const liste = listen[a.weg];
      if (!liste) { handyPruefen(a, handy); continue; }
      let lauf = a.runId ? liste.find((x) => x.id === a.runId) : null;
      if (!lauf) {
        lauf = liste.filter((x) => x.titel === titelVon(a) && !vergeben.has(x.id) && datum(x.erstellt)
          && datum(x.erstellt).getTime() >= a.zeit - 60000)
          .sort((x, y) => datum(x.erstellt) - datum(y.erstellt))[0] || null;
        if (lauf) { a.runId = lauf.id; vergeben.add(lauf.id); }
      }
      if (!lauf) {
        if (Date.now() - a.zeit > VERWORFEN_NACH_MS) {
          if (a.versuche - 1 < a.max) await neuSenden(a, "wurde von GitHub verworfen");
          else abschliessen(a, "verloren");
        }
        continue;
      }
      if (lauf.status === "completed") {
        // 1.2.0: ein ki.yml-Lauf kann zusätzlich den Job „aufraeumen“ haben – ob der Auftrag geklappt hat, sagt der Job „ki“
        if (a.weg === "ki" && lauf.ergebnis !== "success") {
          const jk = await gh.jobErgebnis(lauf.id).catch(() => null);
          if (jk) lauf = Object.assign({}, lauf, { ergebnis: jk });
        }
        if (lauf.ergebnis === "success") abschliessen(a, "erledigt");
        else if (lauf.ergebnis === "cancelled" || lauf.ergebnis === "skipped") {
          if (a.versuche - 1 < a.max) await neuSenden(a, "wurde abgebrochen");
          else abschliessen(a, "verloren");
        } else abschliessen(a, "fehlgeschlagen", "fehlgeschlagen ✗ – Details in der Mail bzw. bei GitHub (" + (lauf.ergebnis || "Fehler") + ")");
      } else {
        a.status = lauf.status === "in_progress" ? "laeuft" : "angekommen";
      }
    }
    for (const a of laufendeAuftraege()) {
      if ((Date.now() - a.zeit) / 60000 > WARTEN_MAX_MIN) abschliessen(a, "verloren");
    }
    speichern();
  } finally {
    pruefLaeuft = false;
    bandZeichnen();
  }
}

/** Ohne Actions-Leserecht: Auftrag gilt als erledigt, sobald handy.json einen Hand-Lauf dieses Modus nach dem Senden zeigt. */
function handyPruefen(a, handy) {
  const d = handy || hooks.handy();
  const lauf = d && d.lauf;
  const stand = d && datum(d.stand);
  if (lauf && lauf.modus === a.modus && stand && stand.getTime() >= a.zeit - 30000 && lauf.ergebnis) {
    abschliessen(a, lauf.ergebnis === "success" ? "erledigt" : "fehlgeschlagen");
  }
}

function nichtMehrVerfolgen(a) {
  auftraege = auftraege.filter((x) => x !== a);
  speichern();
  bandZeichnen();
  hooks.toast("„" + name(a.modus) + "“ wird nicht mehr verfolgt.");
}

function bandZeichnen() {
  const b = $("auftrag-band");
  if (!b) return;
  const jetzt = Date.now();
  const zeigen = auftraege.filter((a) => !istFinal(a) || jetzt - (a.ende || 0) < FERTIG_ZEIGEN_MS);
  if (!zeigen.length) {
    b.hidden = true;
    try { hooks.geaendert(); } catch { /* egal */ }
    return;
  }
  leeren(b);
  for (const a of zeigen) {
    const symbol = a.status === "erledigt" ? "✓" : istFinal(a) ? "✗" : a.status === "laeuft" ? "▶" : "⏳";
    const extra = !istFinal(a) && a.versuche > 1 ? " · Versuch " + a.versuche : "";
    b.appendChild(h("div", { class: "auftrag-zeile " + a.status, "data-modus": a.modus, "data-status": a.status, "data-weg": a.weg },
      h("span", null, symbol + " „" + name(a.modus) + "“ " + STATUS_TEXT[a.status] + (a.weg === "express" ? " (Express)" : "") + extra
        + " · " + vor(new Date(istFinal(a) ? a.ende : a.zeit).toISOString())),
      istFinal(a) ? null : h("button", { type: "button", class: "knopf leise", onclick: () => nichtMehrVerfolgen(a) }, "Nicht mehr verfolgen")));
  }
  if (!actionsOk) b.appendChild(h("div", { class: "klein" }, "Lauf-Status nicht lesbar (Token ohne „Actions: Read“) – die App erkennt das Ergebnis an den Daten."));
  b.hidden = false;
  try { hooks.geaendert(); } catch { /* egal */ }
}
