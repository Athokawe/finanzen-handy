# Finanzen – Handy-Ansicht

Web-App (PWA) fürs iPhone zur privaten Finanz-App: Gesamtvermögen, Coin-Bot, Coin-Topf, Raster-Bot, Trend-Bot,
Aktien-Autopilot und Nachrichten auf einen Blick, mit Statistik-Diagrammen – plus die wichtigsten Schalter („Alles parken“,
„Nur anhalten“, Bots ein/aus, Stufe), Fragen „An die KI“, Alarme löschen und Mitteilungen (Web-Push).

## Neu in 1.3.1

* **Aktien-KI** (braucht Finanz-App 1.3 mit Teil 2): steht der Autopilot auf „KI“, zeigt die Aktien-Karte die letzte
  Einschätzung der KI – Entscheidung, Zuversicht, Ziel (z. B. „Welt-ETF 60 %, NVIDIA 20 %, Euro 20 %“) und „einfach erklärt“.
  Die Rückfrage beim Wählen von „KI“ nennt jetzt auch den Aktien-Teil; „Regeln“ von „KI“ aus sagt dazu, dass die Aktien der KI
  liegen bleiben (Geparktes legt der Regel-Autopilot wieder im Welt-ETF an). Ohne Aktien-KI in der Cloud (ältere Finanz-App) bleibt alles wie in 1.3.

## Neu in 1.3

* **Autopilot-Wahlschalter „KI · Regeln · Aus“** auf der Übersicht, beim Coin-Bot und bei den Aktien – ein Schalter für
  Krypto und Aktien, genau eine Stellung ist aktiv:
  * **KI** – der KI-Autopilot steuert (die festen Regeln laufen als Sicherheitsnetz mit); nur mit JA.
  * **Regeln** – der Regel-Autopilot steuert (Regelwerk mit Notbremse und Gewinnschutz, Aktien-Autopilot); aus „Aus“ mit JA,
    von „KI“ aus ohne JA (die Regeln laufen schon).
  * **Aus** – alles angehalten, nichts wird verkauft; ohne JA, als Express-Bremse.
  Die Bots behalten ihre Namen (Coin-Bot, Raster-Bot, Trend-Bot); ihr Stand zeigt sich an der Schalterstellung. Jede Stellung
  ist EIN Auftrag an die Cloud (braucht Finanz-App 1.3; mit einer älteren Cloud bleiben die bisherigen Knöpfe).
* Enthält 1.2.24 (Aktien-Karte ohne „Gewinnschutz“).

## Neu in 1.2.24

* Aktien-Karte ohne die Zeile „Gewinnschutz“ und ohne den Knopf „Gewinnschutz ein/aus“: Den Gewinnschutz für Aktien und den
  Welt-ETF gibt es in der Cloud nicht mehr (er wirkte seit „Faber 12 halb“ ohnehin nicht). Die Absicherung des Welt-ETF steht
  weiter in der Lage-Karte unter dem Aktien-Autopiloten. Alles zum Krypto-Schutz („Alles parken“, Notbremse, Gewinnschutz
  Krypto) bleibt, wie es ist.

## Neu in 1.2.23

* Inhalt wie 1.2.21: Raster- und Trend-Bot mit eigenen Reitern bleiben (1.2.22 hatte sie irrtümlich entfernt). Neue
  Versionsnummer, damit das iPhone den Zwischenspeicher erneuert. Die Zeile „Aktien-KI einfach erklärt“ ist weg (die Cloud
  liefert seit 17.10.2026 keine Aktien-KI mehr).

## Neu in 1.2.21

