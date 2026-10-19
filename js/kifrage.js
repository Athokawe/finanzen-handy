// „An die KI“ (1.2.0): schwebender Knopf 💬 → Eingabe-Blatt mit Feld, „Senden“, Live-Status und den Antworten der letzten 24 h.
// Senden = Auftrag ki.yml Modus „frage“ (ohne JA). Die KI erklärt nur – sie kann nie handeln (das prüft die Cloud selbst).
// Antworten holt die App NUR aus dem Actions-Artefakt „ki-antwort-<lauf>“ (ZIP, js/zip.js). Lässt der Browser den Download nicht
// zu (Weiterleitung auf den Artefakt-Speicher, CORS) oder scheitert das Netz, sagt die App das klar („liegt in der Cloud, konnte
// aber am Handy nicht geladen werden“). Gespeichert wird NICHTS: Fragen und Antworten liegen nur im Arbeitsspeicher.
// Ob ein Lauf geklappt hat, entscheidet der Job „ki“ (Jobs-API), nicht der ganze Lauf (der Job „aufraeumen“ zählt nicht).
// 1.2.2: statt des allgemeinen Knopfs „Hinweis löschen“ (Nummer eintippen) die Liste „Gemerkte Hinweise“ aus handy.json →
// hinweise (nur aktive), je „✕“ mit Bestätigung → Modus hinweis_loeschen mit genau dieser Nummer. Ohne aktive Hinweise: nichts.
// Die Hinweistexte kommen aus dem privaten Repo und werden nur als Text gezeigt (dom.h).

import { h, $, leeren } from "./dom.js";
import * as gh from "./github.js";
import * as A from "./aktionen.js";
import * as ZIP from "./zip.js";
import * as F from "./format.js";

export const MAX_ZEICHEN = 500;
const AUFBEWAHREN_MS = 24 * 3600 * 1000;

let hooks = { toast: () => {}, entsperrt: () => true, demo: false, handy: () => null, neuZeichnen: () => {} };
const antworten = new Map();   // Lauf-ID -> {zustand: "da"|"fehlt"|"rot", daten?, text?, erstellt}
let laeufe = [];
let laedt = false;
let fehlerText = null;
let geladen = false;
// Gesamtprüfung 19.10.2026 (B14): Läufe, die beim ersten Laden der Sitzung schon fertig waren – deren Sofort-Befehl geht nie
// (noch einmal) hinaus, auch wenn ihr Artefakt erst nach einem Ladefehler kommt; dafür gibt es den Knopf.
const vorSitzung = new Set();
let vorSitzungGemerkt = false;
const loeschenGeschickt = new Set();  // Hinweis-Nummern, für die „Rückgängig“ bzw. „✕“ (hinweis_loeschen) geschickt wurde
const loeschAuftraege = new Map();   // Auftrags-Nr. (aktionen.js) -> Hinweis-Nummer: scheitert der Auftrag, gibt es „✕“ wieder
let demoAntworten = null;
export const NICHT_LADBAR = "Die Antwort liegt in der Cloud, konnte aber am Handy nicht geladen werden";

/** Frage als eine Zeile ohne Steuerzeichen, höchstens 500 Zeichen (Code-Punkte – wie die Cloud). */
export function einzeilig(t) {
  const s = Array.from(String(t ?? "")).map((c) => { const n = c.codePointAt(0); return n < 32 || n === 127 || n === 8232 || n === 8233 ? " " : c; }).join("").split(/\s+/).join(" ").trim();
  return Array.from(s).slice(0, MAX_ZEICHEN).join("");
}

function tageText(t) {
  if (t === 0) return "bis du ihn löschst";
  if (t === 1) return "1 Tag";
  return (Number.isInteger(t) ? t : 7) + " Tage";
}

function sauber(d) {
  const o = d && typeof d === "object" ? d : {};
  return {
    zeit: typeof o.zeit === "string" ? o.zeit : null,
    frage: typeof o.frage === "string" ? o.frage : "",
    antwort: typeof o.antwort === "string" ? o.antwort : "",
    hinweis_nr: Number.isInteger(o.hinweis_nr) ? o.hinweis_nr : null,
    hinweis_tage: Number.isInteger(o.hinweis_tage) ? o.hinweis_tage : null,
    art: typeof o.art === "string" ? o.art : "antwort",
    befehl: befehlSauber(o.befehl),            // 1.3.7: Befehl, den die KI zugeordnet hat (nur Daten; geschickt wird über aktionen.js)
  };
}

