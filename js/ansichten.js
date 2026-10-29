// Die fünf Reiter + Einstellungen. Alle fremden Texte nur als Text (dom.h), fehlende Werte als „–“, ein kaputter Teil
// ({"fehler": "…"}) zeigt nur dort eine Meldung.

import { h, aussenLink, sichereUrl } from "./dom.js";
import * as F from "./format.js";
import * as A from "./aktionen.js";
import * as P from "./push.js";
import * as D from "./diagramm.js";
import * as K from "./kifrage.js";
import * as AL from "./alarme.js";
import { BITPANDA_URL, BITPANDA_EINZAHLEN_URL, BITPANDA_SWAP_URL, BITPANDA_FUSION_URL } from "../konfig.js";
import * as AB from "./ausblenden.js";

const istObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const liste = (x) => (Array.isArray(x) ? x : []);
const fehlerVon = (x) => (istObj(x) && typeof x.fehler === "string" ? x.fehler : null);
const ok = (x) => (istObj(x) && !fehlerVon(x) ? x : null);

// ------------------------------------------------------------------ Bausteine

function karte(titel, rechts, ...kinder) {
  return h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, titel), rechts || null), ...kinder);
}

/**
 * 1.2.19 (Nutzer 16.10.2026): „mehr“ zum Aufklappen – die Übersicht zeigt je Rubrik zuerst nur Status und Stand, Nachrichten und
 * Alarme nur das Neueste. Aufgeklappt bleibt aufgeklappt, solange die App offen ist (sie zeichnet laufend neu); nach dem Sperren
 * ist alles wieder zu. Dringendes (Park-Knöpfe, aktiver KI-Vorschlag, unklare Aufträge) steht nie im „mehr“.
 */
const klappOffen = new Set();
export function klappAllesZu() {
  klappOffen.clear();
}
function mehrTeil(schluessel, inhalt, zuText) {
  const kinder = (Array.isArray(inhalt) ? inhalt : [inhalt]).flat(Infinity).filter(Boolean);
  if (!kinder.length) return null;
  return h("details", { class: "klapp-mehr", "data-klapp": schluessel, open: klappOffen.has(schluessel) || null,
    ontoggle: (ev) => { if (ev.target.open) klappOffen.add(schluessel); else klappOffen.delete(schluessel); } },
    h("summary", null, h("span", { class: "wenn-zu" }, zuText || "mehr"), h("span", { class: "wenn-offen" }, "weniger")),
    h("div", { class: "klapp-inhalt" }, kinder));
}

function fehlerKarte(titel, x) {
  const f = fehlerVon(x);
  return karte(titel, null, h("p", { class: "fehlerteil" }, f ? "Dieser Teil ist gerade nicht lesbar: " + f : "Noch keine Daten."));
}

/** [[links, rechts, klasse?], …] – falsy-Einträge werden übersprungen */
function zeilen(paare) {
  return h("div", { class: "zeilen" }, paare.filter(Boolean).map(([l, r, k]) =>
    h("div", { class: "zeile" }, h("span", { class: "l" }, l), h("span", { class: "r " + (k || "") }, r))));
}

function etikett(text, klasse) {
  return h("span", { class: "etikett " + (klasse || "") }, text);
}

function statusEtikett(s) {
  if (s === "an") return etikett("an", "an");
  if (s === "pausiert") return etikett("pausiert", "pausiert");
  if (s === "aus") return etikett("aus", "aus");
  return etikett(F.text(s), "");
}

function anAus(b) {
  return b === true ? "an" : b === false ? "aus" : "–";
}

const AMPEL = { gruen: ["grün", "gruen"], gelb: ["gelb", "gelb"], rot: ["rot", "rot"] };
function ampel(farbe) {
  const a = AMPEL[farbe];
  if (!a) return h("span", null, "–");
  return h("span", { class: "etikett " + a[1] }, h("span", { class: "punkt " + a[1] }), a[0]);
}

function erklaert(label, text) {
  if (!text) return null;
  return h("div", { class: "erklaert" }, h("span", { class: "label" }, label), h("div", null, text));
}

function bitpandaKnopf(text, url, klasse) {
  return aussenLink(url || BITPANDA_URL, { class: "knopf link " + (klasse || "") }, text);
}

/** Coin-Link: „/asset/*“ steht zwar in Bitpandas Universal-Link-Liste, das Pfadformat (Kürzel oder interne Nummer) ist aber nicht
 *  belegt – daher die Startseite der App (/home, öffnet die Bitpanda-App). */
function coinLink(coin) {
  return aussenLink(BITPANDA_URL, { class: "klein", "aria-label": F.text(coin) + " bei Bitpanda öffnen" }, "Bitpanda ↗");
}

/** 1.2.5: kurzer Hinweis unter den Bitpanda-Knöpfen (Universal Link statt Safari mit Passwort + 2FA) */
function bitpandaHinweis() {
  // 1.3.9 (Tom 19.10.2026): steht auf vier Reitern – der Safari-Kniff hinter „ⓘ“, sichtbar bleibt eine kurze Zeile
  return h("details", { class: "info-klapp klein gedimmt bitpanda-hinweis" }, h("summary", null, "ⓘ Öffnet die Bitpanda-App"),
    h("p", null, "Falls Safari kommt: Link lange drücken → „In Bitpanda öffnen“."));
}

/** 1.2.5: Fuß der Raster-/Trend-Ansicht – beide Bots handeln über Fusion (COIN-EURCV), daher auch ein Fusion-Link */
function botLinks() {
  return [reihe(bitpandaKnopf("Zu Bitpanda"), bitpandaKnopf("Zu Fusion", BITPANDA_FUSION_URL)), bitpandaHinweis()];
}

function reihe(...knoepfe) {
  const k = knoepfe.filter(Boolean);
  if (!k.length) return null;
  return h("div", { class: "knopf-reihe" + (k.length === 1 ? " eins" : "") }, k);
}

function leer(text) {
  return h("p", { class: "leer" }, text);
}

// 1.3.1: Entscheidungen der Aktien-KI (Finanz-App 1.3, Teil 2 – handy.json aktien.ki)
const AKTIEN_KI_TEXT = { halten: "halten", umbauen: "umbauen", parken_welt: "in den Welt-ETF parken", parken_geldmarkt: "parken (Geldmarkt/Euro)" };

function aktienKiZiel(ziel) {
  if (!Array.isArray(ziel) || !ziel.length) return "–";
  return ziel.map((z) => F.text(z.name, z.symbol) + " " + (F.istZahl(z.gewicht) ? F.zahl(z.gewicht, 0) + " %" : "–")).join(", ");
}

function entscheidungText(e) {
  if (!e) return "–";
  if (e === "halten") return "halten";
  if (e === "stable") return "parken (Stablecoin)";
  return "wechseln zu " + e;
}

function ergebnisZeile(label, eur, pz) {
  if (!F.istZahl(eur) && !F.istZahl(pz)) return [label, "–"];
  const k = F.vorzeichenKlasse(F.istZahl(eur) ? eur : pz);
  return [label, F.euroPlus(eur) + (F.istZahl(pz) ? " (" + F.prozent(pz) + ")" : ""), k];
}

/** „✕“ je Eintrag (1.2.5) – nur, wenn die Cloud den Modus kennt und der Eintrag eine ausblend_id trägt */
function wegKnopf(bot, art, x, darf, was) {
  if (!darf || !x || !AB.gueltigeId(x.ausblend_id)) return null;
  return h("button", { type: "button", class: "eintrag-weg", "aria-label": was + " ausblenden", "data-weg": x.ausblend_id,
    onclick: () => AB.eintragAusblenden(bot, art, x.ausblend_id) }, "✕");
}

function tradesListe(trades, bot, darf) {
  const t = liste(trades).filter(istObj);
  if (!t.length) return null;
  return h("ul", { class: "liste" }, t.map((x) => h("li", { "data-eintrag": AB.gueltigeId(x.ausblend_id) ? x.ausblend_id : null },
    h("div", { class: "oben" }, h("span", { class: "titel" }, (x.seite === "verkauf" ? "Verkauf " : "Kauf ") + F.text(x.coin)),
      h("span", { class: "eintrag-rechts" }, h("span", { class: "zahl" }, F.euro(x.eur)), wegKnopf(bot, "trades", x, darf, "Trade"))),
    h("div", { class: "unter" }, F.zeit(x.zeit)))));
}

function ereignisListe(ev, bot, darf) {
  const e = liste(ev).filter(istObj);
  if (!e.length) return null;
  return h("ul", { class: "liste" }, e.slice(0, 10).map((x) => h("li", { "data-eintrag": AB.gueltigeId(x.ausblend_id) ? x.ausblend_id : null },
    h("div", { class: "oben" }, h("span", { class: "text-links" }, F.text(x.text)), wegKnopf(bot, "ereignisse", x, darf, "Ereignis")),
    h("div", { class: "unter" }, F.zeit(x.zeit)))));
}

/**
 * Karte „Letzte Trades“ bzw. „Ereignisse“ eines Bots (1.2.5): ✕ je Eintrag und „Liste leeren“ blenden in beiden Apps aus – nichts
 * wird gelöscht (js/ausblenden.js, Modus liste_ausblenden). „n ausgeblendet“ aus handy.json (trades_/ereignisse_ausgeblendet).
 */
/** 1.2.18 (M2e): Karte „Aufträge mit unklarem Ausgang“ (handy.json <bot>.unklare_auftraege) mit Knopf „Klären“ je Auftrag. */
function unklarKarte(roh, bot) {
  const l = liste(roh).filter(istObj);
  if (!l.length) return null;
  return karte("Aufträge mit unklarem Ausgang", etikett(l.length + " offen", "sd-klar-hinten"),
    h("p", { class: "klein gedimmt" }, "Bitte in Bitpanda Fusion prüfen und klären – der Auftrag bleibt bis dahin reserviert. Es wird nie eine Order gesendet."),
    h("ul", { class: "liste" }, l.map((o) => h("li", { "data-unklar": Number.isInteger(o.nr) ? String(o.nr) : null },
      h("div", { class: "oben" }, h("span", { class: "text-links" }, "Nr. " + F.text(o.nr) + ": " + F.text(o.seite) + " " + F.text(o.pair)
        + " · Menge " + F.text(o.menge) + " · Betrag " + F.text(o.betrag)),
        Number.isInteger(o.nr) ? A.knopf("order_klaeren", "Klären", "", { bot, nr: o.nr }) : null),
      h("div", { class: "unter" }, "gesendet " + F.zeit(o.gesendet) + (o.grund ? " · " + F.text(o.grund) : ""))))));
}

/**
 * 1.3.5: Karte „KI-Antrag“ (handy.json ki_antraege.offen, unter dem Gesamtwert) – die KI wollte etwas außerhalb ihrer Leitplanken; die Cloud hat es NICHT
 * ausgeführt, sondern als Antrag abgelegt. Knopf „JA – ausführen“ öffnet den Dialog antrag_ja (JA tippen); dann führt die Cloud genau
 * diesen Antrag aus (Tageslimit und frische Schalter gelten weiter). Texte sind fremder Text (KI) – nur Textknoten.
 */
const BEREICH_NAME = { krypto: "Krypto", aktien: "Aktien" };
// Gesamtprüfung 19.10.2026 (B27): Status als Wort statt Rohwert; ohne offenen Antrag bleibt das Ergebnis der letzten 24 h als eine Zeile stehen
const ANTRAG_STATUS = { ausgefuehrt: "ausgeführt", verfallen: "verfallen", abgelehnt: "abgelehnt", fehler: "nicht ausgeführt" };
const antragStatus = (s) => ANTRAG_STATUS[s] || F.text(s);
function antragErledigtKarte(frisch) {
  return h("section", { class: "karte antrag-karte antrag-erledigt", id: "ki-antraege" },
    h("ul", { class: "liste" }, frisch.map((a) => h("li", { "data-antrag-erledigt": F.text(a.id), "data-status": F.text(a.status) },
      h("div", { class: "oben" },
        h("span", { class: "titel" }, a.status === "ausgefuehrt" ? "KI-Antrag ausgeführt"
          : "KI-Antrag nicht ausgeführt: " + (typeof a.ergebnis === "string" && a.ergebnis.trim() ? a.ergebnis : antragStatus(a.status))),
        h("span", { class: "klein gedimmt" }, F.zeit(a.erledigt_zeit || a.zeit)))))));
}
function antragKarte(roh) {
  const d = istObj(roh) ? roh : null;
  const offen = d ? liste(d.offen).filter((a) => istObj(a) && typeof a.id === "string") : [];
  const erledigt = d ? liste(d.erledigt).filter(istObj) : [];
  if (!offen.length) {
    const frisch = erledigt.filter((a) => { const t = F.datum(a.erledigt_zeit || a.zeit); return t && Date.now() - t.getTime() < 864e5; }).reverse();
    return frisch.length ? antragErledigtKarte(frisch) : null;
  }
  // 1.3.9 (Tom 19.10.2026, Gesamtprüfung V1/V7/V9): ein Satz statt drei; was das JA auslöst, die Folgen und „gültig bis“ stehen nur
  // noch EINMAL im Dialog antrag_ja (dort wird das JA getippt). Verfällt ein Antrag, sagt es danach die Zeile „nicht ausgeführt: verfallen“.
  return h("section", { class: "karte antrag-karte", id: "ki-antraege" },
    h("div", { class: "karte-kopf" }, h("h2", null, "KI-Antrag"), etikett(offen.length + " offen", "gelb")),
    h("p", { class: "klein gedimmt" }, "Die KI will mehr, als ihre Leitplanken erlauben – nur mit deinem JA."),
    h("ul", { class: "liste" }, offen.map((a) => h("li", { "data-antrag": a.id },
      h("div", { class: "oben" }, h("span", { class: "titel" }, (BEREICH_NAME[a.bereich] || F.text(a.bereich)) + ": " + F.text(a.titel)),
        F.istZahl(a.zuversicht) ? h("span", { class: "klein gedimmt" }, a.zuversicht + " % sicher") : null),
      h("p", null, F.text(a.text)),
      h("div", { class: "unter" }, "Gesperrt durch: " + F.text(a.leitplanke)),
      reihe(A.knopf("antrag_ja", "JA – ausführen …", "primaer", { id: a.id, titel: F.text(a.titel), zusammenfassung: F.text(a.zusammenfassung),
        gueltig_bis: typeof a.gueltig_bis === "string" ? a.gueltig_bis : null }))))),
    erledigt.length ? mehrTeil("antraege-erledigt", h("ul", { class: "liste" }, erledigt.map((a) => h("li", null,
      h("div", { class: "oben" }, h("span", { class: "titel" }, (BEREICH_NAME[a.bereich] || F.text(a.bereich)) + ": " + F.text(a.titel)), etikett(antragStatus(a.status), a.status === "ausgefuehrt" ? "gruen" : "aus")),
      h("div", { class: "unter" }, F.zeit(a.erledigt_zeit || a.zeit) + (a.ergebnis ? " · " + F.text(a.ergebnis) : ""))))), "zuletzt erledigt (" + erledigt.length + ")") : null);
}

/**
 * 1.3.6: Karte „Marktphase“ (handy.json marktphase, Finanz-App ab 18.10.2026) – Bulle/Bär/Übergang in Klartext aus Bitcoin-Kursdaten
 * (Tagesschluss gegen 50-/200-Tage-Linie, von der Cloud mechanisch gerechnet). NUR Anzeige: keine Knöpfe, löst nichts aus. Phase als
 * ein Wort in der Farbe, Kursstand mit Zeit, vier Abstände, „Was die Bots daraus machen“ (drei Ampeln), Hinweis, fester Schluss-Satz.
 * Fehlt das Feld (ältere handy.json) oder ist die Phase „nicht prüfbar“: graue Karte mit dem Grund. Alle Texte nur als Textknoten.
 * 1.3.9 (Tom 19.10.2026, Gesamtprüfung V16/V19/V24): sichtbar nur Phasenwort und EIN Halbsatz („+2,1 % zur 50-Tage-Linie · Kurs …“, die
 * Zahl aus abstaende.ma50_prozent); Grund-Satz, Abstände, Bots, Hinweis und Schluss-Satz hinter „mehr“. Bei „nicht prüfbar“ steht der
 * Grund sichtbar da. Die Trend-Zeile nennt keine eigene Zahl mehr (sonst zwei 50-Tage-Abstände für denselben Tag), der Hinweis kommt
 * nur, wenn der echte Trend-Topf investiert ist (trend_bot_investiert true – nicht beim Musterdepot).
 */
const MP_FARBEN = ["gruen", "rot", "gelb", "grau"];
const MP_SCHLUSS = "Beschreibung der Lage aus Kursdaten, keine Vorhersage. Gehandelt wird nur nach den Regeln der Bots oder nach deinem JA.";
function mpProzent(v) {
  if (!F.istZahl(v)) return "–";
  return (v > 0 ? "+" : "") + Number(v).toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}
