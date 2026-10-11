// Zugriff auf das private Repo über die GitHub-REST-API (CORS erlaubt). Das Token liegt nur im Arbeitsspeicher dieses Moduls.
// Demo-Modus: liest demo/*.json und schickt NIE einen Auftrag (er wird nur zurückgegeben und angezeigt).

import { REPO, WORKFLOW, EXPRESS_WORKFLOW, BRANCH } from "../konfig.js";

const API = "https://api.github.com";
const ZEITLIMIT_MS = 20000;

let token = null;
let demo = false;
const demoAuftraege = [];

export class ApiFehler extends Error {
  constructor(text, art, status) {
    super(text);
    this.art = art;       // "offline" | "netz" | "token" | "rechte" | "nichtda" | "grenze" | "abgelehnt" | "github" | "daten"
    this.status = status || 0;
  }
}

export function tokenSetzen(t) { token = t || null; }
export function tokenDa() { return !!token; }
export function demoSetzen(b) { demo = !!b; }
export function istDemo() { return demo; }
export function demoAuftragsliste() { return demoAuftraege.slice(); }

export function tokenFormatOk(t) {
  return typeof t === "string" && /^[A-Za-z0-9_]{30,255}$/.test(t);
}

async function fehlerAus(r, zweck) {
  const rest = r.headers.get("x-ratelimit-remaining");
  if (r.status === 401) {
    return new ApiFehler("Der Schlüssel (Token) stimmt nicht oder ist abgelaufen. Bitte unter Einstellungen → Abmelden neu verbinden.", "token", 401);
  }
  if (r.status === 403 || r.status === 429) {
    if (rest === "0" || r.status === 429) {
      return new ApiFehler("GitHub-Abfragegrenze erreicht – bitte in ein paar Minuten wieder versuchen.", "grenze", r.status);
    }
    if (zweck === "auftrag") {
      return new ApiFehler("Das Token darf keine Aufträge schicken: beim Token fehlt „Actions: Read and write“.", "rechte", 403);
    }
    if (zweck === "laeufe") {
      return new ApiFehler("Das Token darf den Lauf-Status nicht lesen (Actions).", "rechte", 403);
    }
    if (zweck === "checks") {
      return new ApiFehler(CHECKS_ANLEITUNG, "checks", 403);
    }
    return new ApiFehler("Das Token darf das Repo nicht lesen: „Contents: Read-only“ fehlt oder Athokawe/finanzen ist nicht ausgewählt.", "rechte", 403);
  }
  if (r.status === 404) {
    if (zweck === "auftrag" || zweck === "laeufe") {
      return new ApiFehler("Repo oder Ablauf ki.yml nicht gefunden – hat das Token Zugriff auf Athokawe/finanzen?", "nichtda", 404);
    }
    return new ApiFehler("Nicht gefunden: entweder hat das Token keinen Zugriff auf Athokawe/finanzen (Repository access → Only select repositories), oder die Datei gibt es noch nicht (sie entsteht beim nächsten Cloud-Lauf).", "nichtda", 404);
  }
  if (r.status === 422) {
    return new ApiFehler("GitHub hat den Auftrag nicht angenommen (Modus unbekannt oder Eingabe ungültig).", "abgelehnt", 422);
  }
  if (r.status >= 500) {
    return new ApiFehler("GitHub hat gerade Probleme (Fehler " + r.status + "). Bitte später noch einmal versuchen.", "github", r.status);
  }
  return new ApiFehler("Unerwartete Antwort von GitHub (Fehler " + r.status + ").", "github", r.status);
}

async function anfrage(pfad, opt, zweck) {
  if (!token) throw new ApiFehler("Nicht verbunden.", "token", 0);
  if (navigator.onLine === false) throw new ApiFehler("Du bist offline – keine Internetverbindung.", "offline", 0);
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), ZEITLIMIT_MS);
  let r;
  try {
    r = await fetch(API + pfad, {
      method: opt.method || "GET",
      headers: Object.assign({ Authorization: "Bearer " + token }, opt.headers || {}),
      body: opt.body,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: ab.signal,
    });
  } catch (e) {
    if (navigator.onLine === false) throw new ApiFehler("Du bist offline – keine Internetverbindung.", "offline", 0);
    throw new ApiFehler(ab.signal.aborted ? "GitHub antwortet nicht (Zeitüberschreitung). Bitte gleich noch einmal versuchen."
      : "Keine Verbindung zu GitHub. Prüfe das Internet und versuch es gleich noch einmal.", "netz", 0);
  } finally {
    clearTimeout(uhr);
  }
  if (!r.ok) throw await fehlerAus(r, zweck);
  return r;
}

