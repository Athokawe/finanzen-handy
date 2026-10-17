// Aufträge an die Cloud: nur Modi aus handy.json → „modi“; die Bestätigung wird nach dem Muster aus Formularfeldern gebaut, gegen
// den regulären Ausdruck aus handy.json geprüft und erst dann geschickt. Schalt-Modi mit „ja_noetig“ verlangen ein wörtlich
// getipptes JA.
// 1.2.0: „An die KI“ (Modus frage, js/kifrage.js) ersetzt den Hinweis-Dialog; Alarme löschen (Modus alarme_gelesen, js/alarme.js).
// 1.1.0: Brems-Befehle (handy.json: express true – „Alles parken“, „Nur anhalten“, Coin-Bot aus, Stufe → sicher) gehen an
// express.yml (eigene Warteschlange, sofort), alles andere an ki.yml. Jeder Auftrag wird über die Actions-API
// anhand des Lauf-Titels verfolgt („Express: <modus>“ bzw. „Hand: <modus>“): gesendet → angekommen → läuft → erledigt ✓ /
// fehlgeschlagen ✗. Verwirft GitHub einen Auftrag (nach ~90 s kein passender Lauf oder Lauf „abgebrochen“), schickt die App ihn
// automatisch noch einmal (Brems-Befehle bis zu 3-mal), danach eine klare Meldung.
// 1.2.18 (Gesamtprüfung B7): ein schon gestarteter Lauf, der „abgebrochen“ endet, wird nur bei Brems-Befehlen neu gesendet.
// 1.2.22: Geld-Aufträge zwischen Töpfen (Raster/Trend) gibt es nicht mehr – ihre Sonderregel („Ausgang unklar“) entfällt;
// der Status „unklar“ bleibt nur für ältere, noch gespeicherte Aufträge.
// 1.2.21 (Prüfung 16.10.2026): Knöpfe ohne Dialog (spez.ohneFrage) schicken nie ein „JA“ – verlangt handy.json → modi für so einen
// Modus ein getipptes JA, verweigert der Knopf mit klarer Meldung. Passt die Bestätigung nicht oder scheitert das Senden, kommt immer
// eine Rückmeldung (nie eine stille, unbehandelte Ablehnung). „Bitte kurz warten“ nur bei einem offenen NORMALEN Auftrag (ki.yml).

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
const BREMSEN = new Set(["allesstopp", "anhalten", "stopp", "einstellung"]);

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

// ------------------------------------------------------------------ was jeder Modus im Dialog zeigt

export const ERKLAERT = {
  allesstopp: "Verkauft den Coin-Topf in EURCV und schaltet Coin-Bot und Regelwerk aus – Aktien bleiben.",
  anhalten: "Coin-Bot und Regelwerk aus, nichts wird verkauft – auch keine Notbremse mehr.",
  stopp: "Nur die KI aus – das Regelwerk mit Notbremse schützt weiter.",
};

/** 1.2.5 (Nutzer 12.10.2026): wann welcher Bremsknopf sinnvoll ist – in Stichworten, gleiche Worte wie die Laptop-App
 *  (static/markt.js BREMS_ERKLAERUNG). Unter den Knöpfen und in der Rückfrage. */