function mpZeit(x, vor, nach) {
  const t = x && F.datum(x.zeit) ? F.zeit(x.zeit) : x && typeof x.zeit_text === "string" && x.zeit_text ? F.text(x.zeit_text) : "";
  return t ? vor + t + nach : "";
}
function mpBot(titel, farbe, text) {
  return h("li", null, h("span", { class: "punkt " + (MP_FARBEN.includes(farbe) ? farbe : "grau") }), h("span", { class: "titel" }, titel + ": "), text);
}
function marktphaseKarte(roh) {
  const m = istObj(roh) ? roh : null;
  const farbe = m && MP_FARBEN.includes(m.farbe) ? m.farbe : "grau";
  const phase = m ? F.text(m.phase_text || m.phase, "nicht prüfbar") : "nicht prüfbar";
  const grund = m ? (typeof m.grund === "string" && m.grund ? m.grund : fehlerVon(m) ? "Marktphase nicht prüfbar: " + fehlerVon(m) : "")
    : "Marktphase nicht prüfbar: noch keine Marktphase in den Handy-Daten (kommt mit dem nächsten Cloud-Lauf).";
  const kurs = m ? ok(m.kurs) : null;
  const a = m ? ok(m.abstaende) : null;
  const l = m && istObj(m.linien) ? m.linien : {};
  const b = m && istObj(m.bots) ? m.bots : {};
  const t = ok(b.trend_ampel), z = ok(b.ampel_200), k = ok(b.ki_ampel);
  const eurZusatz = (v) => (F.istZahl(v) ? " · " + F.euro(v) : "");
  // 1.3.9: EIN Halbsatz statt Kursstand + Grund + Abstände; ohne Phase oder ohne 50-Tage-Abstand steht stattdessen der Grund sichtbar da
  const kurz = farbe !== "grau" && a && F.istZahl(a.ma50_prozent)
    ? mpProzent(a.ma50_prozent) + " zur 50-Tage-Linie" + (kurs && F.istZahl(kurs.eur) ? " · Kurs " + F.euro(kurs.eur) : "") : null;
  // Gesamtprüfung 19.10.2026 (B28): Zeiten aus „zeit“ (in der Demo mitverschoben, „heute“/„gestern“ wie überall); zeit_text nur als Rückfall
  const stand = m && m.stand ? "Stand " + F.zeit(m.stand) : mpZeit(kurs, "Stand ", "");
  return h("section", { class: "karte marktphase-karte " + farbe, id: "marktphase" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Marktphase"), stand ? h("span", { class: "klein gedimmt" }, stand) : null),
    h("div", { class: "mp-phase " + farbe, id: "mp-phase" }, phase),
    kurz ? h("p", { class: "klein mp-kurz", id: "mp-kurz" }, kurz) : grund ? h("p", { class: "klein mp-grund" }, grund) : null,
    // Warnung bleibt sichtbar (nicht hinter „mehr“): sie ist der einzige Satz der Karte, der zum Handeln rät
    m && m.trend_bot_investiert === true && typeof m.hinweis === "string" && m.hinweis ? h("p", { class: "mp-hinweis" }, m.hinweis) : null,
    mehrTeil("marktphase", [
      kurz && grund ? h("p", { class: "klein mp-grund" }, grund) : null,
      a ? zeilen([
        ["Abstand zur 50-Tage-Linie", mpProzent(a.ma50_prozent) + eurZusatz(l.ma50_eur)],
        ["Abstand zur 200-Tage-Linie", mpProzent(a.ma200_prozent) + eurZusatz(l.ma200_eur)],
        ["Abstand zum 20-Tage-Hoch", mpProzent(a.hoch_20_prozent) + eurZusatz(l.hoch_20_eur)],
        ["Abstand zum 365-Tage-Hoch", mpProzent(a.hoch_365_prozent) + eurZusatz(l.hoch_365_eur)],
      ]) : null,
      h("ul", { class: "mp-bots" },
      h("li", { class: "klein gedimmt" }, "Was die Bots daraus machen:"),
      // 1.3.9 (V24): nur die Ampel – der 50-Tage-Abstand steht oben einmal (aus abstaende); die Fusion-Kerze weicht oft um 0,1 ab
      t && typeof t.gruen === "boolean"
        ? mpBot("Trend-Bot", t.gruen ? "gruen" : "rot", "Markt-Ampel " + (t.gruen ? "grün" : "rot"))
        : mpBot("Trend-Bot", "grau", "Markt-Ampel nicht prüfbar" + (fehlerVon(b.trend_ampel) ? " (" + fehlerVon(b.trend_ampel) + ")" : "")),
      z && MP_FARBEN.includes(z.farbe)
        ? mpBot("200-Tage-Ampel", z.farbe, (z.farbe === "gruen" ? "grün" : z.farbe) + (z.text ? " – " + F.text(z.text) : ""))
        : mpBot("200-Tage-Ampel", "grau", "nicht prüfbar" + (fehlerVon(b.ampel_200) ? " (" + fehlerVon(b.ampel_200) + ")" : "")),
      k && MP_FARBEN.includes(k.farbe)
        ? mpBot("KI-Ampel Coin-Bot", k.farbe, (k.farbe === "gruen" ? "grün" : k.farbe) + mpZeit(k, " (Einschätzung ", ")"))
        : mpBot("KI-Ampel Coin-Bot", "grau", "nicht prüfbar" + (fehlerVon(b.ki_ampel) ? " (" + fehlerVon(b.ki_ampel) + ")" : ""))),
      h("p", { class: "klein gedimmt mp-schluss" }, m && typeof m.schluss === "string" && m.schluss ? m.schluss : MP_SCHLUSS)]));
}

/** 1.2.11: Lagebericht je Bot (handy.json <bot>.lage – Liste kurzer Sätze, regelbasiert aus der Cloud). Fehlt er: nichts zeigen. */
function lageListe(lage, titel) {
  const saetze = liste(lage).filter((x) => typeof x === "string" && x.trim());
  if (!saetze.length) return null;
  return h("div", { class: "lage-im-mehr" }, h("h3", null, titel), h("ul", { class: "lage-liste" }, saetze.map((t) => h("li", null, F.text(t)))));
}
function lageKarte(lage, titel, zu) {
  const saetze = liste(lage).filter((x) => typeof x === "string" && x.trim());
  if (!saetze.length) return null;
  const ul = h("ul", { class: "lage-liste" }, saetze.map((t) => h("li", null, F.text(t))));
  if (zu) return h("details", { class: "karte lage-karte" }, h("summary", null, titel || "Lage"), ul);
  return karte(titel || "Lage – warum es gerade so ist", null, ul);
}

/**
 * 1.2.13 (Paket E): Karte „KI-Vorschlag“ – die KI schlägt vor, Trend-/Raster-Bot ein-, auszuschalten oder zu pausieren (handy.json
 * <bot>.ki_vorschlag). Nur ein Vorschlag: „Mit JA übernehmen …“ (bis 1.3.8 „Vorschlag übernehmen …“) öffnet den bekannten Dialog (surfen_ein/trend_ein mit
 * vorausgefülltem Betrag, *_pause, *_aus) mit JA. Bei „keine“ steht die Einschätzung da (warum gerade nicht). Fehlt sie: nichts.
 */
function vorschlagKarte(v, teil, deckel, kurz) {
  if (!ok(v)) return null;
  const aktiv = v.aktion && v.aktion !== "keine";
  if (kurz && !aktiv) return null;
  const betrag = v.aktion === "einschalten" ? (F.istZahl(v.betrag_eur) && v.betrag_eur > 0 ? v.betrag_eur : teil && teil.topf_eur) : null;
  // 1.3.9 (V31): „erst mit deinem JA“ steht EINMAL – am Knopf selbst
  const knopf = aktiv && v.modus ? A.knopf(v.modus, "Mit JA übernehmen …", "primaer",
    F.istZahl(betrag) ? { betrag: String(Math.round(betrag * 100) / 100).replace(".", ",") } : undefined) : null;
  const sicher = F.istZahl(v.zuversicht) ? v.zuversicht + " % sicher" : null;
  const frei = ok(deckel) && F.istZahl(deckel.frei_eur) ? "50-%-Deckel: noch " + F.euro(deckel.frei_eur) + " frei für Trend- und Raster-Topf." : null;
  // 1.3.9 (V31): Zeit und Zuversicht im Kopf; „nur mit JA“ steht EINMAL am Knopf (ohne Knopf – nur Einschätzung – gibt es nichts zu schalten)
  const rechts = [sicher, F.datum(v.zeit) ? F.zeit(v.zeit) : null].filter(Boolean).join(" · ");
  // auf der Übersicht (kurz) nur Titel und Knopf – die Begründung steht dort schon im „mehr“ der Bot-Karte darüber („KI: …“)
  return karte(aktiv ? "KI-Vorschlag" : "KI-Einschätzung", rechts ? h("span", { class: "klein gedimmt" }, rechts) : null,
    h("p", { class: aktiv ? "vorschlag-titel" : "" }, h("b", null, F.text(v.titel))),
    !kurz && v.begruendung ? h("p", null, F.text(v.begruendung)) : null,
    !kurz && v.hinweis ? h("p", { class: "klein gedimmt" }, F.text(v.hinweis)) : null,
    frei && !kurz ? h("p", { class: "klein gedimmt" }, frei) : null,
    reihe(knopf));
}

/** 1.2.14: eine Zeile „KI: …“ in den Karten Raster-Bot und Trend-Bot der Übersicht – auch bei „so lassen“ (die Karte „KI-Vorschlag“
 *  erscheint auf der Übersicht nur bei einem aktiven Vorschlag). Fehlt die Einschätzung: nichts. */
function kiZeile(v) {
  if (!ok(v)) return null;
  const a = v.aktion;
  const was = a === "einschalten" ? (F.istZahl(v.betrag_eur) && v.betrag_eur > 0 ? "mit " + F.euro(v.betrag_eur) + " einschalten" : "fortsetzen")
    : a === "pausieren" ? "pausieren" : a === "ausschalten" ? "ausschalten" : "so lassen";
  return h("p", { class: "klein ki-einschaetzung" }, h("b", null, "KI: " + was), v.begruendung ? " – " + F.text(v.begruendung) : "");
}

/** 1.2.15: Schalt-Knöpfe auch in den Bot-Karten der Übersicht (Nutzerwunsch 14.10.2026) – dieselben Dialoge mit JA wie auf den
 *  Bot-Seiten; bei „aus“ dazu der freie Rest unter dem 50-%-Deckel (handy.json bot_deckel, nur Anzeige – die Cloud prüft hart). */
function botKnoepfe(st, ein, pause, aus, deckel) {
  const frei = st === "aus" && ok(deckel) && F.istZahl(deckel.frei_eur)
    ? h("p", { class: "klein gedimmt" }, "Frei für Trend- und Raster-Topf (50-%-Deckel): " + F.euro(deckel.frei_eur)) : null;
  const k = reihe(st !== "an" ? A.knopf(ein, st === "pausiert" ? "Wieder einschalten" : "Einschalten", "primaer") : A.knopf(pause, "Pausieren"),
    st !== "aus" ? A.knopf(aus, "Ausschalten", "gefahr-rand") : null);
  return frei || k ? h("div", { class: "bot-knoepfe" }, frei, k) : null;
}

function listenKarte(titel, bot, art, teil) {
  const roh = liste(teil[art === "trades" ? "trades_letzte" : "ereignisse"]);
  const darf = AB.moeglich(roh);
  const l = AB.sichtbar(roh, bot, art);
  const gezeigt = art === "ereignisse" ? l.slice(0, 10) : l;
  const zahl = teil[art + "_ausgeblendet"];
  const anzahlWeg = (Number.isInteger(zahl) && zahl > 0 ? zahl : 0) + (roh.length - l.length);
  // gesehen = gezeigt + die per ✕ schon lokal ausgeblendeten (auch sie hat der Nutzer gesehen; „Liste leeren“ deckt sie mit ab)
  const gesehen = roh.filter((x) => istObj(x) && (!l.includes(x) || gezeigt.includes(x)));
  const leerKnopf = darf && gezeigt.length
    ? h("button", { type: "button", class: "knopf-text", "data-leeren": bot + "-" + art, onclick: () => AB.listeLeeren(bot, art, gezeigt, titel, gesehen) }, "Liste leeren")
    : null;
  const inhalt = art === "trades" ? tradesListe(gezeigt, bot, darf) : ereignisListe(gezeigt, bot, darf);
  const leerText = anzahlWeg > 0 ? "Alles ausgeblendet – neue Einträge erscheinen hier wieder."
    : art === "trades" ? "Noch keine echten Trades." : "Keine Ereignisse.";
  return h("section", { class: "karte", id: bot + "-" + art + "-karte" }, h("div", { class: "karte-kopf" }, h("h2", null, titel), leerKnopf),
    inhalt || leer(leerText),
    anzahlWeg > 0 ? h("p", { class: "klein gedimmt ausgeblendet-zahl" }, anzahlWeg + " ausgeblendet (nicht gelöscht)") : null,
    AB.wartet(bot, art) ? h("p", { class: "klein gedimmt" }, "Ausgeblendet – wird an die Cloud geschickt, sobald der laufende Auftrag fertig ist.") : null);
}

function schattenHinweis(s, name) {
  if (!ok(s)) return null;
  const diff = F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? s.wert_eur - s.bitcoin_halten_eur : null;
  return h("p", { class: "hinweis-schatten" },
    "Musterdepot (Rechengeld): " + F.euro(s.wert_eur) + " gegen „Bitcoin halten“ " + F.euro(s.bitcoin_halten_eur)
    + (diff !== null ? " → " + F.euroPlus(diff) : "") + (name ? " · " + name : ""));
}

// ------------------------------------------------------------------ Statistik (handy_verlauf.json)

/** Hinweis statt Diagramm, wenn der Verlauf fehlt bzw. nicht lesbar ist – sonst null. */
function verlaufHinweis(Z) {
  if (Z.verlauf) return null;
  if (Z.fehlerVerlauf === "nichtda") return h("p", { class: "leer statistik-leer statistik-fehlt" }, "Statistik entsteht ab dem nächsten Cloud-Lauf.");
  if (Z.fehlerVerlauf) return h("p", { class: "fehlerteil" }, "Statistik gerade nicht lesbar: " + Z.fehlerVerlauf);
  return h("p", { class: "leer statistik-leer" }, "Statistik wird geladen …");
}

/** Gesamt = gesamt_eur der Cloud (seit 1.2.3 inkl. echter Bot-Töpfe; Punkte ohne Wert = Lücke, zählen auch für Veränderung,
 *  Höchst und Tiefst nicht). Linien für Trend-/Raster-Topf nur, wenn der Zeitraum echte Werte hat. */
function gesamtStatistik(Z) {
  const hinweis = verlaufHinweis(Z);
  if (hinweis) return hinweis;
  return D.statistik({
    schluessel: "gesamt", punkte: D.punkteLesen(Z.verlauf), einheit: "eur", beschreibung: "Verlauf des Gesamtvermögens", tippHinweis: false,   // 1.4: der Hinweis steht schon in der Verlauf-Karte
    serien: (p) => [
      // 1.3.12: eigene Farbe je Teil (wie Balken und Punkte), Gesamt hell – die anderen Diagramme behalten l-haupt/l-zweit/l-dritt
      { name: "Gesamt", klasse: "l-gesamt", werte: D.reihe(p, "gesamt_eur") },
      { name: "Coin-Topf", klasse: "l-coin", werte: D.reihe(p, "coin_topf_eur") },
      { name: "Trend-Topf", klasse: "l-trend", werte: D.reihe(p, "trend_echt_eur") },
      { name: "Raster-Topf", klasse: "l-raster", werte: D.reihe(p, "raster_echt_eur") },
      { name: "Aktien & ETFs", klasse: "l-aktien", werte: D.reihe(p, "aktien_eur") },
    ],
    kennzahl: (p, serien) => D.euroKennzahlen(serien[0].werte),
  });
}

function coinStatistik(Z) {
  const hinweis = verlaufHinweis(Z);
  if (hinweis) return [hinweis];
  const punkte = D.punkteLesen(Z.verlauf);
  return [
    D.statistik({
      schluessel: "coin", punkte, einheit: "prozent", beschreibung: "Coin-Topf gegen Bitcoin halten in Prozent seit Zeitraumbeginn", tippHinweis: true,
      serien: (p) => [
        { name: "Coin-Topf", klasse: "l-haupt", werte: D.zeitgewichtet(p) },
        { name: "Bitcoin halten", klasse: "l-halten", werte: D.bitcoinProzent(p) },
      ],
      kennzahl: (p, serien) => {
        const c = serien[0].werte, b = serien[1].werte;
        const ce = c.length ? c[c.length - 1][1] : null, be = b.length ? b[b.length - 1][1] : null;
        const k = D.kennzahlen(D.reihe(p, "coin_topf_eur"));
        return [
          ["Coin-Topf (ohne Einzahlungen)", F.prozent(ce), F.vorzeichenKlasse(ce)],
          ["Bitcoin halten", F.prozent(be), F.vorzeichenKlasse(be)],
          F.istZahl(ce) && F.istZahl(be) ? ["Unterschied", F.zahl(ce - be, 2).replace(/^-/, "−") + " Prozentpunkte", F.vorzeichenKlasse(ce - be)] : null,
          k ? ["Wert im Zeitraum", F.euroPlus(k.diff) + " (mit Ein-/Auszahlungen)", F.vorzeichenKlasse(k.diff)] : null,
          k ? ["Höchst / Tiefst", F.euro(k.hoch[1]) + " / " + F.euro(k.tief[1])] : null,
        ];
      },
    }),
    h("h3", null, "Bitcoin-Kurs"),
    D.statistik({
      schluessel: "btc", punkte, einheit: "eur", beschreibung: "Bitcoin-Kurs in Euro",
      serien: (p) => [{ name: "Bitcoin", klasse: "l-halten", werte: D.reihe(p, "bitcoin_kurs_eur") }],
      kennzahl: (p, serien) => D.euroKennzahlen(serien[0].werte),
    }),
  ];
}

/** Raster/Trend: echter Topf (falls im Verlauf) sonst Musterdepot – jeweils gegen „Bitcoin halten“. */
export function botStatistik(Z, bot) {   // export: Handy-Tests (B13)
  const hinweis = verlaufHinweis(Z);
  if (hinweis) return hinweis;
  const punkte = D.punkteLesen(Z.verlauf);
  // Gesamtprüfung 16.10.2026 (B13): der echte Topf nur, solange der Bot echt läuft (jüngster Punkt trägt *_echt_eur und es gibt
  // mindestens zwei echte Punkte) – drei alte „echt“-Punkte vom 11.10. verdrängten sonst für immer das laufende Musterdepot
  const letzte = punkte.length ? punkte[punkte.length - 1] : null;
  const echt = !!letzte && F.istZahl(letzte[bot + "_echt_eur"]) && D.reihe(punkte, bot + "_echt_eur").length >= 2;
  const feld = bot + (echt ? "_echt" : "_schatten");
  return h("div", null,
    h("p", { class: "klein gedimmt" }, echt ? "Echter Topf gegen „Bitcoin halten“ mit demselben Startbetrag."
      : "Musterdepot (Rechengeld) gegen „Bitcoin halten“ mit demselben Startbetrag."),
    D.statistik({
      schluessel: bot, punkte, einheit: "eur", beschreibung: (echt ? "Echter Topf" : "Musterdepot") + " gegen Bitcoin halten", tippHinweis: true,
      serien: (p) => [
        { name: echt ? "Echter Topf" : "Musterdepot", klasse: "l-haupt", werte: D.reihe(p, feld + "_eur") },
        { name: "Bitcoin halten", klasse: "l-halten", werte: D.reihe(p, feld + "_halten_eur") },
      ],
      kennzahl: (p, serien) => {
        const k = D.euroKennzahlen(serien[0].werte);
        const a = serien[0].werte, b = serien[1].werte;
        if (a.length && b.length) {
          const d = a[a.length - 1][1] - b[b.length - 1][1];
          k.push(["gegen „Bitcoin halten“", F.euroPlus(d), F.vorzeichenKlasse(d)]);
        }
        return k;
      },
    }));
}

// ------------------------------------------------------------------ Übersicht

/**
 * Bot-Topf für eine ältere Cloud, deren „gesamt“ die Bot-Töpfe noch nicht kennt – dieselbe Regel wie handy.bot_topf:
 * Trend zählt im Modus „echt“, Raster bei Status an/pausiert, Einsatz > 0, Topf > 0 oder Coins ohne Kurs; sonst 0 (bekannt).
 * Musterdepots zählen nie. Teil fehlt/kaputt: [true, null] = unbekannt.
 */
function botTopf(teil, art) {
  const t = ok(teil);
  if (!t) return [true, null];
  const pos = (x) => F.istZahl(x) && x > 0;
  const kf = t.kurse_fehlen;
  const echt = art === "trend" ? t.modus === "echt"
    : t.status === "an" || t.status === "pausiert" || pos(t.einsatz_eur) || pos(t.topf_eur) || (Array.isArray(kf) ? kf.length > 0 : !!kf);
  return echt ? [true, F.istZahl(t.topf_eur) ? t.topf_eur : null] : [false, 0];
}

/**
 * Gesamtvermögen aus handy.json → gesamt = Coin-Topf + echter Trend-Topf + echter Raster-Topf + Aktien & ETFs + Aktien-Reserve
 * (docs/HANDY-DATEN.md). Ältere Cloud – „gesamt“ ohne Bot-Töpfe (bis 11.10.2026) oder ganz ohne: aus den Teilen gerechnet, gleiche
 * Regel; der Coin-Topf enthält die Bot-Töpfe nicht. Die Aktien-Reserve fehlt dann (ihre Deckung kennt nur die Cloud).
 */
function gesamtTeil(d) {
  const g = ok(d.gesamt);
  if (g && ("trend_topf_eur" in g || "raster_topf_eur" in g)) return g;
  const k = ok(d.kern_bot), a = ok(d.aktien);
  const zahl = (x) => (F.istZahl(x) ? x : null);
  const c = g ? zahl(g.coin_topf_eur) : k ? zahl(k.wert_eur) : null;
  const s = g ? zahl(g.aktien_eur) : a ? zahl(a.wert_eur) : null;
  const [tEcht, t] = botTopf(d.trend_bot, "trend");
  const [rEcht, r] = botTopf(d.raster_bot, "raster");
  if (c === null && s === null && !t && !r) return null;
  const sum = Math.round([c, t, r, s].reduce((x, y) => x + (y || 0), 0) * 100) / 100;
  const anteil = (x) => (x !== null && sum > 0 ? x / sum * 100 : null);
  return { gesamt_eur: sum, coin_topf_eur: c, trend_topf_eur: t, raster_topf_eur: r, aktien_eur: s, reserve_eur: null,
    trend_echt: tEcht, raster_echt: rEcht,
    anteil_coin_topf_prozent: anteil(c), anteil_trend_topf_prozent: anteil(t), anteil_raster_topf_prozent: anteil(r), anteil_aktien_prozent: anteil(s),
    vollstaendig: (!g || g.vollstaendig !== false) && [c, t, r, s].every((x) => x !== null),
    zeit: (g && g.zeit) || [k && k.wert_zeit, a && a.wert_zeit].filter(Boolean).sort()[0] || null,
    ohne_reserve: !!(a && F.istZahl(a.reserve_eur) && a.reserve_eur > 0) };
}

/** Teile des Gesamtvermögens: [Schlüssel (= Farbe), Name, Wertfeld, Anteilfeld, echt-Feld] */
const GESAMT_TEILE = [
  ["coin", "Coin-Topf", "coin_topf_eur", "anteil_coin_topf_prozent", null],
  ["trend", "Trend-Topf", "trend_topf_eur", "anteil_trend_topf_prozent", "trend_echt"],
  ["raster", "Raster-Topf", "raster_topf_eur", "anteil_raster_topf_prozent", "raster_echt"],
  ["aktien", "Aktien & ETFs", "aktien_eur", "anteil_aktien_prozent", null],
  ["reserve", "Aktien-Reserve", "reserve_eur", "anteil_reserve_prozent", null],
  ["euro", "Euro-Guthaben", "euro_eur", "anteil_euro_prozent", null],     // 1.2.5: freies Euro-Guthaben (nur mit euro_bekannt)
];

/** Sichtbare Teile: Coin-Topf und Aktien immer; ein Bot-Topf nur mit echtem Geld (oder Wert > 0); Reserve nur > 0;
 *  Euro-Guthaben (1.2.5), sobald die Cloud es kennt (euro_bekannt) – auch bei 0 €, dann stimmt die Summe sichtbar mit Bitpanda. */
function gesamtTeile(g) {
  return GESAMT_TEILE.filter(([k, , feld, , echt]) => k === "euro" ? g.euro_bekannt === true && F.istZahl(g[feld])
    : k === "coin" || k === "aktien" || (echt && g[echt] === true) || (F.istZahl(g[feld]) && g[feld] > 0))
    .map(([k, name, feld, af]) => {
      const v = F.istZahl(g[feld]) ? g[feld] : null;
      const a = F.istZahl(g[af]) ? g[af] : v !== null && F.istZahl(g.gesamt_eur) && g.gesamt_eur > 0 ? v / g.gesamt_eur * 100 : null;
      return { k, name, v, a };
    });
}

function gesamtKarte(d, Z) {
  const g = gesamtTeil(d);
  if (!g) return fehlerKarte("Gesamtvermögen", d.gesamt);
  const teile = gesamtTeile(g);
  const balken = h("div", { class: "anteil-balken", "aria-hidden": "true" }, teile.filter((t) => t.a !== null && t.a > 0).map((t) => {
    const el = h("div", { class: "anteil-" + t.k, "data-teil": t.k });
    el.style.width = Math.max(0, Math.min(100, t.a)).toFixed(1) + "%";       // CSSOM ist mit der CSP erlaubt
    return el;
  }));
  return h("section", { class: "karte gesamt-karte", id: "gesamt-karte" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Gesamtvermögen"), h("span", { class: "klein gedimmt" }, "Coin-Topf + Bots + Aktien & ETFs")),
    h("div", { class: "gross", id: "gesamt-wert" }, F.euro(g.gesamt_eur)),
    h("p", { class: "klein gedimmt", id: "gesamt-stand" }, "Stand " + F.zeit(g.zeit) + gesamtVermerk(g)),
    mehrTeil("gesamt", [balken,
      zeilen(teile.map((t) => [h("span", { "data-teil": t.k }, h("span", { class: "punkt " + t.k }),
        " " + t.name + (t.k === "coin" && g.coin_topf_geschaetzt === true ? " (geschätzt)" : "")),
        F.euro(t.v) + (t.a !== null ? " · " + F.prozent(t.a, 1, false) : "")])),
      gesamtStatistik(Z)], "mehr – Aufteilung und Verlauf"));
}

/**
 * Vermerke unter dem Gesamtvermögen: unvollständig (Grund der Cloud, z. B. „Umbuchung – Coin-Topf folgt im nächsten Lauf“: zwischen
 * Bilanz-Punkt und Bot-Topf wurde umgebucht, der Coin-Topf ist geschätzt), ohne Aktien-Reserve (ältere Cloud) und „ohne freies
 * Euro-Guthaben“ – seit 1.2.5 nur noch, solange die Cloud das Euro-Guthaben nicht kennt (euro_bekannt nicht true, auch ältere Cloud).
 */
function gesamtVermerk(g) {
  const grund = typeof g.unvollstaendig_grund === "string" && g.unvollstaendig_grund.trim()
    ? g.unvollstaendig_grund.trim().slice(0, 80) : "ein Teil ist gerade nicht lesbar";
  return (g.vollstaendig === false ? " · unvollständig (" + grund + ")" : "") + (g.ohne_reserve ? " · ohne Aktien-Reserve" : "")
    + (g.euro_bekannt === true ? "" : " · ohne freies Euro-Guthaben");
}

/** „Alles parken“ (groß, rot) und „Nur anhalten“ (klein) mit Erklärtexten */
function parkKnoepfe() {
  const gross = A.knopf("allesstopp", "Alles parken", "gefahr stopp-knopf");
  const klein = A.knopf("anhalten", "Nur anhalten", "gefahr-rand anhalten-knopf");
  if (!gross && !klein) return null;
  // 1.3.14 (Tom 23.10.2026): beide Knöpfe nebeneinander und gleich groß, die Erklärungen darunter
  return h("div", { class: "park-knoepfe" },
    h("div", { class: "park-reihe" }, gross, klein),
    gross ? bremsErklaerung("allesstopp") : null,
    klein ? bremsErklaerung("anhalten") : null);
}

/** 1.2.5: Erklärtext + „Sinnvoll, wenn:“ in Stichworten + Hinweis (A.BREMS_WANN) */
function bremsErklaerung(m) {
  const w = A.BREMS_WANN[m];
  return h("div", { class: "erklaer-text", "data-erklaert": m },
    h("p", null, A.ERKLAERT[m]),
    mehrTeil("park-" + m, [                                       // 1.2.19: die Übersicht bleibt kurz
      h("p", { class: "wann-titel" }, "Sinnvoll, wenn:"),
      h("ul", { class: "wann" }, w.wann.map((x) => h("li", null, x))),
      h("p", { class: "wann-dazu" }, w.dazu)], "wann sinnvoll?"));
}

/** Kurzes Eingabefeld „An die KI“ für den Anfang der Übersicht: Enter oder „Senden“ öffnet das Blatt mit Status und Antworten. */
function kiSchnellKarte() {
  const feld = h("input", { type: "text", class: "ki-schnell-feld", maxlength: "500", autocomplete: "off", enterkeyhint: "send",
    placeholder: "Frage oder Hinweis an die KI …", "aria-label": "Frage oder Hinweis an die KI" });
  const los = async () => {
    const t = feld.value.trim();
    if (!t) { feld.focus(); return; }
    if (await K.schnellSenden(t)) feld.value = "";
  };
  feld.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); los(); } });
  return h("section", { class: "karte ki-schnell-karte" },
    h("div", { class: "ki-schnell" }, feld, h("button", { type: "button", class: "knopf primaer", onclick: los }, "Senden")));
}

