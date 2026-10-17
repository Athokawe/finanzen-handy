// „Letzte Trades“ und „Ereignisse“ von Raster- und Trend-Bot ausblenden (1.2.5, Nutzer 12.10.2026) – NIE löschen: Trades sind
// Buchhaltung (Einstand, Gewinn/Verlust, Abgleich, Steuer). „✕“ je Eintrag blendet sofort aus, „Liste leeren“ fragt kurz nach.
// Der gemeinsame Zustand beider Apps liegt in der Cloud (cloud/ausgeblendet.json, nur Modus „liste_ausblenden“ schreibt ihn):
//   bot=trend|raster;liste=trades|ereignisse;ids=<ausblend_id>[,…]        einzelne Einträge (höchstens 50 je Auftrag)
//   bot=…;liste=…;ids=alle;bis=<Unix-Sekunden>                           Liste leeren bis zum neuesten GESEHENEN Eintrag
// handy.json filtert danach selbst; neue Einträge erscheinen wieder. Die IDs (ausblend_id, 12 Hex) kommen aus handy.json.
// Wie bei den Alarmen (js/alarme.js): läuft gerade ein anderer normaler Auftrag, sammelt die App die Klicks und schickt sie
// gebündelt als EINEN Auftrag, sobald die Warteschlange frei ist (ein neuer Auftrag würde den wartenden in GitHub verdrängen).
// Gemerkt werden nur IDs und Zeiten (localStorage, nie Texte), bis handy.json den Eintrag nicht mehr zeigt – höchstens 24 h.

import * as gh from "./github.js";
import * as A from "./aktionen.js";

const MODUS = "liste_ausblenden";
const KEY = "fh_ausgeblendet_v1";
const HALTEN_MS = 24 * 3600 * 1000;
const MAX_JE_AUFTRAG = 50;
const ID = /^[0-9a-f]{12}$/;
export const BOTS = ["raster", "trend"];
export const LISTEN = ["trades", "ereignisse"];

let hooks = { neuZeichnen: () => {}, toast: () => {}, entsperrt: () => true };
// "bot|liste" -> { ids: {id: {t, g}}, bis: {s: Unix-Sekunden, t, g} | null }   (g = Auftrag geschickt)
let weg = {};
let nurSpeicher = false;   // Demo: nichts in localStorage

const schluessel = (bot, liste) => bot + "|" + liste;
const gueltig = (bot, liste) => BOTS.includes(bot) && LISTEN.includes(liste);
export const gueltigeId = (x) => typeof x === "string" && ID.test(x);

/** Zeit eines Eintrags in Unix-Sekunden (oder null) – aufgerundet: die Cloud blendet „zeit ≤ bis“ aus, ein Bruchteil einer Sekunde
 *  beim neuesten gezeigten Eintrag darf ihn nicht stehen lassen */
export function sekunden(zeit) {
  const t = Date.parse(typeof zeit === "string" ? zeit : "");
  return Number.isFinite(t) ? Math.ceil(t / 1000) : null;
}

function laden() {
  try {
    const roh = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out = {};
    for (const [k, v] of Object.entries(roh && typeof roh === "object" ? roh : {})) {
      const [bot, liste] = k.split("|");
      if (!gueltig(bot, liste) || !v || typeof v !== "object") continue;
      const ids = {};
      for (const [id, x] of Object.entries(v.ids && typeof v.ids === "object" ? v.ids : {})) {
        if (gueltigeId(id) && x && Number.isFinite(x.t) && Date.now() - x.t < HALTEN_MS) ids[id] = { t: x.t, g: !!x.g };
      }
      const b = v.bis;
      const bis = b && Number.isInteger(b.s) && Number.isFinite(b.t) && Date.now() - b.t < HALTEN_MS ? { s: b.s, t: b.t, g: !!b.g } : null;
      if (Object.keys(ids).length || bis) out[k] = { ids, bis };
    }
    return out;
  } catch {
    return {};
  }
}

