# Gestore Esami

App web (PWA) per gestire i voti degli esami universitari: un corso per ogni
anno accademico, appelli, elenco studenti, voto scritto (anche letto tramite
fotocamera con OCR) e voto orale. Funziona da telefono (installabile come
app), tablet e PC con lo stesso codice e lo stesso account.

## Architettura

| Livello | Scelta | Perché |
|---|---|---|
| Frontend | React + TypeScript + Vite, PWA (`vite-plugin-pwa`) | Un solo codebase per telefono/tablet/PC; installabile su home screen senza passare dagli store |
| Backend/DB | [Supabase](https://supabase.com) (Postgres) | Tier gratuito generoso, autenticazione integrata, Row Level Security per isolare i dati di ogni docente |
| OCR | [Tesseract.js](https://github.com/naptha/tesseract.js) (client-side) | Gratuito, nessuna chiave API, gira interamente nel browser/telefono |
| Lettura QR | `jsqr` | Riconosce automaticamente corso/appello dal template stampato |

Struttura dati (`supabase/schema.sql`): `courses` (corso + anno accademico) →
`appelli` (sessioni d'esame) e `students` (iscritti al corso) → `grades`
(voto scritto, lode, voto orale, per coppia studente/appello).

## 1. Creare il progetto Supabase (gratuito)

1. Vai su supabase.com, crea un account e un nuovo progetto (piano Free).
2. Nel progetto, apri **SQL Editor**, incolla il contenuto di
   `supabase/schema.sql` ed eseguilo: crea tabelle, indici e le policy di
   Row Level Security (ogni docente vede solo i propri corsi).
3. In **Authentication → Providers** verifica che *Email* sia abilitato. Per
   semplicità l'app usa il login "magic link" (nessuna password da
   ricordare): l'utente riceve un'email con un link di accesso.
4. In **Project Settings → API** copia `Project URL` e `anon public key`.

## 2. Configurare l'app

```bash
cp .env.example .env
# incolla URL e anon key nel file .env
npm install
npm run dev
```

Apri l'indirizzo mostrato (es. `http://localhost:5173`) da telefono e PC
sulla stessa rete per provare l'app su più dispositivi.

## 3. Deploy gratuito

Qualsiasi hosting statico va bene (Vercel, Netlify, Cloudflare Pages, tutti
con piano gratuito). Esempio con Vercel:

1. Pusha il repository su GitHub (già fatto se stai leggendo questo file da lì).
2. Su vercel.com → "New Project" → importa il repository.
3. Framework preset: Vite. Build command: `npm run build`, output: `dist`.
4. Aggiungi le variabili d'ambiente `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` nelle impostazioni del progetto Vercel.
5. Deploy. L'URL pubblico è servito in HTTPS, requisito necessario per
   usare la fotocamera dal browser.

### Installare l'app sul telefono/tablet/PC

Apri l'URL pubblico e usa "Aggiungi a schermata Home" (Android/Chrome,
iOS/Safari) o l'icona di installazione nella barra indirizzi (Chrome/Edge
desktop). L'app si comporta come un'app nativa, con icona propria.

## 4. Il flusso di scansione del compito

1. Dalla pagina di un corso, apri **Stampa template compiti** per l'appello
   corrente: genera un foglio con QR univoco (corso+appello), un riquadro
   "COGNOME E NOME" a caselle (una lettera per casella) e un riquadro
   "VOTO" a 2 caselle riservato al docente. Stampane una copia per
   studente.
2. Dopo la correzione, apri **Scansiona compito**, scatta/carica la foto
   dell'intero foglio.
3. L'app legge il QR per identificare automaticamente corso e appello (se
   non lo trova, li seleziona manualmente).
4. Vengono chieste due semplici inquadrature (pan/zoom sulla foto): prima
   il riquadro nome, poi il riquadro voto. Su ciascuna gira l'OCR con un
   dizionario di caratteri ristretto (solo lettere per il nome, solo cifre
   per il voto), che aumenta molto l'accuratezza.
5. **Il docente rivede sempre il risultato prima di salvare**: i campi
   cognome, nome e voto sono precompilati ma modificabili. Se il nome
   corrisponde a uno studente già presente nel corso, il voto viene
   associato a quello; altrimenti viene creato un nuovo studente.

Il voto orale si inserisce invece manualmente nella tabella del corso (non
richiede scansione).

### Limiti noti dell'OCR

Il riconoscimento di scrittura a mano libera è intrinsecamente impreciso:
per questo il template usa caselle a carattere singolo in stampatello
(prassi consueta nei moduli a lettura ottica/OMR, molto più affidabile del
testo corsivo libero) e l'app richiede sempre una conferma umana prima di
scrivere sul "registro" — l'OCR è un acceleratore, non un sostituto del
controllo del docente.

## Note tecniche e riferimenti

- Motore OCR: Tesseract, descritto in R. Smith, *"An Overview of the
  Tesseract OCR Engine"*, Proc. ICDAR 2007 — usato qui via il binding
  WebAssembly `tesseract.js`, eseguito interamente lato client.
- Row Level Security per l'isolamento dati multi-utente: documentazione
  Supabase/Postgres su RLS (supabase.com/docs/guides/database/postgres/row-level-security).
- Installabilità multi-piattaforma: specifica W3C Web App Manifest e guida
  MDN alle Progressive Web App (developer.mozilla.org/en-US/docs/Web/Progressive_web_apps).

## Possibili estensioni future

- Correzione prospettica automatica del foglio scansionato (rilevando
  marcatori agli angoli) per evitare l'inquadratura manuale in due passaggi.
- Esportazione voti in CSV/verbale d'esame.
- Ruoli multipli (es. co-docenti) sullo stesso corso.
