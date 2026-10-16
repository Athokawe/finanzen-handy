// Token-Tresor: das GitHub-Token liegt NUR verschlüsselt in localStorage.
// AES-GCM (256 Bit), Schlüssel per PBKDF2 (SHA-256, RUNDEN Runden, zufälliges Salz) aus der PIN; Schlüssel nicht exportierbar.
// 5 falsche PINs hintereinander -> Tresor gelöscht (neu verbinden nötig).
// 1.2.8: Der Face-ID-Umschlag (js/faceid.js, FACEID_SPEICHER) gilt nur zusammen mit DIESEM Tresor: neuer Tresor (neuer Token/PIN)
// oder gelöschter Tresor -> Face-ID-Umschlag wird mitgelöscht (fail-closed).
// 1.2.21 (Prüfung 16.10.2026): NEUE PINs (Einrichten, „PIN ändern“) haben 6 bis 8 Ziffern, neue Tresore 600 000 PBKDF2-Runden.
// Bestehende Tresore tragen ihre Runden selbst („runden“) und bleiben lesbar; bestehende 4–5-stellige PINs entsperren weiter.
// Ob die PIN kürzer als 6 Stellen ist, steht nur als Merker „kurz“ (true/false) im Tresor-Objekt – nie die PIN, nie ihre Länge.
// Alte Tresore (ohne Merker) bekommen ihn beim ersten Entsperren mit der PIN.

const SPEICHER = "fh_tresor_v1";
export const FACEID_SPEICHER = "fh_faceid_v1";
const FEHLER = "fh_pin_fehler";
export const RUNDEN = 600000;          // nur für NEU verschlüsselte Tresore (bis 1.2.20: 310 000)
export const PIN_NEU_MIN = 6;
export const MAX_FEHLVERSUCHE = 5;
const ZUSATZ = new TextEncoder().encode("finanzen-handy|tresor|v1"); // „additional data“ – bindet den Inhalt an diese App

function lies(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function schreib(k, v) {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}
function weg(k) {
  try { localStorage.removeItem(k); } catch { /* egal */ }
}

export function b64(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}
export function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Format einer BESTEHENDEN PIN (Entsperren, PIN-Abfrage): 4 bis 8 Ziffern – alte 4–5-stellige PINs gehen weiter. */
export function pinGueltig(pin) {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

/** Format einer NEUEN PIN (Einrichten, „PIN ändern“): 6 bis 8 Ziffern (4 Stellen sind offline in Minuten durchprobiert). */
export function pinGueltigNeu(pin) {
  return typeof pin === "string" && /^\d{6,8}$/.test(pin);
}

export function verfuegbar() {
  return !!(window.crypto && window.crypto.subtle && window.isSecureContext);
}

async function schluessel(pin, salz, runden) {
  const basis = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salz, iterations: runden, hash: "SHA-256" }, basis,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function laden() {
  try {
    const t = JSON.parse(lies(SPEICHER) || "null");
    return t && t.v === 1 && t.salz && t.iv && t.daten && t.runden ? t : null;
  } catch {
    return null;
  }
}

export function vorhanden() {
  return !!laden();
}

/** 1.2.21: true, wenn die PIN dieses Tresors kürzer als 6 Stellen ist (bekannt erst nach einem Entsperren mit der PIN). */
export function pinKurz() {
  const t = laden();
  return !!t && t.kurz === true;
}

/** Kennung des gespeicherten Tresors (sein zufälliges Salz – kein Geheimnis) oder null; bindet den Face-ID-Umschlag an ihn. */
export function kennung() {
  const t = laden();
  return t ? t.salz : null;
}

export function fehlversuche() {
  const n = parseInt(lies(FEHLER) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Token mit der PIN verschlüsseln und speichern. Wirft bei ungültiger PIN oder vollem/gesperrtem Speicher. */
export async function speichern(token, pin) {
  if (!pinGueltigNeu(pin)) throw new Error("Die neue PIN braucht 6 bis 8 Ziffern.");
  weg(FACEID_SPEICHER); // neuer Token/neue PIN -> ein alter Face-ID-Umschlag gilt nicht mehr (neu einrichten)
  const salz = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await schluessel(pin, salz, RUNDEN);
  const daten = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: ZUSATZ }, key, new TextEncoder().encode(token));
  const ok = schreib(SPEICHER, JSON.stringify({ v: 1, runden: RUNDEN, salz: b64(salz), iv: b64(iv), daten: b64(daten), kurz: pin.length < PIN_NEU_MIN }));
  if (!ok) throw new Error("Der Speicher des Browsers ist gesperrt (privater Modus?) – der Schlüssel kann nicht gespeichert werden.");
  weg(FEHLER);
}

/**
 * Tresor mit der PIN öffnen.
 * -> {ok: true, token} | {ok: false, rest: n} (falsche PIN, noch n Versuche) | {ok: false, geloescht: true}
 */
export async function oeffnen(pin) {
  const t = laden();
  if (!t) return { ok: false, geloescht: true };
  try {
    const key = await schluessel(pin, unb64(t.salz), t.runden);
    const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(t.iv), additionalData: ZUSATZ }, key, unb64(t.daten));
    weg(FEHLER);
    // 1.2.21: Merker „PIN kürzer als 6 Stellen“ nachtragen (alte Tresore) – nur true/false, nie die PIN oder ihre Länge
    const kurz = pin.length < PIN_NEU_MIN;
    if (t.kurz !== kurz) schreib(SPEICHER, JSON.stringify(Object.assign({}, t, { kurz })));
    return { ok: true, token: new TextDecoder().decode(klar) };
  } catch {
    const n = fehlversuche() + 1;
    if (n >= MAX_FEHLVERSUCHE) {
      loeschen();
      return { ok: false, geloescht: true };
    }
    schreib(FEHLER, String(n));
    return { ok: false, rest: MAX_FEHLVERSUCHE - n };
  }
}

/** Nach erfolgreichem Entsperren mit Face ID: die Folge falscher PINs ist unterbrochen. */
export function fehlerZuruecksetzen() {
  weg(FEHLER);
}

export function loeschen() {
  weg(SPEICHER);
  weg(FEHLER);
  weg(FACEID_SPEICHER);
}