function speichern() {
  for (const [k, v] of Object.entries(weg)) if (!Object.keys(v.ids).length && !v.bis) delete weg[k];
  if (nurSpeicher) return;
  try {
    if (Object.keys(weg).length) localStorage.setItem(KEY, JSON.stringify(weg));
    else localStorage.removeItem(KEY);
  } catch { /* egal */ }
}

export function init(h0, demo) {
  hooks = Object.assign(hooks, h0);
  nurSpeicher = !!demo;
  weg = demo ? {} : laden();
  setInterval(() => { if (hooks.entsperrt() && document.visibilityState === "visible") versenden(); }, 10000);
}

/** darf die App diese Liste ausblenden? (Cloud kennt den Modus, die Einträge tragen ausblend_id) */
export function moeglich(eintraege) {
  return A.erlaubt(MODUS) && Array.isArray(eintraege) && eintraege.some((x) => x && gueltigeId(x.ausblend_id));
}

function istWeg(x, w) {
  if (!w || !x) return false;
  if (gueltigeId(x.ausblend_id) && w.ids[x.ausblend_id]) return true;
  const s = sekunden(x.zeit);
  return !!w.bis && s !== null && s <= w.bis.s;
}

/**
 * Einträge ohne die (noch) lokal ausgeblendeten. Nebenbei aufräumen: geschickte Einträge, die handy.json nicht mehr zeigt, hat die
 * Cloud übernommen (fallen aus dem Speicher), ebenso „Liste leeren“, sobald kein gezeigter Eintrag mehr darunter fällt.
 */
export function sichtbar(eintraege, bot, liste) {
  const l = Array.isArray(eintraege) ? eintraege : [];
  const w = weg[schluessel(bot, liste)];
  if (!w) return l;
  let geaendert = false;
  const da = new Set(l.filter((x) => x && gueltigeId(x.ausblend_id)).map((x) => x.ausblend_id));
  for (const [id, v] of Object.entries(w.ids)) {
    if ((v.g && !da.has(id)) || Date.now() - v.t >= HALTEN_MS) { delete w.ids[id]; geaendert = true; }
  }
  const darunter = l.some((x) => x && sekunden(x.zeit) !== null && w.bis && sekunden(x.zeit) <= w.bis.s);
  if (w.bis && ((w.bis.g && !darunter) || Date.now() - w.bis.t >= HALTEN_MS)) {
    w.bis = null;
    geaendert = true;
  }
  const out = l.filter((x) => !istWeg(x, w));
  if (geaendert) speichern();
  return out;
}

/** wartet noch etwas (dieser Liste) auf den Versand? */
export function wartet(bot, liste) {
  return Object.entries(weg).some(([k, v]) => (!bot || k === schluessel(bot, liste))
    && (Object.values(v.ids).some((x) => !x.g) || (v.bis && !v.bis.g)));
}

/** ✕: einen Eintrag sofort ausblenden und (sobald möglich) schicken */
export function eintragAusblenden(bot, liste, id) {
  if (!gueltig(bot, liste) || !gueltigeId(id)) return;
  const k = schluessel(bot, liste);
  const w = weg[k] || (weg[k] = { ids: {}, bis: null });
  if (w.ids[id]) return;
  w.ids[id] = { t: Date.now(), g: false };
  speichern();
  hooks.neuZeichnen();
  return versenden();
}

/**
 * „Liste leeren“: alles bis zum neuesten gesehenen Eintrag (Unix-Sekunden) ausblenden – mit Rückfrage. gezeigt = die sichtbaren
 * Einträge (für die Anzahl), gesehen = gezeigt + die per ✕ schon lokal ausgeblendeten (bestimmen „bis“ mit; so deckt das Leeren auch
 * ein noch nicht geschicktes ✕ ab, selbst wenn es der neueste Eintrag war).
 */