/**
 * 1.3.7 (Nutzer 18.10.2026): „An die KI“ nimmt auch Befehle an. Die Cloud ordnet sie einem erlaubten ki.yml-Modus zu und prüft die
 * Bestätigung gegen dasselbe Muster wie beim Senden – ausgeführt wird dort nichts. Hier: sofort = Muster ohne JA (harmlos: News,
 * Bericht, Einschätzung, Aus-/Anhalten …) -> die App schickt den Auftrag von selbst, sobald die Antwort eintrifft (nur in dieser
 * Sitzung, nie nach einem Neustart – dann gibt es den Knopf). Alles mit JA (Geld, Einschalten, Stufe, Alles parken) -> Knopf, der
 * den bekannten Dialog mit vorausgefüllten Feldern öffnet; das JA tippt der Nutzer. Geschickt wird nur, was handy.json → modi
 * erlaubt und was zum Muster passt (aktionen.js) – die Bestätigung der Cloud wird nie blind übernommen.
 */
function befehlSauber(b) {
  if (!b || typeof b !== "object" || typeof b.modus !== "string" || !/^[a-z_]{2,40}$/.test(b.modus)) return null;
  const felder = {};
  if (b.felder && typeof b.felder === "object") {
    for (const k of ["betrag", "prozent", "anzahl", "stufe", "auto"]) {
      if (typeof b.felder[k] === "string" || typeof b.felder[k] === "number") felder[k] = String(b.felder[k]);
    }
  }
  return { modus: b.modus, bestaetigung: typeof b.bestaetigung === "string" ? b.bestaetigung : "", titel: typeof b.titel === "string" ? b.titel : "",
    sofort: b.sofort === true, felder, grund: typeof b.grund === "string" ? b.grund : "" };
}

const befehlGeschickt = new Map();   // lauf-id -> "geschickt" | "fehler: …" (nur Arbeitsspeicher)

/** Sofort-Befehl (ohne JA) schicken – nur, wenn die Cloud den Modus ohne JA erlaubt und die leere Bestätigung passt. */
async function befehlSofort(id, b) {
  if (befehlGeschickt.has(id) || gh.istDemo()) return;
  befehlGeschickt.set(id, "geschickt");
  const r = await A.sofortSenden(b.modus);
  if (r !== true) befehlGeschickt.set(id, "fehler: " + (r || "nicht geschickt"));
  zeichnen();
}

/** Vorgaben für den Dialog aus den Feldern der Cloud (Betrag/Prozent/Anzahl/Stufe/Automatik) */
function befehlVorgaben(b) {
  const v = {};
  if (b.felder.betrag !== undefined) v.betrag = b.felder.betrag.replace(".", ",");
  if (b.felder.prozent !== undefined) v.prozent = b.felder.prozent;
  if (b.felder.anzahl !== undefined) v.anzahl = b.felder.anzahl;
  if (b.felder.stufe !== undefined) v.stufe = b.felder.stufe;
  if (b.felder.auto !== undefined) v.auto = b.felder.auto === "1";
  return v;
}

/**
 * 1.3.9 (Tom 19.10.2026, V25): eine Zeile, ein Knopf – „⚡ <Titel>“ und der Knopf, dessen Wort die Art sagt: „Jetzt ausführen“ (Sofort-
 * Befehl nach einem Neustart), „Ausführen“ (ein Tipp, kein JA), „Ausführen …“ (öffnet den bekannten Dialog mit JA). Nach dem Senden nur
 * „✓ <Titel> geschickt“ (der Titel aus der Cloud-Liste belegt, was wirklich ging). Kein „grund“ (sagt die Antwort schon), keine
 * Erklärzeile; Fehler und „kennt die App nicht“ bleiben sichtbar. Verhalten (sofortSenden, data-eintipp, A.knopf-Dialog) wie in 1.3.8.
 */
