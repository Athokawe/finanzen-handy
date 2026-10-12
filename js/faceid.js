// Face ID (1.2.8): ein ZWEITER, eigener Umschlag für den GitHub-Token, geöffnet über einen Passkey am iPhone
// (Plattform-Authenticator = Face ID) mit der WebAuthn-Erweiterung PRF.
// * Nach Face ID liefert der Passkey 32 geheime Bytes (PRF-Ausgabe zum gespeicherten, zufälligen Salz). Daraus wird per
//   HKDF-SHA-256 (info „finanzen-handy-faceid-v1“) ein nicht exportierbarer AES-GCM-256-Schlüssel abgeleitet.
// * Ohne PRF gibt es KEIN Face ID – keine schwächere Variante ohne Verschlüsselung.
// * Der PIN-Tresor (tresor.js) bleibt unverändert als Rückfall; dieser Umschlag gilt nur zusammen mit ihm (Kennung + „additional
//   data“) und wird mit ihm gelöscht. Fehlversuche mit Face ID zählen nicht zu den PIN-Fehlversuchen.
// Gespeichert (localStorage fh_faceid_v1): {v, id (Credential-ID), salz (PRF-Salz), iv, daten (Chiffrat), tresor (Kennung des
// PIN-Tresors), seit} – nie der Token im Klartext, nie die PRF-Ausgabe, nie der Schlüssel.
// WICHTIG: navigator.credentials.create()/get() werden in anlegen()/prfHolen()/oeffnen() OHNE vorheriges await aufgerufen –
// iOS erlaubt sie nur direkt im Tipp des Nutzers.

import { FACEID_SPEICHER, kennung, b64, unb64 } from "./tresor.js";

const VERSION = 1;
const INFO = new TextEncoder().encode("finanzen-handy-faceid-v1");
const HKDF_SALZ = new Uint8Array(32); // fest (Nullen): die PRF-Ausgabe ist schon gleichverteilt zufällig
const NICHT_MOEGLICH = "fh_faceid_nicht_moeglich"; // {ua, am}: dieses Gerät liefert kein PRF (nur ein Merker, kein Geheimnis)
const ZEIT_MS = 60000;

function lies(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function schreib(k, v) {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}
function weg(k) {
  try { localStorage.removeItem(k); } catch { /* egal */ }
}
function zufall(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}
function gleich(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function bytes(x) {
  if (!x) return null;
  if (x instanceof ArrayBuffer) return new Uint8Array(x.slice(0));
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength));
  return null;
}

// ------------------------------------------------------------------ Was kann das Gerät?

/** WebAuthn überhaupt da (ohne Prüfung des Plattform-Authenticators)? */
export function webauthnDa() {
  return !!(window.isSecureContext && window.PublicKeyCredential && navigator.credentials && navigator.credentials.create
    && navigator.credentials.get && window.crypto && crypto.subtle);
}

/**
 * -> "ja" (Plattform-Authenticator mit Nutzerprüfung da – ob PRF geht, zeigt erst das Einrichten),
 *    "ohne_prf" (der Browser sagt selbst: kein PRF), "nein" (kein Face ID/Touch ID für Passkeys -> nicht anbieten).
 */
