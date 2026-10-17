// Konfiguration der Handy-App. Hier steht NICHTS Geheimes.
//
// VAPID_PUBLIC_KEY: der ÖFFENTLICHE Push-Schlüssel (base64url, ca. 87 Zeichen). Er kommt aus
// „python tools/vapid_einrichten.py mailto:…“ der Finanz-App (siehe docs/HANDY-DATEN.md, Abschnitt 4) und ist nicht geheim.
// Leer = Push ist noch nicht eingerichtet (der Knopf zeigt dann „Push wird noch eingerichtet“).
export const VAPID_PUBLIC_KEY = "BBtbqMbfNFeUqOb0JW3x6m2RRzozq1oBOZjiW-MJfChblC2QS61NiRoAKI2wN6O2YGVW37QC45qCc48BVXIebRM";

// Privates Repo der Finanz-App, aus dem gelesen und an das Aufträge geschickt werden
export const REPO = "Athokawe/finanzen";
export const WORKFLOW = "ki.yml";
// Express-Bremse (1.1.0): Brems-Befehle laufen über einen eigenen Ablauf mit eigener Warteschlange (wartet nie hinter ki.yml)
export const EXPRESS_WORKFLOW = "express.yml";
export const BRANCH = "main";

// Bitpanda-Adressen (ohne Zugangsdaten). 1.2.5: nur Pfade aus Bitpandas apple-app-site-association
// (https://web.bitpanda.com/.well-known/apple-app-site-association, „applinks“: u. a. /home, /trade/deposit, /trade/swap, /fusion) –
// nur die öffnen am iPhone als Universal Link direkt die Bitpanda-App (ohne Passwort + 2FA in Safari). Die nackte Wurzel „/“ und
// die alte Swap-Adresse „/home(modal:trade/swap)“ stehen dort nicht. Universal Links greifen nur beim Antippen eines echten Links
// (<a href>, js/dom.js aussenLink), nie bei einer Weiterleitung per JavaScript. Die Laptop-App und die Mails bleiben, wie sie sind.
export const BITPANDA_URL = "https://web.bitpanda.com/home";
export const BITPANDA_EINZAHLEN_URL = "https://web.bitpanda.com/trade/deposit";
export const BITPANDA_SWAP_URL = "https://web.bitpanda.com/trade/swap";
// Coin-Links: „/asset/*“ ist zwar freigegeben, das Pfadformat (Kürzel oder interne Nummer) aber nicht belegt -> BITPANDA_URL
