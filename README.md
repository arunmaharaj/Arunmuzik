# Arunmuzik — AI Music Generator

A web app that lets anyone generate full songs with AI, powered by [SunoAPI.org](https://sunoapi.org).

- **Simple mode** – describe a song in plain words.
- **Custom mode** – write your own lyrics, title and style (or go instrumental).
- Two takes per generation, in-browser playback, cover art, lyrics and MP3 download.
- Song history saved in the browser.
- Live credit balance in the header.

## Tech stack

- Static frontend (plain HTML/CSS/JS, no build step) in `public/`
- Netlify Functions in `netlify/functions/` act as a secure proxy so your **API key never reaches the browser**.

```
public/                 → the website
netlify/functions/
  generate.mjs          → POST /api/generate       (starts a song)
  status.mjs            → GET  /api/status?taskId= (polls progress)
  credits.mjs           → GET  /api/credits        (remaining credits)
  callback.mjs          → callback URL required by SunoAPI.org
netlify.toml            → build + /api/* routing
```

## Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub →** pick this repo.
2. Build settings are read from `netlify.toml` (no build command; publish dir `public`). Just click **Deploy**.
3. Go to **Site configuration → Environment variables** and add:
   - `SUNO_API_KEY` = your SunoAPI.org key
   - `APP_PASSWORD` *(optional, recommended)* = a passcode visitors must enter before generating. Without it, anyone with the link can spend your credits.
4. **Trigger a redeploy** (Deploys → Trigger deploy) so the functions pick up the variables.

## Run locally

```bash
npm install -g netlify-cli
cp .env.example .env   # then put your key in .env
netlify dev
```