/** Ablauf-Datei je Weg: "express" -> express.yml (Brems-Befehle), sonst ki.yml */
export function ablauf(weg) {
  return weg === "express" ? EXPRESS_WORKFLOW : WORKFLOW;
}

/** cloud/handy.json, cloud/news.json bzw. cloud/handy_verlauf.json lesen -> Objekt */
export async function lesen(datei) {
  if (demo) {
    const r = await fetch("demo/" + datei.split("/").pop(), { cache: "no-store" });
    if (!r.ok) throw new ApiFehler("Beispiel-Datei fehlt (" + datei + ").", "nichtda", r.status);
    return r.json();
  }
  const r = await anfrage("/repos/" + REPO + "/contents/" + datei + "?ref=" + encodeURIComponent(BRANCH),
    { headers: { Accept: "application/vnd.github.raw+json" } }, "lesen");
  const t = await r.text();
  try {
    const d = JSON.parse(t);
    if (!d || typeof d !== "object") throw new Error("kein Objekt");
    return d;
  } catch {
    throw new ApiFehler("Die Datei " + datei + " ist gerade nicht lesbar (kein gültiges JSON).", "daten", 0);
  }
}

/** Auftrag an ki.yml bzw. (weg "express") an express.yml schicken. Demo: nur merken und zurückgeben. */
export async function auftrag(modus, bestaetigung, weg) {
  const nutzlast = { ref: BRANCH, inputs: { modus: String(modus), bestaetigung: String(bestaetigung ?? "") } };
  const wf = ablauf(weg);
  if (demo) {
    demoAuftraege.push({ workflow: wf, nutzlast });
    return { demo: true, nutzlast, workflow: wf };
  }
  await anfrage("/repos/" + REPO + "/actions/workflows/" + wf + "/dispatches", {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify(nutzlast),
  }, "auftrag");
  return { demo: false, nutzlast, workflow: wf };
}

/** Letzte Hand-Läufe von ki.yml bzw. express.yml: [{id, titel, status, ergebnis, erstellt}] */
export async function laeufe(weg) {
  if (demo) return [];
  const r = await anfrage("/repos/" + REPO + "/actions/workflows/" + ablauf(weg) + "/runs?event=workflow_dispatch&per_page=20",
    { headers: { Accept: "application/vnd.github+json" } }, "laeufe");
  const d = await r.json();
  return (d.workflow_runs || []).map((x) => ({
    id: x.id,
    titel: x.display_title || x.name || "",
    status: x.status,
    ergebnis: x.conclusion,
    erstellt: x.created_at,
  }));
}

// ------------------------------------------------------------------ „An die KI“ (1.2.0): Antworten holen
// Die Cloud legt die Antwort als Actions-Artefakt „ki-antwort-<lauf>“ ab (1 Tag) und zusätzlich als Annotation des Laufs
// („::notice title=ki-antwort i/n::<base64url>“). Beides gehört zum Lauf und verschwindet mit ihm (Aufräumen nach 24 h).
// Nichts davon wird hier gespeichert.

export const CHECKS_ANLEITUNG = "Bitte beim Token zusätzlich „Checks: Read-only“ erlauben: github.com → Profilbild → Settings → "
  + "Developer settings → Personal access tokens → Fine-grained tokens → „Finanzen Handy“ → Edit → Repository permissions → "
  + "Checks: Read-only → Update. Der Token bleibt derselbe, in der App ist nichts zu ändern.";

function b64urlText(s) {
  const t = String(s);
  const bin = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(out);
}

