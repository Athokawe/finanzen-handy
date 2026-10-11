// Alarme „löschen“ (1.2.0): „✕“ je Alarm und „Alle löschen“. Die App blendet sofort aus und schickt den Auftrag ki.yml Modus
// „alarme_gelesen“ mit den Alarm-Nummern (ohne JA, Live-Status wie jeder Auftrag). Die Cloud setzt nur „gelesen“ – gelöscht wird
// nichts; handy.json zeigt danach nur noch ungelesene. Gemerkt werden höchstens die NUMMERN (localStorage, nie Alarm-Texte),
// bis handy.json den Alarm nicht mehr zeigt (dann bestätigt) – spätestens nach 24 h fallen sie weg.
// Läuft gerade ein anderer normaler Auftrag, wartet der Versand und geht automatisch, sobald die Warteschlange frei ist.

import * as gh from "./github.js";
import * as A from "./aktionen.js";

const KEY = "fh_alarme_weg_v1";
const HALTEN_MS = 24 * 3600 * 1000;
const MAX_JE_AUFTRAG = 50;

let hooks = { neuZeichnen: () => {}, toast: () => {}, entsperrt: () => true };
// id -> {t: Zeitpunkt des Ausblendens, g: true = Auftrag geschickt}
let weg = {};
let nurSpeicher = false;   // Demo: nichts in localStorage

function laden() {
  try {
    const roh = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out = {};
    for (const [k, v] of Object.entries(roh && typeof roh === "object" ? roh : {})) {
      if (/^\d{1,12}$/.test(k) && v && Number.isFinite(v.t) && Date.now() - v.t < HALTEN_MS) out[k] = { t: v.t, g: !!v.g };
    }
    return out;
  } catch {
    return {};
  }
}

function speichern() {
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

/** darf die App Alarme ausblenden? (handy.json kennt den Modus und liefert IDs) */
export function moeglich(liste) {
  return A.erlaubt("alarme_gelesen") && Array.isArray(liste) && liste.some((x) => x && Number.isInteger(x.id));
}

/** Alarme ohne die ausgeblendeten; nebenbei: was handy.json nicht mehr zeigt und schon geschickt ist, gilt als bestätigt */
export function sichtbar(liste, ausHandy) {
  const l = Array.isArray(liste) ? liste : [];
  if (ausHandy) {
    const da = new Set(l.filter((x) => x && Number.isInteger(x.id)).map((x) => String(x.id)));
    let geaendert = false;
    for (const [id, v] of Object.entries(weg)) {
      if ((v.g && !da.has(id)) || Date.now() - v.t >= HALTEN_MS) { delete weg[id]; geaendert = true; }
    }
    if (geaendert) speichern();
  }
  return l.filter((x) => !(x && Number.isInteger(x.id) && weg[String(x.id)]));
}

export function wartet() {
  return Object.values(weg).some((v) => !v.g);
}

/** sofort ausblenden und (sobald möglich) den Auftrag schicken */
export function ausblenden(ids) {
  const neu = (ids || []).filter((i) => Number.isInteger(i) && i >= 0).map(String).filter((i) => !weg[i]);
  if (!neu.length) return;
  for (const i of neu) weg[i] = { t: Date.now(), g: false };
  speichern();
  hooks.neuZeichnen();
  versenden();
}

let sendetGerade = false;

export async function versenden() {
  if (sendetGerade) return;
  const offen = Object.entries(weg).filter(([, v]) => !v.g).map(([id]) => id).slice(0, MAX_JE_AUFTRAG);
  if (!offen.length) return;
  if (!A.erlaubt("alarme_gelesen")) return;
  if (!gh.istDemo() && A.laufendeAuftraege().some((a) => a.weg === "ki")) return;   // nach dem laufenden Auftrag (Intervall)
  const best = offen.map(Number).sort((a, b) => a - b).join(",");
  if (!A.passt("alarme_gelesen", best)) return;
  sendetGerade = true;
  try {
    await A.senden("alarme_gelesen", best);
    for (const id of offen) if (weg[id]) weg[id].g = true;
    speichern();
  } catch (e) {
    hooks.toast("Alarme ausgeblendet, aber noch nicht an die Cloud geschickt – " + (e && e.message ? e.message : "Fehler") + " (neuer Versuch gleich).");
  } finally {
    sendetGerade = false;
    hooks.neuZeichnen();
  }
}

/** für Tests: ausgeblendete Nummern */
export function ausgeblendet() {
  return Object.keys(weg).map(Number).sort((a, b) => a - b);
}