* **Längere PIN für mehr Sicherheit:** Neue PINs haben jetzt 6 bis 8 Ziffern. Hast du noch eine kürzere PIN, funktioniert sie weiter – in den Einstellungen steht dann oben die Empfehlung „PIN auf 6 Stellen ändern“ mit dem Knopf **PIN ändern** (bisherige PIN, neue PIN zweimal). Warum: Kopiert jemand den Speicher des iPhones, sind 4 Stellen in Minuten durchprobierbar, 6 Stellen erst in Stunden bis Tagen. Am bequemsten und sichersten ist Face ID.
* **Face ID nach dem PIN-Wechsel neu einrichten:** Face ID hängt an der alten PIN-Verschlüsselung. Beim PIN-Ändern entfernt die App Face ID deshalb sauber und bittet dich, es neu einzurichten.
* **Stärkere Verschlüsselung:** Neu gespeicherte Tokens werden mit 600 000 statt 310 000 Rechenrunden aus der PIN geschützt (ältere bleiben lesbar und bekommen die neuen Runden beim nächsten PIN-Ändern).
* **Gewinnschutz-Karte ehrlicher:** Ist der Gewinnschutz ausgeschaltet und würde sonst auslösen, steht dort „Würde parken (Schalter aus)“ statt „Ausgelöst: ja“.
* **Kleine Schutz-Verbesserungen:** Die App läuft nicht mehr eingebettet in einer fremden Seite. „Benachrichtigungen“ wartet nur noch hinter einem normalen Auftrag (nicht hinter einer Bremse) und meldet sich immer zurück. Ein Knopf ohne Rückfrage schickt nie ein „JA“ von selbst.
* Beispiel-Daten (Demo) ohne Zeiten in der Zukunft.

## Neu in 1.2.20

* **Abgebrochene Läufe sicherer erkannt:** Ob ein Auftrag in der Cloud schon lief, erkennt die App jetzt auch an den Schritten des Laufs – auch wenn sie den Zustand „läuft gerade“ im Hintergrund verpasst hat. Ein schon gestarteter, dann abgebrochener Lauf wird nie automatisch neu gesendet (außer Brems-Befehlen).

## Neu in 1.2.19

* **Kurze Übersicht:** Beim Öffnen zeigt jede Rubrik (Gesamtvermögen, Coin-Topf, Raster-Bot, Trend-Bot, Schattendepots, Aktien) nur Status und aktuellen Stand; „mehr“ klappt die Details auf (Aufteilung, Verlauf, Positionen, Knöpfe), „weniger“ wieder zu. Aufgeklappt bleibt aufgeklappt, solange die App offen ist; nach dem Sperren ist alles wieder kurz.
* **Alarme:** die neuesten drei, der Rest unter „mehr (n weitere)“.
* **Nachrichten:** je Rubrik die neueste Schlagzeile, der Rest und „Stand deiner Bots“ unter „mehr“; lange KI-Texte zeigen zuerst den ersten Satz.
* Immer sichtbar bleiben „Alles parken“/„Nur anhalten“ (die Erklärung „Sinnvoll, wenn …“ unter „wann sinnvoll?“), ein aktiver KI-Vorschlag und unklare Aufträge.

## Neu in 1.2.18

* **Auftrag klären:** Hat der Raster- oder Trend-Bot einen Auftrag mit unklarem Ausgang (Alarm „BITTE PRÜFEN“), steht oben auf seiner Seite die Karte „Aufträge mit unklarem Ausgang“ mit „Klären“: im Dialog die Fusion-Order-ID eintragen (ausgeführt) oder „nie ausgeführt – verwerfen“ wählen, dann JA (Modus `order_klaeren`). Die Cloud prüft Paar, Seite, Menge und Zeit; es wird nie eine Order gesendet.
* **Geld-Aufträge nie doppelt:** Umschichten, „Teil zurück“, Einschalten mit Betrag und Betrag ändern gehen nicht mehr automatisch ein zweites Mal an GitHub – weder wenn der Lauf erst spät erscheint noch wenn ein schon gestarteter Lauf abgebrochen wird. Stattdessen die Meldung „Ausgang unklar – bitte nachsehen“. Brems-Befehle werden wie bisher bis zu 3-mal neu gesendet.
* **Statistik der Bot-Seiten:** zeigt den echten Topf nur, solange der Bot echt läuft – sonst wieder das laufende Schattendepot (vorher verdrängten drei alte Echt-Punkte vom 11.10. es dauerhaft).