/** 1.2.19: Kurzzeile einer Bot-Karte der Übersicht – läuft der echte Topf: sein Stand (+ Ergebnis), sonst das Musterdepot.
 *  1.3.9: zeigt die Kurzzeile das Musterdepot, steht es im „mehr“ nicht noch einmal (zeigtEcht) – „Rechengeld“ je Karte einmal. */
function zeigtEcht(status, topf) {
  return status !== "aus" && F.istZahl(topf);
}
function botKurz(status, topf, ergEur, ergPz, schatten, id, je) {
  if (zeigtEcht(status, topf)) {
    const erg = F.istZahl(ergEur) || F.istZahl(ergPz)
      ? h("p", { class: "klapp-kurz " + F.vorzeichenKlasse(F.istZahl(ergEur) ? ergEur : ergPz) },
        "Ergebnis " + (F.istZahl(ergEur) ? F.euroPlus(ergEur) : "–") + (F.istZahl(ergPz) ? " (" + F.prozent(ergPz) + ")" : ""))
      : null;
    return [h("div", { class: "mittel", id }, F.euro(topf)), erg];
  }
  // 1.4.1 (Spielgeld-Ansicht): mit „je 1.000 €“ der Cloud (schattendepots je_1000) dieselben Zahlen wie in der Musterdepot-Liste
  const s = je && F.istZahl(je.wert) ? { wert_eur: je.wert, bitcoin_halten_eur: je.referenz } : ok(schatten);
  const diff = s && F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? s.wert_eur - s.bitcoin_halten_eur : null;
  return h("p", { class: "klapp-kurz", id }, "nur Musterdepot (Rechengeld)" + (s && F.istZahl(s.wert_eur) ? ": " + F.euro(s.wert_eur)
    + (F.istZahl(s.bitcoin_halten_eur) ? " gegen „Bitcoin halten“ " + F.euro(s.bitcoin_halten_eur) : "") + (diff !== null ? " → " + F.euroPlus(diff) : "") : ""));
}

// ------------------------------------------------------------------ Autopilot-Wahlschalter (1.3, Nutzer 18.10.2026)
// EIN Wahlschalter „KI · Regeln · Aus“ für Krypto und Aktien, genau eine Stellung aktiv: KI = der KI-Autopilot steuert (die festen
// Regeln laufen als Sicherheitsnetz mit), Regeln = der Regel-Autopilot (Regelwerk + Aktien-Autopilot), Aus = alles angehalten. Je
// Stellung EIN Auftrag (autopilot_ki mit JA, autopilot_regeln mit JA nur wenn dabei etwas eingeschaltet wird, autopilot_aus als Bremse).
export function autopilotStellung(d) {
  const a = ok(d && d.autopilot);
  if (a && ["ki", "regeln", "aus"].includes(a.stellung)) return { stellung: a.stellung, hinweis: a.hinweis || null };
  const k = ok(d && d.kern_bot) || {}, ak = ok(d && d.aktien) || {};   // ältere Cloud ohne Feld: aus den Einzel-Schaltern
  return { stellung: k.an ? "ki" : (k.regelwerk_an || ak.an) ? "regeln" : "aus", hinweis: null };
}
const STELLUNG_TEXT = { ki: "KI", regeln: "Regeln", aus: "Aus" };
function autopilotWahl(d, id) {
  if (!A.erlaubt("autopilot_ki") || !A.erlaubt("autopilot_regeln") || !A.erlaubt("autopilot_aus")) return null;   // ältere Cloud
  const s = autopilotStellung(d);
  const feld = (st, modus, vorgaben) => {
    const an = st === s.stellung;
    return h("button", { type: "button", class: "wahl-feld" + (an ? " aktiv" : ""), role: "radio", "aria-checked": an ? "true" : "false",
      "data-stellung": st, "data-modus": modus,
      onclick: () => (an && !s.hinweis ? null : A.ausfuehren(modus, vorgaben || {})) }, STELLUNG_TEXT[st]);
  };
  // „Regeln“ braucht JA, wenn dabei eine Regel EINgeschaltet wird – also nicht von einem vollständigen „KI“ aus
  const regelnJa = s.stellung !== "ki" || !!s.hinweis;
  return h("div", { class: "autopilot-wahl", id },
    h("span", { class: "wahl-label" }, "Autopilot"),
    h("div", { class: "wahl", role: "radiogroup", "aria-label": "Autopilot" },
      feld("ki", "autopilot_ki"), feld("regeln", "autopilot_regeln", { ja: regelnJa }), feld("aus", "autopilot_aus")),
    s.hinweis ? h("p", { class: "klein gedimmt wahl-hinweis" }, "(" + s.hinweis + ")") : null);
}
/** 1.3.14 (Tom 23.10.2026, Reihenfolge Teil 1): Verlauf NUR des Gesamtvermögens als eigene Karte über dem Gesamtwert – die Linien
 *  je Teil (1.3.12) bleiben im „mehr“ der Gesamt-Karte. */
