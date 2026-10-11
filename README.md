# Finanzen – Handy-Ansicht

Web-App (PWA) fürs iPhone zur privaten Finanz-App: Gesamtvermögen, Coin-Bot, Coin-Topf, Raster-Bot, Trend-Bot,
Aktien-Autopilot und Nachrichten auf einen Blick, mit Statistik-Diagrammen – plus die wichtigsten Schalter („Alles parken“,
„Nur anhalten“, Bots ein/aus, Stufe), Fragen „An die KI“, Alarme löschen und Mitteilungen (Web-Push).

## Neu in 1.2.2

* **„Gemerkte Hinweise“ statt „Hinweis löschen“:** der allgemeine Knopf (Nummer eintippen) ist weg – er sah aus, als wäre
  schon ein Hinweis gemerkt. Stattdessen zeigen die Karte „An die KI“ (Coin-Bot, Einstellungen) und das Eingabe-Blatt eine
  kleine Liste der **aktiven** Hinweise aus `handy.json` → `hinweise` (Text, Nummer, von wem, gilt bis …), je mit **✕**:
  Bestätigung wie bei den anderen Aufträgen, dann Modus `hinweis_loeschen` mit genau dieser Nummer (ohne JA). Danach steht
  „Löschen geschickt“; scheitert der Auftrag, ist das ✕ wieder da. Ohne aktive Hinweise gibt es weder Liste noch Knopf.
  „Rückgängig“ unter einer Antwort, die einen Hinweis gemerkt hat, bleibt wie bisher. Hinweistexte nur als Text, gemerkt wird
  nichts (nur die Nummern im Arbeitsspeicher).

## Neu in 1.2.0

* **„An die KI“:** schwebender Knopf 💬 rechts unten (auf jedem Reiter mit dem Daumen erreichbar) öffnet ein Eingabe-Blatt:
  Frage tippen (eine Zeile, höchstens 500 Zeichen), **Senden** = Auftrag `ki.yml` Modus `frage` (ohne JA). Live-Status wie bei
  allen Aufträgen (gesendet → angekommen → „Die KI denkt nach …“ → Antwort da). Die KI **erklärt nur** – sie kann nie kaufen,
  verkaufen oder schalten (das sichert die Cloud selbst ab). Hält sie etwas für den Bot wichtig, merkt sie es als Hinweis:
  „📌 Als Hinweis gemerkt (7 Tage) · **Rückgängig**“ (= `hinweis_loeschen`). Ersetzt den bisherigen Hinweis-Dialog; „Hinweis
  löschen“ bleibt als kleine Aktion. Höchstens 10 Fragen in 24 Stunden.
* **Antworten nur im Arbeitsspeicher:** gezeigt werden die Antworten der letzten 24 h, geholt aus dem Actions-Artefakt
  `ki-antwort-<lauf>` (ZIP – eigener kleiner Entpacker `js/zip.js`, „gespeichert“ oder „deflate“ über
  `DecompressionStream("deflate-raw")`, mit CRC-Prüfung) – der einzige Weg. Kann der Browser das Artefakt nicht laden
  (Weiterleitung auf den Artefakt-Speicher, CORS) oder scheitert das Netz, sagt die App klar: „Die Antwort liegt in der Cloud,
  konnte aber am Handy nicht geladen werden“. Die Cloud löscht die Frage-Läufe (samt Eingabe und Artefakt) nach 24 h; im Repo
  landet von Frage und Antwort nichts.
* **Ergebnis eines Auftrags:** ein `ki.yml`-Lauf kann einen zweiten Job „aufraeumen“ haben – die App bewertet den Job „ki“
  (Jobs-API), damit ein gescheitertes Aufräumen keinen Auftrag „rot“ macht.
* **Alarme löschen:** je Alarm „✕“, oben „Alle löschen“ – sofort ausgeblendet, Auftrag `alarme_gelesen` (ohne JA, Live-Status).
  Die Cloud markiert sie nur als gelesen (nichts wird wirklich gelöscht). Läuft gerade ein anderer Auftrag, geht der Versand
  automatisch danach. Gemerkt werden nur die Alarm-Nummern (`fh_alarme_weg_v1`), bis `handy.json` sie nicht mehr zeigt.
* CSP `connect-src` zusätzlich nur `https://productionresultssa0…19.blob.core.windows.net` (Artefakt-Speicher von GitHub, wohin
  der Artefakt-Download weiterleitet) – kein `*.blob.core.windows.net`.