## Neu in 1.2.17

* **Alle Schattendepots an einem Ort:** Auf der Übersicht die Karte „Schattendepots“ (`handy.json` `schattendepots`): jedes laufende Schattendepot (nur Rechengeld) als aufklappbarer Punkt – Coin-Bot (Rückkauf einfach, heutige Regeln, Regeln alt/neu), Welt-ETF, Trend-Bot (heutige Regeln, „straff“) und Raster-Bot. Die Cloud vergleicht automatisch mit der Referenz ab einem gemeinsamen Startpunkt; das Urteil („zu früh“, „gleichauf“, „vorne“, „klar vorne“ …) steht schon in der Kopfzeile, bei „klar vorne/hinten“ kommt ein Push.

## Neu in 1.2.16

* **Zweites Schattendepot „straff“:** Auf der Trend-Seite unter dem bisherigen Schattendepot die Karte „Schattendepot neu („straff“)“ (`handy.json` `trend_bot.schatten_straff`): die schnellere Regel aus dem Backtest mit Rechengeld – Wert gegen „Bitcoin halten“ und das alte Schattendepot, Positionen, letzte Trades; auf der Übersicht eine Zeile in der Trend-Karte.

## Neu in 1.2.15

* **Einschalten direkt auf der Übersicht:** Die Karten Raster-Bot und Trend-Bot haben jetzt dieselben Knöpfe wie die Bot-Seiten („Einschalten“ bzw. „Wieder einschalten“, „Pausieren“, „Ausschalten“ – Dialog mit JA). Ist ein Bot aus, steht darüber der freie Rest unter dem 50-%-Deckel.

## Neu in 1.2.14

* **KI-Einschätzung auch auf der Übersicht:** In den Karten Raster-Bot und Trend-Bot steht eine Zeile „KI: so lassen – …“ bzw. „KI: mit 120 € einschalten – …“ (aus `<bot>.ki_vorschlag`), auch wenn die KI nichts vorschlägt.

## Neu in 1.2.13

* **KI-Vorschläge für Trend- und Raster-Bot (Paket E):** Auf der Raster- und der Trend-Seite steht unter der Lage die Karte „KI-Vorschlag“ bzw. „KI-Einschätzung“ (`handy.json` `<bot>.ki_vorschlag`): einschalten (mit Betrag), pausieren, ausschalten oder so lassen – mit Begründung. „Vorschlag übernehmen …“ öffnet den bekannten Dialog mit vorausgefülltem Betrag und JA; ohne JA passiert nichts. Ein aktiver Vorschlag erscheint auch auf der Übersicht, dazu der freie Rest unter dem 50-%-Deckel (`bot_deckel`). Push kommt aus der Cloud nur, wenn sich der Vorschlag ändert.

## Neu in 1.2.12

* **Aktien & ETFs weiter unten:** Auf der Übersicht stehen der Aktien-Autopilot und seine Lage-Karte jetzt unter dem Krypto-Teil (Coin-Topf, Raster-Bot, Trend-Bot), direkt vor „Letzte Alarme“ – langfristig angelegtes Geld, das man am seltensten anschaut.

## Neu in 1.2.11

* **Lagebericht je Bot:** oben auf Coin-Bot, Raster und Trend eine Karte „Lage – warum es gerade so ist“ (kurze Sätze aus `handy.json` `<bot>.lage`, von der Cloud regelbasiert gerechnet); beim Aktien-Autopiloten auf der Übersicht eingeklappt. Fehlt der Block (ältere Cloud), gibt es keine Karte.

## Neu in 1.2.10

* **„An die KI“ ganz oben:** Auf der Übersicht steht als Erstes ein Eingabefeld. Enter oder „Senden“ schickt die Frage (gleiche Prüfung wie im Blatt) und öffnet das Blatt mit Status und Antworten. Der Knopf 💬 unten rechts bleibt.