function befehlZeigen(id, b) {
  if (!b) return null;
  const titel = b.titel || A.name(b.modus);
  const kachel = (...kinder) => h("div", { class: "ki-befehl", "data-befehl": b.modus }, ...kinder);
  const zeile = (knopf) => h("div", { class: "ki-befehl-zeile" }, h("span", { class: "ki-befehl-kopf" }, "⚡ " + titel), knopf);
  if (!A.erlaubt(b.modus)) {
    return kachel(zeile(null), h("div", { class: "unter" }, "Diesen Befehl kennt die App nicht – bitte in der App selbst schalten."));
  }
  const stand = befehlGeschickt.get(id);
  const fehlerZeile = stand && stand !== "geschickt" ? h("div", { class: "unter fehler" }, stand) : null;
  if (stand === "geschickt") return kachel(h("div", { class: "ki-befehl-kopf" }, "✓ " + titel + " geschickt"));
  if (b.sofort) return kachel(zeile(A.knopf(b.modus, "Jetzt ausführen", "primaer", befehlVorgaben(b))), fehlerZeile);
  // 1.3.8 (Tom 19.10.2026): Schaltbefehle ohne JA-Muster (Autopilot „Aus“, Nur anhalten, Coin-Bot aus, Aktien aus, Euro-Automatik aus,
  // Gewinnschutz ein …) gehen nie von selbst, aber mit EINEM Tipp (kein Dialog, kein JA) – die Cloud liefert sie mit sofort=false
  const e = A.eintrag(b.modus);
  if (e && !e.ja_noetig) {
    return kachel(zeile(h("button", { type: "button", class: "knopf primaer", "data-modus": b.modus, "data-eintipp": "1",
      onclick: async () => { const r = await A.sofortSenden(b.modus); befehlGeschickt.set(id, r === true ? "geschickt" : "fehler: " + (r || "nicht geschickt")); zeichnen(); } },
      "Ausführen")), fehlerZeile);
  }
  return kachel(zeile(A.knopf(b.modus, "Ausführen …", "primaer", befehlVorgaben(b))));
}

function reihe(...knoepfe) {
  const k = knoepfe.filter(Boolean);
  return k.length ? h("div", { class: "knopfreihe" }, k) : null;
}

// ------------------------------------------------------------------ Knopf und Blatt

export function init(h0) {
  hooks = Object.assign(hooks, h0);
  $("ki-knopf").addEventListener("click", oeffnen);
  $("ki-zu").addEventListener("click", schliessen);
  $("ki-huelle").addEventListener("click", (e) => { if (e.target === $("ki-huelle")) schliessen(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("ki-huelle").hidden && $("dialog-huelle").hidden) schliessen();
  });
  $("ki-feld").addEventListener("input", zaehlerZeigen);
  $("ki-feld").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); senden(); }
  });
  $("ki-senden").addEventListener("click", senden);
}

/** nach jedem Zeichnen der App: Knopf zeigen, wenn „frage“ laut handy.json erlaubt ist (oder Demo) */
export function knopfZeigen(sichtbar) {
  const darf = sichtbar && A.erlaubt("frage");
  $("ki-knopf").hidden = !darf || !$("ki-huelle").hidden;
  if (!darf && !$("ki-huelle").hidden) schliessen();
}

export function istOffen() {
  return !$("ki-huelle").hidden;
}

export function oeffnen() {
  if (!A.erlaubt("frage")) {
    hooks.toast("„An die KI“ kommt mit dem nächsten Cloud-Lauf (die Cloud kennt den Modus noch nicht).");
    return;
  }
  $("ki-huelle").hidden = false;
  $("ki-knopf").hidden = true;
  document.body.classList.add("blatt-offen");
  zaehlerZeigen();
  zeichnen();
  laden();
  setTimeout(() => $("ki-feld").focus(), 60);
}

/** 1.2.10 (Nutzer 12.10.2026): Eingabefeld ganz oben auf der Übersicht – öffnet das Blatt (Status, Antworten) und schickt den Text
 *  mit genau derselben Prüfung wie „Senden“ im Blatt. Gibt false zurück, wenn „An die KI“ gerade nicht erlaubt ist. */
export async function schnellSenden(text) {
  oeffnen();
  if ($("ki-huelle").hidden) return false;
  $("ki-feld").value = String(text || "");
  zaehlerZeigen();
  await senden();
  return true;
}

export function schliessen() {
  $("ki-huelle").hidden = true;
  document.body.classList.remove("blatt-offen");
  knopfZeigen(hooks.entsperrt());
}

