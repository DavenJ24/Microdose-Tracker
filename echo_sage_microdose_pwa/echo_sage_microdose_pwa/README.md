# EchoSage Microdose Tracker

EchoSage Microdose Tracker is a mobile‑first Progressive Web App (PWA) that helps you self‑track a microdosing programme in a clear and beginner‑friendly way. It works entirely offline — your data stays on your device until you choose to export it — and provides charts and summaries to help you discover patterns over time.

## Installation on Your Phone

1. **Open `index.html` in a modern mobile browser.** For best results use Chrome on Android or Safari on iOS. You can simply serve the folder via a local web server or open directly using a file manager.
2. **Add the app to your home screen:**
   - **Android (Chrome):** Tap the browser menu (three dots) and choose **“Install app”**. Follow the prompts; the app will appear on your home screen and launch full‑screen like a native app.
   - **iOS (Safari):** Tap the **share icon** and select **“Add to Home Screen”**. Confirm the name and tap **Add**. The app will then launch from your home screen.

The PWA will cache its files for offline use. On first load it may require a network connection to download Chart.js; subsequent visits will work offline.

## How to Use

1. **Baseline:** Before dosing, open the **Baseline** tab and enter your details (initials, age, etc.). Choose your microdosing protocol (Fadiman, Stamets or Custom) and complete the mental health questionnaires (PHQ‑9, GAD‑7, PSS‑10, WHO‑5). These establish your starting point.
2. **Dosing Log:** Each time you dose, record the amount, substance, form, context and any immediate notes. This helps correlate dose days with changes later.
3. **Daily Log:** Every day, complete a quick check‑in (mood, anxiety, stress, sleep hours) and optionally note productivity, social connection, libido or any adverse events.
4. **Weekly Check‑in:** Once a week, retake the PHQ‑9, GAD‑7, PSS‑10 and WHO‑5. The app auto‑scores and summarises changes versus your baseline.
5. **Cognition:** Use the Finger Tapping Test (FTT) regularly. Select your hand and tap the box as quickly as possible for 10 seconds. Perform three trials per hand; the app stores averages for tracking motor speed over time. (An optional Psychomotor Vigilance Task is mentioned but not implemented here.)
6. **Summary:** The Home tab shows 7‑day averages for your mood, anxiety, stress and sleep, along with FTT averages for each hand. Charts allow you to visualise trends.
7. **Export/Import:** You can export your data to JSON or separate CSV files and copy them to your clipboard or download them. To restore your data on a new device, paste your exported JSON into the import box.
8. **Settings:** Customise your protocol pattern, switch between dark and light themes, toggle large text mode for accessibility, or clear all data. The About section contains important safety and legality information.

## Disclaimer

This application is for educational and self‑tracking purposes only. It is **not medical advice**. Psychedelics may be illegal where you live and may interact with medications or medical conditions. Do not drive or operate heavy machinery on dose days. If you experience severe distress, suicidal thoughts or serious adverse reactions, stop dosing immediately and seek professional help.
