// Kleiner DOM-Helfer: baut Elemente NUR über textContent/Attribute – fremde Texte (Nachrichten, KI-Texte) werden nie als HTML
// eingefügt.

/**
 * h("div", {class: "karte"}, "Text", kind, [kinder…])
 * attrs: class, id, href, target, rel, type, hidden, data-*, aria-*, on* (Funktion), sonst setAttribute.
 */
export function h(tag, attrs, ...kinder) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (k === "style") throw new Error("style-Attribute sind wegen der CSP verboten");
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  anhaengen(el, kinder);
  return el;
}

function anhaengen(el, kinder) {
  for (const k of kinder) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) anhaengen(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

export function leeren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function $(id) {
  return document.getElementById(id);
}

/**
 * Sicherer Link nach außen: nur http(s), ohne Zugangsdaten in der Adresse; öffnet in neuem Tab ohne Referrer/Opener.
 * Gibt null zurück, wenn die Adresse nicht passt.
 */
export function sichereUrl(roh) {
  if (typeof roh !== "string" || !roh || /\s/.test(roh)) return null;
  let u;
  try {
    u = new URL(roh);
  } catch {
    return null;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
  return u.href;
}

export function aussenLink(url, attrs, ...kinder) {
  const sicher = sichereUrl(url);
  if (!sicher) return null;
  return h("a", Object.assign({ href: sicher, target: "_blank", rel: "noopener noreferrer" }, attrs || {}), ...kinder);
}
