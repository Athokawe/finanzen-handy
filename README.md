# Finanzen – Handy-Ansicht

Web-App (PWA) fürs iPhone zur privaten Finanz-App: Kern-Bot, Kern-Topf, Raster-Bot, Trend-Bot, Aktien-Autopilot und
Nachrichten auf einen Blick – plus die wichtigsten Schalter („Alles stoppen“, Bots ein/aus, Stufe, Hinweis an die KI) und
Mitteilungen (Web-Push). Ausgeliefert über GitHub Pages: <https://athokawe.github.io/finanzen-handy/>

**Dieses Repo enthält nur die Anzeige und die Knöpfe – keine Daten, keine Schlüssel.**

## Was ist das?

* Die Zahlen liegen ausschließlich im privaten Repo `Athokawe/finanzen` (Dateien `cloud/handy.json` und `cloud/news.json`, die
  die Cloud-Läufe schreiben). Die App liest sie direkt am Handy über die GitHub-API – sie braucht den Laptop nicht.
* Befehle gehen als Cloud-Aufträge an den Ablauf `ki.yml` im privaten Repo (`workflow_dispatch` mit `modus` und `bestaetigung`).
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
* **Keine Daten am Gerät gespeichert:** Zahlen und Nachrichten liegen nur im Arbeitsspeicher; der Service Worker cacht nur die
  App-Hülle (HTML/CSS/JS/Icons), nie Antworten der GitHub-API.
* **Strenge Content-Security-Policy** (nur eigene Dateien, Verbindungen nur zu `api.github.com`, keine Inline-Skripte),
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
| `index.html`, `app.css` | Gerüst und Aussehen (Hell/Dunkel nach System, Safe-Area fürs iPhone) |
| `konfig.js` | Repo, Ablauf, Bitpanda-Adressen, öffentlicher VAPID-Schlüssel (nicht geheim) |
| `js/app.js` | Ablauf: Verbinden → PIN → App, Sperre, Laden, Push |
| `js/tresor.js` | Token-Verschlüsselung (AES-GCM/PBKDF2) |
| `js/github.js` | GitHub-API (lesen, Aufträge, Lauf-Status), Demo-Modus |
| `js/aktionen.js` | erlaubte Modi, JA-Dialog, Bestätigung bauen/prüfen, Warteschlange |
| `js/ansichten.js` | die Reiter |
| `js/push.js`, `sw.js` | Web-Push-Abo, Service Worker (Hülle cachen, Mitteilungen) |
| `manifest.webmanifest`, `icons/` | Home-Bildschirm-App |

Neue Version: `APP_VERSION` in `js/app.js` und `VERSION` in `sw.js` hochzählen (alter Cache wird dann gelöscht).