/** beim Sperren/Abmelden: alles aus dem Arbeitsspeicher */
export function vergessen() {
  antworten.clear();
  laeufe = [];
  geladen = false;
  vorSitzung.clear();
  vorSitzungGemerkt = false;
  fehlerText = null;
  loeschenGeschickt.clear();
  loeschAuftraege.clear();
  $("ki-feld").value = "";
  $("ki-huelle").hidden = true;
  $("ki-knopf").hidden = true;
  document.body.classList.remove("blatt-offen");
  leeren($("ki-antworten"));
}

function zaehlerZeigen() {
  const n = Array.from($("ki-feld").value).length;
  $("ki-zaehler").textContent = n + " / " + MAX_ZEICHEN;
  $("ki-zaehler").classList.toggle("zu-lang", n > MAX_ZEICHEN);
}

function statusSetzen(text, art) {
  const s = $("ki-status");
  s.textContent = text || "";
  s.className = "ki-status" + (art ? " " + art : "");
  s.hidden = !text;
}

// ------------------------------------------------------------------ Senden

export async function senden() {
  const text = einzeilig($("ki-feld").value);
  if (!text) { statusSetzen("Bitte eine Frage eintippen.", "fehler"); return; }
  if (!A.erlaubt("frage")) { statusSetzen("Die Cloud kennt „An die KI“ noch nicht – kommt mit dem nächsten Cloud-Lauf.", "fehler"); return; }
  if (!gh.istDemo() && A.laufendeAuftraege().some((a) => a.weg === "ki")) {
    statusSetzen("Es läuft noch ein Auftrag – bitte warten, bis er fertig ist, dann noch einmal senden.", "fehler");
    return;
  }
  const knopf = $("ki-senden");
  knopf.disabled = true;
  try {
    const best = text;
    if (!A.passt("frage", best)) { statusSetzen("Die Frage passt nicht zum erlaubten Muster – nichts geschickt.", "fehler"); return; }
    await A.senden("frage", best);
    $("ki-feld").value = "";
    zaehlerZeigen();
    if (gh.istDemo()) statusSetzen("Demo: nichts gesendet – unten stehen Beispiel-Antworten.", "");
  } catch (e) {
    statusSetzen(e && e.message ? e.message : "Senden fehlgeschlagen.", "fehler");
    return;
  } finally {
    knopf.disabled = false;
  }
  zeichnen();
}

/** Aufruf aus aktionen.js, wenn ein Auftrag fertig ist */
export function auftragFertig(a) {
  if (a && a.modus === "hinweis_loeschen" && loeschAuftraege.has(a.nr)) {
    const nr = loeschAuftraege.get(a.nr);
    loeschAuftraege.delete(a.nr);
    if (a.status !== "erledigt") {      // nicht geklappt: „✕“ bzw. „Rückgängig“ wieder anbieten
      loeschenGeschickt.delete(nr);
      zeichnen();
      hooks.neuZeichnen();
    }
    return;
  }
  if (!a || a.modus !== "frage") return;
  if (a.status === "erledigt") {
    laden(true);
    if (!istOffen()) hooks.toast("💬 Antwort da – tippe auf 💬");
  }
  zeichnen();
}

// ------------------------------------------------------------------ Antworten holen (nur Arbeitsspeicher)

async function antwortHolen(lauf) {
  try {
    const d = await gh.frageArtefakt(lauf.id, ZIP.datei);
    return d ? { daten: d } : { problem: null };
  } catch (e) {
    return { problem: e, nichtLadbar: !!(e && (e.art === "artefakt" || e.art === "netz" || e.art === "offline")) };
  }
}

/** Ergebnis des Jobs „ki“ (bei rotem Lauf nachsehen: vielleicht ist nur der Job „aufraeumen“ gescheitert) */
async function kiJobOk(l) {
  if (l.ergebnis === "success") return true;
  try {
    return (await gh.jobErgebnis(l.id)) === "success";
  } catch {
    return false;
  }
}