export const BREMS_WANN = {
  anhalten: {
    wann: ["du selbst in Bitpanda handeln willst", "der Coin-Bot sich seltsam verhält", "du einen Fehler vermutest",
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
    text: [ERKLAERT.allesstopp + " Der Coin-Topf wird über Fusion in EURCV verkauft (wie bei der Notbremse); Coin-Bot und Regelwerk gehen aus. Scheitert der Verkauf, ist trotzdem alles aus – die Mail sagt es.",
      wannText("allesstopp"), BREMS_WANN.allesstopp.dazu],
  },
  anhalten: {
    titel: "Nur anhalten", gefahr: true, ok: "Anhalten",
    text: [ERKLAERT.anhalten + " Der Coin-Topf bleibt, wie er ist. Aktien bleiben.",
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

  // 1.2.22: vom Raster-Bot bleibt nur die Zahl der festen Raster-Recherchen je Tag – sie speisen das Raster-Schattendepot
  surfen_recherchen: {
    titel: "Raster-Schatten: Recherchen je Tag",
    text: "Feste Raster-Recherchen je Tag (1 bis 4). Sie speisen nur das Raster-Schattendepot (Rechengeld) – es wird nie gehandelt.",
    felder: [{ name: "anzahl", art: "wahl", label: "Feste Recherchen je Tag", optionen: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]] }],
    bauen: (w) => "JA;anzahl=" + w.anzahl,
  },

  // 1.2.0: „An die KI“ (js/kifrage.js) – die KI erklärt nur
  frage: { titel: "An die KI", ohneFrage: true },
  alarme_gelesen: { titel: "Alarme löschen", ohneFrage: true },
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
      inputmode: f.art === "betrag" ? "decimal" : f.art === "zeile" ? "text" : "numeric", autocomplete: "off", enterkeyhint: "done",
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

/**
 * Bestätigungstext aus den Feldern bauen (ohne Prüfung). NUR für den Dialog mit JA-Feld – ein Knopf ohne Dialog (ohneFrage) bekommt
 * hier nie ein „JA“ (1.2.21).
 */
function bestaetigungBauen(m, spez, w) {
  const e = eintrag(m);
  if (spez.ohneFrage) return "";
  if (spez.bauen) return spez.bauen(w);
  return e && e.ja_noetig ? "JA" : "";
}

function wegText(w) {
  return w === "express" ? "Express-Bremse (express.yml, sofort)" : "normale Warteschlange (ki.yml)";
}

// ------------------------------------------------------------------ ausführen

export async function ausfuehren(m, vorgaben = {}) {
  const spez = SPEZ[m];
  const e = eintrag(m);
  if (!spez || !e) {
    hooks.toast("Dieser Befehl ist gerade nicht erlaubt.");
    return;
  }
  const kiOffen = kiAuftragOffen();
  if (kiOffen && !istBremse(m) && m !== "einstellung" && !gh.istDemo()) {
    bitteWarten(kiOffen);
    return;
  }
  if (spez.ohneFrage) {
    // 1.2.21: ohne Dialog gibt es kein JA-Feld – verlangt die Cloud ein getipptes JA, schickt dieser Knopf NICHTS (nie ein
    // automatisch erzeugtes „JA“)
    if (e.ja_noetig) {
      hooks.toast("Die Cloud verlangt für „" + name(m) + "“ ein getipptes JA – dieser Knopf kann das nicht. Nichts geschickt.");
      return;
    }
    const best = bestaetigungBauen(m, spez, {});
    if (!passt(m, best)) {
      hooks.toast("„" + name(m) + "“ passt gerade nicht zum erlaubten Muster der Cloud – nichts geschickt.");
      return;
    }
    try {
      await senden(m, best);
    } catch (err) {
      hooks.toast("„" + name(m) + "“: " + (err && err.message ? err.message : "konnte nicht geschickt werden."));
    }
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

const FINAL = new Set(["erledigt", "fehlgeschlagen", "verloren", "unklar"]);   // „unklar“: nur noch ältere gespeicherte Aufträge
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
/** 1.2.21: der älteste laufende NORMALE Auftrag (ki.yml) oder null – nur er hält weitere normale Aufträge zurück (Express nicht). */
export function kiAuftragOffen() {
  return laufendeAuftraege().find((a) => a.weg === "ki") || null;
}
/** Dialog „Bitte kurz warten“ für einen laufenden normalen Auftrag (ausfuehren, Push-Knöpfe in app.js). */
export function bitteWarten(kiOffen) {
  dialog({
    titel: "Bitte kurz warten",
    inhalt: [
      "Es läuft noch ein Auftrag: „" + name(kiOffen.modus) + "“ (geschickt " + vor(new Date(kiOffen.zeit).toISOString()) + ").",
      "Die Cloud arbeitet normale Aufträge nacheinander ab – ein neuer könnte den wartenden verdrängen. Sobald er fertig ist, kannst du den nächsten schicken. Brems-Befehle („Alles parken“, „Nur anhalten“, Coin-Bot aus, Stufe → sicher) gehen immer.",
    ],
    okText: "Verstanden", nurOk: true,
  });
}
/** für Tests, Einstellungen und „An die KI“: Kopie der Liste (ohne Bestätigungstext) */
export function auftragsListe() {
  return auftraege.map((a) => Object.assign({}, a, { best: undefined }));
}

function verfolgen(a) {
  a.nr = ++naechsteNr;
  a.status = "gesendet";
  a.runId = null;
  a.max = (BREMSEN.has(a.modus) && a.weg === "express") || a.modus === "allesstopp" || a.modus === "anhalten" ? NEU_SENDEN.bremse
    : NEU_SENDEN.normal;
  a.gestartet = false;
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
  unklar: "Ausgang unklar – bitte nachsehen ✗",
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
          const jk = await gh.jobInfo(lauf.id).catch(() => null);
          if (jk && jk.ergebnis) lauf = Object.assign({}, lauf, { ergebnis: jk.ergebnis });
          if (jk && jk.gestartet) a.gestartet = true;          // 1.2.20: auch wenn die App „läuft gerade“ verpasst hat
        }
        if (lauf.ergebnis === "success") abschliessen(a, "erledigt");
        else if (lauf.ergebnis === "cancelled" || lauf.ergebnis === "skipped") {
          // B7: nur ein Lauf, der nie lief (in der Warteschlange verdrängt), darf neu gehen – ein schon gestarteter nur bei Bremsen
          const bremse = a.max === NEU_SENDEN.bremse;
          if (a.versuche - 1 < a.max && (bremse || !a.gestartet)) await neuSenden(a, "wurde abgebrochen");
          else abschliessen(a, "verloren");
        } else abschliessen(a, "fehlgeschlagen", "fehlgeschlagen ✗ – Details in der Mail bzw. bei GitHub (" + (lauf.ergebnis || "Fehler") + ")");
      } else {
        a.status = lauf.status === "in_progress" ? "laeuft" : "angekommen";
        if (lauf.status === "in_progress") a.gestartet = true;
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
