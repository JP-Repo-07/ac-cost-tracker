# PWA deployment / Android test

1. Run `npm install` and `npm run build` locally. Deploy the repository to Vercel as a Vite app (build command `npm run build`, output directory `dist`).
2. Open the deployed HTTPS URL in Android Chrome. Chrome's menu may show **Install app** or **Add to Home screen**. A popup is not guaranteed.
3. Launch the installed app from your home screen. Load it once online, then try airplane mode: the cached calculator, tracker, and bundled aircon catalog should remain available.
4. Add a log, close and reopen, verify the record remains. Export JSON backups regularly. IndexedDB is device/browser-local; it does not sync or survive clearing site data.
5. Deploy an update and reload while online to test the service worker's update behavior. This project uses `registerType: prompt` to avoid automatically reloading while users edit logs; updates activate on subsequent app restarts or after browser handling.

The PWA icons are generated from the supplied snowflake PNG. A valid manifest and HTTPS make installation possible, but browser installation prompts are not guaranteed.
