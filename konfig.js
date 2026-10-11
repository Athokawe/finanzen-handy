// Konfiguration der Handy-App. Hier steht NICHTS Geheimes.
//
// VAPID_PUBLIC_KEY: der ÖFFENTLICHE Push-Schlüssel (base64url, ca. 87 Zeichen). Er kommt aus
// „python tools/vapid_einrichten.py mailto:…“ der Finanz-App (siehe docs/HANDY-DATEN.md, Abschnitt 4) und ist nicht geheim.
// Leer = Push ist noch nicht eingerichtet (der Knopf zeigt dann „Push wird noch eingerichtet“).
export const VAPID_PUBLIC_KEY = "BBtbqMbfNFeUqOb0JW3x6m2RRzozq1oBOZjiW-MJfChblC2QS61NiRoAKI2wN6O2YGVW37QC45qCc48BVXIebRM";

// Privates Repo der Finanz-App, aus dem gelesen und an das Aufträge geschickt werden
export const REPO = "Athokawe/finanzen";
export const WORKFLOW = "ki.yml";
export const BRANCH = "main";

// Bitpanda-Adressen (ohne Zugangsdaten). SWAP_URL = dieselbe Adresse wie in den Empfehlungs-Mails (cloud_ki.SWAP_URL).
export const BITPANDA_URL = "https://web.bitpanda.com/";
export const BITPANDA_SWAP_URL = "https://web.bitpanda.com/home(modal:trade/swap)";
