// Die fünf Reiter + Einstellungen. Alle fremden Texte nur als Text (dom.h), fehlende Werte als „–“, ein kaputter Teil
// ({"fehler": "…"}) zeigt nur dort eine Meldung.

import { h, aussenLink, sichereUrl } from "./dom.js";
import * as F from "./format.js";
import * as A from "./aktionen.js";
import * as P from "./push.js";
import { BITPANDA_URL, BITPANDA_SWAP_URL } from "../konfig.js";

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

/** Coin-Link: für Bitpanda gibt es keine sichere, aus dem Kürzel ableitbare Coin-Adresse – daher die allgemeine Seite. */
function coinLink(coin) {
  return aussenLink(BITPANDA_URL, { class: "klein", "aria-label": F.text(coin) + " bei Bitpanda öffnen" }, "Bitpanda ↗");
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

function tradesListe(trades) {
  const t = liste(trades);
  if (!t.length) return leer("Noch keine echten Trades.");
  return h("ul", { class: "liste" }, t.map((x) => h("li", null,
    h("div", { class: "oben" }, h("span", { class: "titel" }, (x.seite === "verkauf" ? "Verkauf " : "Kauf ") + F.text(x.coin)),
      h("span", { class: "zahl" }, F.euro(x.eur))),
    h("div", { class: "unter" }, F.zeit(x.zeit)))));
}

function ereignisListe(ev) {
  const e = liste(ev);
  if (!e.length) return leer("Keine Ereignisse.");
  return h("ul", { class: "liste" }, e.slice(0, 10).map((x) => h("li", null,
    h("div", null, F.text(x.text)), h("div", { class: "unter" }, F.zeit(x.zeit)))));
}

function schattenHinweis(s, name) {
  if (!ok(s)) return null;
  const diff = F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? s.wert_eur - s.bitcoin_halten_eur : null;
  return h("p", { class: "hinweis-schatten" },
    "Schattendepot (Rechengeld): " + F.euro(s.wert_eur) + " gegen „Bitcoin halten“ " + F.euro(s.bitcoin_halten_eur)
    + (diff !== null ? " → " + F.euroPlus(diff) : "") + (name ? " · " + name : ""));
}

// ------------------------------------------------------------------ Übersicht

export function uebersicht(Z) {
  const d = Z.handy;
  if (!d) return [Z.fehlerHandy ? h("p", { class: "leer" }, "Noch keine Daten.") : leer("Daten werden geladen …")];
  const out = [];
  out.push(A.knopf("allesstopp", "■ Alles stoppen", "gefahr stopp-knopf"));

  const k = ok(d.kern_bot);
  if (k) {
    const ki = ok(k.ki);
    const pos = k.geparkt ? "geparkt in EURCV" : k.position ? F.text(k.position) : "–";
    out.push(karte(F.text(k.topf_name, "Kern-Topf"), statusEtikett(k.an ? "an" : "aus"),
      h("div", { class: "gross", id: "kern-wert" }, F.euro(k.wert_eur)),
      h("p", { class: "klein gedimmt" }, "Stand " + F.zeit(k.wert_zeit) + (F.istZahl(k.bitcoin_kurs_eur) ? " · Bitcoin " + F.euro(k.bitcoin_kurs_eur) : "")),
      zeilen([
        [F.text(k.name, "Kern-Bot"), anAus(k.an)],
        ["Stufe", F.text(k.stufe) + (k.stufe_automatik ? " (Automatik)" : "")],
        ["Bitcoin-Ampel", ampel(k.ampel)],
        ["Hält", pos],
        ki ? ["KI-Urteil", entscheidungText(ki.entscheidung) + (F.istZahl(ki.zuversicht) ? " · " + ki.zuversicht + " % sicher" : "")] : null,
      ]),
      ki ? erklaert("Einfach erklärt", ki.einfach_erklaert) : null,
      ok(d.bilanz) && d.bilanz.text ? h("p", { class: "klein gedimmt" }, d.bilanz.text) : null,
    ));
  } else out.push(fehlerKarte("Kern-Topf", d.kern_bot));

  out.push(reihe(bitpandaKnopf("Zu Bitpanda", BITPANDA_URL, "primaer"), bitpandaKnopf("Einzahlen", BITPANDA_URL)));
  out.push(h("p", { class: "klein gedimmt" }, "Öffnet Bitpanda (mit installierter App meist direkt die Bitpanda-App). Einzahlen: dort auf „Einzahlen“ tippen."));

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
  } else out.push(fehlerKarte("Aktien-Autopilot", d.aktien));

  const r = ok(d.raster_bot);
  if (r) {
    out.push(karte(F.text(r.name, "Raster-Bot"), statusEtikett(r.status),
      zeilen([["Topf", F.euro(r.topf_eur)], ergebnisZeile("Ergebnis", r.ergebnis_eur, r.ergebnis_prozent),
        ["Coins", liste(r.coins).map((c) => c.coin).join(", ") || "–"]]),
      schattenHinweis(r.schatten)));
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
      schattenHinweis(t.schatten, liste(ok(t.schatten) && t.schatten.positionen).join(", "))));
  } else out.push(fehlerKarte("Trend-Bot", d.trend_bot));

  const al = liste(d.alarme);
  out.push(karte("Letzte Alarme", null, al.length ? h("ul", { class: "liste" }, al.slice(0, 5).map((x) => h("li", { class: "alarm " + F.text(x.stufe, "") },
    h("div", { class: "oben" }, h("span", { class: "titel" }, F.text(x.titel)), h("span", { class: "klein gedimmt" }, F.zeit(x.zeit))),
    x.text ? h("div", { class: "unter" }, x.text) : null))) : leer(fehlerVon(d.alarme) || "Keine Alarme.")));
  return out;
}