## Neu in 1.2.9

* **Face ID startet von selbst:** Zeigt die App den Sperrbildschirm (beim Öffnen, nach 5 Minuten im Hintergrund, beim
  Zurückkehren in die gesperrte App) und ist Face ID eingerichtet, fragt sie Face ID **einmal automatisch** an – nur bei
  sichtbarer Seite. Nach „Jetzt sperren“ bewusst nicht (sonst wäre die App sofort wieder offen). Der Tipp auf
  „Mit Face ID entsperren“ entfällt dann; das iOS-Blatt „Mit Passkey anmelden“ selbst kommt weiter von iOS. Lässt iOS die Anfrage
  ohne Tipp nicht zu (oder bricht sie sofort ab), bleibt **still** der bisherige Knopf – ohne Fehlermeldung, ohne Zähler.
* Brichst du das iOS-Blatt ab, startet Face ID in derselben Sperre nicht noch einmal von selbst (erst wieder nach erneutem
  Sperren/Öffnen). Kommst du gesperrt aus dem Hintergrund zurück, gibt es wieder einen automatischen Versuch – aber nicht, wenn
  nur das Face-ID-Blatt die Seite kurz verdeckt hat (keine Endlosschleife).
* Nie zwei Face-ID-Anfragen gleichzeitig: die laufende Anfrage wird gemerkt und beim Entsperren mit der PIN, beim Neu-Verbinden
  und beim Verlassen der Seite abgebrochen (`AbortController`).

## Neu in 1.2.8

* **Mit Face ID entsperren** (optional): Einstellungen → Karte „Face ID“ → **Face ID einrichten** (nur sichtbar, wenn das Gerät
  einen Plattform-Authenticator mit Nutzerprüfung hat, also Face ID für Passkeys; und nur in der entsperrten App). Zuerst
  fragt die App die **App-PIN** ab (eine falsche zählt wie beim Entsperren, 5 löschen den Token) – wer nur das kurz entsperrte
  iPhone und den iPhone-Code hat, kann Face ID also nicht einrichten; in den Umschlag kommt genau der mit dieser PIN
  entschlüsselte Token. Danach startet ein eigener Knopf „Weiter mit Face ID“ (iOS erlaubt das Anlegen nur direkt im Tipp).
  Das iPhone legt einen Passkey für `athokawe.github.io` an (WebAuthn, `residentKey`/`userVerification`
  required, Plattform-Authenticator, ES256/RS256) mit der Erweiterung **PRF**: nach Face ID liefert der Passkey 32 geheime Bytes
  zu einem zufälligen Salz. Daraus wird per HKDF-SHA-256 (info `finanzen-handy-faceid-v1`) ein nicht exportierbarer
  AES-GCM-256-Schlüssel, mit dem der Token **zusätzlich** in einem zweiten Umschlag verschlüsselt wird (`localStorage`
  `fh_faceid_v1`: Credential-ID, PRF-Salz, iv, Chiffrat, Kennung des PIN-Tresors, Version, Datum – kein Klartext, nie die
  PRF-Ausgabe oder der Schlüssel). Liefert `create()` noch keine PRF-Ausgabe (iOS teils erst bei `get()`), holt die App sie
  gleich mit demselben Passkey; lässt iOS das ohne neuen Tipp nicht zu, kommt „Noch ein Schritt“ mit Knopf.
* **Entsperren:** Ist Face ID eingerichtet, zeigt der Sperrbildschirm zuerst **„Mit Face ID entsperren“** (ein Knopf – iOS
  verlangt für Passkeys einen Tipp), die PIN steht darunter. Abgebrochen, nicht erkannt, kein Schlüssel oder Umschlag passt
  nicht → klare Meldung, PIN. **Fehlversuche mit Face ID zählen nicht zu den 5 PIN-Fehlversuchen**; ein erfolgreiches Face ID
  unterbricht die Folge falscher PINs (Zähler auf 0). Ein Umschlag, der sich nicht entschlüsseln lässt, wird gelöscht.
