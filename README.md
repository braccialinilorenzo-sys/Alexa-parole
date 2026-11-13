# Parole del mattino 🇬🇧 🇨🇳

Skill Alexa privata, in italiano: ogni giorno **una parola inglese** (livello B1/B2) e **una parola cinese** (base).

- Alexa ti presenta le due parole e ti fa una domanda: **"che cosa significa…?"** oppure **"usala in una frase"** (si alterna ogni giorno).
- Rispondi (anche "non lo so") e lei ti dà la soluzione: traduzione ed esempio.
- **Finché non rispondi, le parole restano le stesse.** Si passa alla coppia successiva solo dopo la tua risposta alla domanda sulla parola inglese. Il punto in cui sei è salvato nello storage dell'hosting Alexa (S3).
- Su **Echo Show** vedi le parole a schermo: parola, pronuncia, traduzione ed esempio (traduzione ed esempio compaiono dopo la tua risposta, per non svelare la soluzione).
- Si può avviare da una **routine** collegata alla sveglia.

## Come si usa

| Dici… | Succede |
|---|---|
| "Alexa, apri parole del mattino" | parte la lezione del giorno |
| una risposta, es. "significa raggiungere" | Alexa corregge e dà la soluzione |
| "non lo so" / "passo" | Alexa dà la soluzione (conta come risposta) |
| "ripeti" | ripete l'ultima cosa detta |
| "a che punto sono" | quante coppie hai completato |
| "stop" | esce; se non avevi risposto, la prossima volta ritrovi le stesse parole |

## Modificare le parole

Le liste sono due file di testo, una parola per riga, campi separati da ` | `:

- `lambda/parole/inglese.txt` → `parola | pronuncia | traduzione | esempio | traduzione esempio`
- `lambda/parole/cinese.txt` → `hanzi | pinyin | pronuncia | traduzione | esempio | pinyin esempio | traduzione esempio`

Le righe che iniziano con `#` sono commenti. Traduzioni alternative separate da ` / `.
Puoi modificarle direttamente nella scheda **Code** della Alexa Developer Console e poi premere **Deploy**.
Quando arrivi in fondo a una lista, ricomincia dall'inizio.

## Impostazioni

In `lambda/impostazioni.js`:

- `VOCE_INGLESE`: voce americana per le parole inglesi (predefinita `Matthew`).
- `VOCE_CINESE`: vuota = Alexa legge la pronuncia "all'italiana"; puoi provare `Zhiyu`.
- `ALTERNA_TRADUCI_E_FRASE`: `false` per avere sempre la domanda "traduci".

## Struttura

```
lambda/                 codice della skill (Node.js, Alexa-hosted)
  index.js              logica della conversazione
  parole.js             lettura delle liste
  parole/               liste di parole (modificabili)
  apl/documento.json    schermata per Echo Show
  impostazioni.js       voci e tipo di domande
skill-package/          manifest e modello vocale (it-IT)
strumenti/genera-modello.js   rigenera il modello vocale dalle liste (facoltativo)
```