export function listeLeeren(bot, liste, gezeigt, titel, gesehen) {
  if (!gueltig(bot, liste)) return;
  const zeitVon = (x) => (x && typeof x === "object" ? sekunden(x.zeit) : null);
  const anzahl = (Array.isArray(gezeigt) ? gezeigt : []).filter((x) => zeitVon(x) !== null).length;
  const alle = (Array.isArray(gesehen) ? gesehen : []).concat(Array.isArray(gezeigt) ? gezeigt : []);
  const zeiten = alle.map(zeitVon).filter((s) => s !== null);
  if (!anzahl || !zeiten.length) return;
  const bis = Math.max(...zeiten);
  const zeitJeId = new Map(alle.filter((x) => x && gueltigeId(x.ausblend_id) && zeitVon(x) !== null).map((x) => [x.ausblend_id, zeitVon(x)]));
  A.dialog({
    titel: "„" + titel + "“ leeren?",
    inhalt: [
      (anzahl === 1 ? "Der gezeigte Eintrag wird" : "Die " + anzahl + " gezeigten Einträge werden") + " in beiden Apps ausgeblendet (Handy und Laptop).",
      "Nichts wird gelöscht – die Buchhaltung (Einstand, Gewinn/Verlust, Steuer) bleibt vollständig. Neue Einträge erscheinen wieder.",
    ],
    okText: "Ausblenden",
    onOk: async () => {
      const k = schluessel(bot, liste);
      const w = weg[k] || (weg[k] = { ids: {}, bis: null });
      w.bis = { s: Math.max(bis, w.bis ? w.bis.s : 0), t: Date.now(), g: false };
      for (const [id, v] of Object.entries(w.ids)) {                            // vom Leeren abgedeckt (nur, wenn sicher älter)
        if (!v.g && zeitJeId.has(id) && zeitJeId.get(id) <= w.bis.s) delete w.ids[id];
      }
      speichern();
      hooks.neuZeichnen();
      await versenden();
      return true;
    },
  });
}

/** Bestätigung für eine Liste: Leeren hat Vorrang (deckt die einzelnen IDs ab), sonst bis zu 50 IDs */
function bestFuer(bot, liste, w) {
  if (w.bis && !w.bis.g) return { best: "bot=" + bot + ";liste=" + liste + ";ids=alle;bis=" + w.bis.s, ids: [], bis: true };
  const ids = Object.entries(w.ids).filter(([, v]) => !v.g).map(([id]) => id).sort().slice(0, MAX_JE_AUFTRAG);
  return ids.length ? { best: "bot=" + bot + ";liste=" + liste + ";ids=" + ids.join(","), ids, bis: false } : null;
}

let sendetGerade = false;

/** den nächsten gesammelten Auftrag schicken – einer zur Zeit, nie an einem laufenden normalen Auftrag vorbei */
export async function versenden() {
  if (sendetGerade || !A.erlaubt(MODUS)) return;
  if (!gh.istDemo() && A.laufendeAuftraege().some((a) => a.weg === "ki")) return;   // nach dem laufenden Auftrag (Intervall)
  for (const [k, w] of Object.entries(weg)) {
    const [bot, liste] = k.split("|");
    const b = bestFuer(bot, liste, w);
    if (!b || !A.passt(MODUS, b.best)) continue;
    sendetGerade = true;
    try {
      await A.senden(MODUS, b.best);
      if (b.bis && w.bis) w.bis.g = true;
      for (const id of b.ids) if (w.ids[id]) w.ids[id].g = true;
      speichern();
    } catch (e) {
      hooks.toast("Ausgeblendet, aber noch nicht an die Cloud geschickt – " + (e && e.message ? e.message : "Fehler") + " (neuer Versuch gleich).");
    } finally {
      sendetGerade = false;
      hooks.neuZeichnen();
    }
    return;                                   // ein Auftrag je Durchgang – der nächste geht, sobald dieser fertig ist
  }
}
