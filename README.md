# Poki

Poki is a private two-person messenger presented behind a working calculator. This repository contains a React + TypeScript PWA frontend and a small Python Flask WebSocket relay.

## Recommended stack

- React + TypeScript + Vite for the installable frontend
- Tailwind CSS, Framer Motion, and Lucide React for UI
- IndexedDB for persistent media blobs; localStorage for the small MVP message/profile records
- Web Crypto API for hashing the calculator unlock code
- Flask + Flask-Sock for stateless signaling, presence, and live packet relay
- WebRTC DataChannel is the next transport step for direct encrypted peer traffic

The relay does not write chat history, media, or private keys. It only keeps active connections in memory. A production deployment should use HTTPS/WSS and authenticated pairing tokens.

## Run the PWA

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Open Calculator > Settings to set a display name, shared room code, and 4-12 digit unlock code. The unlock code is stored only as a SHA-256 hash.

## Run the relay

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r server\requirements.txt
python server\app.py
```

The default WebSocket endpoint is `ws://127.0.0.1:5000/ws`. Set `VITE_SIGNALING_URL` in `.env` when the relay runs elsewhere.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` deploys the PWA from `main` to:

```text
https://gururajachar2008.github.io/poki/
```

Before the first deployment, open the repository's **Settings > Pages**, choose **GitHub Actions** as the source, then add a repository variable named `VITE_SIGNALING_URL` under **Settings > Secrets and variables > Actions > Variables**. Set it to the deployed WebSocket endpoint, for example `wss://your-backend.example.com/ws`.

The workflow uses the `/poki/` base path and publishes only the static frontend. The Flask relay remains a separate deployment.

## Current MVP boundary

Implemented: calculator arithmetic, hashed unlock, local text history, IndexedDB media attachments, image/video/audio previews, offline pending state, two-device room presence, and in-memory live packet relay.

Still required for a hardened production release: QR pairing, identity keys, authenticated encryption, WebRTC DataChannel transfer, chunked large-media transfer, encrypted backups, and automated device tests. The browser cannot receive messages after a completely closed PWA without push infrastructure.

## Reusable build prompt

> Build Poki as a local-first two-person messenger disguised as a real calculator. Use React, TypeScript, Vite, Tailwind CSS, Framer Motion, IndexedDB, Web Crypto, WebRTC, a Service Worker, and a Web App Manifest. Use Python Flask with WebSockets only for ephemeral signaling and presence; never persist messages or media on the server. The first screen must be a fully functional calculator. A configurable numeric sequence must unlock the chat, with only a cryptographic hash stored locally. Store messages and media on the device, save a message before network transmission, support offline pending state, text/image/video/audio attachments, online/offline presence, reconnect behavior, and graceful browser permission failures. Pair exactly two devices using authenticated QR pairing, verify peer identity, encrypt payloads with established authenticated primitives, and never transmit private keys. Build responsive mobile-first Poki UI with a premium dark visual language, restrained motion, accessible controls, lazy media loading, local search, storage management, encrypted backup, and explicit warnings about PWA background limits. Validate the calculator, offline startup, persistence, pairing, WebRTC, media, storage limits, encryption, deletion, and installability in mobile and desktop Chromium.