/** ki.yml-Läufe „Hand: frage“ der letzten 24 h (je Seite 100, weiterblättern bis alles abgedeckt): [{id, titel, status, ergebnis, erstellt}] */
export async function frageLaeufe() {
  if (demo) return [];
  const seit = new Date(Date.now() - 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const out = [];
  for (let seite = 1; seite <= 10; seite++) {
    const r = await anfrage("/repos/" + REPO + "/actions/workflows/" + WORKFLOW + "/runs?event=workflow_dispatch&per_page=100&page=" + seite
      + "&created=" + encodeURIComponent(">=" + seit), { headers: { Accept: "application/vnd.github+json" } }, "laeufe");
    const d = await r.json();
    const runs = Array.isArray(d.workflow_runs) ? d.workflow_runs : [];
    for (const x of runs) {
      if (x && x.display_title === "Hand: frage") out.push({ id: x.id, titel: x.display_title, status: x.status, ergebnis: x.conclusion, erstellt: x.created_at });
    }
    if (runs.length < 100) break;
  }
  return out;
}

/**
 * Antwort aus dem Artefakt „ki-antwort-<id>“ (ZIP mit antwort.json) lesen. null = kein (gültiges) Artefakt da.
 * Wirft ApiFehler art "artefakt", wenn der Download selbst scheitert (Weiterleitung/CORS/CSP) – dann nimmt die App die Annotation.
 */
export async function frageArtefakt(id, entpacken) {
  const r = await anfrage("/repos/" + REPO + "/actions/runs/" + encodeURIComponent(id) + "/artifacts?per_page=20",
    { headers: { Accept: "application/vnd.github+json" } }, "laeufe");
  const d = await r.json();
  const a = (d.artifacts || []).find((x) => x.name === "ki-antwort-" + id && !x.expired);
  if (!a) return null;
  let url;
  try {
    url = new URL(a.archive_download_url);
  } catch {
    throw new ApiFehler("Artefakt-Adresse unlesbar.", "artefakt", 0);
  }
  if (url.origin !== API) throw new ApiFehler("Artefakt-Adresse nicht bei api.github.com.", "artefakt", 0);
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), ZEITLIMIT_MS);
  let z;
  try {
    // GitHub antwortet mit 302 auf den Artefakt-Speicher; der Browser folgt und lässt den Token dabei weg (fremder Rechner)
    z = await fetch(url.href, { headers: { Authorization: "Bearer " + token }, cache: "no-store", credentials: "omit",
      referrerPolicy: "no-referrer", redirect: "follow", signal: ab.signal });
  } catch {
    throw new ApiFehler("Das Artefakt lässt sich in diesem Browser nicht laden.", "artefakt", 0);
  } finally {
    clearTimeout(uhr);
  }
  if (!z.ok) {
    if (z.status === 404 || z.status === 410) return null;
    throw new ApiFehler("Artefakt nicht ladbar (Fehler " + z.status + ").", "artefakt", z.status);
  }
  const daten = await entpacken(new Uint8Array(await z.arrayBuffer()), "antwort.json");
  return JSON.parse(new TextDecoder().decode(daten));
}

/**
 * Ersatzweg: Antwort aus den Annotationen des Laufs (Job „ki“ -> Check-Run -> annotations, Titel „ki-antwort i/n“).
 * null = keine (vollständige) Annotation. 403 -> ApiFehler art "checks" mit Anleitung (Token braucht „Checks: Read-only“).
 */
export async function frageAnnotation(id) {
  const r = await anfrage("/repos/" + REPO + "/actions/runs/" + encodeURIComponent(id) + "/jobs?per_page=20",
    { headers: { Accept: "application/vnd.github+json" } }, "laeufe");
  const d = await r.json();
  const jobs = (d.jobs || []).filter((j) => j && typeof j.check_run_url === "string");
  const job = jobs.find((j) => j.name === "ki") || jobs[0];
  const m = job ? /\/check-runs\/(\d+)$/.exec(job.check_run_url) : null;
  if (!m) return null;
  const a = await anfrage("/repos/" + REPO + "/check-runs/" + m[1] + "/annotations?per_page=50",
    { headers: { Accept: "application/vnd.github+json" } }, "checks");
  const liste = await a.json();
  const teile = {};
  let n = 0;
  for (const x of Array.isArray(liste) ? liste : []) {
    const t = /^ki-antwort (\d+)\/(\d+)$/.exec(String((x && x.title) || ""));
    if (t) {
      teile[Number(t[1])] = String(x.message || "");
      n = Number(t[2]);
    }
  }
  if (!n || n > 20) return null;
  let roh = "";
  for (let i = 1; i <= n; i++) {
    if (!(i in teile) || !/^[A-Za-z0-9_-]*$/.test(teile[i])) return null;
    roh += teile[i];
  }
  let antwort;
  try {
    antwort = JSON.parse(b64urlText(roh));
  } catch {
    throw new ApiFehler("Annotation nicht lesbar.", "daten", 0);
  }
  if (!antwort || String(antwort.lauf) !== String(id)) return null;
  return antwort;
}