## Neu in 1.1.0

* **Look der Laptop-App, immer dunkel** (fast schwarz, Karten mit feinem Rand, grüner Akzent, Pillen-Knöpfe).
* **Gesamtvermögen** als erste Karte: Coin-Topf + Aktien & ETFs mit Anteilen und Stand-Zeit.
* **Statistik** aus `cloud/handy_verlauf.json`: selbst gezeichnete SVG-Diagramme (keine fremden Bibliotheken), Zeitraum
  7 T / 30 T / 90 T / 1 J / Alles, Antippen zeigt Datum und Wert, darunter Veränderung, Höchst- und Tiefstwert. Übersicht:
  Gesamtvermögen; Coin-Bot: Coin-Topf gegen „Bitcoin halten“ in Prozent (Ein- und Auszahlungen herausgerechnet) und
  Bitcoin-Kurs; Raster/Trend: Schattendepot (bzw. echter Topf) gegen „Bitcoin halten“. Fehlt die Datei noch: „Statistik
  entsteht ab dem nächsten Cloud-Lauf“.
* **Neue Namen:** Coin-Bot (bisher Kern-Bot), Coin-Topf (bisher Kern-Topf).
* **„Alles parken“** (großer roter Knopf, mit JA): verkauft alle Krypto-Bestände der Bots in EURCV und schaltet sie aus –
  Aktien bleiben. **„Nur anhalten“** (kleiner Knopf): alle Krypto-Bots aus, nichts wird verkauft – auch keine Notbremse mehr.
  „Coin-Bot aus“: nur die KI aus – das Regelwerk mit Notbremse schützt weiter.
* **Express-Bremse:** Brems-Befehle (Alles parken, Nur anhalten, Coin-Bot aus, Stufe → sicher, Raster/Trend pausieren) gehen
  an `express.yml` (eigene Warteschlange, wartet nie hinter einem laufenden Cloud-Lauf), alles andere an `ki.yml`.
* **Live-Rückmeldung** für jeden Auftrag über die Actions-API (gesendet → angekommen → läuft → erledigt ✓ / fehlgeschlagen ✗).
  Verwirft GitHub einen Auftrag (nach ~90 s kein Lauf oder Lauf abgebrochen), schickt die App ihn automatisch noch einmal
  (Brems-Befehle bis zu 3-mal) und meldet es danach klar. Ausgeliefert über GitHub Pages: <https://athokawe.github.io/finanzen-handy/>

**Dieses Repo enthält nur die Anzeige und die Knöpfe – keine Daten, keine Schlüssel.**

## Was ist das?

* Die Zahlen liegen ausschließlich im privaten Repo `Athokawe/finanzen` (Dateien `cloud/handy.json`, `cloud/news.json` und
  `cloud/handy_verlauf.json`, die die Cloud-Läufe schreiben). Die App liest sie direkt am Handy über die GitHub-API – sie braucht den Laptop nicht.
* Befehle gehen als Cloud-Aufträge an den Ablauf `ki.yml` bzw. – Brems-Befehle – `express.yml` im privaten Repo
  (`workflow_dispatch` mit `modus` und `bestaetigung`).
  Erlaubt sind nur die Modi, die `handy.json` → `modi` nennt. Schaltbefehle brauchen ein getipptes **JA**; die App baut die
  Bestätigung (z. B. `JA;betrag=200`) aus den Formularfeldern, prüft sie gegen das Muster aus `handy.json` und erst dann geht sie
  raus. Die Cloud prüft noch einmal selbst.
* Datenvertrag: `docs/HANDY-DATEN.md` im privaten Repo.
* Reine statische Dateien (HTML/CSS/JS, kein Build-Schritt, keine fremden Skripte oder CDNs).

## Sicherheit

* **Token nur am Gerät:** Der persönliche GitHub-Token (fine-grained, nur `Athokawe/finanzen`, Contents read-only, Actions read
  and write) wird nie angezeigt und liegt nur verschlüsselt in `localStorage`: AES-GCM 256, Schlüssel per PBKDF2-SHA-256 mit
  310 000 Runden und zufälligem Salz aus der PIN (Web Crypto, Schlüssel nicht exportierbar).
* **PIN-Sperre** beim Öffnen und nach 5 Minuten im Hintergrund; **5 falsche PINs löschen den Token** (neu verbinden nötig).
  „Abmelden“ löscht Token und PIN.