* **Kein PRF (älteres iOS) → kein Face ID:** keine schwächere Variante ohne Verschlüsselung; Hinweis „auf diesem Gerät nicht
  möglich – die PIN bleibt“ (nach einem iOS-Update wird es wieder angeboten).
* **Face ID entfernen** löscht nur den zweiten Umschlag. Der Passkey bleibt im iCloud-Schlüsselbund – löschen in der App
  „Passwörter“ (älteres iOS: Einstellungen → Passwörter) → `athokawe.github.io` → „Finanzen Handy …“. Abmelden, „PIN vergessen
  – neu verbinden“ und 5 falsche PINs löschen den Umschlag mit; ein neuer Token/PIN-Tresor macht ihn ungültig (fail-closed:
  der Umschlag ist an die Kennung des PIN-Tresors gebunden, auch über die „additional data“ von AES-GCM).
* Ehrlich: Face ID ersetzt nur die PIN-Eingabe, der Token bleibt verschlüsselt auf dem iPhone, das Gesicht verlässt das iPhone
  nie (die App bekommt nur den Schlüssel des Passkeys), der Passkey wird über den iCloud-Schlüsselbund synchronisiert (ohne den
  Umschlag auf diesem iPhone öffnet er nichts). Erkennt Face ID dich nicht, bietet iOS den iPhone-Code an – wer ihn kennt, kommt
  damit auch in die App. Neues Modul `js/faceid.js`; der PIN-Tresor (`js/tresor.js`, Format v1) bleibt unverändert.

## Neu in 1.2.7

* **Bitpanda-Links öffnen die Bitpanda-App** statt Safari (dort nervten Passwort und 2FA): „Zu Bitpanda“ → `/home`,
  „Einzahlen“ → `/trade/deposit`, „Tauschen bei Bitpanda“ → `/trade/swap`, neu „Zu Fusion“ (Raster- und Trend-Ansicht, dort
  handeln die Bots) → `/fusion` (`konfig.js`). Nur solche Pfade stehen in Bitpandas
  `apple-app-site-association` – die nackte Adresse `https://web.bitpanda.com/` und die alte Swap-Adresse
  `/home(modal:trade/swap)` nicht. Coin-Links gehen auf `/home` (`/asset/…` ist freigegeben, das Pfadformat aber nicht belegt).
  Echte Links (`<a href>`), keine Weiterleitung per JavaScript – nur dann greift ein Universal Link. Hinweis unter den Knöpfen:
  „falls Safari kommt: Link lange drücken → ‚In Bitpanda öffnen‘“. Die Laptop-App und die Mails bleiben, wie sie sind.
* **Bremsknöpfe besser erklärt:** unter „Alles parken“ und „Nur anhalten“ (und in der Rückfrage) steht in Stichworten, wann
  welcher Knopf sinnvoll ist und was er kostet – gleiche Worte wie in der Laptop-App.
* **„Letzte Trades“ und „Ereignisse“ ausblenden** (Raster- und Trend-Bot): ✕ je Eintrag (sofort) und „Liste leeren“ (mit
  Rückfrage, nur bis zum neuesten **gesehenen** Eintrag). Nichts wird gelöscht – Trades sind Buchhaltung. Auftrag `ki.yml` Modus
  `liste_ausblenden` ohne JA (`bot=trend|raster;liste=trades|ereignisse;ids=<ausblend_id>,…` bzw. `ids=alle;bis=<Unix-Sekunden>`),
  die Cloud merkt es in `cloud/ausgeblendet.json`, beide Apps zeigen danach dasselbe; neue Einträge erscheinen wieder. Läuft
  gerade ein anderer Auftrag, sammelt die App die Klicks und schickt sie gebündelt, sobald die Warteschlange frei ist
  (`js/ausblenden.js`, wie bei den Alarmen). „n ausgeblendet (nicht gelöscht)“ unter der Liste. Ältere Cloud ohne den Modus:
  keine ✕, alles wie bisher.
