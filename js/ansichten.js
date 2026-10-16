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
  return h("p", { class: "klein gedimmt bitpanda-hinweis" }, "Öffnet die Bitpanda-App; falls Safari kommt: Link lange drücken → „In Bitpanda öffnen“.");
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
/** 1.2.11: Lagebericht je Bot (handy.json <bot>.lage – Liste kurzer Sätze, regelbasiert aus der Cloud). Fehlt er: nichts zeigen. */
function lageKarte(lage, titel, zu) {
  const saetze = liste(lage).filter((x) => typeof x === "string" && x.trim());
  if (!saetze.length) return null;
  const ul = h("ul", { class: "lage-liste" }, saetze.map((t) => h("li", null, F.text(t))));
  if (zu) return h("details", { class: "karte lage-karte" }, h("summary", null, titel || "Lage"), ul);
  return karte(titel || "Lage – warum es gerade so ist", null, ul);
}

/**
 * 1.2.13 (Paket E): Karte „KI-Vorschlag“ – die KI schlägt vor, Trend-/Raster-Bot ein-, auszuschalten oder zu pausieren (handy.json
 * <bot>.ki_vorschlag). Nur ein Vorschlag: „Vorschlag übernehmen …“ öffnet den bekannten Dialog (surfen_ein/trend_ein mit
 * vorausgefülltem Betrag, *_pause, *_aus) mit JA. Bei „keine“ steht die Einschätzung da (warum gerade nicht). Fehlt sie: nichts.
 */