export async function pruefen() {
  if (!webauthnDa() || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return "nein";
  try {
    if (!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) return "nein";
  } catch {
    return "nein";
  }
  try {
    if (typeof PublicKeyCredential.getClientCapabilities === "function") {
      const k = await PublicKeyCredential.getClientCapabilities();
      if (k && k["extension:prf"] === false) return "ohne_prf";
    }
  } catch { /* ältere Browser: beim Einrichten prüfen */ }
  return "ja";
}

/** Beim Einrichten festgestellt: dieses Gerät (genau diese iOS-/Browser-Version) liefert kein PRF. */
export function nichtMoeglichGemerkt() {
  try {
    const m = JSON.parse(lies(NICHT_MOEGLICH) || "null");
    return !!m && m.ua === navigator.userAgent; // nach einem iOS-Update wird wieder angeboten
  } catch {
    return false;
  }
}

export function nichtMoeglichMerken() {
  schreib(NICHT_MOEGLICH, JSON.stringify({ ua: navigator.userAgent, am: new Date().toISOString() }));
}

// ------------------------------------------------------------------ Umschlag

function laden() {
  try {
    const u = JSON.parse(lies(FACEID_SPEICHER) || "null");
    return u && u.v === VERSION && u.id && u.salz && u.iv && u.daten && u.tresor ? u : null;
  } catch {
    return null;
  }
}

/** Face ID eingerichtet und gültig? Ein kaputter oder zu einem anderen (alten) PIN-Tresor gehörender Umschlag wird gelöscht. */
export function eingerichtet() {
  const u = laden();
  if (!u || u.tresor !== kennung()) {
    if (lies(FACEID_SPEICHER) !== null) weg(FACEID_SPEICHER);
    return false;
  }
  return true;
}

export function seit() {
  const u = laden();
  return u ? u.seit || null : null;
}

/** Löscht nur den Face-ID-Umschlag (der Passkey bleibt im iCloud-Schlüsselbund). */
export function entfernen() {
  weg(FACEID_SPEICHER);
}

async function schluessel(prf) {
  const basis = await crypto.subtle.importKey("raw", prf, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: HKDF_SALZ, info: INFO }, basis,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// „additional data“: bindet das Chiffrat an diese App, den Passkey und den PIN-Tresor
function zusatz(idB64, tresor) {
  return new TextEncoder().encode("finanzen-handy|faceid|v" + VERSION + "|" + idB64 + "|" + tresor);
}

function fehlerArt(e) {
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "AbortError") return "abgebrochen";
  if (n === "SecurityError") return "sicherheit";
  if (n === "NotSupportedError") return "nicht_unterstuetzt";
  if (n === "InvalidStateError") return "schon_da";
  return "fehler";
}

function prfAus(cred) {
  let ext = {};
  try { ext = (cred.getClientExtensionResults && cred.getClientExtensionResults()) || {}; } catch { ext = {}; }
  const prf = ext.prf;
  const erstes = bytes(prf && prf.results && prf.results.first);
  return { aus: !!prf && prf.enabled === false, prf: erstes && erstes.length === 32 ? erstes : null };
}

function holOptionen(id, salz) {
  return {
    challenge: zufall(32), // ohne Server: die Signatur wird nicht gebraucht, nur die PRF-Ausgabe
    rpId: location.hostname,
    allowCredentials: [{ type: "public-key", id, transports: ["internal"] }],
    userVerification: "required",
    timeout: ZEIT_MS,
    extensions: { prf: { eval: { first: salz } } },
  };
}

/**
 * Passkey anlegen (Face ID). Muss direkt im Tipp aufgerufen werden.
 * -> {art: "prf", id, salz, prf} | {art: "get_noetig", id, salz} (create() lieferte keine PRF-Ausgabe) | {art: "kein_prf"}
 *    | {art: "abgebrochen"|"sicherheit"|"nicht_unterstuetzt"|"schon_da"|"fehler"}
 */
export async function anlegen() {
  const salz = zufall(32);
  const jetzt = new Date();
  const name = "Finanzen Handy " + String(jetzt.getDate()).padStart(2, "0") + "." + String(jetzt.getMonth() + 1).padStart(2, "0") + "." + jetzt.getFullYear();
  let cred;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: "Finanzen", id: location.hostname },
        user: { id: zufall(16), name, displayName: name },
        challenge: zufall(32),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], // ES256, RS256
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", requireResidentKey: true, userVerification: "required" },
        attestation: "none",
        timeout: ZEIT_MS,
        extensions: { prf: { eval: { first: salz } } },
      },
    });
  } catch (e) {
    return { art: fehlerArt(e) };
  }
  if (!cred || !cred.rawId) return { art: "fehler" };
  const id = new Uint8Array(cred.rawId);
  const r = prfAus(cred);
  if (r.prf) return { art: "prf", id, salz, prf: r.prf };
  if (r.aus) return { art: "kein_prf" };
  return { art: "get_noetig", id, salz }; // iOS liefert die PRF-Ausgabe teils erst bei get()
}

/**
 * PRF-Ausgabe für diesen Passkey holen (Face ID). Muss direkt im Tipp aufgerufen werden.
 * -> {art: "prf", prf} | {art: "kein_prf"} | {art: "falscher_passkey"} | {art: "abgebrochen"|…}
 */