export async function laden(erzwingen) {
  if (gh.istDemo()) {
    await demoLaden();
    return;
  }
  if (laedt || (!erzwingen && !istOffen() && geladen)) return;
  laedt = true;
  zeichnen();
  try {
    laeufe = await gh.frageLaeufe();
    fehlerText = null;
    if (!vorSitzungGemerkt) {
      for (const l of laeufe) if (l.status === "completed") vorSitzung.add(l.id);
      vorSitzungGemerkt = true;
    }
    for (const l of laeufe) {
      const alt = antworten.get(l.id);
      if (l.status !== "completed" || (alt && alt.zustand === "da")) continue;
      if (!(await kiJobOk(l))) {
        antworten.set(l.id, { zustand: "rot", erstellt: l.erstellt, text: "Dieser Lauf ist fehlgeschlagen – keine Antwort. Bitte noch einmal fragen." });
        continue;
      }
      const r = await antwortHolen(l);
      // 1.3.7: harmloser Befehl (sofort) – nur, wenn die Antwort in dieser Sitzung neu eintrifft (geladen war schon true)
      // und der Lauf beim ersten Laden der Sitzung noch nicht fertig war (B14)
      if (r.daten && geladen && !vorSitzung.has(l.id)) {
        const b = sauber(r.daten).befehl;
        if (b && b.sofort) befehlSofort(l.id, b);
      }
      antworten.set(l.id, r.daten ? { zustand: "da", daten: sauber(r.daten), erstellt: l.erstellt }
        : { zustand: "fehlt", erstellt: l.erstellt, nichtLadbar: !!r.nichtLadbar,
          text: r.nichtLadbar ? NICHT_LADBAR + " (" + r.problem.message + ")."
            : "Antwort nicht abrufbar" + (r.problem && r.problem.message ? " (" + r.problem.message + ")" : " – das Artefakt fehlt (schon abgelaufen?)") + "." });
    }
    const ids = new Set(laeufe.map((l) => l.id));
    for (const id of [...antworten.keys()]) if (!ids.has(id)) antworten.delete(id);
    geladen = true;
  } catch (e) {
    fehlerText = e && e.message ? e.message : "Antworten nicht lesbar.";
  } finally {
    laedt = false;
    zeichnen();
  }
}

async function demoLaden() {
  if (demoAntworten) { zeichnen(); return; }
  try {
    const r = await fetch("demo/ki_antworten.json", { cache: "no-store" });
    const d = await r.json();
    demoAntworten = (d.antworten || []).map((x, i) => ({
      id: "demo-" + i, zustand: "da", erstellt: new Date(Date.now() - (x.vor_min || 0) * 60000).toISOString(),
      daten: sauber(Object.assign({}, x, { zeit: new Date(Date.now() - (x.vor_min || 0) * 60000).toISOString() })),
    }));
  } catch {
    demoAntworten = [];
  }
  zeichnen();
}

// ------------------------------------------------------------------ Zeichnen

function letzterAuftrag() {
  return A.auftragsListe().filter((a) => a.modus === "frage").sort((x, y) => y.zeit - x.zeit)[0] || null;
}

function statusAusAuftrag() {
  const a = letzterAuftrag();
  if (!a) return null;
  const e = a.runId ? antworten.get(a.runId) : null;
  const da = !!e && e.zustand === "da";
  if (a.status === "erledigt" && e && !da) return ["✗ Antwort nicht abrufbar – siehe unten.", "fehler"];
  switch (a.status) {
    case "gesendet": return ["⏳ Frage gesendet – wartet auf GitHub …", "laeuft"];
    case "angekommen": return ["⏳ Frage angekommen – wartet in der Cloud …", "laeuft"];
    case "laeuft": return ["▶ Die KI denkt nach …", "laeuft"];
    case "erledigt": return [da ? "✓ Antwort da (unten)" : "✓ Fertig – Antwort wird geholt …", "gut"];
    case "fehlgeschlagen": return ["✗ Der Lauf ist fehlgeschlagen – bitte noch einmal fragen.", "fehler"];
    case "verloren": return ["✗ Nicht angekommen – bitte noch einmal senden.", "fehler"];
    default: return null;
  }
}

