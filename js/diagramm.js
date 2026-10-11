// Statistik-Diagramme (1.1.0): selbst gezeichnetes SVG (kein Canvas, keine fremden Bibliotheken), CSP-fest (nur Attribute und
// Klassen, keine style-Attribute). Daten: cloud/handy_verlauf.json → punkte [{zeit, coin_topf_eur, …}] (docs/HANDY-DATEN.md).
// Zeitraum-Umschalter 7 T / 30 T / 90 T / 1 J / Alles; Antippen (oder Ziehen) zeigt Datum und Werte des nächsten Punkts.

import { h, leeren } from "./dom.js";
import * as F from "./format.js";

const NS = "http://www.w3.org/2000/svg";
const ZEITRAEUME = [["7", "7 T"], ["30", "30 T"], ["90", "90 T"], ["365", "1 J"], ["alle", "Alles"]];
const ZEITRAUM = {};                      // gewählter Zeitraum je Diagramm (nur im Arbeitsspeicher)
const W = 340, H = 180, L = 52, R = 10, O = 12, U = 24;

function s(tag, attrs, ...kinder) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  for (const k of kinder) if (k) el.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  return el;
}

const tagFmt = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "numeric", month: "numeric" });
const tagJahrFmt = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "numeric", month: "numeric", year: "2-digit" });

/** Zahl als Achsen-Beschriftung: „1.234 €“, „73.400 €“, „+2,5 %“ */
function achsenText(v, einheit) {
  if (einheit === "prozent") return F.prozent(v, Math.abs(v) < 10 ? 1 : 0);
  const stellen = Math.abs(v) < 100 ? 1 : 0;
  return new Intl.NumberFormat("de-AT", { maximumFractionDigits: stellen, minimumFractionDigits: stellen }).format(v) + " €";
}
function wertText(v, einheit) {
  return einheit === "prozent" ? F.prozent(v, 2) : F.euro(v);
}

/** Punkte (sortiert) mit Zeit als Date; ohne lesbare Zeit fallen sie weg. */
export function punkteLesen(verlauf) {
  const p = verlauf && Array.isArray(verlauf.punkte) ? verlauf.punkte : [];
  return p.map((x) => (x && typeof x === "object" ? Object.assign({}, x, { _t: F.datum(x.zeit) }) : null))
    .filter((x) => x && x._t)
    .sort((a, b) => a._t - b._t);
}

/** Punkte im Zeitraum (Tage vor dem jüngsten Punkt; "alle" = alles). */
export function imZeitraum(punkte, zr) {
  if (!punkte.length || zr === "alle") return punkte;
  const ende = punkte[punkte.length - 1]._t.getTime();
  const ab = ende - parseInt(zr, 10) * 86400000;
  return punkte.filter((p) => p._t.getTime() >= ab);
}

/** Reihe [[Date, Zahl]] aus einem Feld (nur Zahlen). */
export function reihe(punkte, feld) {
  return punkte.filter((p) => F.istZahl(p[feld])).map((p) => [p._t, p[feld]]);
}

/** Prozent seit dem ersten Punkt der Reihe. */
export function prozentSeitStart(werte) {
  if (!werte.length || !werte[0][1]) return [];
  const b = werte[0][1];
  return werte.map(([t, v]) => [t, (v / b - 1) * 100]);
}

/**
 * Coin-Topf zeitgewichtet in Prozent seit Zeitraumbeginn: Ein- und Auszahlungen heben Coin-Topf und „Bitcoin halten“ um denselben
 * Betrag – der Zufluss je Schritt ist das, was „Bitcoin halten“ nicht durch den Kurs erklärt (halten_i − halten_{i−1} ×
 * kurs_i/kurs_{i−1}); er wird herausgerechnet, die Schritt-Renditen werden verkettet. Ohne halten/kurs: einfache Rendite.
 */
export function zeitgewichtet(punkte) {
  const out = [];
  let idx = 1, vorher = null;
  for (const p of punkte) {
    if (!F.istZahl(p.coin_topf_eur)) continue;
    if (vorher && vorher.coin_topf_eur > 0) {
      let zufluss = 0;
      if (F.istZahl(p.coin_halten_eur) && F.istZahl(vorher.coin_halten_eur) && F.istZahl(p.bitcoin_kurs_eur) && F.istZahl(vorher.bitcoin_kurs_eur)
          && vorher.bitcoin_kurs_eur > 0) {
        zufluss = p.coin_halten_eur - vorher.coin_halten_eur * (p.bitcoin_kurs_eur / vorher.bitcoin_kurs_eur);
        if (Math.abs(zufluss) < 0.01) zufluss = 0;
      }
      const r = (p.coin_topf_eur - zufluss) / vorher.coin_topf_eur;
      if (Number.isFinite(r) && r > 0) idx *= r;
    }
    out.push([p._t, (idx - 1) * 100]);
    vorher = p;
  }
  return out;
}

