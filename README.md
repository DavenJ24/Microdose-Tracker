# EchoSage Microdose Tracker

A static, no‑backend PWA for tracking microdosing, daily mood/sleep, weekly questionnaire totals, and a Finger Tapping Test. All data stays in `localStorage` on the device.

## Quick start
1. Download this folder as a ZIP, unzip.
2. Create a new repo on GitHub and upload these files (or drag‑drop via the web UI).
3. Commit to `main`.
4. Enable GitHub Pages (optional) → Settings → Pages → Source: Deploy from branch, select `main` and `/root`.
5. Open `https://<your-username>.github.io/<repo>/` on your phone and add to Home Screen.

## Dev notes
- Single‑page app using vanilla JS + Chart.js (CDN).
- Export JSON and CSV for baseline, doses, daily, weekly, and FTT.
- Import JSON to restore.
- Theme toggle + large text mode.
- PWA manifest included.

v1.4.0 — 2025-09-05
