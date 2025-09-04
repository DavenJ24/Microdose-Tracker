# EchoSage • Microdose Tracker (Mystic 1.3.0)

**What this is:** a mobile-first, offline-capable PWA for self-tracking a microdosing program. Static files only (no server).  
**Privacy:** your data stays on-device (localStorage). Export/Import is manual.

## Deploy (Netlify + GitHub)
1. Put these files in your repo root (index.html at top level).  
2. Ensure your Netlify site is connected to this repo, branch = `main`.  
3. Build settings: **Build command:** _blank_, **Publish directory:** `/`.  
   (This repo also includes `netlify.toml` that forces no build and publish from root.)  
4. Commit + push. Netlify auto-publishes.

## iPhone install (PWA)
- Open your domain in Safari → Share → **Add to Home Screen**.  
- After updates: open site in Safari for ~10s (updates service worker), then reopen the app.

## Android install
- Open in Chrome → menu → **Install app**.

## Data
- Export: **Export → Export JSON** or **Export CSVs**.  
- Import: paste JSON and tap **Import**.

## Disclaimer
Self‑tracking only; not medical advice. Laws vary by location. Avoid driving after dosing. Seek help for severe distress.