function vorschlagKarte(v, teil, deckel, kurz) {
  if (!ok(v)) return null;
  const aktiv = v.aktion && v.aktion !== "keine";
  if (kurz && !aktiv) return null;
  const betrag = v.aktion === "einschalten" ? (F.istZahl(v.betrag_eur) && v.betrag_eur > 0 ? v.betrag_eur : teil && teil.topf_eur) : null;
  const knopf = aktiv && v.modus ? A.knopf(v.modus, "Vorschlag übernehmen …", "primaer",
    F.istZahl(betrag) ? { betrag: String(Math.round(betrag * 100) / 100).replace(".", ",") } : undefined) : null;
  const sicher = F.istZahl(v.zuversicht) ? v.zuversicht + " % sicher" : null;
  const frei = ok(deckel) && F.istZahl(deckel.frei_eur) ? "50-%-Deckel: noch " + F.euro(deckel.frei_eur) + " frei für Trend- und Raster-Topf." : null;
  return karte(aktiv ? "KI-Vorschlag" : "KI-Einschätzung", sicher ? h("span", { class: "klein gedimmt" }, sicher) : null,
    h("p", { class: aktiv ? "vorschlag-titel" : "" }, h("b", null, F.text(v.titel))),
    v.begruendung ? h("p", null, F.text(v.begruendung)) : null,
    v.hinweis ? h("p", { class: "klein gedimmt" }, F.text(v.hinweis)) : null,
    h("p", { class: "klein gedimmt" }, "Nur ein Vorschlag der KI (" + F.zeit(v.zeit) + ") – geschaltet wird erst mit deinem JA." + (frei && !kurz ? " " + frei : "")),
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
    "Schattendepot (Rechengeld): " + F.euro(s.wert_eur) + " gegen „Bitcoin halten“ " + F.euro(s.bitcoin_halten_eur)
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
    schluessel: "gesamt", punkte: D.punkteLesen(Z.verlauf), einheit: "eur", beschreibung: "Verlauf des Gesamtvermögens",
    serien: (p) => [
      { name: "Gesamt", klasse: "l-haupt", werte: D.reihe(p, "gesamt_eur") },
      { name: "Coin-Topf", klasse: "l-zweit", werte: D.reihe(p, "coin_topf_eur") },
      { name: "Trend-Topf", klasse: "l-trend", werte: D.reihe(p, "trend_echt_eur") },
      { name: "Raster-Topf", klasse: "l-raster", werte: D.reihe(p, "raster_echt_eur") },
      { name: "Aktien & ETFs", klasse: "l-dritt", werte: D.reihe(p, "aktien_eur") },
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
      schluessel: "coin", punkte, einheit: "prozent", beschreibung: "Coin-Topf gegen Bitcoin halten in Prozent seit Zeitraumbeginn",
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

/** Raster/Trend: echter Topf (falls im Verlauf) sonst Schattendepot – jeweils gegen „Bitcoin halten“. */
function botStatistik(Z, bot) {
  const hinweis = verlaufHinweis(Z);
  if (hinweis) return hinweis;
  const punkte = D.punkteLesen(Z.verlauf);
  const echt = punkte.some((p) => F.istZahl(p[bot + "_echt_eur"]));
  const feld = bot + (echt ? "_echt" : "_schatten");
  return h("div", null,
    h("p", { class: "klein gedimmt" }, echt ? "Echter Topf gegen „Bitcoin halten“ mit demselben Startbetrag."
      : "Schattendepot (Rechengeld) gegen „Bitcoin halten“ mit demselben Startbetrag."),
    D.statistik({
      schluessel: bot, punkte, einheit: "eur", beschreibung: (echt ? "Echter Topf" : "Schattendepot") + " gegen Bitcoin halten",
      serien: (p) => [
        { name: echt ? "Echter Topf" : "Schattendepot", klasse: "l-haupt", werte: D.reihe(p, feld + "_eur") },
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
 * Schattendepots zählen nie. Teil fehlt/kaputt: [true, null] = unbekannt.
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
    balken,
    zeilen(teile.map((t) => [h("span", { "data-teil": t.k }, h("span", { class: "punkt " + t.k }),
      " " + t.name + (t.k === "coin" && g.coin_topf_geschaetzt === true ? " (geschätzt)" : "")),
      F.euro(t.v) + (t.a !== null ? " · " + F.prozent(t.a, 1, false) : "")])),
    h("p", { class: "klein gedimmt", id: "gesamt-stand" }, "Stand " + F.zeit(g.zeit) + gesamtVermerk(g)),
    gesamtStatistik(Z));
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
  return h("div", { class: "park-knoepfe" },
    gross, gross ? bremsErklaerung("allesstopp") : null,
    klein, klein ? bremsErklaerung("anhalten") : null);
}

/** 1.2.5: Erklärtext + „Sinnvoll, wenn:“ in Stichworten + Hinweis (A.BREMS_WANN) */
function bremsErklaerung(m) {
  const w = A.BREMS_WANN[m];
  return h("div", { class: "erklaer-text", "data-erklaert": m },
    h("p", null, A.ERKLAERT[m]),
    h("p", { class: "wann-titel" }, "Sinnvoll, wenn:"),
    h("ul", { class: "wann" }, w.wann.map((x) => h("li", null, x))),
    h("p", { class: "wann-dazu" }, w.dazu));
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

export function uebersicht(Z) {
  const d = Z.handy;
  if (!d) return [Z.fehlerHandy ? h("p", { class: "leer" }, "Noch keine Daten.") : leer("Daten werden geladen …")];
  const out = [];
  if (A.erlaubt("frage")) out.push(kiSchnellKarte());             // 1.2.10: Eingabefeld „An die KI“ ganz oben (Nutzer 12.10.2026)
  out.push(gesamtKarte(d, Z));
  out.push(parkKnoepfe());

  const k = ok(d.kern_bot);
  if (k) {
    const ki = ok(k.ki);
    const pos = k.geparkt ? "geparkt in EURCV" : k.position ? F.text(k.position) : "–";
    out.push(karte(F.text(k.topf_name, "Coin-Topf"), statusEtikett(k.an ? "an" : "aus"),
      h("div", { class: "gross", id: "kern-wert" }, F.euro(k.wert_eur)),
      h("p", { class: "klein gedimmt" }, "Stand " + F.zeit(k.wert_zeit) + (F.istZahl(k.bitcoin_kurs_eur) ? " · Bitcoin " + F.euro(k.bitcoin_kurs_eur) : "")),
      zeilen([
        [F.text(k.name, "Coin-Bot"), anAus(k.an)],
        ["Stufe", F.text(k.stufe) + (k.stufe_automatik ? " (Automatik)" : "")],
        ["Bitcoin-Ampel", ampel(k.ampel)],
        ["Hält", pos],
        ki ? ["KI-Urteil", entscheidungText(ki.entscheidung) + (F.istZahl(ki.zuversicht) ? " · " + ki.zuversicht + " % sicher" : "")] : null,
      ]),
      ki ? erklaert("Einfach erklärt", ki.einfach_erklaert) : null,
      ok(d.bilanz) && d.bilanz.text ? h("p", { class: "klein gedimmt" }, d.bilanz.text) : null,
    ));
  } else out.push(fehlerKarte("Coin-Topf", d.kern_bot));

  out.push(reihe(bitpandaKnopf("Zu Bitpanda", BITPANDA_URL, "primaer"), bitpandaKnopf("Einzahlen", BITPANDA_EINZAHLEN_URL)));
  out.push(bitpandaHinweis());

  const r = ok(d.raster_bot);
  if (r) {
    out.push(karte(F.text(r.name, "Raster-Bot"), statusEtikett(r.status),
      zeilen([["Topf", F.euro(r.topf_eur)], ergebnisZeile("Ergebnis", r.ergebnis_eur, r.ergebnis_prozent),
        ["Coins", liste(r.coins).map((c) => c.coin).join(", ") || "–"]]),
      schattenHinweis(r.schatten),
      kiZeile(r.ki_vorschlag),
      botKnoepfe(r.status, "surfen_ein", "surfen_pause", "surfen_aus", d.bot_deckel)));
  } else out.push(fehlerKarte("Raster-Bot", d.raster_bot));

  const t = ok(d.trend_bot);
  if (t) {
    const ma = ok(t.markt_ampel);
    out.push(karte(F.text(t.name, "Trend-Bot"), statusEtikett(t.status),
      zeilen([
        ["Markt-Ampel", ma ? ampel(ma.gruen ? "gruen" : "rot") : "–"],
        t.modus === "echt" ? ["Topf", F.euro(t.topf_eur)] : ["Modus", "nur Schattendepot"],
        t.modus === "echt" ? ergebnisZeile("Ergebnis", t.ergebnis_eur, t.ergebnis_prozent) : null,
        ["Nächste Umschichtung", F.text(t.naechste_umschichtung)],
      ]),
      schattenHinweis(t.schatten, liste(ok(t.schatten) && t.schatten.positionen).join(", ")),
      straffZeile(t.schatten_straff),
      kiZeile(t.ki_vorschlag),
      botKnoepfe(t.status, "trend_ein", "trend_pause", "trend_aus", d.bot_deckel)));
  } else out.push(fehlerKarte("Trend-Bot", d.trend_bot));

  // 1.2.13 (Paket E): nur ein AKTIVER KI-Vorschlag erscheint auch hier (sonst steht die Einschätzung auf der Bot-Seite)
  for (const teil of [ok(d.raster_bot), ok(d.trend_bot)]) {
    const vk = teil ? vorschlagKarte(teil.ki_vorschlag, teil, d.bot_deckel, true) : null;
    if (vk) out.push(vk);
  }

  // 1.2.12: Aktien & ETFs unter dem Krypto-Teil, direkt vor „Letzte Alarme“ – langfristiges Geld, am wenigsten angeschaut (Nutzer 14.10.2026)
  const ak = ok(d.aktien);
  if (ak) {
    out.push(karte(F.text(ak.name, "Aktien-Autopilot"), statusEtikett(ak.an ? "an" : "aus"),
      h("div", { class: "mittel" }, F.euro(ak.wert_eur)),
      zeilen([
        ["Modus", ak.modus === "etf" ? "ETF" : ak.modus === "aktiv" ? "aktiv" : F.text(ak.modus)],
        ["Status", F.text(ak.status)],
        F.istZahl(ak.reserve_eur) && ak.reserve_eur > 0 ? ["Reserve", F.euro(ak.reserve_eur)] : null,
        ["Gewinnschutz", anAus(ak.gewinnschutz_an)],
        ["Stand", F.zeit(ak.wert_zeit)],
      ]),
      ok(ak.ki) ? erklaert("Aktien-KI einfach erklärt", ak.ki.einfach_erklaert) : null,
      reihe(ak.an ? A.knopf("aktien_stopp", "Autopilot aus") : A.knopf("aktien_start", "Autopilot ein"),
        ak.gewinnschutz_an ? A.knopf("gewinnschutz_aktien_aus", "Gewinnschutz aus") : A.knopf("gewinnschutz_aktien_ein", "Gewinnschutz ein")),
    ));
    const lageA = lageKarte(ak.lage, "Lage Aktien-Autopilot", true);   // 1.2.11: eingeklappt, die Übersicht bleibt kurz
    if (lageA) out.push(lageA);
  } else out.push(fehlerKarte("Aktien-Autopilot", d.aktien));

  out.push(alarmKarte(d));
  return out;
}

/** „Letzte Alarme“ (1.2.0): je Alarm „✕“, oben „Alle löschen“ – sofort ausgeblendet, Auftrag alarme_gelesen (js/alarme.js) */
function alarmKarte(d) {
  const roh = liste(d.alarme);
  const darf = AL.moeglich(roh);
  const al = AL.sichtbar(roh, false);
  const alle = darf && al.some((x) => Number.isInteger(x.id))
    ? h("button", { type: "button", class: "knopf-text", id: "alarme-alle", onclick: () => AL.ausblenden(al.map((x) => x.id)) }, "Alle löschen")
    : null;
  return h("section", { class: "karte", id: "alarm-karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Letzte Alarme"), alle),
    al.length ? h("ul", { class: "liste" }, al.slice(0, 5).map((x) => h("li", { class: "alarm " + F.text(x.stufe, ""), "data-alarm": Number.isInteger(x.id) ? String(x.id) : null },
      h("div", { class: "oben" }, h("span", { class: "titel" }, F.text(x.titel)),
        h("span", { class: "alarm-rechts" }, h("span", { class: "klein gedimmt" }, F.zeit(x.zeit)),
          darf && Number.isInteger(x.id) ? h("button", { type: "button", class: "alarm-weg", "aria-label": "Alarm löschen", "data-weg": String(x.id),
            onclick: () => AL.ausblenden([x.id]) }, "✕") : null)),
      x.text ? h("div", { class: "unter" }, x.text) : null)))
      : leer(fehlerVon(d.alarme) || (roh.length ? "Alle Alarme gelöscht." : "Keine Alarme.")),
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
  out.push(karte(F.text(k.name, "Coin-Bot"), statusEtikett(k.an ? "an" : "aus"),
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
    reihe(k.an ? A.knopf("stopp", "Coin-Bot aus", "gefahr-rand") : A.knopf("start", "Coin-Bot ein", "primaer"),
      A.knopf("einstellung", "Stufe ändern", "", { stufe: k.stufe, auto: !!k.stufe_automatik })),
    k.an && A.erlaubt("stopp") ? h("p", { class: "erklaer-text" }, "„Coin-Bot aus“: " + A.ERKLAERT.stopp) : null,
    k.stufe !== "sicher" || k.stufe_automatik
      ? reihe(A.knopf("einstellung", "Bremsen: Stufe → sicher", "gefahr-rand stufe-sicher", { stufe: "sicher", auto: false })) : null,
    reihe(k.euro_automatik ? A.knopf("euro_aus", "Euro-Automatik aus") : A.knopf("euro_ein", "Euro-Automatik ein"),
      k.regelwerk_an === false ? A.knopf("regelwerk_ein", "Regelwerk ein") : null),
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
      gs.ausgeloest ? ["Ausgelöst", "ja"] : null,
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

  // Ohne echtes Geld steht das Schattendepot gleich unter dem Bot, mit echtem Geld nur noch als eine Referenzzeile ganz unten (Nutzer 11.10.2026)
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
  return karte("Schattendepot", s ? statusEtikett(s.status) : null,
    h("p", { class: "klein gedimmt" }, "Rechengeld (kein echtes Geld): zeigt, wie sich der Raster-Bot mit 300 € gegen „Bitcoin halten“ schlagen würde."),
    s ? zeilen([
      ["Wert", F.euro(s.wert_eur)],
      ["„Bitcoin halten“", F.euro(s.bitcoin_halten_eur)],
      ["Unterschied", F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.euroPlus(s.wert_eur - s.bitcoin_halten_eur) : "–",
        F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.vorzeichenKlasse(s.wert_eur - s.bitcoin_halten_eur) : ""],
      ["Start", F.euro(s.start_eur) + " am " + F.tag(s.start_zeit)],
      F.istZahl(s.runde) ? ["Runde", String(s.runde)] : null,
      ["Stand", F.zeit(s.zeit)],
    ]) : leer("Kein Schattendepot."));
}

// ------------------------------------------------------------------ Trend-Bot

export function trend(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const t = ok(d.trend_bot);
  if (!t) return [fehlerKarte("Trend-Bot", d.trend_bot)];
  const out = [];
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
    t.modus === "echt" ? h("div", { class: "mittel" }, F.euro(t.topf_eur)) : h("p", null, "Läuft gerade nur im Schattendepot (Rechengeld)."),
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
  const stk = straffKarte(t);                       // 1.2.16: zweites Schattendepot „straff“ direkt darunter
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
  return karte("Schattendepot", null,
    h("p", { class: "klein gedimmt" }, "Rechengeld (kein echtes Geld) mit denselben Regeln wie der Trend-Bot."),
    s ? zeilen([
      ["Wert", F.euro(s.wert_eur)],
      ["„Bitcoin halten“", F.euro(s.bitcoin_halten_eur)],
      ["Unterschied", F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.euroPlus(s.wert_eur - s.bitcoin_halten_eur) : "–",
        F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.vorzeichenKlasse(s.wert_eur - s.bitcoin_halten_eur) : ""],
      ["hält", liste(s.positionen).join(", ") || "nichts"],
      ["Start", F.euro(s.start_eur) + " am " + F.tag(s.start_zeit)],
      ["Stand", F.zeit(s.zeit)],
    ]) : leer("Kein Schattendepot."));
}

/** 1.2.16: eine Zeile „Neu (straff)“ in der Trend-Karte der Übersicht. */
function straffZeile(st) {
  if (!ok(st) || !st.gestartet || !F.istZahl(st.wert_eur)) return null;
  return h("p", { class: "klein gedimmt" }, "Neues Schattendepot (straff): " + F.euro(st.wert_eur) +
    (F.istZahl(st.bitcoin_halten_eur) ? " gegen „Bitcoin halten“ " + F.euro(st.bitcoin_halten_eur) : "") +
    " · hält " + (liste(st.positionen).map((p) => F.text(p.coin)).join(", ") || "nichts"));
}

/** 1.2.16: zweites Schattendepot „straff“ (trend_straff.py, 16.10.2026) – schnellere Regel als Test mit Rechengeld:
 *  Vergleich mit dem alten Schattendepot und „Bitcoin halten“, Positionen mit Kaufkurs, letzte Trades. Fehlt der Teil: nichts. */
function straffKarte(t) {
  const st = ok(t.schatten_straff);
  if (!st) return null;
  if (!st.gestartet) return karte("Schattendepot neu („straff“)", null, h("p", { class: "klein gedimmt" }, "Startet mit dem nächsten Stundenlauf. Regel: " + F.text(st.regel)));
  const alt = ok(t.schatten);
  const diff = F.istZahl(st.wert_eur) && F.istZahl(st.bitcoin_halten_eur) ? st.wert_eur - st.bitcoin_halten_eur : null;
  const pos = liste(st.positionen);
  const tr = liste(st.trades_letzte).slice(-5).reverse();
  return karte("Schattendepot neu („straff“)", null,
    h("p", { class: "klein gedimmt" }, "Test der schnelleren Regel mit Rechengeld (kein echtes Geld): " + F.text(st.regel) + "."),
    zeilen([
      ["Wert", F.euro(st.wert_eur)],
      ["„Bitcoin halten“", F.euro(st.bitcoin_halten_eur)],
      ["Unterschied", diff === null ? "–" : F.euroPlus(diff), diff === null ? "" : F.vorzeichenKlasse(diff)],
      alt && F.istZahl(alt.wert_eur) ? ["altes Schattendepot", F.euro(alt.wert_eur)] : null,
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

function gesamtbildKarte(g, lage) {
  const zeilen_ = liste(lage).filter((x) => istObj(x) && textOder(x.text));
  const gb = istObj(g) ? g : null;
  const text = gb && textOder(gb.text), bots = gb && textOder(gb.bots);
  const teile = gb ? [["bitcoin", "Bitcoin"], ["welt_etf", "Welt-ETF"]]
    .filter(([k]) => istObj(gb[k]) && RICHTUNG[gb[k].richtung])
    .map(([k, name]) => richtungEtikett(gb[k].richtung, name + (STAERKE[gb[k].staerke] ? " · " + STAERKE[gb[k].staerke] : ""))) : [];
  if (!text && !bots && !teile.length && !zeilen_.length) return null;
  return h("section", { class: "karte", id: "news-gesamtbild" },
    h("div", { class: "karte-kopf" }, h("h2", null, "Gesamtbild")),
    teile.length ? h("div", { class: "etiketten" }, teile) : null,
    text ? h("p", { class: "gesamt-text" }, text) : null,
    bots ? h("p", { class: "gesamt-bots" }, bots) : null,
    zeilen_.length ? h("div", { class: "bot-lage" }, h("span", { class: "label" }, "Stand deiner Bots"),
      h("ul", { class: "liste" }, zeilen_.map((x) => h("li", null, x.text)))) : null,
    h("p", { class: "klein gedimmt" }, (gb && textOder(gb.hinweis)) || NEWS_HINWEIS));
}

export function news(Z) {
  const out = [];
  out.push(reihe(A.knopf("news_jetzt", "News aktualisieren", "primaer")));
  const n = Z.news;
  if (!n) {
    out.push(Z.fehlerNews ? h("p", { class: "fehlerteil" }, Z.fehlerNews) : leer("News werden geladen …"));
    return out;
  }
  out.push(h("p", { class: "klein gedimmt" }, "Abgerufen " + F.vor(n.zeit) + " (" + F.zeit(n.zeit) + ", " + (n.anlass === "news_jetzt" ? "von Hand" : "für den Bericht") + "). Neu holen geht höchstens alle 30 Minuten."));
  if (n.fehler) out.push(h("p", { class: "fehlerteil" }, F.text(n.fehler)));
  const z = ok(n.zusammenfassung);
  out.push(gesamtbildKarte(z && z.gesamtbild, n.bot_lage));
  if (z) {
    const wichtig = liste(z.wichtigste);
    out.push(karte("Das Wichtigste", null,
      liste(z.rubriken).filter((r) => r.id === "einordnung").map((r) => erklaert(F.text(r.name), r.text)),
      wichtig.length ? h("div", null, wichtig.map((s) => [schlagzeile(s), istObj(s) ? einordnungTeil(s.einordnung) : null])) : null));
    for (const r of liste(z.rubriken).filter((r) => r.id !== "einordnung")) {
      out.push(karte(F.text(r.name), etikett("KI", ""), h("p", { class: "rubrik-text" }, F.text(r.text))));
    }
  }
  for (const r of liste(n.rubriken)) {
    const s = liste(r.schlagzeilen);
    out.push(karte(F.text(r.name), h("span", { class: "klein gedimmt" }, s.length + (s.length === 1 ? " Schlagzeile" : " Schlagzeilen")),
      s.length ? h("div", null, s.map(schlagzeile)) : leer("Keine Schlagzeilen.")));
  }
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

export function mehr(Z, ctx) {
  const out = [];
  const d = Z.handy || {};
  const pushTeil = ok(d.push) || {};
  const abos = liste(pushTeil.abos);

  // Push
  const pk = [];
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
      h("li", null, "Der Token liegt nur auf diesem iPhone, mit deiner PIN verschlüsselt (AES-GCM, PBKDF2)."),
      h("li", null, "Optional Face ID: ein zweiter verschlüsselter Umschlag, den nur dein Passkey öffnet – ohne Passkey-Erweiterung PRF gibt es kein Face ID."),
      h("li", null, "Er darf nur Athokawe/finanzen lesen und Cloud-Aufträge starten – kein Geld bewegen, keine anderen Repos."),
      h("li", null, "Schaltbefehle brauchen ein getipptes JA; die Cloud prüft jede Bestätigung noch einmal selbst."),
      h("li", null, "Die App sperrt sich beim Öffnen und nach 5 Minuten im Hintergrund. 5 falsche PINs löschen den Token."),
      h("li", null, "Zahlen werden nur im Arbeitsspeicher gehalten, nie im App-Speicher."))));
  return out;
}
