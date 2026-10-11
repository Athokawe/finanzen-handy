// Web-Push: Abo im Browser anlegen/entfernen. Angemeldet wird es per Auftrag „push_abo“ (JSON des Abos) bzw. abgemeldet mit
// „loeschen:<Hash>“ – Hash = die ersten 16 Hex-Zeichen von SHA-256(endpoint), genau wie in docs/HANDY-DATEN.md.

import { VAPID_PUBLIC_KEY } from "../konfig.js";

export function alsHomeApp() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function unterstuetzt() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function schluesselDa() {
  return typeof VAPID_PUBLIC_KEY === "string" && /^[A-Za-z0-9_-]{80,100}$/.test(VAPID_PUBLIC_KEY);
}

export function erlaubnis() {
  return "Notification" in window ? Notification.permission : "unsupported";
}

function b64urlZuBytes(s) {
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hash(endpoint) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(endpoint)));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function registrierung() {
  const zeit = new Promise((_, nein) => setTimeout(() => nein(new Error("Der Hintergrund-Dienst der App ist nicht bereit – App einmal schließen und neu öffnen.")), 8000));
  return Promise.race([navigator.serviceWorker.ready, zeit]);
}

export async function aktuellesAbo() {
  if (!unterstuetzt()) return null;
  try {
    const reg = await registrierung();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Abo als kompaktes JSON (nur endpoint und keys) + Hash */
export async function aboDaten(sub) {
  const j = sub.toJSON();
  if (!j || !j.endpoint || !j.keys || !j.keys.p256dh || !j.keys.auth) throw new Error("Das Abo ist unvollständig.");
  return { json: JSON.stringify({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }), hash: await hash(j.endpoint) };
}

/**
 * Erlaubnis holen und abonnieren. MUSS direkt aus einem Tipp heraus aufgerufen werden (iOS verlangt das für die Erlaubnis-Frage).
 * -> {json, hash}
 */
export async function abonnieren() {
  if (!schluesselDa()) throw new Error("Push wird noch eingerichtet.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error(perm === "denied"
      ? "Benachrichtigungen sind abgelehnt. Erlauben kannst du sie in den iPhone-Einstellungen → Mitteilungen → Finanzen."
      : "Benachrichtigungen wurden nicht erlaubt.");
  }
  const reg = await registrierung();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlZuBytes(VAPID_PUBLIC_KEY) });
  }
  return aboDaten(sub);
}

/** Abo im Browser entfernen -> Hash (oder null, wenn keins da war) */
export async function abbestellen() {
  const sub = await aktuellesAbo();
  if (!sub) return null;
  const h = await hash(sub.endpoint);
  try { await sub.unsubscribe(); } catch { /* trotzdem in der Cloud löschen */ }
  return h;
}