// ------------------------------------------------------------------ Kern-Bot

export function kern(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const k = ok(d.kern_bot);
  if (!k) return [fehlerKarte("Kern-Bot", d.kern_bot)];
  const out = [];
  out.push(karte(F.text(k.name, "Kern-Bot"), statusEtikett(k.an ? "an" : "aus"),
    h("div", { class: "mittel" }, F.euro(k.wert_eur)),
    h("p", { class: "klein gedimmt" }, F.text(k.topf_name, "Kern-Topf") + " · Stand " + F.zeit(k.wert_zeit)),
    zeilen([
      ["Hält", k.geparkt ? "geparkt in EURCV" : F.text(k.position)],
      ["Stufe", F.text(k.stufe)],
      ["Stufe automatisch", anAus(k.stufe_automatik)],
      k.stufe_geaendert ? ["Stufe zuletzt geändert", F.zeit(k.stufe_geaendert) + (k.stufe_quelle ? " (" + k.stufe_quelle + ")" : "")] : null,
      ["Regelwerk ohne KI", anAus(k.regelwerk_an)],
      ["Euro-Automatik", anAus(k.euro_automatik)],
    ]),
    reihe(k.an ? A.knopf("stopp", "Kern-Bot aus") : A.knopf("start", "Kern-Bot ein", "primaer"),
      A.knopf("einstellung", "Stufe ändern", "", { stufe: k.stufe, auto: !!k.stufe_automatik })),
    reihe(k.euro_automatik ? A.knopf("euro_aus", "Euro-Automatik aus") : A.knopf("euro_ein", "Euro-Automatik ein"),
      k.regelwerk_an === false ? A.knopf("regelwerk_ein", "Regelwerk ein") : null),
  ));

  const nb = ok(k.notbremse);
  if (nb) {
    out.push(karte("Notbremse", null,
      h("p", { class: "klein gedimmt" }, "Grenzen der Stufe „" + F.text(k.stufe) + "“: fällt der Kern-Topf so stark, parkt der Kern-Bot in EURCV."),
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
    reihe(bitpandaKnopf("Tauschen bei Bitpanda", BITPANDA_SWAP_URL, "primaer"), bitpandaKnopf("Zu Bitpanda"))));

  const b = ok(d.bilanz);
  if (b) {
    out.push(karte("Kern-Bot gegen „Bitcoin halten“", null,
      zeilen([
        ["Kern-Bot", F.euro(b.kern_bot_eur)],
        ["Bitcoin halten", F.euro(b.halten_eur)],
        ["seit Start", F.prozent(b.seit_start_prozent), F.vorzeichenKlasse(b.seit_start_prozent)],
        ["letzte 30 Tage", F.istZahl(b.letzte_30_tage_pp) ? F.zahl(b.letzte_30_tage_pp, 2).replace(/^-/, "−") + " Prozentpunkte" : "–", F.vorzeichenKlasse(b.letzte_30_tage_pp)],
        ["Tage seit Start", F.zahl(b.tage_seit_start, 0)],
      ])));
  }
  out.push(karte("Hinweis an die KI", null,
    h("p", { class: "klein gedimmt" }, "Etwas, das der Bot wissen soll (z. B. ein Termin). Löst nie selbst eine Order aus."),
    reihe(A.knopf("hinweis", "Hinweis schreiben"), A.knopf("hinweis_loeschen", "Hinweis löschen"))));
  return out;
}

// ------------------------------------------------------------------ Raster-Bot

export function raster(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const r = ok(d.raster_bot);
  if (!r) return [fehlerKarte("Raster-Bot", d.raster_bot)];
  const out = [];
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
    reihe(A.knopf("surfen_deckel", "Verlustdeckel"), A.knopf("surfen_recherchen", "Recherchen/Tag")),
  ));

  const coins = liste(r.coins);
  out.push(karte("Coins im Raster", null, coins.length ? h("ul", { class: "liste" }, coins.map((c) => h("li", null,
    h("div", { class: "coin-zeile" }, h("span", { class: "titel" }, F.text(c.coin)), h("span", { class: "zahl" }, F.euro(c.wert_eur)), coinLink(c.coin)),
    h("div", { class: "unter" }, (F.istZahl(c.stufen) ? c.stufen + " Stufen" : "") + (c.sperre ? " · gesperrt" : "") + (c.auslaufend ? " · läuft aus" : ""))))) : leer("Keine Coins.")));
  out.push(karte("Letzte Trades", null, tradesListe(r.trades_letzte)));
  out.push(karte("Ereignisse", null, ereignisListe(r.ereignisse)));

  const s = ok(r.schatten);
  out.push(karte("Schattendepot", s ? statusEtikett(s.status) : null,
    h("p", { class: "klein gedimmt" }, "Rechengeld (kein echtes Geld): zeigt, wie sich der Raster-Bot mit 300 € gegen „Bitcoin halten“ schlagen würde."),
    s ? zeilen([
      ["Wert", F.euro(s.wert_eur)],
      ["„Bitcoin halten“", F.euro(s.bitcoin_halten_eur)],
      ["Unterschied", F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.euroPlus(s.wert_eur - s.bitcoin_halten_eur) : "–",
        F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.vorzeichenKlasse(s.wert_eur - s.bitcoin_halten_eur) : ""],
      ["Start", F.euro(s.start_eur) + " am " + F.tag(s.start_zeit)],
      F.istZahl(s.runde) ? ["Runde", String(s.runde)] : null,
      ["Stand", F.zeit(s.zeit)],
    ]) : leer("Kein Schattendepot.")));
  out.push(reihe(bitpandaKnopf("Zu Bitpanda")));
  return out;
}