* **Keine Daten am Gerät gespeichert:** Zahlen, Nachrichten, Fragen und Antworten an die KI liegen nur im Arbeitsspeicher; der Service Worker cacht nur die
  App-Hülle (HTML/CSS/JS/Icons), nie Antworten der GitHub-API.
* **Strenge Content-Security-Policy** (nur eigene Dateien, Verbindungen nur zu `api.github.com` und zum Artefakt-Speicher
  `productionresultssa0…19.blob.core.windows.net`, keine Inline-Skripte),
  `noindex`, kein Referrer. Fremde Texte (Schlagzeilen, KI-Texte) werden nur als Text angezeigt; Links nur `http(s)`, in neuem
  Fenster mit `rel="noopener noreferrer"`.
* Der Token kann kein Geld bewegen und kommt an keine anderen Repos. Grenze: Wer das entsperrte iPhone **und** die PIN hat,
  kann Aufträge schicken – darum bleibt die iPhone-Sperre die erste Schutzschicht. Eine 4–6-stellige PIN schützt den
  gespeicherten Token gegen Gelegenheits-Zugriff, nicht gegen jemanden, der den Speicher des Geräts ausliest und lange
  durchprobiert. Im Zweifel den Token auf github.com widerrufen.

## Einrichtung (am iPhone)

1. In Safari <https://athokawe.github.io/finanzen-handy/> öffnen → Teilen (□↑) → **Zum Home-Bildschirm**. Ab jetzt die App
   über das Symbol „Finanzen“ öffnen (nur so gehen Mitteilungen).
2. Token anlegen: github.com → Profilbild → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**
   * Name `Finanzen Handy`, Ablauf 1 Jahr
   * Repository access: **Only select repositories** → `Athokawe/finanzen`
   * Permissions: **Contents: Read-only**, **Actions: Read and write**, **Metadata: Read-only**
3. Token kopieren, in der App einfügen → **Verbinden** (die App testet den Abruf) → PIN mit 4–6 Ziffern festlegen.
4. Optional: Einstellungen (Zahnrad) → **Benachrichtigungen erlauben**.

Die App erklärt die Schritte beim ersten Öffnen selbst.

## Ausprobieren ohne Token (Demo)

<https://athokawe.github.io/finanzen-handy/?demo=1> zeigt erfundene Beispiel-Daten aus `demo/` (deutlich markiert). Im
Demo-Modus geht nichts an GitHub: Aufträge werden nur angezeigt („Demo – nicht gesendet“).

Lokal: `python -m http.server` in einem Ordner, der dieses Repo als Unterordner `finanzen-handy/` enthält, dann
<http://localhost:8000/finanzen-handy/?demo=1> (Web Crypto und Service Worker brauchen `localhost` oder `https`).

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `app.css` | Gerüst und Aussehen (immer dunkel wie die Laptop-App, Safe-Area fürs iPhone) |
| `konfig.js` | Repo, Ablauf, Bitpanda-Adressen, öffentlicher VAPID-Schlüssel (nicht geheim) |
| `js/app.js` | Ablauf: Verbinden → PIN → App, Sperre, Laden, Push |
| `js/tresor.js` | Token-Verschlüsselung (AES-GCM/PBKDF2) |
| `js/github.js` | GitHub-API (lesen, Aufträge, Lauf-Status), Demo-Modus |
| `js/aktionen.js` | erlaubte Modi, JA-Dialog, Bestätigung bauen/prüfen, Weg (Express/ki.yml), Live-Rückmeldung und Neu-Senden |
| `js/ansichten.js` | die Reiter |
| `js/kifrage.js` | „An die KI“: schwebender Knopf, Eingabe-Blatt, Senden, Live-Status, Antworten (Artefakt), Rückgängig |
| `js/zip.js` | ZIP-Leser für genau eine Datei (gespeichert/deflate, CRC-Prüfung) |
| `js/alarme.js` | Alarme ausblenden und als gelesen melden (`alarme_gelesen`) |
| `js/diagramm.js` | Statistik-Diagramme (SVG, Zeiträume, Antippen, Kennzahlen) |
| `js/push.js`, `sw.js` | Web-Push-Abo, Service Worker (Hülle cachen, Mitteilungen) |
| `manifest.webmanifest`, `icons/` | Home-Bildschirm-App |

Neue Version: `APP_VERSION` in `js/app.js` und `VERSION` in `sw.js` hochzählen (alter Cache wird dann gelöscht).