function eintragZeigen(id, e) {
  if (e.zustand !== "da") {
    return h("li", { class: "ki-eintrag fehlt" + (e.nichtLadbar ? " nicht-ladbar" : ""), "data-lauf": String(id) },
      h("div", { class: "ki-antwort-text" }, e.text || "Keine Antwort."), h("div", { class: "unter" }, F.vor(e.erstellt)));
  }
  const d = e.daten;
  const nr = d.hinweis_nr;
  let hinweis = null;
  if (Number.isInteger(nr)) {
    const weg = loeschenGeschickt.has(nr);
    hinweis = h("div", { class: "ki-hinweis" }, "📌 Als Hinweis gemerkt (" + tageText(d.hinweis_tage) + ") · ",
      weg ? h("span", { class: "gedimmt" }, "Rückgängig geschickt")
        : h("button", { type: "button", class: "knopf-text", "data-rueckgaengig": String(nr), onclick: () => hinweisZurueck(nr) }, "Rückgängig"));
  }
  return h("li", { class: "ki-eintrag" + (d.art !== "antwort" ? " " + d.art : ""), "data-lauf": String(id) },
    d.frage ? h("div", { class: "ki-frage-text" }, d.frage) : null,
    h("div", { class: "ki-antwort-text" }, d.antwort || "–"),
    befehlZeigen(id, d.befehl),                // 1.3.7: zugeordneter Befehl (Knopf bzw. „sofort geschickt“)
    hinweis,
    h("div", { class: "unter" }, F.vor(d.zeit || e.erstellt) + " · " + F.zeit(d.zeit || e.erstellt)));
}

async function hinweisZurueck(nr) {
  if (!A.erlaubt("hinweis_loeschen")) { hooks.toast("Hinweis löschen ist gerade nicht erlaubt."); return; }
  if (!gh.istDemo() && A.laufendeAuftraege().some((a) => a.weg === "ki")) {
    hooks.toast("Es läuft noch ein Auftrag – „Rückgängig“ bitte gleich noch einmal tippen.");
    return;
  }
  try {
    await loeschenSenden(nr);
  } catch (e) {
    hooks.toast(e && e.message ? e.message : "Nicht gesendet.");
  }
  zeichnen();
}

/** hinweis_loeschen mit genau dieser Nummer schicken und merken (nur Nummern, nur im Arbeitsspeicher) */
async function loeschenSenden(nr) {
  await A.senden("hinweis_loeschen", String(nr));
  loeschenGeschickt.add(nr);
  if (!gh.istDemo()) {
    const a = A.auftragsListe().filter((x) => x.modus === "hinweis_loeschen").sort((x, y) => y.zeit - x.zeit)[0];
    if (a && a.nr !== undefined) loeschAuftraege.set(a.nr, nr);
  }
  zeichnen();
  hooks.neuZeichnen();
}

// ------------------------------------------------------------------ Gemerkte Hinweise (1.2.2)

const QUELLE = new Map([["App", "von dir"], ["MCP", "über ein KI-Werkzeug"], ["KI", "von der KI"]]);

/** aktive Hinweise aus handy.json → hinweise; fehlt der Block (ältere Cloud) oder ist er kaputt: leere Liste */
export function aktiveHinweise(d) {
  const l = d && Array.isArray(d.hinweise) ? d.hinweise : [];
  return l.filter((x) => x && typeof x === "object" && Number.isInteger(x.nr) && x.nr >= 0 && x.nr <= 999999
    && typeof x.text === "string" && x.text.trim() !== "");
}

function bisText(bis) {
  if (bis === null || bis === undefined) return "gilt, bis du ihn löschst";
  return F.datum(bis) ? "gilt bis " + F.zeit(bis) : null;
}

/** Liste „Gemerkte Hinweise“ (je „✕“) – null, wenn es keine aktiven Hinweise gibt. Fremdtexte nur als Textknoten. */
export function hinweisListe(d) {
  const l = aktiveHinweise(d);
  if (!l.length) return null;
  const darf = A.erlaubt("hinweis_loeschen");
  return h("div", { class: "hinweis-liste" },
    h("h3", null, "Gemerkte Hinweise"),
    h("ul", { class: "liste" }, l.map((x) => {
      const weg = loeschenGeschickt.has(x.nr);
      const info = ["Nr. " + x.nr, QUELLE.get(x.quelle) || null, typeof x.herkunft === "string" && x.herkunft.trim() ? x.herkunft : null, bisText(x.bis)];
      return h("li", { class: "hinweis-eintrag" + (weg ? " weg" : ""), "data-hinweis": String(x.nr) },
        h("div", { class: "oben" }, h("span", { class: "hinweis-text" }, x.text),
          weg ? h("span", { class: "klein gedimmt" }, "Löschen geschickt")
            : darf ? h("button", { type: "button", class: "hinweis-weg", "aria-label": "Hinweis Nr. " + x.nr + " löschen",
              "data-hinweis-weg": String(x.nr), onclick: () => hinweisLoeschenFragen(x) }, "✕") : null),
        h("div", { class: "unter" }, info.filter(Boolean).join(" · ")));
    })));
}

