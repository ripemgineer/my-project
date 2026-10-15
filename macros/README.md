# Macros — free macro tracker

A simple, free macro tracker inspired by MacroFactor. It runs in the browser and installs on your phone like an app (PWA).

## Features
- **Barcode scanner**: point the camera at a package and the macros are filled in from [Open Food Facts](https://world.openfoodfacts.org) (free, no account).
- Food search, recent foods, your own custom foods, and a quick add for calories and macros.
- Daily calorie ring with protein, carbs and fat bars. Food is logged by meal (Breakfast, Lunch, Dinner, Snacks), and you can browse past days.
- If a barcode isn't in the database, you can enter it once and it's remembered next time.
- Bodyweight log with a smoothed trend line and weekly rate of change.
- Target calculator (Mifflin-St Jeor plus activity level and goal) or set your own targets manually.
- Works offline once installed. All data stays on your phone. You can export and import backups from Settings.

## Install on Android (Samsung S24 Ultra)
1. Open the app's https URL in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install**.
3. Open it from the home screen and allow camera access the first time you scan.

The camera needs https, so open it from the hosted URL, not as a local file.

## Hosting (GitHub Pages, free)
Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then pick the branch this folder lives on with folder `/ (root)`.
The app will then be at `https://<user>.github.io/<repo>/macros/`.
