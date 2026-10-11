// Kleiner ZIP-Leser für GENAU EINE Datei (Antwort-Artefakt „ki-antwort-<lauf>“, 1.2.0): liest das Inhaltsverzeichnis am Ende,
// nimmt die gesuchte (sonst die erste) Datei und entpackt sie – gespeichert (Methode 0) oder „deflate“ (Methode 8, mit
// DecompressionStream("deflate-raw")). Prüft Größe und CRC-32; verschlüsselte, ZIP64- oder übergroße Einträge -> Fehler.
// Größen kommen aus dem zentralen Verzeichnis (upload-artifact schreibt „data descriptors“, im lokalen Kopf steht dann 0).

const MAX_BYTES = 1024 * 1024;   // eine Antwort ist ein paar KB – mehr ist kein Antwort-Artefakt

let crcTabelle = null;
function crc32(bytes) {
  if (!crcTabelle) {
    crcTabelle = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTabelle[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTabelle[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function fehler(text) {
  return new Error("ZIP: " + text);
}

async function inflateRaw(daten) {
  if (typeof DecompressionStream !== "function") throw fehler("dieser Browser kann nicht entpacken (DecompressionStream fehlt)");
  const leser = new Blob([daten]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const teile = [];
  let laenge = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    laenge += value.length;
    if (laenge > MAX_BYTES) {
      leser.cancel();
      throw fehler("Inhalt zu groß");
    }
    teile.push(value);
  }
  const out = new Uint8Array(laenge);
  let o = 0;
  for (const t of teile) {
    out.set(t, o);
    o += t.length;
  }
  return out;
}

/** bytes: Uint8Array des ZIP; name: gewünschter Dateiname (ohne Ordner). -> Uint8Array des Inhalts */
export async function datei(bytes, name) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw fehler("zu kurz");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let ende = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      ende = i;
      break;
    }
  }
  if (ende < 0) throw fehler("kein Inhaltsverzeichnis");
  const anzahl = dv.getUint16(ende + 10, true);
  let p = dv.getUint32(ende + 16, true);
  if (anzahl === 0xffff || p === 0xffffffff) throw fehler("ZIP64 wird nicht unterstützt");
  const eintraege = [];
  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw fehler("Inhaltsverzeichnis kaputt");
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), kl = dv.getUint16(p + 32, true);
    eintraege.push({
      flags: dv.getUint16(p + 8, true), methode: dv.getUint16(p + 10, true), crc: dv.getUint32(p + 16, true),
      gepackt: dv.getUint32(p + 20, true), groesse: dv.getUint32(p + 24, true), lokal: dv.getUint32(p + 42, true),
      name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl)),
    });
    p += 46 + nl + xl + kl;
  }
  const dateien = eintraege.filter((x) => !x.name.endsWith("/"));
  const e = dateien.find((x) => x.name.split("/").pop() === name) || dateien[0];
  if (!e) throw fehler("keine Datei");
  if (e.flags & 1) throw fehler("verschlüsselte Einträge werden nicht unterstützt");
  if (e.gepackt === 0xffffffff || e.groesse === 0xffffffff || e.lokal === 0xffffffff) throw fehler("ZIP64 wird nicht unterstützt");
  if (e.groesse > MAX_BYTES || e.gepackt > MAX_BYTES) throw fehler("Inhalt zu groß");
  if (e.lokal + 30 > bytes.length || dv.getUint32(e.lokal, true) !== 0x04034b50) throw fehler("lokaler Kopf fehlt");
  const start = e.lokal + 30 + dv.getUint16(e.lokal + 26, true) + dv.getUint16(e.lokal + 28, true);
  if (start + e.gepackt > bytes.length) throw fehler("abgeschnitten");
  const roh = bytes.subarray(start, start + e.gepackt);
  let out;
  if (e.methode === 0) out = roh.slice();
  else if (e.methode === 8) out = await inflateRaw(roh);
  else throw fehler("Packmethode " + e.methode + " wird nicht unterstützt");
  if (out.length !== e.groesse) throw fehler("Größe stimmt nicht");
  if (crc32(out) !== e.crc) throw fehler("Prüfsumme stimmt nicht");
  return out;
}