* **Gesamtvermögen mit freiem Euro-Guthaben:** eigene Zeile „Euro-Guthaben“ (türkis im Balken) aus `gesamt.euro_eur`, sobald die
  Cloud es kennt (`euro_bekannt`); der Vermerk „ohne freies Euro-Guthaben“ steht nur noch, solange es unbekannt ist (auch bei
  älterer Cloud). Damit stimmt die Summe mit Bitpanda überein.

## Neu in 1.2.6

* **News mit Einordnung:** oben im Reiter „News“ die Karte „Gesamtbild“ (z. B. „leicht belastend für Bitcoin, neutral für den
  Welt-ETF“), ob eine Bot-Regel kurz vor dem Auslösen steht (oder dass ein Abstand gerade nicht berechenbar war, z. B. ohne
  frische Kursdaten – dann nie „kein Handlungsbedarf“), „Stand deiner Bots“ (Coin-Bot: Notbremse-Abstand, Gewinnschutz-Grenze;
  Trend-Bot: Markt-Ampel, 50-Tage-Linie; Raster-Bot; Aktien-Autopilot) und der Hinweis, dass das eine Einschätzung ist und nur nach den Regeln der Bots oder nach deinem JA gehandelt wird. Unter jeder wichtigen Meldung kleine
  Etiketten (🟢 stützend / 🔴 belastend / ⚪ neutral, Stärke, kurzfristig (Tage) / langfristig (Monate), betroffenes Objekt) und
  die Zeile „Für deine Bots: …“. Die Zahlen darin rechnet die Cloud aus dem gespeicherten Stand der Bots, nicht die KI.
* Felder `zusammenfassung.wichtigste[].einordnung`, `zusammenfassung.gesamtbild` und `bot_lage` in `cloud/news.json` (Finanz-App,
  `news.py`) – alle optional: eine ältere `news.json` ohne sie zeigt die App wie bisher. Nur bekannte Werte werden als Etikett
  gezeigt, alle Texte als Text (nie als HTML).

## Neu in 1.2.4

* **Zwischen den Bots umschichten:** in der Trend-Ansicht „Zum Raster-Bot umschichten“, in der Raster-Ansicht „Zum Trend-Bot
  umschichten“ – Betrag in Euro oder „Alles umschichten“ (der abgebende Bot geht danach aus), beim Raster-Bot zusätzlich
  „Sofort“ (auch Stufen im Minus verkaufen). Mit getipptem JA, Auftrag `ki.yml` Modus `bot_umschichten`
  (`JA;von=trend|raster;nach=…;betrag=…` bzw. `;alles=JA`, `;sofort=JA` nur vom Raster-Bot). Keine Bitcoin-Order: das Geld
  wird direkt von Topf zu Topf umgebucht. Der Dialog sagt, was mit dem anderen Bot passiert (aus → wird eingeschaltet,
  pausiert → bleibt pausiert; Trend-Bot an → stockt bei grüner Markt-Ampel sofort auf, bei roter bleibt das Geld als EURCV im
  Topf). Jeder Auftrag bewegt den Betrag erneut – während einer läuft, nimmt die App keinen zweiten an. Die Knöpfe erscheinen nur, wenn die Cloud den Modus in `handy.json` → `modi` anbietet und der
  abgebende Bot nicht aus ist.

## Neu in 1.2.3