export async function prfHolen(id, salz, signal) {
  let cred;
  try {
    cred = await navigator.credentials.get({ publicKey: holOptionen(id, salz), signal });
  } catch (e) {
    return { art: fehlerArt(e) };
  }
  if (!cred || !gleich(new Uint8Array(cred.rawId), id)) return { art: "falscher_passkey" };
  const r = prfAus(cred);
  return r.prf ? { art: "prf", prf: r.prf } : { art: "kein_prf" };
}

/** Token mit dem Schlüssel aus der PRF-Ausgabe verschlüsseln und als Face-ID-Umschlag speichern. Wirft bei Fehlern. */
export async function speichern(token, id, salz, prf) {
  const tresor = kennung();
  if (!tresor) throw new Error("Der PIN-Tresor fehlt – bitte zuerst mit Token und PIN verbinden.");
  if (typeof token !== "string" || !token) throw new Error("Die App ist gesperrt – bitte erst mit der PIN entsperren.");
  const idB64 = b64(id);
  const iv = zufall(12);
  try {
    const key = await schluessel(prf);
    const daten = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: zusatz(idB64, tresor) }, key, new TextEncoder().encode(token));
    const ok = schreib(FACEID_SPEICHER, JSON.stringify({
      v: VERSION, id: idB64, salz: b64(salz), iv: b64(iv), daten: b64(daten), tresor, seit: new Date().toISOString(),
    }));
    if (!ok) throw new Error("Der Speicher des Browsers ist gesperrt (privater Modus?) – Face ID kann nicht eingerichtet werden.");
  } finally {
    prf.fill(0);
  }
  weg(NICHT_MOEGLICH);
}

/**
 * Mit Face ID entsperren – im Tipp oder (1.2.9) automatisch beim Sperrbildschirm, wenn iOS das ohne Tipp zulässt.
 * signal (AbortSignal, optional): bricht die laufende Anfrage ab (z. B. PIN-Entsperren, Seitenwechsel).
 * -> {ok: true, token} | {ok: false, art} – art: "abgebrochen", "kein_prf", "passt_nicht" (Umschlag gelöscht), "weg", …
 */
export async function oeffnen(signal) {
  const u = laden();
  if (!u || u.tresor !== kennung()) {
    weg(FACEID_SPEICHER);
    return { ok: false, art: "weg" };
  }
  let id, salz;
  try {
    id = unb64(u.id);
    salz = unb64(u.salz);
  } catch {
    weg(FACEID_SPEICHER);
    return { ok: false, art: "passt_nicht" };
  }
  const r = await prfHolen(id, salz, signal);
  if (r.art !== "prf") return { ok: false, art: r.art };
  try {
    const key = await schluessel(r.prf);
    const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(u.iv), additionalData: zusatz(u.id, u.tresor) }, key, unb64(u.daten));
    return { ok: true, token: new TextDecoder().decode(klar) };
  } catch {
    weg(FACEID_SPEICHER); // fail-closed: ein Umschlag, der sich nicht öffnen lässt, wird nicht wieder angeboten
    return { ok: false, art: "passt_nicht" };
  } finally {
    r.prf.fill(0);
  }
}

/** Kurzer Satz zur Fehlerart (ohne „bitte PIN“ – das ergänzt app.js). */
export function text(art) {
  return {
    abgebrochen: "Face ID wurde abgebrochen oder hat dich nicht erkannt.",
    kein_prf: "Face ID hat keinen Schlüssel geliefert.",
    passt_nicht: "Der Face-ID-Schlüssel passt nicht (mehr) – Face ID wurde auf diesem iPhone entfernt.",
    falscher_passkey: "Es kam ein anderer Passkey zurück.",
    weg: "Face ID ist nicht (mehr) eingerichtet.",
    sicherheit: "Face ID ist an dieser Adresse nicht erlaubt.",
    nicht_unterstuetzt: "Dieses Gerät unterstützt solche Passkeys nicht.",
    schon_da: "Für diese App gibt es schon einen Passkey.",
  }[art] || "Face ID hat nicht geklappt.";
}