function gesamtVerlaufKarte(Z, spiel) {
  const hinweis = verlaufHinweis(Z);
  // 1.4.1: solange echt 0 € liegen, zeigt die Karte den Verlauf des Spielgelds (Verlaufspunkte spielgeld_eur, seit 23.10.2026)
  return h("section", { class: "karte", id: "gesamt-verlauf" }, h("div", { class: "karte-kopf" }, h("h2", null, spiel ? "Verlauf · Spielgeld" : "Verlauf")),
    hinweis || D.statistik({
      schluessel: spiel ? "spielgeld" : "gesamt-nur", punkte: D.punkteLesen(Z.verlauf), einheit: "eur",
      beschreibung: spiel ? "Verlauf des Spielgelds" : "Verlauf des Gesamtvermögens", tippHinweis: true,
      serien: (p) => [spiel ? { name: "Spielgeld", klasse: "l-gesamt", werte: D.reihe(p, "spielgeld_eur") }
        : { name: "Gesamtvermögen", klasse: "l-gesamt", werte: D.reihe(p, "gesamt_eur") }],
      kennzahl: (p, serien) => D.euroKennzahlen(serien[0].werte),
    }));
}

/** 1.3.14: „Coin-Topf gesamt“ – alle Krypto-Töpfe zusammengefasst (Coin-Bot + Raster-Bot + Trend-Bot, Werte aus dem Gesamtvermögen) */
function kryptoGesamtKarte(d, sg) {
  const g = gesamtTeil(d);
  if (!g && !sg) return null;
  const sgW = (k) => { const t = sg && liste(sg.teile).find((x) => istObj(x) && x.k === k); return t && F.istZahl(t.wert_eur) ? t.wert_eur : null; };
  const teile = sg ? [["Coin-Bot", sgW("coin")], ["Raster-Bot", sgW("raster")], ["Trend-Bot", sgW("trend")]]
    : [["Coin-Bot", g.coin_topf_eur], ["Raster-Bot", g.raster_topf_eur], ["Trend-Bot", g.trend_topf_eur]];
  if (!teile.some(([, v]) => F.istZahl(v))) return null;
  const summe = teile.reduce((s, [, v]) => s + (F.istZahl(v) ? v : 0), 0);
  return h("section", { class: "karte", id: "krypto-gesamt" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Coin-Topf gesamt"), sg ? etikett("Spielgeld", "") : null),
    h("div", { class: "gross", id: "krypto-gesamt-wert" }, F.euro(summe)),
    zeilen(teile.map(([n, v]) => [n, F.istZahl(v) ? F.euro(v) : "–"])));
}

/** 1.4.1 (Tom 23.10.2026): „solange wir nur mit Spielgeld trainieren, das Spielgeld anzeigen“ – je Bot sein Haupt-Musterdepot mit
 *  je 1.000 € ab Vergleichsstart (handy.json spielgeld). Ersetzt die Gesamt-Karte, solange echt 0 € liegen. */
function spielgeldModus(d) {
  const sg = ok(d.spielgeld);
  const g = gesamtTeil(d);
  return sg && F.istZahl(sg.gesamt_eur) && liste(sg.teile).length && g && F.istZahl(g.gesamt_eur) && g.gesamt_eur < 1 ? sg : null;
}
const SG_KLASSE = { coin: "coin", raster: "raster", trend: "trend", aktien: "aktien" };
function spielgeldKarte(sg) {
  const teile = liste(sg.teile).filter((t) => istObj(t) && F.istZahl(t.wert_eur));
  const je = F.istZahl(sg.je_eur) ? sg.je_eur : 1000;
  const balken = h("div", { class: "anteil-balken", "aria-hidden": "true" }, teile.filter((t) => F.istZahl(t.anteil_prozent) && t.anteil_prozent > 0).map((t) => {
    const el = h("div", { class: "anteil-" + (SG_KLASSE[t.k] || "euro") });
    el.style.width = Math.max(0, Math.min(100, t.anteil_prozent)).toFixed(1) + "%";
    return el;
  }));
  const diff = F.istZahl(sg.start_eur) ? sg.gesamt_eur - sg.start_eur : null;
  return h("section", { class: "karte gesamt-karte", id: "spielgeld-karte" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Spielgeld"), etikett("Rechengeld", "")),
    h("div", { class: "gross", id: "spielgeld-wert" }, F.euro(sg.gesamt_eur)),
    h("p", { class: "klein " + (diff !== null ? F.vorzeichenKlasse(diff) : "gedimmt") },
      (diff !== null ? F.euroPlus(diff) + " seit Start (" + F.euro(sg.start_eur) + ")" : "") + " · je Bot " + F.euro(je) + " ab Vergleichsstart"),
    balken,
    zeilen(teile.map((t) => [h("span", null, h("span", { class: "punkt " + (SG_KLASSE[t.k] || "euro") }), " " + F.text(t.name)),
      h("span", { class: F.vorzeichenKlasse(t.wert_eur - je) }, F.euro(t.wert_eur))])),
    h("p", { class: "klein gedimmt" }, "Echtes Geld: 0 € – die Übersicht zeigt das Spielgeld, bis wieder echtes Geld liegt."));
}
function sdJe(d, kennung) {
  const e = liste((ok(d.schattendepots) || {}).liste).find((x) => istObj(x) && x.kennung === kennung);
  return e && istObj(e.je_1000) ? e.je_1000 : null;
}

export function uebersicht(Z) {
  const d = Z.handy;
  if (!d) return [Z.fehlerHandy ? h("p", { class: "leer" }, "Noch keine Daten.") : leer("Daten werden geladen …")];
  const out = [];
  // 1.3.14 (Tom 23.10.2026, Reihenfolge Teil 1): KI-Frage · Marktphase · Verlauf · Gesamtvermögen · Parken/Anhalten · Coin-Topf gesamt ·
  // Coin-Bot (mit dem Autopilot-Wahlschalter) · Raster-Bot · Trend-Bot · Musterdepots · Aktien · Wichtige Hinweise
  if (A.erlaubt("frage")) out.push(kiSchnellKarte());
  out.push(marktphaseKarte(d.marktphase));
  const sg = spielgeldModus(d);                                    // 1.4.1: echt 0 € -> Spielgeld-Ansicht
  out.push(gesamtVerlaufKarte(Z, !!sg));
  out.push(sg ? spielgeldKarte(sg) : gesamtKarte(d, Z));
  const ak_ = antragKarte(d.ki_antraege);                          // 1.3.5: KI-Antrag gleich unter dem Gesamtwert (offen; sonst Ergebnis der letzten 24 h)
  if (ak_) out.push(ak_);
  out.push(parkKnoepfe());
  const kg = kryptoGesamtKarte(d, sg);
  if (kg) out.push(kg);

  const k = ok(d.kern_bot);
  if (k) {
    const ki = ok(k.ki);
    const pos = k.geparkt ? "geparkt in EURCV" : k.position ? F.text(k.position) : "–";
    const stK = autopilotStellung(d).stellung;                     // 1.3: der Coin-Bot läuft mit KI ODER Regeln
    const wahl = autopilotWahl(d, "autopilot-uebersicht");         // 1.3.14: der Wahlschalter steht in der Coin-Bot-Karte
    const sgCoin = sg ? liste(sg.teile).find((x) => istObj(x) && x.k === "coin") : null;
    out.push(karte(F.text(k.name, "Coin-Bot"), statusEtikett(k.an || k.regelwerk_an ? "an" : "aus"),
      h("div", { class: "gross", id: "kern-wert" }, F.euro(sgCoin ? sgCoin.wert_eur : k.wert_eur)),
      h("p", { class: "klapp-kurz" }, sgCoin ? "Spielgeld · " + F.text(sgCoin.name) : F.text(k.topf_name, "Coin-Topf") + " · hält " + pos),
      wahl,
      wahl ? mehrTeil("autopilot-stellungen", h("p", { class: "klein gedimmt" }, "KI = der KI-Autopilot steuert Coin-Bot und Aktien (die festen Regeln laufen als Sicherheitsnetz mit) · "
        + "Regeln = der Regel-Autopilot (Notbremse, Gewinnschutz, Welt-ETF, Absturz-Regel) · Aus = alles angehalten, nichts verkauft."), "Was bedeuten die Stellungen?") : null,
      mehrTeil("kern", [
        h("p", { class: "klein gedimmt" }, "Stand " + F.zeit(k.wert_zeit) + (F.istZahl(k.bitcoin_kurs_eur) ? " · Bitcoin " + F.euro(k.bitcoin_kurs_eur) : "")),
        zeilen([
          ["Autopilot", STELLUNG_TEXT[stK]],
          ["Stufe", F.text(k.stufe) + (k.stufe_automatik ? " (Automatik)" : "")],
          ["Bitcoin-Ampel", ampel(k.ampel)],
          ["Hält", pos],
          ki ? ["KI-Urteil", entscheidungText(ki.entscheidung) + (F.istZahl(ki.zuversicht) ? " · " + ki.zuversicht + " % sicher" : "")] : null,
        ]),
        ki ? erklaert("Einfach erklärt", ki.einfach_erklaert) : null,
        ok(d.bilanz) && d.bilanz.text ? h("p", { class: "klein gedimmt" }, d.bilanz.text) : null,
      ]),
    ));
  } else out.push(fehlerKarte("Coin-Topf", d.kern_bot));

  const r = ok(d.raster_bot);
  if (r) {
    out.push(karte(F.text(r.name, "Raster-Bot"), statusEtikett(r.status),
      botKurz(r.status, r.topf_eur, r.ergebnis_eur, r.ergebnis_prozent, r.schatten, "raster-wert", sdJe(d, "raster_schatten")),
      mehrTeil("raster", [
        zeilen([["Topf", F.euro(r.topf_eur)], ergebnisZeile("Ergebnis", r.ergebnis_eur, r.ergebnis_prozent),
          ["Coins", liste(r.coins).map((c) => c.coin).join(", ") || "–"]]),
        zeigtEcht(r.status, r.topf_eur) ? schattenHinweis(r.schatten) : null,
        kiZeile(r.ki_vorschlag),
        botKnoepfe(r.status, "surfen_ein", "surfen_pause", "surfen_aus", d.bot_deckel)])));
  } else out.push(fehlerKarte("Raster-Bot", d.raster_bot));

  const t = ok(d.trend_bot);
  if (t) {
    const ma = ok(t.markt_ampel);
    out.push(karte(F.text(t.name, "Trend-Bot"), statusEtikett(t.status),
      botKurz(t.modus === "echt" ? t.status : "aus", t.topf_eur, t.ergebnis_eur, t.ergebnis_prozent, t.schatten, "trend-wert", sdJe(d, "trend_schatten")),
      h("button", { type: "button", class: "knopf-text seite-link", id: "trend-seite", onclick: () => seiteOeffnen("trend") }, "Trend-Seite ›"),
      mehrTeil("trend", [
        zeilen([
          ["Markt-Ampel", ma ? ampel(ma.gruen ? "gruen" : "rot") : "–"],
          t.modus === "echt" ? ["Topf", F.euro(t.topf_eur)] : ["Modus", "nur Musterdepot"],
          t.modus === "echt" ? ergebnisZeile("Ergebnis", t.ergebnis_eur, t.ergebnis_prozent) : null,
          ["Nächste Umschichtung", F.text(t.naechste_umschichtung)],
        ]),
        zeigtEcht(t.modus === "echt" ? t.status : "aus", t.topf_eur) ? schattenHinweis(t.schatten, liste(ok(t.schatten) && t.schatten.positionen).join(", "))
          : ok(t.schatten) && liste(t.schatten.positionen).length ? h("p", { class: "klein gedimmt" }, "Musterdepot hält " + liste(t.schatten.positionen).join(", ")) : null,
        straffZeile(t.schatten_straff),
        kiZeile(t.ki_vorschlag),
        botKnoepfe(t.status, "trend_ein", "trend_pause", "trend_aus", d.bot_deckel)])));
  } else out.push(fehlerKarte("Trend-Bot", d.trend_bot));

  // 1.2.13 (Paket E): nur ein AKTIVER KI-Vorschlag erscheint auch hier (sonst steht die Einschätzung auf der Bot-Seite)
  for (const teil of [ok(d.raster_bot), ok(d.trend_bot)]) {
    const vk = teil ? vorschlagKarte(teil.ki_vorschlag, teil, d.bot_deckel, true) : null;
    if (vk) out.push(vk);
  }

  const sk = schattenKarte(d.schattendepots);                       // 1.2.17: alle Musterdepots, automatisch verglichen
  if (sk) out.push(sk);

  // 1.2.12: Aktien & ETFs unter dem Krypto-Teil, direkt vor „Letzte Alarme“ – langfristiges Geld, am wenigsten angeschaut (Nutzer 14.10.2026)
  const ak = ok(d.aktien);
  if (ak) {
    out.push(aktienKarte(d, ak, false, sg));
  } else out.push(fehlerKarte("Aktien-Autopilot", d.aktien));

  out.push(alarmKarte(d));
  return out;
}

/** Aktien-Karte: Übersicht (offen=false: Details im „mehr“) und Reiter „Aktien“ (1.4, offen=true: alles offen, dazu die Positionen). */
function aktienKarte(d, ak, offen, sg) {
  const sgAk = sg ? liste(sg.teile).find((x) => istObj(x) && x.k === "aktien") : null;   // 1.4.1: Spielgeld statt 0 €
  const akKi = ok(ak.ki);
  const details = [
    zeilen([
      ["Modus", ak.modus === "etf" ? "ETF" : ak.modus === "aktiv" ? "aktiv" : F.text(ak.modus)],
      ["Status", F.text(ak.status)],
      F.istZahl(ak.reserve_eur) && ak.reserve_eur > 0 ? ["Reserve", F.euro(ak.reserve_eur)] : null,
      ["Stand", F.zeit(ak.wert_zeit)],
      // 1.3.1: letzte Einschätzung der Aktien-KI (nur bei Autopilot „KI“ wirksam – aktiv)
      akKi ? ["KI-Autopilot", (akKi.aktiv ? "" : "ruht · ") + F.text(AKTIEN_KI_TEXT[akKi.entscheidung], akKi.entscheidung)
        + (F.istZahl(akKi.zuversicht) ? " · " + akKi.zuversicht + " % sicher" : "") + " (" + F.zeit(akKi.zeit) + ")"] : null,
      akKi ? ["KI-Ziel", aktienKiZiel(akKi.ziel)] : null,
    ]),
    akKi ? erklaert("KI einfach erklärt", akKi.einfach_erklaert) : null,
    // 1.2.24: Zeile und Knopf „Gewinnschutz“ entfielen mit dem Gewinnschutz Aktien/ETF (Cloud, 17.10.2026); die Absicherung
    // des Welt-ETF steht in der Lage darunter
    // 1.3: derselbe Wahlschalter wie beim Coin-Bot (ältere Cloud: die bisherigen Knöpfe)
    autopilotWahl(d, "autopilot-aktien") || reihe(ak.an ? A.knopf("aktien_stopp", "Autopilot aus") : A.knopf("aktien_start", "Autopilot ein")),
    // 1.3.9: die Lage im selben „mehr“ statt als eigene eingeklappte Karte darunter (ein Aufklappen je Rubrik)
    lageListe(ak.lage, "Lage"),
  ];
  const pos = liste(ak.positionen);
  return karte(F.text(ak.name, "Aktien-Autopilot"), statusEtikett(ak.an ? "an" : "aus"),
    h("div", { class: "mittel", id: offen ? "aktien-wert-seite" : "aktien-wert" }, F.euro(sgAk ? sgAk.wert_eur : ak.wert_eur)),
    sgAk ? h("p", { class: "klapp-kurz" }, "Spielgeld · " + F.text(sgAk.name)) : null,
    F.istZahl(ak.reserve_eur) && ak.reserve_eur > 0 ? h("p", { class: "klapp-kurz" }, "dazu Reserve " + F.euro(ak.reserve_eur)) : null,
    offen ? [details, pos.length ? zeilen(pos.map((p) => [F.text(p.name, p.symbol), F.euro(p.wert_eur)])) : leer("Keine Aktien oder ETFs im Depot.")]
      : mehrTeil("aktien", details));
}

/** 1.4 (Tom 23.10.2026, Teil 3): eigener Reiter „Aktien“ – die Aktien-Karte offen, darunter die Aktien-Musterdepots */
export function aktien(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const ak = ok(d.aktien);
  if (!ak) return [fehlerKarte("Aktien-Autopilot", d.aktien)];
  return [aktienKarte(d, ak, true, spielgeldModus(d)), schattenKarte(d.schattendepots, "Aktien-Teil")];
}

/** 1.4 (Teil 3): die Trend-Seite hat keinen Reiter mehr – ein Tipp auf die Trend-Karte öffnet sie, „‹ Übersicht“ führt zurück */
function seiteOeffnen(r) {
  document.dispatchEvent(new CustomEvent("fh-reiter", { detail: r }));
}

/**
 * 1.2.17: Karte „Musterdepots“ (handy.json schattendepots, Cloud: schattendepots.py) – jedes laufende Musterdepot (nur
 * Rechengeld) als aufklappbarer Punkt; das Urteil der automatischen Auswertung steht schon in der Kopfzeile. Fehlt der Teil: nichts.
 */
const SD_KLASSE = { klar_vorne: "sd-klar-vorne", klar_hinten: "sd-klar-hinten", vorne: "sd-vorne", hinten: "sd-hinten" };
const sdOffen = new Set();                                         // aufgeklappte Depots überleben das Neuzeichnen
const sdTag = (iso) => {
  const d = F.datum(iso);
  return d ? d.toLocaleDateString("de-AT", { timeZone: "Europe/Vienna", day: "numeric", month: "numeric" }) : "–";
};
// 1.4 (Tom 23.10.2026, Teil 2): Musterdepots in Gruppen und Toms Reihenfolge; je Paar „Referenz“ vs. „getestet“ (der Vorsprung gilt
// für das zweite). Unbekannte Kennungen (neue Versuche der Cloud) stehen unter „Weitere“.
const SD_GRUPPEN = [
  ["Coin-Teil", [["raster_schatten", "„Bitcoin halten“ vs. „Raster“"], ["trend_schatten", "„Bitcoin halten“ vs. „Trend“"],
    ["gewinner_schatten", "„Bitcoin halten“ vs. „Tagesgewinner“"], ["trend_gegen_raster", "„Raster“ vs. „Trend“"],
    ["gewinner_gegen_raster", "„Raster“ vs. „Tagesgewinner“"], ["gewinner_gegen_trend", "„Trend“ vs. „Tagesgewinner“"]]],
  ["Coin-Bot", [["ki_schatten", "„Bitcoin halten“ vs. „KI“"], ["ki_gegen_regeln", "„Regeln“ vs. „KI“"],
    ["coin_leiter", "„Bitcoin halten“ vs. „Regeln“"], ["coin_einfach", "„Regeln“ vs. „Rückkauf einfach“"],
    ["coin_alt_neu", "„Regeln alt“ vs. „Regeln neu“"], ["trend_straff", "„Trend“ vs. „Trend straff“"],
    ["swing_schatten", "„Bitcoin halten“ vs. „Swing-Trading (RSI)“"], ["sparplan_schatten", "„Einmalanlage“ vs. „Sparplan“"]]],
  ["Aktien-Teil", [["etf_faber", "Welt-ETF: „Faber 12“ gegen „Halten“"], ["aktien_rotation", "Momentum-Rotation"]]],
];
const SD_NAME = new Map(SD_GRUPPEN.flatMap(([, l]) => l));
function sdGruppen(eintraege, nur) {
  const nachKennung = new Map(eintraege.map((e) => [F.text(e.kennung, ""), e]));
  const out = [];
  for (const [titel, l] of SD_GRUPPEN) {
    if (nur && titel !== nur) continue;
    const da = l.map(([k]) => nachKennung.get(k)).filter(Boolean);
    if (da.length) out.push([titel, da]);
  }
  const rest = nur ? [] : eintraege.filter((e) => !SD_NAME.has(F.text(e.kennung, "")));
  if (rest.length) out.push(["Weitere", rest]);
  return out;
}

function schattenKarte(sd, nur) {
  if (fehlerVon(sd)) return fehlerKarte("Musterdepots", sd);
  const s = ok(sd);
  if (!s || !Array.isArray(s.liste)) return null;
  const gruppen = sdGruppen(s.liste.filter(istObj), nur);
  const eintraege = gruppen.flatMap(([, l]) => l);
  if (nur && !eintraege.length) return null;
  const klar = eintraege.filter((e) => ["klar_vorne", "klar_hinten"].includes((ok(e.auswertung) || {}).urteil)).length;
  const urteile = new Map();                                       // 1.2.19: Kurzzeile „6 laufen · 4 zu früh, 2 gleichauf“
  for (const e of eintraege) {
    const u = F.text((ok(e.auswertung) || {}).urteil_text, "ohne Urteil");
    urteile.set(u, (urteile.get(u) || 0) + 1);
  }
  return karte("Musterdepots", klar ? etikett(klar + " mit klarem Urteil", "sd-klar-vorne") : null,
    h("p", { class: "klapp-kurz", id: "sd-kurz" }, eintraege.length
      ? eintraege.length + (eintraege.length === 1 ? " läuft" : " laufen") + " · " + [...urteile].map(([u, n]) => n + " " + u).join(", ")
      : "Gerade läuft kein Musterdepot."),
    mehrTeil("schattendepots", eintraege.length ? [
    h("p", { class: "klein gedimmt" }, "Nur Rechengeld, keine Orders. Die Cloud vergleicht jedes Depot laufend mit seiner Referenz und meldet "
      + "sich per Push, sobald eines klar vorne oder klar hinten liegt."),
    gruppen.map(([titel, l]) => [h("h3", { class: "sd-gruppe" }, titel), l.map((e) => {
      const a = ok(e.auswertung) || {};
      const ref = ok(e.referenz) || {};
      const weitere = liste(e.weitere).filter(istObj).map((w) => F.text(w.name) + " " + F.euro(w.wert_eur)).join(" · ");
      const kennung = F.text(e.kennung, "");
      return h("details", { class: "sd-eintrag", "data-sd": kennung, open: sdOffen.has(kennung) || null,
        ontoggle: (ev) => { if (ev.target.open) sdOffen.add(kennung); else sdOffen.delete(kennung); } },
        h("summary", null, SD_NAME.has(kennung) ? null : [h("span", { class: "klein gedimmt" }, F.text(e.bot, "")), " "],
          h("b", null, SD_NAME.get(kennung) || F.text(e.name)), " ",
          etikett(F.text(a.urteil_text), SD_KLASSE[a.urteil] || ""),
          F.istZahl(a.vorsprung_prozent) ? h("span", { class: "klein" }, " " + F.prozent(a.vorsprung_prozent, 1)) : null),
        h("div", { class: "sd-inhalt klein" },
          e.testet ? h("p", null, F.text(e.testet)) : null,
          istObj(e.je_1000) && F.istZahl(e.je_1000.wert)
            ? h("p", null, h("b", null, F.euro(e.je_1000.wert)), " gegen " + F.text(ref.name, "Referenz") + " " + F.euro(e.je_1000.referenz)
              + " (je 1.000 € ab Vergleichsstart)" + (e.status ? " · " + F.text(e.status) : ""))
            : h("p", null, h("b", null, F.euro(e.wert_eur)), " gegen " + F.text(ref.name, "Referenz") + " " + F.euro(ref.wert_eur)
            + (weitere ? " · " + weitere : "") + (e.status ? " · " + F.text(e.status) : "")),
          a.text ? h("p", null, F.text(a.text)) : null,
          h("p", { class: "gedimmt" }, "läuft seit " + sdTag(e.seit) + " · Vergleich seit " + (a.seit ? sdTag(a.seit) : "jetzt")
            + (e.stand ? " · Stand " + F.zeit(e.stand) : ""))));
    })]),
    s.regel ? h("p", { class: "klein gedimmt" }, F.text(s.regel)) : null] : null, "mehr – alle Depots"));
}

/** „Letzte Alarme“ (1.2.0): je Alarm „✕“, oben „Alle löschen“ – sofort ausgeblendet, Auftrag alarme_gelesen (js/alarme.js) */
const ALARME_KURZ = 3;
function alarmKarte(d) {
  const roh = liste(d.alarme);
  const darf = AL.moeglich(roh);
  const al = AL.sichtbar(roh, false);
  const alle = darf && al.some((x) => Number.isInteger(x.id))
    ? h("button", { type: "button", class: "knopf-text", id: "alarme-alle", onclick: () => AL.ausblenden(al.map((x) => x.id)) }, "Alle löschen")
    : null;
  const eintrag = (x) => h("li", { class: "alarm " + F.text(x.stufe, ""), "data-alarm": Number.isInteger(x.id) ? String(x.id) : null },
    h("div", { class: "oben" }, h("span", { class: "titel" }, F.text(x.titel)),
      h("span", { class: "alarm-rechts" }, h("span", { class: "klein gedimmt" }, F.zeit(x.zeit)),
        darf && Number.isInteger(x.id) ? h("button", { type: "button", class: "alarm-weg", "aria-label": "Hinweis löschen", "data-weg": String(x.id),
          onclick: () => AL.ausblenden([x.id]) }, "✕") : null)),
    x.text ? h("div", { class: "unter" }, x.text) : null);
  const rest = al.slice(ALARME_KURZ);                               // 1.2.19: die neuesten drei, der Rest im „mehr“
  // 1.3.14 (Tom 23.10.2026): „Wichtige Hinweise“ statt „Letzte Alarme“ (Inhalt unverändert: die Alarme der Cloud)
  return h("section", { class: "karte", id: "alarm-karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Wichtige Hinweise"), alle),
    al.length ? [h("ul", { class: "liste" }, al.slice(0, ALARME_KURZ).map(eintrag)),
      rest.length ? mehrTeil("alarme", h("ul", { class: "liste" }, rest.map(eintrag)), "mehr (" + rest.length + " weitere)") : null]
      : leer(fehlerVon(d.alarme) || (roh.length ? "Alle Hinweise gelöscht." : "Keine wichtigen Hinweise.")),
    AL.wartet() ? h("p", { class: "klein gedimmt" }, "Ausgeblendet – wird an die Cloud geschickt, sobald der laufende Auftrag fertig ist.") : null);
}

/** Karte „An die KI“ (1.2.0, ersetzt „Hinweis an die KI“): öffnet das Eingabe-Blatt; darunter (1.2.2) die Liste „Gemerkte
 *  Hinweise“ mit je „✕“ – nur, wenn handy.json aktive Hinweise nennt (kein allgemeiner Knopf „Hinweis löschen“ mehr) */
function kiKarte(text, d) {
  if (!A.erlaubt("frage") && !A.erlaubt("hinweis_loeschen")) return null;
  return karte("An die KI", null,
    h("p", { class: "klein gedimmt" }, text),
    reihe(A.erlaubt("frage") ? h("button", { type: "button", class: "knopf primaer", "data-ki-oeffnen": "1", onclick: () => K.oeffnen() }, "💬 Frage an die KI") : null),
    K.hinweisListe(d));
}

// ------------------------------------------------------------------ Coin-Bot (Reiter „kern“ – interner Name bleibt)

export function kern(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const k = ok(d.kern_bot);
  if (!k) return [fehlerKarte("Coin-Bot", d.kern_bot)];
  const out = [];
  const lageK = lageKarte(k.lage);
  if (lageK) out.push(lageK);
  out.push(karte(F.text(k.name, "Coin-Bot"), statusEtikett(k.an || k.regelwerk_an ? "an" : "aus"),
    h("div", { class: "mittel" }, F.euro(k.wert_eur)),
    h("p", { class: "klein gedimmt" }, F.text(k.topf_name, "Coin-Topf") + " · Stand " + F.zeit(k.wert_zeit)),
    zeilen([
      ["Hält", k.geparkt ? "geparkt in EURCV" : F.text(k.position)],
      ["Stufe", F.text(k.stufe)],
      ["Stufe automatisch", anAus(k.stufe_automatik)],
      k.stufe_geaendert ? ["Stufe zuletzt geändert", F.zeit(k.stufe_geaendert) + (k.stufe_quelle ? " (" + k.stufe_quelle + ")" : "")] : null,
      ["Regelwerk ohne KI", anAus(k.regelwerk_an)],
      ["Euro-Automatik", anAus(k.euro_automatik)],
    ]),
    // 1.3: Wahlschalter „KI · Regeln · Aus“ statt „Coin-Bot ein/aus“ (ältere Cloud ohne die Befehle: die bisherigen Knöpfe)
    autopilotWahl(d, "autopilot-kern") || reihe(k.an ? A.knopf("stopp", "Coin-Bot aus", "gefahr-rand") : A.knopf("start", "Coin-Bot ein", "primaer")),
    reihe(A.knopf("einstellung", "Stufe ändern", "", { stufe: k.stufe, auto: !!k.stufe_automatik })),
    k.stufe !== "sicher" || k.stufe_automatik
      ? reihe(A.knopf("einstellung", "Bremsen: Stufe → sicher", "gefahr-rand stufe-sicher", { stufe: "sicher", auto: false })) : null,
    reihe(k.euro_automatik ? A.knopf("euro_aus", "Euro-Automatik aus") : A.knopf("euro_ein", "Euro-Automatik ein"),
      k.regelwerk_an === false && !A.erlaubt("autopilot_regeln") ? A.knopf("regelwerk_ein", "Regelwerk ein") : null),
  ));

  const nb = ok(k.notbremse);
  if (nb) {
    out.push(karte("Notbremse", null,
      h("p", { class: "klein gedimmt" }, "Grenzen der Stufe „" + F.text(k.stufe) + "“: fällt der Coin-Topf so stark, parkt der Coin-Bot in EURCV."),
      zeilen([
        ["an einem Tag", F.prozent(nb.tag_prozent, 0)],
        ["in einer Woche", F.prozent(nb.woche_prozent, 0)],
        ["in einem Monat", F.prozent(nb.monat_prozent, 0)],
        ["Zuletzt geparkt", nb.letztes_parken ? F.zeit(nb.letztes_parken) + (nb.letztes_parken_grund ? " (" + nb.letztes_parken_grund + ")" : "") : "noch nie"],
        nb.rueckkauf_fruehestens ? ["Rückkauf frühestens", F.zeit(nb.rueckkauf_fruehestens)] : null,
      ])));
  } else out.push(fehlerKarte("Notbremse", k.notbremse));

  const gs = ok(k.gewinnschutz);
  if (gs) {
    const kinder = [];
    if (gs.aktiv && F.istZahl(gs.prozent) && F.istZahl(gs.abstand_prozent)) {
      const luft = gs.prozent + gs.abstand_prozent; // abstand ist negativ (Kurs unter Höchststand)
      const anteil = Math.max(0, Math.min(1, luft / gs.prozent));
      kinder.push(h("p", { id: "gs-luft" }, "Noch ", h("b", null, F.zahl(Math.max(0, luft), 1) + " Prozentpunkte"), " Luft bis zum Parken."));
      const balken = h("div", { class: "balken " + (anteil > 0.5 ? "" : anteil > 0.2 ? "gelb" : "rot") }, h("div"));
      balken.firstChild.style.width = Math.round(anteil * 100) + "%"; // CSSOM ist mit der CSP erlaubt
      kinder.push(balken);
    }
    kinder.push(zeilen([
      ["Grenze der Stufe", F.istZahl(gs.prozent) ? "−" + F.zahl(gs.prozent, 0) + " % vom Höchststand" : "–"],
      ["Schützt gerade", gs.aktiv ? F.text(gs.coin) : "nichts"],
      gs.aktiv ? ["Höchststand", F.euro(gs.hoechststand_eur) + " (" + F.zeit(gs.hoechststand_zeit) + ")"] : null,
      gs.aktiv ? ["Kurs zuletzt", F.euro(gs.kurs_eur) + " (" + F.zeit(gs.kurs_zeit) + ")"] : null,
      gs.aktiv ? ["Abstand zum Höchststand", F.prozent(gs.abstand_prozent), F.vorzeichenKlasse(gs.abstand_prozent)] : null,
      gs.aktiv ? ["Parkt unter", F.euro(gs.grenze_eur)] : null,
      // 1.2.21: „ausgeloest“ = wirklich ausgelöst; „wuerde_ausloesen“ (neu) = Schalter AUS, sonst würde er parken. Ältere
      // handy.json ohne das Feld meldeten beides als „ausgeloest“ – dort bleibt es bei „Ausgelöst: ja“.
      gs.ausgeloest === true && gs.wuerde_ausloesen !== true ? ["Ausgelöst", "ja"]
        : gs.wuerde_ausloesen === true ? ["Grenze erreicht", "Würde parken (Schalter aus)"] : null,
    ]));
    kinder.push(reihe(gs.an ? A.knopf("gewinnschutz_aus", "Gewinnschutz aus") : A.knopf("gewinnschutz_ein", "Gewinnschutz ein")));
    out.push(karte("Gewinnschutz", statusEtikett(gs.an ? "an" : "aus"), ...kinder));
  } else out.push(fehlerKarte("Gewinnschutz", k.gewinnschutz));

  const ki = ok(k.ki);
  out.push(karte("KI-Urteil", ki ? h("span", { class: "klein gedimmt" }, F.zeit(ki.zeit)) : null,
    ki ? zeilen([
      ["Entscheidung", entscheidungText(ki.entscheidung)],
      ["Zuversicht", F.istZahl(ki.zuversicht) ? ki.zuversicht + " %" : "–"],
      ["Empfohlene Stufe", F.text(ki.stufe_empfehlung)],
      ["Ergebnis", F.text(ki.status)],
    ]) : leer("Noch kein KI-Urteil."),
    ki ? erklaert("Einfach erklärt", ki.einfach_erklaert) : null,
    ki && ki.lage ? erklaert("Lage", ki.lage) : null,
    reihe(A.knopf("einschaetzung", "Frische Einschätzung"), A.knopf("bericht_jetzt", "Bericht jetzt")),
    h("p", { class: "klein gedimmt" }, "Beides kommt per Mail, es wird dabei nie gehandelt."),
  ));

  out.push(karte("Selbst tauschen", null,
    h("p", { class: "klein gedimmt" }, "Steuerneutraler Tausch Krypto gegen Krypto direkt bei Bitpanda (Anmeldung dort nötig)."),
    reihe(bitpandaKnopf("Tauschen bei Bitpanda", BITPANDA_SWAP_URL, "primaer"), bitpandaKnopf("Zu Bitpanda")), bitpandaHinweis()));

  out.push(karte("Statistik", null, h("p", { class: "klein gedimmt" }, "Coin-Topf gegen „Bitcoin halten“ in Prozent seit Beginn des Zeitraums – Ein- und Auszahlungen herausgerechnet."), ...coinStatistik(Z)));

  const b = ok(d.bilanz);
  if (b) {
    out.push(karte(F.text(b.name, "Coin-Bot gegen „Bitcoin halten“ seit Start"), null,
      zeilen([
        ["Coin-Bot", F.euro(b.kern_bot_eur)],
        ["Bitcoin halten", F.euro(b.halten_eur)],
        ["seit Start", F.prozent(b.seit_start_prozent), F.vorzeichenKlasse(b.seit_start_prozent)],
        ["letzte 30 Tage", F.istZahl(b.letzte_30_tage_pp) ? F.zahl(b.letzte_30_tage_pp, 2).replace(/^-/, "−") + " Prozentpunkte" : "–", F.vorzeichenKlasse(b.letzte_30_tage_pp)],
        ["Tage seit Start", F.zahl(b.tage_seit_start, 0)],
      ])));
  }
  out.push(kiKarte("Frag die KI zu deinem Stand – oder sag ihr etwas, das der Bot wissen soll (z. B. ein Termin): sie merkt es sich dann als Hinweis. Sie erklärt nur und löst nie selbst eine Order aus.", d));
  return out;
}

// ------------------------------------------------------------------ Raster-Bot

export function raster(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const r = ok(d.raster_bot);
  if (!r) return [fehlerKarte("Raster-Bot", d.raster_bot)];
  const out = [];
  const uR = unklarKarte(r.unklare_auftraege, "raster");          // 1.2.18 (M2e): ganz oben, solange etwas offen ist
  if (uR) out.push(uR);
  const lageR = lageKarte(r.lage);
  if (lageR) out.push(lageR);
  const vR = vorschlagKarte(r.ki_vorschlag, r, d.bot_deckel);
  if (vR) out.push(vR);
  const st = r.status;
  out.push(karte(F.text(r.name, "Raster-Bot"), statusEtikett(st),
    h("div", { class: "mittel" }, F.euro(r.topf_eur)),
    r.kurse_fehlen ? h("p", { class: "fehlerteil" }, "Kurs fehlt für: " + liste(r.kurse_fehlen).join(", ")) : null,
    zeilen([
      ["Einsatz", F.euro(r.einsatz_eur)],
      ["eingestellter Betrag", F.euro(r.budget_eur)],
      ["freies EURCV", F.euro(r.eurcv)],
      ergebnisZeile("Ergebnis", r.ergebnis_eur, r.ergebnis_prozent),
      ["realisierter Gewinn", F.euroPlus(r.realisiert_eur), F.vorzeichenKlasse(r.realisiert_eur)],
      ["Gebühren", F.euro(r.gebuehren_eur)],
      ["„Bitcoin halten“ seit Start", F.euro(r.bitcoin_halten_eur)],
      ["Start", F.zeit(r.start_zeit)],
      ["heute", (ok(r.heute) ? r.heute.kaeufe + " Käufe, " + r.heute.verkaeufe + " Verkäufe" : "–")],
      r.verlustdeckel_zeit ? ["Verlustdeckel ausgelöst", F.zeit(r.verlustdeckel_zeit)] : null,
      ["letzter Lauf", F.zeit(r.letzter_lauf)],
    ]),
    reihe(st !== "an" ? A.knopf("surfen_ein", st === "pausiert" ? "Wieder einschalten" : "Einschalten", "primaer") : A.knopf("surfen_pause", "Pausieren"),
      st !== "aus" ? A.knopf("surfen_aus", "Ausschalten", "gefahr-rand") : null),
    st !== "aus" ? reihe(A.knopf("surfen_betrag", "Topf ändern"), A.knopf("surfen_zurueck", "Teil zurück")) : null,
    // 1.2.4: direkt zum Trend-Bot (keine Bitcoin-Order) – nur wenn die Cloud den Modus kennt und der Raster-Bot Geld hat
    st !== "aus" ? reihe(A.knopf("bot_umschichten", "Zum Trend-Bot umschichten", "umschichten", { von: "raster" })) : null,
    reihe(A.knopf("surfen_deckel", "Verlustdeckel"), A.knopf("surfen_recherchen", "Recherchen/Tag")),
  ));

  // Ohne echtes Geld steht das Musterdepot gleich unter dem Bot, mit echtem Geld nur noch als eine Referenzzeile ganz unten (Nutzer 11.10.2026)
  const rEcht = st !== "aus" || (F.istZahl(r.topf_eur) && r.topf_eur > 0);
  if (!rEcht) out.push(rasterSchatten(r));
  out.push(karte("Statistik", null, botStatistik(Z, "raster")));
  const coins = liste(r.coins);
  out.push(karte("Coins im Raster", null, coins.length ? h("ul", { class: "liste" }, coins.map((c) => h("li", null,
    h("div", { class: "coin-zeile" }, h("span", { class: "titel" }, F.text(c.coin)), h("span", { class: "zahl" }, F.euro(c.wert_eur)), coinLink(c.coin)),
    h("div", { class: "unter" }, (F.istZahl(c.stufen) ? c.stufen + " Stufen" : "") + (c.sperre ? " · gesperrt" : "") + (c.auslaufend ? " · läuft aus" : ""))))) : leer("Keine Coins.")));
  out.push(listenKarte("Letzte Trades", "raster", "trades", r));
  out.push(listenKarte("Ereignisse", "raster", "ereignisse", r));

  if (rEcht && ok(r.schatten)) out.push(schattenHinweis(r.schatten));
  out.push(...botLinks());
  return out;
}

function rasterSchatten(r) {
  const s = ok(r.schatten);
  return karte("Musterdepot", s ? statusEtikett(s.status) : null,
    h("p", { class: "klein gedimmt" }, "Rechengeld (kein echtes Geld): zeigt, wie sich der Raster-Bot mit 300 € gegen „Bitcoin halten“ schlagen würde."),
    s ? zeilen([
      ["Wert", F.euro(s.wert_eur)],
      ["„Bitcoin halten“", F.euro(s.bitcoin_halten_eur)],
      ["Unterschied", F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.euroPlus(s.wert_eur - s.bitcoin_halten_eur) : "–",
        F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.vorzeichenKlasse(s.wert_eur - s.bitcoin_halten_eur) : ""],
      ["Start", F.euro(s.start_eur) + " am " + F.tag(s.start_zeit)],
      F.istZahl(s.runde) ? ["Runde", String(s.runde)] : null,
      ["Stand", F.zeit(s.zeit)],
    ]) : leer("Kein Musterdepot."));
}

// ------------------------------------------------------------------ Trend-Bot

export function trend(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const t = ok(d.trend_bot);
  if (!t) return [fehlerKarte("Trend-Bot", d.trend_bot)];
  const out = [h("button", { type: "button", class: "knopf-text seite-zurueck", id: "trend-zurueck", onclick: () => seiteOeffnen("uebersicht") }, "‹ Übersicht")];
  const uT = unklarKarte(t.unklare_auftraege, "trend");           // 1.2.18 (M2e): ganz oben, solange etwas offen ist
  if (uT) out.push(uT);
  const lageT = lageKarte(t.lage);
  if (lageT) out.push(lageT);
  const vT = vorschlagKarte(t.ki_vorschlag, t, d.bot_deckel);
  if (vT) out.push(vT);
  const st = t.status;
  const ma = ok(t.markt_ampel);
  out.push(karte("Markt-Ampel", ma ? ampel(ma.gruen ? "gruen" : "rot") : null,
    ma ? h("p", null, ma.gruen ? "Bitcoin liegt über seiner 50-Tage-Linie – der Trend-Bot darf kaufen." : "Bitcoin liegt unter seiner 50-Tage-Linie – der Trend-Bot hält sich zurück.") : leer("Keine Markt-Ampel."),
    ma ? zeilen([["Abstand zur 50-Tage-Linie", F.prozent(ma.abstand_prozent), F.vorzeichenKlasse(ma.abstand_prozent)], ["Tag", F.text(ma.tag)]]) : null));

  out.push(karte(F.text(t.name, "Trend-Bot"), statusEtikett(st),
    t.modus === "echt" ? h("div", { class: "mittel" }, F.euro(t.topf_eur)) : h("p", null, "Läuft gerade nur im Musterdepot (Rechengeld)."),
    zeilen([
      ["Modus", t.modus === "echt" ? "echtes Geld" : "Schatten"],
      t.modus === "echt" ? ["Einsatz", F.euro(t.einsatz_eur)] : null,
      t.modus === "echt" ? ergebnisZeile("Ergebnis", t.ergebnis_eur, t.ergebnis_prozent) : null,
      t.modus === "echt" ? ["„Bitcoin halten“", F.euro(t.bitcoin_halten_eur)] : null,
      ["Nächste Umschichtung", F.text(t.naechste_umschichtung)],
      ["Verlustdeckel", F.istZahl(t.verlustdeckel_prozent) && t.verlustdeckel_prozent > 0 ? "−" + F.zahl(t.verlustdeckel_prozent, 0) + " %" : "keiner"],
      t.verlustdeckel_zeit ? ["Verlustdeckel ausgelöst", F.zeit(t.verlustdeckel_zeit)] : null,
      ["letzter Lauf", F.zeit(t.letzter_lauf)],
    ]),
    reihe(st !== "an" ? A.knopf("trend_ein", st === "pausiert" ? "Wieder einschalten" : "Einschalten", "primaer") : A.knopf("trend_pause", "Pausieren"),
      st !== "aus" ? A.knopf("trend_aus", "Ausschalten", "gefahr-rand") : null),
    st !== "aus" ? reihe(A.knopf("trend_betrag", "Topf ändern"), A.knopf("trend_zurueck", "Teil zurück")) : null,
    // 1.2.4: direkt zum Raster-Bot (keine Bitcoin-Order) – nur wenn die Cloud den Modus kennt und der Trend-Bot Geld hat
    st !== "aus" ? reihe(A.knopf("bot_umschichten", "Zum Raster-Bot umschichten", "umschichten", { von: "trend" })) : null,
    reihe(A.knopf("trend_deckel", "Verlustdeckel")),
  ));

  const tEcht = t.modus === "echt";
  if (!tEcht) out.push(trendSchatten(t));
  const stk = straffKarte(t);                       // 1.2.16: zweites Musterdepot „straff“ direkt darunter
  if (stk) out.push(stk);
  out.push(karte("Statistik", null, botStatistik(Z, "trend")));
  const pos = liste(t.positionen);
  out.push(karte("Positionen", null, pos.length ? h("ul", { class: "liste" }, pos.map((p) => h("li", null,
    h("div", { class: "coin-zeile" }, h("span", { class: "titel" }, F.text(p.coin)), h("span", { class: "zahl" }, F.euro(p.einstand_eur)), coinLink(p.coin)),
    h("div", { class: "unter" }, "Rang " + F.text(p.rang) + " · seit " + F.zeit(p.seit))))) : leer("Keine echten Positionen.")));

  const rl = liste(t.rangliste);
  out.push(karte("Rangliste (14 Tage)", null, rl.length ? h("ul", { class: "liste" }, rl.map((x) => h("li", null,
    h("div", { class: "coin-zeile" }, h("span", { class: "titel" }, F.text(x.rang) + ". " + F.text(x.coin)),
      h("span", { class: "zahl " + F.vorzeichenKlasse(x.r14_prozent) }, F.prozent(x.r14_prozent)), coinLink(x.coin))))) : leer("Keine Rangliste.")));

  out.push(listenKarte("Letzte Trades", "trend", "trades", t));
  out.push(listenKarte("Ereignisse", "trend", "ereignisse", t));
  if (tEcht && ok(t.schatten)) out.push(schattenHinweis(t.schatten, liste(ok(t.schatten) && t.schatten.positionen).join(", ")));
  out.push(...botLinks());
  return out;
}

function trendSchatten(t) {
  const s = ok(t.schatten);
  return karte("Musterdepot", null,
    h("p", { class: "klein gedimmt" }, "Rechengeld (kein echtes Geld) mit denselben Regeln wie der Trend-Bot."),
    s ? zeilen([
      ["Wert", F.euro(s.wert_eur)],
      ["„Bitcoin halten“", F.euro(s.bitcoin_halten_eur)],
      ["Unterschied", F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.euroPlus(s.wert_eur - s.bitcoin_halten_eur) : "–",
        F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.vorzeichenKlasse(s.wert_eur - s.bitcoin_halten_eur) : ""],
      ["hält", liste(s.positionen).join(", ") || "nichts"],
      ["Start", F.euro(s.start_eur) + " am " + F.tag(s.start_zeit)],
      ["Stand", F.zeit(s.zeit)],
    ]) : leer("Kein Musterdepot."));
}

/** 1.2.16: eine Zeile „Neu (straff)“ in der Trend-Karte der Übersicht. */
function straffZeile(st) {
  if (!ok(st) || !st.gestartet || !F.istZahl(st.wert_eur)) return null;
  return h("p", { class: "klein gedimmt" }, "Neues Musterdepot (straff): " + F.euro(st.wert_eur) +
    (F.istZahl(st.bitcoin_halten_eur) ? " gegen „Bitcoin halten“ " + F.euro(st.bitcoin_halten_eur) : "") +
    " · hält " + (liste(st.positionen).map((p) => F.text(p.coin)).join(", ") || "nichts"));
}

/** 1.2.16: zweites Musterdepot „straff“ (trend_straff.py, 16.10.2026) – schnellere Regel als Test mit Rechengeld:
 *  Vergleich mit dem alten Musterdepot und „Bitcoin halten“, Positionen mit Kaufkurs, letzte Trades. Fehlt der Teil: nichts. */
function straffKarte(t) {
  const st = ok(t.schatten_straff);
  if (!st) return null;
  if (!st.gestartet) return karte("Musterdepot neu („straff“)", null, h("p", { class: "klein gedimmt" }, "Startet mit dem nächsten Stundenlauf. Regel: " + F.text(st.regel)));
  const alt = ok(t.schatten);
  const diff = F.istZahl(st.wert_eur) && F.istZahl(st.bitcoin_halten_eur) ? st.wert_eur - st.bitcoin_halten_eur : null;
  const pos = liste(st.positionen);
  const tr = liste(st.trades_letzte).slice(-5).reverse();
  return karte("Musterdepot neu („straff“)", null,
    h("p", { class: "klein gedimmt" }, "Test der schnelleren Regel mit Rechengeld (kein echtes Geld): " + F.text(st.regel) + "."),
    zeilen([
      ["Wert", F.euro(st.wert_eur)],
      ["„Bitcoin halten“", F.euro(st.bitcoin_halten_eur)],
      ["Unterschied", diff === null ? "–" : F.euroPlus(diff), diff === null ? "" : F.vorzeichenKlasse(diff)],
      alt && F.istZahl(alt.wert_eur) ? ["altes Musterdepot", F.euro(alt.wert_eur)] : null,
      ["hält", pos.map((p) => F.text(p.coin)).join(", ") || "nichts (bar)"],
      ["Start", F.euro(st.start_eur) + " am " + F.tag((st.start || {}).zeit)],
      ["Stand", F.zeit(st.letzter_lauf)],
    ]),
    st.hinweis ? h("p", { class: "klein gedimmt" }, F.text(st.hinweis)) : null,
    tr.length ? h("ul", { class: "liste" }, tr.map((x) => h("li", null, h("div", { class: "coin-zeile" },
      h("span", { class: "titel" }, (x.seite === "buy" ? "Kauf " : "Verkauf ") + F.text(x.coin)), h("span", { class: "zahl" }, F.euro(x.betrag))),
      h("div", { class: "unter" }, F.zeit(x.zeit) + (x.seite === "sell" && F.istZahl(x.gv) ? " · " + F.euroPlus(x.gv) + " · " + F.text(x.grund) : ""))))) : null);
}

// ------------------------------------------------------------------ Nachrichten

function schlagzeile(s) {
  if (!istObj(s)) return null;
  const unter = [s.quelle, s.aktie && !(String(s.quelle || "").includes(s.aktie)) ? s.aktie : null, s.zeit ? F.vor(s.zeit) : null].filter(Boolean).join(" · ");
  const inhalt = [h("div", { class: "titel" }, F.text(s.titel)), unter ? h("div", { class: "unter" }, unter) : null];
  return sichereUrl(s.link) ? aussenLink(s.link, { class: "news-link" }, ...inhalt) : h("div", { class: "news-link" }, ...inhalt);
}

// 1.2.6 (Paket C): Einordnung je Meldung + Gesamtbild + Stand der Bots. Nur bekannte Werte (sonst kein Etikett), alle Texte als
// Textknoten. Ältere news.json ohne diese Felder: Anzeige wie bisher.
const RICHTUNG = { stuetzend: ["🟢", "stützend", "gruen"], belastend: ["🔴", "belastend", "rot"], neutral: ["⚪", "neutral", "aus"] };
const STAERKE = { schwach: "schwach", mittel: "mittel", stark: "stark" };
const ZEITRAUM = { kurzfristig: "kurzfristig (Tage)", langfristig: "langfristig (Monate)" };
const OBJEKT = { bitcoin: "Bitcoin", welt_etf: "Welt-ETF", krypto: "Krypto allgemein", aktienmarkt: "Aktienmarkt", einzelaktie: "deine Aktie", allgemein: "allgemein" };
const NEWS_HINWEIS = "Das ist eine Einschätzung, keine sichere Vorhersage. Gehandelt wird nur nach den Regeln der Bots oder nach deinem JA.";
const textOder = (x) => (typeof x === "string" && x.trim() ? x : null);

function richtungEtikett(r, zusatz) {
  const a = RICHTUNG[r];
  return a ? h("span", { class: "etikett " + a[2], "data-richtung": r }, a[0] + " " + a[1] + (zusatz ? " · " + zusatz : "")) : null;
}

function einordnungTeil(e) {
  if (!istObj(e) || !RICHTUNG[e.richtung]) return null;
  const objekt = textOder(e.objekt_name) || OBJEKT[e.objekt] || null;
  const bots = textOder(e.bots);
  return h("div", { class: "news-einordnung" },
    h("div", { class: "etiketten" },
      richtungEtikett(e.richtung),
      STAERKE[e.staerke] ? etikett(STAERKE[e.staerke], "") : null,
      ZEITRAUM[e.zeitraum] ? etikett(ZEITRAUM[e.zeitraum], "") : null,
      objekt ? etikett(objekt, "objekt") : null),
    bots ? h("p", { class: "news-bots" }, h("span", { class: "label" }, "Für deine Bots: "), bots) : null);
}

function gesamtbildKarte(g, lage, extra) {
  const zeilen_ = liste(lage).filter((x) => istObj(x) && textOder(x.text));
  const gb = istObj(g) ? g : null;
  const text = gb && textOder(gb.text), bots = gb && textOder(gb.bots);
  const teile = gb ? [["bitcoin", "Bitcoin"], ["welt_etf", "Welt-ETF"]]
    .filter(([k]) => istObj(gb[k]) && RICHTUNG[gb[k].richtung])
    .map(([k, name]) => richtungEtikett(gb[k].richtung, name + (STAERKE[gb[k].staerke] ? " · " + STAERKE[gb[k].staerke] : ""))) : [];
  const dazu = liste(extra).filter(Boolean);
  if (!text && !bots && !teile.length && !zeilen_.length && !dazu.length) return null;
  // 1.4 (Tom 23.10.2026, Teil 4): oben die kurze Analyse für Krypto und Aktien, im „mehr“ Wirtschaft und Notenbanken (und der Stand der Bots)
  return h("section", { class: "karte", id: "news-gesamtbild" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Gesamtbild")),
    teile.length ? h("div", { class: "etiketten" }, teile) : null,
    text ? h("p", { class: "gesamt-text" }, text) : null,
    bots ? h("p", { class: "gesamt-bots" }, bots) : null,
    mehrTeil("news-gesamtbild", [
      dazu,
      zeilen_.length ? h("div", { class: "bot-lage" }, h("span", { class: "label" }, "Stand deiner Bots"),
        h("ul", { class: "liste" }, zeilen_.map((x) => h("li", null, x.text)))) : null,
      h("p", { class: "klein gedimmt" }, (gb && textOder(gb.hinweis)) || NEWS_HINWEIS)],
      dazu.length ? "mehr – Wirtschaft und Notenbanken" : "mehr – Stand deiner Bots"));
}

/** 1.4 (Teil 4): Karte „Aktien“ der News – neueste Schlagzeile zu deinen Aktien, im „mehr“ die übrigen und die Börsengänge */
function aktienNewsKarte(rub, bg) {
  const s = rub.flatMap((r) => r.s);
  const ki = rub.map((r) => r.ki).find(Boolean);
  const [kurz, lang] = ki ? textTeilen(F.text(ki.text)) : ["", ""];
  return h("section", { class: "karte", id: "news-aktien" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Aktien"), s.length ? h("span", { class: "klein gedimmt" }, s.length + (s.length === 1 ? " Schlagzeile" : " Schlagzeilen")) : null),
    kurz ? h("p", { class: "rubrik-text" }, etikett("KI", ""), " ", kurz) : null,
    s.length ? h("div", null, schlagzeile(s[0])) : (kurz ? null : leer("Keine Schlagzeilen zu deinen Aktien.")),
    mehrTeil("news-aktien", [lang ? h("p", { class: "rubrik-text" }, lang) : null, s.length > 1 ? h("div", null, s.slice(1).map(schlagzeile)) : null, bg],
      "mehr – Börsengänge"));
}

/** 1.2.19: ein KI-Text in [erster Satz, Rest] – kurze Texte (bis 160 Zeichen) bleiben ganz (Rest null) */
function textTeilen(t) {
  const s = String(t || "");
  if (s.length <= 160) return [s, null];
  const m = /^(.{40,}?[.!?])\s+(.+)$/s.exec(s);
  return m ? [m[1], m[2]] : [s, null];
}

// ------------------------------------------------------------------ Börsengänge (1.3.3, Finanz-App boersengaenge.py -> cloud/boersengaenge.json)
// Nutzer 18.10.2026: „welche neuen Aktien anstehen und welche davon bei Bitpanda handelbar sind“ – alle Neuzugänge, nicht nur Anthropic.
// US-Börsengänge aus dem Nasdaq-Kalender (angekündigt + letzte 60 Tage) mit Bitpanda-Abgleich, dazu „Neu bei Bitpanda“ (jedes seit dem
// Vortag neu gelistete Wertpapier, 30 Tage). Firmennamen sind fremde Texte – nur Textknoten. Nur Information, keine Empfehlung.
const BG_KURZ = 3;
const BG_GRUPPE = { equity_stock: "Aktie", equity_etf: "ETF", equity_complex_etf: "ETF (komplex)", equity_complex_etc: "ETC" };

function bgVolumen(v) {
  if (!F.istZahl(v) || v <= 0) return null;
  return v >= 1e9 ? F.zahl(v / 1e9, 1) + " Mrd. $" : F.zahl(v / 1e6, 0) + " Mio. $";
}

function bgEtikett(e) {
  const b = e.bitpanda;
  if (istObj(b) && textOder(b.symbol)) {
    return b.kaufbar === false ? etikett("Bitpanda: gelistet, Kauf gesperrt · " + b.symbol, "gelb") : etikett("Bitpanda: ja · " + b.symbol, "gruen");
  }
  if (b === undefined) return etikett("Bitpanda: nicht geprüft", "");
  return etikett("Bitpanda: noch nicht", "aus");
}

function bgZeile(e) {
  if (!istObj(e) || !textOder(e.name)) return null;
  const unter = [e.datum ? F.datum(e.datum) : null, textOder(e.kuerzel), textOder(e.boerse), textOder(e.preis_usd) ? e.preis_usd + " $" : null, bgVolumen(e.volumen_usd)]
    .filter(Boolean).join(" · ");
  return h("li", null, h("div", { class: "oben" }, h("span", { class: "titel" }, e.name + (e.spac ? " (SPAC)" : "")), bgEtikett(e)),
    unter ? h("div", { class: "unter" }, unter) : null);
}

function bgZugang(e) {
  if (!istObj(e) || !textOder(e.symbol)) return null;
  const unter = [BG_GRUPPE[e.gruppe] || null, e.symbol, textOder(e.isin), e.seit ? "seit " + F.datum(e.seit) : null].filter(Boolean).join(" · ");
  return h("li", null, h("div", { class: "oben" }, h("span", { class: "titel" }, F.text(e.name, e.symbol)),
    e.kaufbar === false ? etikett("Kauf gesperrt", "gelb") : etikett("neu bei Bitpanda", "gruen")), h("div", { class: "unter" }, unter));
}

function bgListe(titel, eintraege, zeile, leerText, schluessel) {
  const l = liste(eintraege).map(zeile).filter(Boolean);
  return [h("h3", null, titel),
    l.length ? h("ul", { class: "liste" }, l.slice(0, BG_KURZ)) : leer(leerText),
    l.length > BG_KURZ ? mehrTeil(schluessel, h("ul", { class: "liste" }, l.slice(BG_KURZ)), "mehr (" + (l.length - BG_KURZ) + " weitere)") : null];
}

/**
 * 1.3.9 (Tom 19.10.2026, V26): „Kürzlich gestartet“ – zuerst die Treffer bei Bitpanda (gelistet, auch „Kauf gesperrt“), die übrigen als
 * EINE aufklappbare Zeile. „nicht bei Bitpanda“ steht nur da, wenn der Abgleich gelaufen ist (bitpanda.geprueft true) und jeder übrige
 * Eintrag geprüft ist (bitpanda null, nicht fehlend) – sonst sagt die Zeile „Bitpanda nicht geprüft“ bzw. nur die Zahl.
 */
function bgGestartet(titel, eintraege, bp) {
  const alle = liste(eintraege).filter((e) => istObj(e) && textOder(e.name));
  const treffer = alle.filter((e) => istObj(e.bitpanda) && textOder(e.bitpanda.symbol));
  const rest = alle.filter((e) => !treffer.includes(e));
  const geprueft = bp.geprueft === true && rest.every((e) => e.bitpanda === null);
  const ungeprueft = bp.geprueft !== true || rest.every((e) => e.bitpanda === undefined);
  const zu = rest.length + " weitere" + (geprueft ? " (nicht bei Bitpanda)" : ungeprueft ? " (Bitpanda nicht geprüft)" : "");
  return [h("h3", null, titel),
    !alle.length ? leer("In diesem Zeitraum keine Börsengänge.") : treffer.length ? h("ul", { class: "liste" }, treffer.map(bgZeile)) : null,
    rest.length ? mehrTeil("bg-gestartet", h("ul", { class: "liste" }, rest.map(bgZeile)), zu) : null];
}

function boersengaengeKarte(d, fehler) {
  const kopf = h("div", { class: "karte-kopf" }, h("h2", null, "Börsengänge"), istObj(d) && d.zeit ? h("span", { class: "klein gedimmt" }, "Stand " + F.zeit(d.zeit)) : null);
  if (!istObj(d)) {
    return h("section", { class: "karte", id: "boersengaenge" }, kopf, h("p", { class: "klein gedimmt" }, fehler || "Börsengänge werden geladen …"));
  }
  const bp = istObj(d.bitpanda) ? d.bitpanda : {};
  const hinweise = [];
  if (textOder(d.fehler)) hinweise.push("Kalender: " + d.fehler);
  if (bp.geprueft === false) hinweise.push("Bitpanda-Abgleich zuletzt nicht möglich" + (textOder(bp.fehler) ? " (" + bp.fehler + ")" : "") + (bp.zeit ? " – Spalte vom " + F.zeit(bp.zeit) : ""));
  if (textOder(d.neuzugang_hinweis)) hinweise.push(d.neuzugang_hinweis);
  // 1.3.9 (V26): die Herkunft hinter „ⓘ“; der Halbsatz „Nur Information, keine Empfehlung“ bleibt sichtbar (Einwand des Prüfers)
  return h("section", { class: "karte", id: "boersengaenge" }, kopf,
    h("details", { class: "info-klapp klein gedimmt", id: "bg-info" }, h("summary", null, "ⓘ Nur Information, keine Empfehlung"),
      h("p", null, "US-Börsengänge aus dem Nasdaq-Kalender, täglich um 18:30 mit Bitpandas Wertpapierliste"
        + (F.istZahl(bp.anzahl) ? " (" + F.zahl(bp.anzahl, 0) + " Einträge)" : "") + " abgeglichen. Taucht einer bei Bitpanda auf, kommt ein Push.")),
    ...bgListe("Angekündigt", d.angekuendigt, bgZeile, "Derzeit keine angekündigten Börsengänge im Kalender.", "bg-angekuendigt"),
    ...bgGestartet("Kürzlich gestartet (letzte " + (F.istZahl(d.neu_tage) ? d.neu_tage : 60) + " Tage)", d.gestartet, bp),
    ...bgListe("Neu bei Bitpanda (letzte " + (F.istZahl(d.neuzugang_tage) ? d.neuzugang_tage : 30) + " Tage)", d.neu_bei_bitpanda, bgZugang,
      "Seit dem letzten Vergleich nichts Neues bei Bitpanda.", "bg-neu"),
    hinweise.length ? h("p", { class: "klein gedimmt" }, hinweise.join(" · ")) : null);
}

export function news(Z) {
  const out = [];
  out.push(reihe(A.knopf("news_jetzt", "News aktualisieren", "primaer")));
  const n = Z.news;
  if (!n) {
    out.push(Z.fehlerNews ? h("p", { class: "fehlerteil" }, Z.fehlerNews) : leer("News werden geladen …"));
    out.push(boersengaengeKarte(Z.boersengaenge, Z.fehlerBoersengaenge));
    return out;
  }
  out.push(h("p", { class: "klein gedimmt" }, "Abgerufen " + F.vor(n.zeit) + " (" + F.zeit(n.zeit) + ", " + (n.anlass === "news_jetzt" ? "von Hand" : "für den Bericht") + "). Neu holen geht höchstens alle 30 Minuten."));
  if (n.fehler) out.push(h("p", { class: "fehlerteil" }, F.text(n.fehler)));
  const z = ok(n.zusammenfassung);
  const meldung = (s) => [schlagzeile(s), istObj(s) ? einordnungTeil(s.einordnung) : null];
  // 1.3.10 (Tom 19.10.2026: „Wirtschaft & Börse und Notenbanken kommen immer zweimal vor“): EINE Karte je Rubrik – oben der KI-Satz
  // (Abzeichen „KI“), darunter die neueste Schlagzeile, der Rest (längerer KI-Text, weitere Schlagzeilen) hinter „mehr“. Zusammengeführt
  // über den Rubrik-Namen (die Kennungen unterscheiden sich: „wirtschaft“ gegen „aktien_wirtschaft“); KI-Rubriken ohne Schlagzeilen hängen an.
  const kiRubriken = z ? liste(z.rubriken).filter((r) => istObj(r) && r.id !== "einordnung") : [];
  const schluessel = (r) => F.text(r.name).trim().toLowerCase();
  const benutzt = new Set();
  const rubrikKarte = (name, id, s, ki) => {
    const [kurz, lang] = ki ? textTeilen(F.text(ki.text)) : ["", ""];
    const rechts = s.length ? h("span", { class: "klein gedimmt" }, s.length + (s.length === 1 ? " Schlagzeile" : " Schlagzeilen")) : (ki ? etikett("KI", "") : null);
    const mehr = [lang ? h("p", { class: "rubrik-text" }, lang) : null, s.length > 1 ? h("div", null, s.slice(1).map(schlagzeile)) : null];
    const zusatz = s.length > 1 ? "mehr (" + (s.length - 1) + " weitere)" : "mehr";
    return karte(F.text(name), rechts,
      kurz ? h("p", { class: "rubrik-text" }, s.length ? etikett("KI", "") : null, s.length ? " " : null, kurz) : null,
      s.length ? h("div", null, schlagzeile(s[0])) : (ki ? null : leer("Keine Schlagzeilen.")),
      mehrTeil("news-" + F.text(id, name), mehr, zusatz));
  };
  // 1.4 (Tom 23.10.2026, Teil 4): kompakt – Gesamtbild (im „mehr“ Wirtschaft und Notenbanken), Krypto im Detail, Aktien im Detail
  // (im „mehr“ die Börsengänge). Rubriken sammeln: Schlagzeilen + KI-Text je Rubrik (zusammengeführt wie bisher über den Namen)
  const rub = [];
  for (const r of liste(n.rubriken)) {
    if (!istObj(r)) continue;
    const ki = kiRubriken.find((k) => schluessel(k) === schluessel(r) || F.text(k.id) === F.text(r.id));
    if (ki) benutzt.add(ki);
    rub.push({ id: F.text(r.id), name: r.name, s: liste(r.schlagzeilen), ki });
  }
  for (const k of kiRubriken) if (!benutzt.has(k)) rub.push({ id: F.text(k.id), name: k.name, s: [], ki: k });
  const art = (r) => (/krypto/i.test(r.id) ? "krypto" : /aktie/i.test(r.id) && !/wirtschaft/i.test(r.id) ? "aktien" : "markt");
  const unterteil = (r) => h("div", { class: "news-unterteil", "data-rubrik": r.id }, h("h3", null, F.text(r.name)),
    r.ki ? h("p", { class: "rubrik-text" }, etikett("KI", ""), " ", F.text(r.ki.text)) : null,
    r.s.length ? h("div", null, r.s.map(schlagzeile)) : null);
  const wichtig = z ? liste(z.wichtigste) : [];
  const einordnung = z ? liste(z.rubriken).filter((r) => istObj(r) && r.id === "einordnung") : [];
  const dasWichtigste = wichtig.length || einordnung.length ? h("div", { class: "news-unterteil", "data-rubrik": "wichtig" }, h("h3", null, "Das Wichtigste"),
    einordnung.map((r) => erklaert(F.text(r.name), r.text)), wichtig.map(meldung)) : null;
  out.push(gesamtbildKarte(z && z.gesamtbild, n.bot_lage, [dasWichtigste, ...rub.filter((r) => art(r) === "markt").map(unterteil)]));
  for (const r of rub.filter((x) => art(x) === "krypto")) out.push(rubrikKarte(r.name, r.id, r.s, r.ki));
  const aktienRub = rub.filter((x) => art(x) === "aktien");
  const bg = boersengaengeKarte(Z.boersengaenge, Z.fehlerBoersengaenge);   // 1.3.3 – seit 1.4 im „mehr“ der Aktien-Karte
  if (bg) { bg.classList.remove("karte"); bg.classList.add("news-unterteil"); }
  out.push(aktienNewsKarte(aktienRub, bg));
  out.push(h("p", { class: "klein gedimmt" }, "Schlagzeilen sind fremde Texte; Links öffnen in einem neuen Fenster."));
  return out;
}

// ------------------------------------------------------------------ Einstellungen

/**
 * 1.2.8: Karte „Face ID“ – nur, wenn ein Plattform-Authenticator (Face ID) für Passkeys da ist oder Face ID schon eingerichtet ist.
 * ctx.faceId: {status: null|"ja"|"ohne_prf"|"nein", eingerichtet, seit, nichtMoeglich} (null im Demo-Modus).
 */
function faceIdKarte(ctx) {
  const f = ctx.faceId;
  if (!f) return null;
  if (!f.eingerichtet && f.status !== "ja" && f.status !== "ohne_prf") return null;
  const teile = [];
  if (f.eingerichtet) {
    teile.push(h("p", { id: "faceid-stand" }, "✓ Face ID ist eingerichtet" + (f.seit ? " (seit " + F.tag(f.seit) + ")" : "")
      + ". Beim Öffnen und nach 5 Minuten im Hintergrund kannst du mit Face ID statt mit der PIN entsperren."));
    teile.push(h("button", { type: "button", class: "knopf voll gefahr-rand", id: "faceid-entfernen", onclick: ctx.onFaceIdEntfernen }, "Face ID entfernen"));
  } else if (f.nichtMoeglich || f.status === "ohne_prf") {
    teile.push(h("p", { id: "faceid-stand" }, "Face ID ist auf diesem Gerät nicht möglich – die PIN bleibt."));
    teile.push(h("p", { class: "klein gedimmt" }, "Dein iPhone liefert für Passkeys keinen Schlüssel (Erweiterung „PRF“, braucht ein neueres iOS). Ohne ihn könnte die App den Token nicht sicher verschlüsseln – eine schwächere Variante gibt es bewusst nicht. Nach einem iOS-Update bietet die App Face ID wieder an."));
    return karte("Face ID", null, ...teile);
  } else {
    teile.push(h("p", { id: "faceid-stand" }, "Entsperre die App mit Face ID statt mit der PIN."));
    teile.push(h("button", { type: "button", class: "knopf voll primaer", id: "faceid-einrichten", onclick: ctx.onFaceIdEinrichten }, "Face ID einrichten"));
  }
  teile.push(h("ul", { class: "liste klein" },
    h("li", null, "Face ID ersetzt nur die PIN-Eingabe. Die PIN bleibt immer als Rückfall; Fehlversuche mit Face ID zählen nicht zu den 5 PIN-Versuchen."),
    h("li", null, "Der Token bleibt verschlüsselt auf diesem iPhone – zusätzlich in einem zweiten Umschlag, den nur dein Passkey nach Face ID öffnet (Passkey-Erweiterung PRF, AES-GCM)."),
    h("li", null, "Dein Gesicht verlässt das iPhone nie: Face ID prüft das iPhone selbst, die App bekommt nur einen Schlüssel vom Passkey."),
    h("li", null, "Der Passkey wird über den iCloud-Schlüsselbund mit deinen Apple-Geräten synchronisiert. Ohne den verschlüsselten Umschlag auf diesem iPhone öffnet er dort nichts."),
    h("li", null, "Erkennt dich Face ID nicht, bietet das iPhone den iPhone-Code an – wer ihn kennt, kommt damit auch in die App.")));
  return karte("Face ID", null, ...teile);
}

/**
 * 1.2.21: Karte „PIN“ – mit „PIN ändern“ (alte PIN, neue PIN 2×). Ist die PIN kürzer als 6 Stellen (Merker im Tresor), steht sie als
 * gut sichtbare Empfehlung „PIN auf 6 Stellen ändern“ ganz oben. ctx.pin: {kurz, faceId} oder null (Demo / kein Tresor).
 */
function pinKarte(ctx) {
  const p = ctx.pin;
  if (!p) return null;
  const knopf = h("button", { type: "button", class: "knopf voll " + (p.kurz ? "primaer" : ""), id: "pin-aendern", onclick: ctx.onPinAendern }, "PIN ändern");
  const ehrlich = "Kopiert jemand den Speicher dieses iPhones (z. B. aus einem unverschlüsselten Backup), sind 4 Stellen in Minuten "
    + "durchprobierbar, 6 Stellen erst in Stunden bis Tagen – die Sperre nach 5 falschen PINs gilt nur in der App. Face ID ist der empfohlene Weg.";
  const faceIdSatz = p.faceId ? "Face ID wird beim Ändern entfernt und muss danach neu eingerichtet werden." : null;
  if (p.kurz) {
    return h("section", { class: "karte empfehlung", id: "pin-empfehlung" },
      h("div", { class: "karte-kopf" }, h("h2", null, "PIN auf 6 Stellen ändern"), etikett("Empfehlung", "gelb")),
      h("p", null, "Deine PIN hat weniger als 6 Ziffern. Sie funktioniert weiter – sicherer ist eine neue PIN mit 6 bis 8 Ziffern."),
      h("p", { class: "klein gedimmt" }, ehrlich),
      faceIdSatz ? h("p", { class: "klein gedimmt" }, faceIdSatz) : null,
      knopf);
  }
  return h("section", { class: "karte", id: "pin-karte" },
    h("div", { class: "karte-kopf" }, h("h2", null, "PIN")),
    h("p", { class: "klein gedimmt" }, "Neue PINs haben 6 bis 8 Ziffern. " + ehrlich),
    faceIdSatz ? h("p", { class: "klein gedimmt" }, faceIdSatz) : null,
    knopf);
}

// 1.4.2 (Tom 29.10.2026, Idee aus dem BTC-ECHO-Anfängerartikel): kleines Lexikon unter „Mehr“ – je Begriff ein Satz, alphabetisch
const LEXIKON = [
  ["200-Tage-Linie", "Durchschnitt der Schlusskurse der letzten 200 Tage – liegt der Kurs darüber, gilt der Trend als aufwärts (bei der 50-Tage-Linie ebenso, nur kurzfristiger)."],
  ["Bärenmarkt / Bullenmarkt", "Bär = der Markt fällt länger (Kurs unter den Durchschnittslinien), Bulle = er steigt länger (Kurs darüber)."],
  ["Bitcoin halten", "Einmal kaufen und liegen lassen – der Maßstab, an dem sich jeder Bot und jedes Musterdepot messen muss."],
  ["Coin-Bot", "Hält den Coin-Topf in Bitcoin oder einem anderen Coin und parkt ihn bei Gefahr in EURCV – mit KI oder nach festen Regeln."],
  ["Einmalanlage / Sparplan", "Alles auf einmal anlegen oder in gleichen Raten verteilt – der Sparplan glättet den Einstiegskurs, die Einmalanlage ist früher voll investiert."],
  ["ETF / Welt-ETF", "Ein Fonds, der einen ganzen Index nachbildet; der Welt-ETF hält Tausende Firmen aus aller Welt auf einmal."],
  ["EURCV / Stablecoin", "Ein Coin, der immer etwa einen Euro wert ist – der „Parkplatz“ der Bots, wenn sie nicht investiert sind."],
  ["Faber 12", "Absicherung des Welt-ETF: liegt der Monatsschluss unter dem Schnitt der letzten 12 Monate, wird die Hälfte in Euro geparkt."],
  ["Gebühr / Spread", "Die Gebühr kassiert die Börse je Order, der Spread ist der Abstand zwischen Kauf- und Verkaufskurs – beides kostet bei jedem Wechsel."],
  ["Gewinnschutz", "Fällt der Kurs um einen festen Anteil unter seinen Höchststand seit dem Kauf, parkt der Coin-Bot und sichert so einen Teil des Gewinns."],
  ["Hebel / Margin", "Handel mit geliehenem Geld – Gewinne und Verluste vervielfachen sich; die App nutzt das bewusst nie."],
  ["Kerzenchart / Doji", "Jede Kerze zeigt Eröffnung, Schluss, Hoch und Tief eines Zeitraums; ein Doji (fast gleicher Eröffnungs- und Schlusskurs) deutet Unentschlossenheit an."],
  ["KESt", "Kapitalertragsteuer in Österreich, 27,5 % auf Kursgewinne – bei Verlust fällt keine an."],
  ["Limit-Order / Market-Order", "Limit = nur zu einem festgelegten Preis oder besser (wird vielleicht nie ausgeführt), Market = sofort zum gerade besten Preis."],
  ["Musterdepot", "Ein Depot nur mit Rechengeld: es handelt nach festen Regeln, ohne echtes Geld, und zeigt, ob eine Idee etwas taugt."],
  ["Notbremse", "Fällt der gehaltene Coin innerhalb kurzer Zeit zu stark, parkt der Coin-Bot sofort in EURCV."],
  ["Raster-Bot", "Kauft in festen Preisstufen nach unten und verkauft jede Stufe mit kleinem Gewinn wieder – lebt von Schwankungen."],
  ["RSI", "Relative-Stärke-Index von 0 bis 100: unter 30 gilt ein Kurs als überverkauft, über 70 als überkauft."],
  ["Stop-Loss", "Ein automatischer Verkauf, sobald der Kurs eine Grenze unterschreitet – begrenzt Verluste, kann bei Kursstürzen aber tiefer ausgeführt werden."],
  ["Swing-Trading / Daytrading", "Swing hält Tage bis Wochen und nutzt Schwankungen im Trend, Daytrading kauft und verkauft am selben Tag – für Anfänger und bei Gebühren selten lohnend."],
  ["Trend-Bot", "Kauft die Coins mit dem stärksten Lauf der letzten zwei Wochen, solange die Markt-Ampel grün ist, und steigt bei Schwäche aus."],
  ["Volatilität", "Wie stark ein Kurs schwankt – Krypto schwankt deutlich mehr als Aktien, in beide Richtungen."],
];
function lexikonKarte() {
  return h("section", { class: "karte", id: "lexikon" }, h("div", { class: "karte-kopf" }, h("h2", null, "Lexikon")),
    h("p", { class: "klapp-kurz" }, LEXIKON.length + " Begriffe, je in einem Satz"),
    mehrTeil("lexikon", h("dl", { class: "lexikon" }, LEXIKON.map(([b_, t]) => [h("dt", null, b_), h("dd", null, t)])), "Begriffe zeigen"));
}

export function mehr(Z, ctx) {
  const out = [];
  const d = Z.handy || {};
  const pinTeil = pinKarte(ctx);
  if (pinTeil && ctx.pin.kurz) out.push(pinTeil);          // Empfehlung ganz oben, gut sichtbar
  // 1.3.14 (Tom 23.10.2026): „Zu Bitpanda“ und „Einzahlen“ aus der Übersicht hierher
  out.push(h("section", { class: "karte", id: "bitpanda-karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Bitpanda")),
    reihe(bitpandaKnopf("Zu Bitpanda", BITPANDA_URL, "primaer"), bitpandaKnopf("Einzahlen", BITPANDA_EINZAHLEN_URL)), bitpandaHinweis()));
  out.push(lexikonKarte());                                 // 1.4.2: kleines Lexikon
  const pushTeil = ok(d.push) || {};
  const abos = liste(pushTeil.abos);

  // Push
  const pk = [];
  // 1.3.11 (20.10.2026, Push-Ausfall-Alarm der Cloud): push.ausfall = {folge, grund, seit, letzter} ab 3 Sendeversuchen ohne
  // Zustellung – EIN Satz, nur als Text; die Cloud hat dann schon gemailt und meldet „Mitteilungen gehen wieder“ von selbst
  const ausfall = pushTeil.ausfall && typeof pushTeil.ausfall === "object" ? pushTeil.ausfall : null;
  if (ausfall && Number(ausfall.folge) >= 1) {
    pk.push(h("p", { class: "fehlerteil", "data-push-ausfall": String(ausfall.folge) },
      "Mitteilungen kommen seit " + F.zeit(ausfall.seit) + " nicht an (" + Number(ausfall.folge) + " Versuche"
      + (ausfall.grund ? ": " + String(ausfall.grund) : "") + ") – die Cloud hat dir eine Mail geschickt; die Bots laufen weiter."));
  }
  if (!P.alsHomeApp()) {
    pk.push(h("p", null, "Erst zum Home-Bildschirm hinzufügen: in Safari unten auf Teilen (□↑) → „Zum Home-Bildschirm“, dann die App von dort öffnen. Nur so erlaubt das iPhone Mitteilungen."));
  } else if (!P.unterstuetzt()) {
    pk.push(h("p", null, "Dieses Gerät unterstützt keine Web-Mitteilungen (nötig: iOS 16.4 oder neuer)."));
  } else if (!P.schluesselDa()) {
    pk.push(h("button", { type: "button", class: "knopf voll", disabled: true }, "Push wird noch eingerichtet"));
  } else {
    if (pushTeil.vapid_eingerichtet === false) pk.push(h("p", { class: "fehlerteil" }, "In der Cloud fehlt noch der private Push-Schlüssel – Mitteilungen kommen erst, wenn er eingerichtet ist."));
    const meins = ctx.pushHash ? abos.find((a) => a.hash === ctx.pushHash) : null;
    if (meins) {
      pk.push(h("p", null, "✓ Dieses iPhone ist angemeldet (seit " + F.tag(meins.seit) + ")."));
      pk.push(h("button", { type: "button", class: "knopf voll gefahr-rand", id: "push-aus", onclick: ctx.onPushAus }, "Push abbestellen"));
    } else if (ctx.pushHash) {
      pk.push(h("p", null, "Am iPhone ist ein Abo da, in der Cloud ist es (noch) nicht angekommen."));
      pk.push(h("button", { type: "button", class: "knopf voll primaer", id: "push-an", onclick: ctx.onPushAn }, "Erneut anmelden"));
      pk.push(h("button", { type: "button", class: "knopf voll gefahr-rand", id: "push-aus", onclick: ctx.onPushAus }, "Push abbestellen"));
    } else {
      pk.push(h("button", { type: "button", class: "knopf voll primaer", id: "push-an", onclick: ctx.onPushAn }, "Benachrichtigungen erlauben"));
    }
    if (P.erlaubnis() === "denied") pk.push(h("p", { class: "klein gedimmt" }, "Mitteilungen sind abgelehnt – erlauben in den iPhone-Einstellungen → Mitteilungen → Finanzen."));
  }
  pk.push(h("p", { class: "klein gedimmt" }, "Du bekommst eine Mitteilung, wenn der Coin-Bot parkt oder zurückkauft, die Stufe wechselt, ein Bot geschaltet wird oder handelt, ein Verlustdeckel greift, die KI deine Frage beantwortet hat (ohne den Text), und einmal täglich ein Lebenszeichen. In der Cloud angemeldet: " + abos.length + " Gerät(e)."));
  out.push(karte("Benachrichtigungen", null, ...pk));

  out.push(kiKarte("Fragen an die KI und Hinweise für den Bot – auch über den Knopf 💬 unten rechts. Die KI löst nie selbst eine Order aus.", d));
  out.push(faceIdKarte(ctx));
  if (pinTeil && !ctx.pin.kurz) out.push(pinTeil);

  const lauf = ok(d.lauf);
  out.push(karte("Verbindung", null,
    zeilen([
      ["Modus", ctx.demo ? "Demo (Beispiel-Daten)" : "verbunden mit Athokawe/finanzen"],
      ["Finanz-App", F.text(d.version)],
      ["Daten-Stand", d.stand ? F.zeit(d.stand) + " (" + F.vor(d.stand) + ")" : "–"],
      lauf ? ["Letzter Cloud-Lauf", F.text(lauf.modus) + " · " + (lauf.ausloeser === "dispatch" ? "von Hand" : lauf.ausloeser === "wecker" ? "Wecker" : lauf.ausloeser === "schedule" ? "Zeitplan" : F.text(lauf.ausloeser)) + " · " + (lauf.ergebnis === "success" ? "ok" : F.text(lauf.ergebnis))] : null,
      ok(d.freiminuten) ? ["Sparmodus (Freiminuten)", anAus(d.freiminuten.sparmodus)] : null,
      ["Handy-App", ctx.appVersion],
    ]),
    ctx.demo
      ? reihe(h("a", { class: "knopf", href: "./" }, "Demo beenden"))
      : reihe(h("button", { type: "button", class: "knopf", id: "knopf-sperren", onclick: ctx.onSperren }, "Jetzt sperren"),
        h("button", { type: "button", class: "knopf gefahr-rand", id: "knopf-abmelden", onclick: ctx.onAbmelden }, "Abmelden")),
    ctx.demo ? null : h("p", { class: "klein gedimmt" }, "„Abmelden“ löscht den verschlüsselten Token und die PIN (und Face ID) von diesem iPhone. Den Token selbst kannst du auf github.com → Settings → Developer settings → Fine-grained tokens jederzeit widerrufen.")));

  out.push(karte("Sicherheit", null,
    h("ul", { class: "liste" },
      h("li", null, "Der Token liegt nur auf diesem iPhone, mit deiner PIN verschlüsselt (AES-GCM, PBKDF2; neue PINs 6 bis 8 Ziffern, 600 000 Runden)."),
      h("li", null, "Ehrlich: Kopiert jemand den App-Speicher, sind 4 Stellen in Minuten durchprobierbar, 6 Stellen in Stunden bis Tagen. Face ID ist der empfohlene Weg."),
      h("li", null, "Optional Face ID: ein zweiter verschlüsselter Umschlag, den nur dein Passkey öffnet – ohne Passkey-Erweiterung PRF gibt es kein Face ID."),
      h("li", null, "Er darf nur Athokawe/finanzen lesen und Cloud-Aufträge starten, keine anderen Repos. Aufträge, die Geld bewegen "
        + "(einschalten, umschichten, nachkaufen), führt die Cloud nur mit wörtlich getipptem JA aus."),
      h("li", null, "Schaltbefehle brauchen ein getipptes JA; die Cloud prüft jede Bestätigung noch einmal selbst."),
      h("li", null, "Die App sperrt sich beim Öffnen und nach 5 Minuten im Hintergrund. 5 falsche PINs löschen den Token."),
      h("li", null, "Zahlen werden nur im Arbeitsspeicher gehalten, nie im App-Speicher."))));
  return out;
}