* **Gesamtvermögen mit allen Töpfen:** Coin-Topf + echter Trend-Topf + echter Raster-Topf + Aktien & ETFs (+ Aktien-Reserve,
  wenn > 0) – wie `gesamt` in `cloud/handy.json` (Finanz-App, `handy.gesamt_teil`). Ein Bot-Topf erscheint nur, wenn er echtes
  Geld hält (Trend-Bot im Modus „echt“, Raster-Bot an/pausiert oder mit Einsatz); Schattendepots zählen nie. Jeder Teil hat eine
  eigene Farbe im Anteil-Balken und eine eigene Zeile (Trend-Topf violett, Raster-Topf gelb, Aktien-Reserve hellblau); der
  Hinweis „ohne Raster-/Trend-Topf und Aktien-Reserve“ ist weg. Eine Umbuchung zwischen Töpfen ändert die Summe nicht mehr.
* **Statistik:** die Linie „Gesamt“ nimmt `gesamt_eur` aus `cloud/handy_verlauf.json` (seit `gesamt_def` 2 inkl. Bot-Töpfe –
  der falsche Absturz am 11.10.2026 ist weg); Punkte ohne Wert (Lücke) zählen weder für die Linie noch für Veränderung, Höchst
  und Tiefst. Zusätzliche Linien „Trend-Topf“ / „Raster-Topf“, sobald der Zeitraum echte Werte hat.
* Ältere Cloud ohne die neuen Felder: die App rechnet die echten Bot-Töpfe nach derselben Regel aus `trend_bot`/`raster_bot`
  dazu (die Aktien-Reserve fehlt dann – Hinweis „ohne Aktien-Reserve“).
* **Umbuchung im selben Lauf:** hat ein Bot nach dem Bilanz-Punkt Geld aus dem Coin-Topf geholt oder zurückgegeben (z. B.
  „Alles parken“), meldet die Cloud `vollstaendig: false` mit Grund – die Karte zeigt „unvollständig (Umbuchung – Coin-Topf folgt
  im nächsten Lauf)“ und „Coin-Topf (geschätzt)“, der Verlauf eine Lücke statt einer Spitze bzw. eines Knicks.
* **„ohne freies Euro-Guthaben“** unter der Summe: frisch eingezahltes Euro zählt erst, wenn es investiert ist – die
  Laptop-Übersicht zählt es sofort mit und zeigt nach einer Einzahlung daher mehr.

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
  600 000 Runden (ab 1.2.21; ältere Tresore tragen ihre 310 000 Runden selbst und bleiben lesbar) und zufälligem Salz aus der PIN
  (Web Crypto, Schlüssel nicht exportierbar).
* **PIN:** neue PINs 6 bis 8 Ziffern; ältere 4–5-stellige PINs entsperren weiter, die Einstellungen empfehlen dann „PIN auf 6 Stellen
  ändern“. Ob die PIN kurz ist, steht nur als Merker (`kurz`: ja/nein) im Tresor – nie die PIN selbst.
* **PIN-Sperre** beim Öffnen und nach 5 Minuten im Hintergrund; **5 falsche PINs löschen den Token** (neu verbinden nötig).
  „Abmelden“ löscht Token und PIN (und Face ID).
* **Face ID (optional, ab 1.2.8):** zweiter Umschlag für den Token, Schlüssel per HKDF-SHA-256 aus der PRF-Ausgabe eines
  Passkeys (Face ID), AES-GCM 256, nicht exportierbar. Ohne PRF kein Face ID. Die PIN bleibt immer der Rückfall.
* **Keine Daten am Gerät gespeichert:** Zahlen, Nachrichten, Fragen und Antworten an die KI liegen nur im Arbeitsspeicher; der Service Worker cacht nur die
  App-Hülle (HTML/CSS/JS/Icons), nie Antworten der GitHub-API.
* **Strenge Content-Security-Policy** (nur eigene Dateien, Verbindungen nur zu `api.github.com` und zum Artefakt-Speicher
  `productionresultssa0…19.blob.core.windows.net`, keine Inline-Skripte),
  `noindex`, kein Referrer. Fremde Texte (Schlagzeilen, KI-Texte) werden nur als Text angezeigt; Links nur `http(s)`, in neuem
  Fenster mit `rel="noopener noreferrer"`.
