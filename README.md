# CPE Lucky Wheel Project

## Overview

A modern web‑app that lets users spin a wheel to reveal random **CPE** hints. The UI is styled with a premium **red, white, black** theme and uses **Firebase Realtime Database** for real‑time synchronization across clients.

## Features
- Red/White/Black cyber‑punk design with glass‑morphism effects.
- Real‑time hint pool via Firebase (no PHP backend required).
- Single‑spin restriction per user (stored in `localStorage`).
- History log and confetti animation.
- Reset URL parameters:
  - `?reset` – clears the spin lock for the current browser.
  - `?reset_db` – seeds the Firebase database with the default hint list.

## Setup
1. **Firebase**
   - Create a Firebase project and enable **Realtime Database**.
   - Replace the placeholder `firebaseConfig` object in `random.html` with your project’s config values.
2. **Local development**
   - Open `index.html` and `random.html` in a browser (served via any static server).
3. **Deploy** – see the *Deploy to Vercel* section below.

## Deploy to Vercel
1. Fork/clone this repo.
2. In Vercel, add the repo and set the Firebase config values as environment variables.
3. Vercel will automatically build and publish the static site.

---

*Created with love by Antigravity AI assistant.*