/** „Bitcoin halten“ in Prozent seit Zeitraumbeginn: reiner Kursverlauf. */
export function bitcoinProzent(punkte) {
  return prozentSeitStart(reihe(punkte, "bitcoin_kurs_eur"));
}

/** Kennzahlen einer Euro-Reihe: Veränderung (€ und %), Höchst- und Tiefstwert mit Datum. */
export function kennzahlen(werte) {
  if (werte.length < 2) return null;
  const a = werte[0][1], z = werte[werte.length - 1][1];
  let hoch = werte[0], tief = werte[0];
  for (const w of werte) {
    if (w[1] > hoch[1]) hoch = w;
    if (w[1] < tief[1]) tief = w;
  }
  return { diff: z - a, prozent: a ? (z / a - 1) * 100 : null, hoch, tief };
}

// ------------------------------------------------------------------ Zeichnen

function pfad(werte, x, y) {
  let d = "";
  for (const [t, v] of werte) d += (d ? "L" : "M") + x(t).toFixed(1) + " " + y(v).toFixed(1);
  return d;
}

function naechster(werte, t) {
  let best = null, bd = Infinity;
  for (const w of werte) {
    const d = Math.abs(w[0] - t);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

/**
 * SVG-Diagramm. serien: [{name, klasse, werte: [[Date, Zahl]]}] (die erste ist die Hauptlinie). einheit: "eur" | "prozent".
 * info: Element, in dem beim Antippen Datum und Werte stehen.
 */
export function svgDiagramm(serien, einheit, info, beschreibung) {
  const alle = serien.flatMap((r) => r.werte);
  const tMin = Math.min(...alle.map((w) => w[0].getTime())), tMax = Math.max(...alle.map((w) => w[0].getTime()));
  let vMin = Math.min(...alle.map((w) => w[1])), vMax = Math.max(...alle.map((w) => w[1]));
  if (einheit === "prozent") { vMin = Math.min(vMin, 0); vMax = Math.max(vMax, 0); }
  if (vMax - vMin < 1e-9) { vMin -= einheit === "prozent" ? 1 : Math.max(1, Math.abs(vMin) * 0.01); vMax += einheit === "prozent" ? 1 : Math.max(1, Math.abs(vMax) * 0.01); }
  const rand = (vMax - vMin) * 0.08;
  const nichtNegativ = einheit !== "prozent" && vMin >= 0;
  vMin -= rand; vMax += rand;
  if (nichtNegativ && vMin < 0) vMin = 0;                  // Euro-Werte: die Achse geht nie unter 0 €
  const x = (t) => L + ((t.getTime ? t.getTime() : t) - tMin) / Math.max(1, tMax - tMin) * (W - L - R);
  const y = (v) => O + (vMax - v) / (vMax - vMin) * (H - O - U);
  const svg = s("svg", { viewBox: "0 0 " + W + " " + H, class: "diagramm", role: "img", "aria-label": beschreibung || "Diagramm" });
  // Raster und Achsen-Beschriftung
  for (let i = 0; i <= 3; i++) {
    const v = vMin + (vMax - vMin) * (i / 3);
    const yy = y(v);
    svg.appendChild(s("line", { x1: L, x2: W - R, y1: yy.toFixed(1), y2: yy.toFixed(1), class: "raster" }));
    svg.appendChild(s("text", { x: L - 6, y: (yy + 4).toFixed(1), class: "achse", "text-anchor": "end" }, achsenText(v, einheit)));
  }
  if (einheit === "prozent" && vMin < 0 && vMax > 0) {
    svg.appendChild(s("line", { x1: L, x2: W - R, y1: y(0).toFixed(1), y2: y(0).toFixed(1), class: "null-linie" }));
  }
  const fmt = tMax - tMin > 300 * 86400000 ? tagJahrFmt : tagFmt;
  const xs = [[tMin, "start"], [(tMin + tMax) / 2, "middle"], [tMax, "end"]];
  for (const [t, anker] of xs) {
    svg.appendChild(s("text", { x: x(t).toFixed(1), y: H - 6, class: "achse", "text-anchor": anker }, fmt.format(new Date(t))));
  }
  // Linien (die Hauptlinie zuletzt, damit sie oben liegt)
  for (const r of serien.slice().reverse()) {
    if (r.werte.length) svg.appendChild(s("path", { d: pfad(r.werte, x, y), class: "linie " + r.klasse }));
  }
  // Antippen: senkrechte Linie, Punkte, Text
  const marke = s("g", { class: "marke", visibility: "hidden" });
  const senk = s("line", { y1: O, y2: H - U, class: "marke-linie" });
  marke.appendChild(senk);
  const kreise = serien.map((r) => { const c = s("circle", { r: 3.5, class: "marke-punkt " + r.klasse }); marke.appendChild(c); return c; });
  svg.appendChild(marke);
  const flaeche = s("rect", { x: L, y: 0, width: W - L - R, height: H, class: "fang" });
  svg.appendChild(flaeche);
  const zeigen = (ev) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const px = (ev.clientX - box.left) / box.width * W;
    const t = tMin + Math.max(0, Math.min(1, (px - L) / (W - L - R))) * (tMax - tMin);
    const haupt = naechster(serien[0].werte.length ? serien[0].werte : alle, t);
    if (!haupt) return;
    const tt = haupt[0].getTime();
    senk.setAttribute("x1", x(tt).toFixed(1));
    senk.setAttribute("x2", x(tt).toFixed(1));
    const teile = [];
    serien.forEach((r, i) => {
      const w = naechster(r.werte, tt);
      if (w && Math.abs(w[0] - tt) <= Math.max(3 * 3600000, (tMax - tMin) / 80)) {
        kreise[i].setAttribute("cx", x(w[0]).toFixed(1));
        kreise[i].setAttribute("cy", y(w[1]).toFixed(1));
        kreise[i].setAttribute("visibility", "visible");
        teile.push(r.name + " " + wertText(w[1], einheit));
      } else kreise[i].setAttribute("visibility", "hidden");
    });
    marke.setAttribute("visibility", "visible");
    if (info) {
      info.textContent = F.zeit(haupt[0].toISOString()) + " · " + teile.join(" · ");
      info.classList.add("aktiv");
    }
  };
  flaeche.addEventListener("pointerdown", zeigen);
  flaeche.addEventListener("pointermove", (ev) => { if (ev.pointerType === "mouse" || ev.buttons) zeigen(ev); });
  return svg;
}

/**
 * Statistik-Karteninhalt mit Zeitraum-Umschalter. Optionen:
 *   schluessel  eindeutiger Name (merkt den Zeitraum),
 *   punkte      Ergebnis von punkteLesen,
 *   serien(p)   -> [{name, klasse, werte}] für die Punkte im Zeitraum,
 *   einheit     "eur" | "prozent",
 *   kennzahl(p, serien) -> [[label, text, klasse?]] (Zeile unter dem Diagramm),
 *   beschreibung  Text für Screenreader.
 */
export function statistik(opt) {
  const huelle = h("div", { class: "statistik", "data-statistik": opt.schluessel });
  const zeichne = () => {
    leeren(huelle);
    const zr = ZEITRAUM[opt.schluessel] || opt.vorgabe || "30";
    huelle.appendChild(h("div", { class: "zeitraeume", role: "group", "aria-label": "Zeitraum" }, ZEITRAEUME.map(([k, t]) =>
      h("button", { type: "button", class: "zr" + (k === zr ? " aktiv" : ""), "data-zeitraum": k, "aria-pressed": k === zr ? "true" : "false",
        onclick: () => { ZEITRAUM[opt.schluessel] = k; zeichne(); } }, t))));
    const p = imZeitraum(opt.punkte, zr);
    const serien = opt.serien(p).filter((r) => r && r.werte);
    const haupt = serien[0];
    if (!haupt || haupt.werte.length < 2) {
      huelle.appendChild(h("p", { class: "leer statistik-leer" },
        opt.punkte.length < 2 ? "Noch zu wenige Punkte für ein Diagramm – die Statistik wächst mit jedem Cloud-Lauf (höchstens einer je Stunde)."
          : "In diesem Zeitraum gibt es noch zu wenige Punkte – bitte einen längeren Zeitraum wählen."));
      return;
    }
    const info = h("div", { class: "diagramm-info", "aria-live": "polite" }, "Antippen zeigt Datum und Wert.");
    huelle.appendChild(info);
    huelle.appendChild(svgDiagramm(serien.filter((r) => r.werte.length), opt.einheit, info, opt.beschreibung));
    huelle.appendChild(h("div", { class: "legende" }, serien.filter((r) => r.werte.length).map((r) =>
      h("span", { class: "legende-eintrag" }, h("span", { class: "legende-strich " + r.klasse }), r.name))));
    const kz = opt.kennzahl ? opt.kennzahl(p, serien) : null;
    if (kz && kz.length) {
      huelle.appendChild(h("div", { class: "kennzahlen" }, kz.filter(Boolean).map(([l, t, k]) =>
        h("div", { class: "kennzahl" }, h("span", { class: "kz-l" }, l), h("span", { class: "kz-r " + (k || "") }, t)))));
    }
  };
  zeichne();
  return huelle;
}

/** Standard-Kennzahlen einer Euro-Reihe: Veränderung € (%), Höchst, Tiefst. */
export function euroKennzahlen(werte, label) {
  const k = kennzahlen(werte);
  if (!k) return [];
  return [
    [label || "Veränderung", F.euroPlus(k.diff) + (F.istZahl(k.prozent) ? " (" + F.prozent(k.prozent) + ")" : ""), F.vorzeichenKlasse(k.diff)],
    ["Höchst", F.euro(k.hoch[1]) + " · " + F.tag(k.hoch[0].toISOString())],
    ["Tiefst", F.euro(k.tief[1]) + " · " + F.tag(k.tief[0].toISOString())],
  ];
}
