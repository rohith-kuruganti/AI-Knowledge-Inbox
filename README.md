# Knowledge Inbox

A small web app for saving notes and web pages, then asking questions grounded in that content.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

```sh
npm install
```

Start the backend in one terminal:

```sh
npm run dev:server
```

Start the frontend in another terminal:

```sh
npm run dev:client
```

Open the local URL printed by Vite, usually http://localhost:5173.

To generate embeddings, copy `server/.env.example` to `server/.env`, add your OpenAI API key, and restart the backend. The app can save content without a key; embeddings remain pending until configured. Generating embeddings sends each chunk to OpenAI and usage is billed by input tokens. Never commit `server/.env`.

## Design decisions and tradeoffs

- React and Express run as separate npm workspaces, keeping frontend and backend responsibilities clear while sharing one install step.
- Vite forwards `/api` requests to Express during local development, avoiding extra CORS setup for this single-origin app.
- SQLite stores notes and extracted page text locally, so saved items survive restarts without an external database service. The URL importer extracts text from HTML; pages that require client-side JavaScript may not import cleanly.
- Text is split near paragraph or sentence boundaries into chunks targeting 1,600 characters with 240 characters of overlap. This keeps nearby context together, though character counts only approximate model token limits.
- OpenAI embeddings are stored as JSON vectors beside their chunks. This is easy to inspect and suitable for a small library; a larger collection would benefit from an indexed vector store.
