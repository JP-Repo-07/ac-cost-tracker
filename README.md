# Aircon Cost Calculator + Usage Tracker PH

React 19, TypeScript, Vite, Tailwind CSS v4. No server or account required.

## Run

```powershell
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## What is included
- **Calculator**: the original daily/weekly/monthly hypothetical-use calculator.
- **Usage tracker**: manually enter start and end **dates and times**, temperature, brand/model or manual watts, room area, sun exposure, electricity rate, and assumed average-power factor.
- Saves, edits, and deletes individual usage sessions using browser **IndexedDB**.
- Daily totals correctly split overnight sessions at midnight; today, current Monday–Sunday week, and current month summaries.
- Prevents overlapping sessions (single-aircon tracker); exports a JSON backup.
- `src/data/aircon-models.json` contains **132 records / 29 brands** from the previously expanded catalog; model availability and sources must be independently audited before public release.

## Accuracy and privacy
The rated-power method assumes the selected aircon draws its rated input throughout the session. Other factor choices are **illustrative user assumptions**, not DOE-certified factors or measured runtime. Temperature, room size, and sun exposure are recorded but **do not yet alter consumption**; a validated environmental model is still future work. Tracking hours does not automatically measure electrical power.

Logs are local to the browser/device. Export backups before clearing browser storage. No sync between devices. No import feature yet.

## Files
- `src/App.tsx` navigation between calculator and tracker
- `src/Calculator.tsx` original calculator
- `src/Tracker.tsx` tracker UI and CRUD
- `src/storage/usageStorage.ts` IndexedDB persistence
- `src/calculations/usage.ts` session and daily aggregation logic
- `src/types/usage.ts` usage log schema
- `src/data/aircon-models.json` aircon catalog

## Import / export backups

Open **Usage tracker → Your data stays in this browser**. Use **Export backup JSON** to download a versioned backup (`schemaVersion: 1`, `app: "aircon-cost-tracker-ph"`, `usageLogs: [...]`). Use **Import usage history** to select the exported JSON, preview valid/invalid/duplicate entries, and choose **Merge** (default; skip existing IDs) or **Replace** (confirmation required). Original tracker exports containing a plain array of logs are also accepted. Import writes records in one IndexedDB transaction. Invalid records are skipped after a warning. Files are processed locally, not uploaded to a server. Keep independent backups because clearing browser storage removes saved logs.

The app does **not** automatically convert arbitrary third-party JSON formats. Such data must first be converted to the documented `UsageLog` structure.

## Android PWA

PWA support is configured with `vite-plugin-pwa`. See `PWA-DEPLOY.md` for Vercel and Android install/offline testing instructions. The provided snowflake icon is used for the PWA icons.