// ------------------------------------------------------------------ Trend-Bot

export function trend(Z) {
  const d = Z.handy;
  if (!d) return [leer("Daten werden geladen …")];
  const t = ok(d.trend_bot);
  if (!t) return [fehlerKarte("Trend-Bot", d.trend_bot)];
  const out = [];
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
    reihe(A.knopf("trend_deckel", "Verlustdeckel")),
  ));

  const pos = liste(t.positionen);
  out.push(karte("Positionen", null, pos.length ? h("ul", { class: "liste" }, pos.map((p) => h("li", null,
    h("div", { class: "coin-zeile" }, h("span", { class: "titel" }, F.text(p.coin)), h("span", { class: "zahl" }, F.euro(p.einstand_eur)), coinLink(p.coin)),
    h("div", { class: "unter" }, "Rang " + F.text(p.rang) + " · seit " + F.zeit(p.seit))))) : leer("Keine echten Positionen.")));

  const rl = liste(t.rangliste);
  out.push(karte("Rangliste (14 Tage)", null, rl.length ? h("ul", { class: "liste" }, rl.map((x) => h("li", null,
    h("div", { class: "coin-zeile" }, h("span", { class: "titel" }, F.text(x.rang) + ". " + F.text(x.coin)),
      h("span", { class: "zahl " + F.vorzeichenKlasse(x.r14_prozent) }, F.prozent(x.r14_prozent)), coinLink(x.coin))))) : leer("Keine Rangliste.")));

  const s = ok(t.schatten);
  out.push(karte("Schattendepot", null,
    h("p", { class: "klein gedimmt" }, "Rechengeld (kein echtes Geld) mit denselben Regeln wie der Trend-Bot."),
    s ? zeilen([
      ["Wert", F.euro(s.wert_eur)],
      ["„Bitcoin halten“", F.euro(s.bitcoin_halten_eur)],
      ["Unterschied", F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.euroPlus(s.wert_eur - s.bitcoin_halten_eur) : "–",
        F.istZahl(s.wert_eur) && F.istZahl(s.bitcoin_halten_eur) ? F.vorzeichenKlasse(s.wert_eur - s.bitcoin_halten_eur) : ""],
      ["hält", liste(s.positionen).join(", ") || "nichts"],
      ["Start", F.euro(s.start_eur) + " am " + F.tag(s.start_zeit)],
      ["Stand", F.zeit(s.zeit)],
    ]) : leer("Kein Schattendepot.")));
  out.push(karte("Letzte Trades", null, tradesListe(t.trades_letzte)));
  out.push(karte("Ereignisse", null, ereignisListe(t.ereignisse)));
  out.push(reihe(bitpandaKnopf("Zu Bitpanda")));
  return out;
}