* Der Token kommt an keine anderen Repos. Er kann aber Cloud-Aufträge starten, die Geld bewegen (Bots einschalten, umschichten, Teil zurück, und über die alten GitHub-Abläufe auch nachkaufen/umschichten) – die Cloud führt solche Aufträge nur mit wörtlich getipptem JA aus. Grenze: Wer das entsperrte iPhone **und** die PIN hat,
  kann Aufträge schicken – darum bleibt die iPhone-Sperre die erste Schutzschicht. Ehrlich: Die Sperre nach 5 falschen PINs gilt
  nur in der App. Kopiert jemand den Speicher des Geräts (z. B. aus einem unverschlüsselten Backup), sind **4 Stellen in Minuten
  durchprobierbar, 6 Stellen in Stunden bis Tagen**. **Face ID ist der empfohlene Weg.** Im Zweifel den Token auf github.com
  widerrufen.
* **Eigene Seite, kein iframe:** Läuft die App eingebettet in einer fremden Seite, zeigt sie nur „Diese App läuft nur als eigene
  Seite.“ (ohne Verbinden-Schirm, ohne Token-Feld).
* **Regel für das GitHub-Konto:** Alle GitHub-Pages-Seiten eines Kontos teilen sich dieselbe Herkunft
  (`https://athokawe.github.io`) – also auch `localStorage` (Tresor, Face-ID-Umschlag) und die Passkey-Domain. Darum **auf dem
  GitHub-Konto Athokawe keine weitere GitHub-Pages-Seite veröffentlichen.** Dauerhaft lösen ließe sich das nur mit einer eigenen
  Domain (CNAME) nur für diese App; im Code der App geht es nicht.

## Einrichtung (am iPhone)

1. In Safari <https://athokawe.github.io/finanzen-handy/> öffnen → Teilen (□↑) → **Zum Home-Bildschirm**. Ab jetzt die App
   über das Symbol „Finanzen“ öffnen (nur so gehen Mitteilungen).
2. Token anlegen: github.com → Profilbild → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**
   * Name `Finanzen Handy`, Ablauf 1 Jahr
   * Repository access: **Only select repositories** → `Athokawe/finanzen`
   * Permissions: **Contents: Read-only**, **Actions: Read and write**, **Metadata: Read-only**
3. Token kopieren, in der App einfügen → **Verbinden** (die App testet den Abruf) → PIN mit 6–8 Ziffern festlegen.
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
| `js/faceid.js` | Face ID: Passkey mit PRF, zweiter Umschlag (HKDF → AES-GCM), Einrichten/Entsperren/Entfernen |
| `js/github.js` | GitHub-API (lesen, Aufträge, Lauf-Status), Demo-Modus |
| `js/aktionen.js` | erlaubte Modi, JA-Dialog, Bestätigung bauen/prüfen, Weg (Express/ki.yml), Live-Rückmeldung und Neu-Senden |
| `js/ansichten.js` | die Reiter |
| `js/kifrage.js` | „An die KI“: schwebender Knopf, Eingabe-Blatt, Senden, Live-Status, Antworten (Artefakt), Rückgängig |
| `js/zip.js` | ZIP-Leser für genau eine Datei (gespeichert/deflate, CRC-Prüfung) |
| `js/alarme.js` | Alarme ausblenden und als gelesen melden (`alarme_gelesen`) |
| `js/ausblenden.js` | „Letzte Trades“/„Ereignisse“ ausblenden (`liste_ausblenden`, nie löschen) |
| `js/diagramm.js` | Statistik-Diagramme (SVG, Zeiträume, Antippen, Kennzahlen) |
| `js/push.js`, `sw.js` | Web-Push-Abo, Service Worker (Hülle cachen, Mitteilungen) |
| `manifest.webmanifest`, `icons/` | Home-Bildschirm-App |

Neue Version: `APP_VERSION` in `js/app.js` und `VERSION` in `sw.js` hochzählen (alter Cache wird dann gelöscht).