/** „✕“ an einem gemerkten Hinweis: Bestätigung wie bei den anderen Aufträgen, dann hinweis_loeschen mit genau dieser Nummer */
export function hinweisLoeschenFragen(x) {
  const nr = x && x.nr;
  const best = String(nr);
  if (!Number.isInteger(nr) || !A.erlaubt("hinweis_loeschen") || !A.passt("hinweis_loeschen", best)) {
    hooks.toast("Hinweis löschen ist gerade nicht erlaubt.");
    return;
  }
  const laeuft = () => !gh.istDemo() && A.laufendeAuftraege().some((a) => a.weg === "ki");
  if (laeuft()) {
    hooks.toast("Es läuft noch ein Auftrag – bitte warten, bis er fertig ist, dann noch einmal ✕ tippen.");
    return;
  }
  A.dialog({
    titel: "Hinweis löschen",
    inhalt: [
      h("p", null, "Diesen Hinweis löschen? Bot und KI beachten ihn danach nicht mehr. Gekauft oder verkauft wird dabei nichts."),
      h("p", { class: "hinweis-zitat" }, "Nr. " + nr + ": „", x.text, "“"),
      // 1.3.9 (V17): Vorschau eingeklappt unter „Technik“ wie in allen Dialogen
      A.technik(h("div", { class: "vorschau", id: "dialog-vorschau" }, "modus = hinweis_loeschen\nbestaetigung = " + best + "\nweg = normale Warteschlange (ki.yml)")),
    ],
    okText: "Löschen",
    onOk: async () => {
      if (laeuft()) throw new Error("Gerade läuft noch ein Auftrag – bitte warten, bis er fertig ist.");
      await loeschenSenden(nr);
      return true;
    },
  });
}

export function zeichnen() {
  if ($("ki-huelle").hidden) return;
  const st = statusAusAuftrag();
  if (st) statusSetzen(st[0], st[1]);
  else if ($("ki-status").classList.contains("laeuft") || $("ki-status").classList.contains("gut")) statusSetzen("");
  const box = leeren($("ki-antworten"));
  const liste = gh.istDemo() ? (demoAntworten || []).map((e) => [e.id, e])
    : [...antworten.entries()].filter(([, e]) => Date.now() - (F.datum(e.erstellt) || new Date()).getTime() < AUFBEWAHREN_MS);
  liste.sort((x, y) => (F.datum(y[1].erstellt) || 0) - (F.datum(x[1].erstellt) || 0));
  const kopf = h("div", { class: "ki-liste-kopf" }, h("h3", null, "Antworten der letzten 24 Stunden"),
    laedt ? h("span", { class: "klein gedimmt" }, "lädt …") : null);
  box.appendChild(kopf);
  if (fehlerText) box.appendChild(h("p", { class: "fehlerteil" }, fehlerText));
  const offen = laeufe.filter((l) => l.status !== "completed").length;
  if (offen) box.appendChild(h("p", { class: "klein gedimmt" }, offen === 1 ? "Eine Frage ist noch in Arbeit." : offen + " Fragen sind noch in Arbeit."));
  if (!liste.length) box.appendChild(h("p", { class: "leer" }, laedt ? "Antworten werden geholt …" : "Noch keine Antworten in den letzten 24 Stunden."));
  else box.appendChild(h("ul", { class: "liste ki-liste" }, liste.map(([id, e]) => eintragZeigen(id, e))));
  const akt = leeren($("ki-aktionen"));
  const gemerkt = hinweisListe(hooks.handy());   // 1.2.2: statt des allgemeinen Knopfs „Hinweis löschen“
  if (gemerkt) akt.appendChild(gemerkt);
  akt.appendChild(h("p", { class: "klein gedimmt" }, "Fragen und Antworten bleiben nicht am iPhone; in der Cloud verschwinden sie nach 24 Stunden."));
}