// ------------------------------------------------------------------ Nachrichten

function schlagzeile(s) {
  if (!istObj(s)) return null;
  const unter = [s.quelle, s.aktie && !(String(s.quelle || "").includes(s.aktie)) ? s.aktie : null, s.zeit ? F.vor(s.zeit) : null].filter(Boolean).join(" · ");
  const inhalt = [h("div", { class: "titel" }, F.text(s.titel)), unter ? h("div", { class: "unter" }, unter) : null];
  return sichereUrl(s.link) ? aussenLink(s.link, { class: "news-link" }, ...inhalt) : h("div", { class: "news-link" }, ...inhalt);
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
  if (z) {
    const wichtig = liste(z.wichtigste);
    out.push(karte("Das Wichtigste", null,
      liste(z.rubriken).filter((r) => r.id === "einordnung").map((r) => erklaert(F.text(r.name), r.text)),
      wichtig.length ? h("div", null, wichtig.map(schlagzeile)) : null));
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
  pk.push(h("p", { class: "klein gedimmt" }, "Du bekommst eine Mitteilung, wenn der Kern-Bot parkt oder zurückkauft, die Stufe wechselt, ein Bot geschaltet wird oder handelt, ein Verlustdeckel greift, und einmal täglich ein Lebenszeichen. In der Cloud angemeldet: " + abos.length + " Gerät(e)."));
  out.push(karte("Benachrichtigungen", null, ...pk));

  out.push(karte("Hinweis an die KI", null,
    h("p", { class: "klein gedimmt" }, "Etwas, das der Bot wissen soll. Löst nie selbst eine Order aus."),
    reihe(A.knopf("hinweis", "Hinweis schreiben"), A.knopf("hinweis_loeschen", "Hinweis löschen"))));

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
    ctx.demo ? null : h("p", { class: "klein gedimmt" }, "„Abmelden“ löscht den verschlüsselten Token und die PIN von diesem iPhone. Den Token selbst kannst du auf github.com → Settings → Developer settings → Fine-grained tokens jederzeit widerrufen.")));

  out.push(karte("Sicherheit", null,
    h("ul", { class: "liste" },
      h("li", null, "Der Token liegt nur auf diesem iPhone, mit deiner PIN verschlüsselt (AES-GCM, PBKDF2)."),
      h("li", null, "Er darf nur Athokawe/finanzen lesen und Cloud-Aufträge starten – kein Geld bewegen, keine anderen Repos."),
      h("li", null, "Schaltbefehle brauchen ein getipptes JA; die Cloud prüft jede Bestätigung noch einmal selbst."),
      h("li", null, "Die App sperrt sich beim Öffnen und nach 5 Minuten im Hintergrund. 5 falsche PINs löschen den Token."),
      h("li", null, "Zahlen werden nur im Arbeitsspeicher gehalten, nie im App-Speicher."))));
  return out;
}
