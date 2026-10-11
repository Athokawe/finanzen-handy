// Zahlen und Zeiten österreichisch anzeigen (de-AT, Wiener Zeit). Alle Eingaben können null/fehlend sein -> „–“.

const TZ = "Europe/Vienna";
const euroFmt = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zeitFmt = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const tagFmt = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, day: "numeric", month: "numeric" });
const tagJahrFmt = new Intl.DateTimeFormat("de-AT", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function istZahl(x) {
  return typeof x === "number" && Number.isFinite(x);
}

/** „€ 1.234,56“ */
export function euro(x) {
  return istZahl(x) ? euroFmt.format(x) : "–";
}

/** Euro mit Vorzeichen: „+ € 5,00“ / „− € 3,20“ */
export function euroPlus(x) {
  if (!istZahl(x)) return "–";
  if (x === 0) return euroFmt.format(0);
  return (x > 0 ? "+ " : "− ") + euroFmt.format(Math.abs(x));
}

export function zahl(x, stellen = 2) {
  if (!istZahl(x)) return "–";
  return new Intl.NumberFormat("de-AT", { minimumFractionDigits: stellen, maximumFractionDigits: stellen }).format(x);
}

/** „+2,50 %“ / „−4,01 %“ (mit echtem Minuszeichen) */
export function prozent(x, stellen = 2, vorzeichen = true) {
  if (!istZahl(x)) return "–";
  const z = zahl(Math.abs(x), stellen);
  const v = x > 0 ? (vorzeichen ? "+" : "") : x < 0 ? "−" : "";
  return v + z + " %";
}

/** CSS-Klasse für Gewinn/Verlust */
export function vorzeichenKlasse(x) {
  return !istZahl(x) || x === 0 ? "" : x > 0 ? "plus" : "minus";
}

/** ISO-Text -> Date oder null (auch „2026-10-11T03:10+00:00“ ohne Sekunden und mit Leerzeichen statt T). */
export function datum(iso) {
  if (!iso || typeof iso !== "string") return null;
  let s = iso.trim().replace(" ", "T");
  s = s.replace(/T(\d\d):(\d\d)(?=[+-]\d\d:?\d\d$|Z$|$)/, "T$1:$2:00");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function gleicherTag(a, b) {
  return ymdFmt.format(a) === ymdFmt.format(b);
}

/** „heute 08:20“, „gestern 21:35“, „9.10. 14:20“, „9.10.2025 14:20“ (Wiener Zeit) */
export function zeit(iso, jetzt = new Date()) {
  const d = datum(iso);
  if (!d) return "–";
  const gestern = new Date(jetzt.getTime() - 86400000);
  if (gleicherTag(d, jetzt)) return "heute " + zeitFmt.format(d);
  if (gleicherTag(d, gestern)) return "gestern " + zeitFmt.format(d);
  const jahrGleich = ymdFmt.format(d).slice(0, 4) === ymdFmt.format(jetzt).slice(0, 4);
  return (jahrGleich ? tagFmt.format(d) : tagJahrFmt.format(d)) + " " + zeitFmt.format(d);
}

/** Nur Datum: „9.10.2026“ (für „seit …“) */
export function tag(iso) {
  const d = datum(iso);
  return d ? tagJahrFmt.format(d) : "–";
}

/** „gerade eben“, „vor 3 min“, „vor 2 h 5 min“, „vor 3 Tagen“ */
export function vor(iso, jetzt = new Date()) {
  const d = datum(iso);
  if (!d) return "–";
  const min = Math.round((jetzt.getTime() - d.getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return "vor " + min + " min";
  const h = Math.floor(min / 60);
  if (h < 24) return "vor " + h + " h" + (min % 60 ? " " + (min % 60) + " min" : "");
  const t = Math.floor(h / 24);
  return t === 1 ? "vor 1 Tag" : "vor " + t + " Tagen";
}

/** Minuten seit einer Zeit (oder null) */
export function minutenSeit(iso, jetzt = new Date()) {
  const d = datum(iso);
  return d ? (jetzt.getTime() - d.getTime()) / 60000 : null;
}

/** Text sicher machen (für Anzeige als Text, nie als HTML) */
export function text(x, ersatz = "–") {
  if (x === null || x === undefined || x === "") return ersatz;
  return String(x);
}
