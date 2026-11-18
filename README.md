# Knowledge Inbox

A small web app for saving notes and web pages, then asking questions grounded in that content.

## Requirements

- Node.js 20 or newer
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

## Design decisions and tradeoffs

- React and Express run as separate npm workspaces, keeping frontend and backend responsibilities clear while sharing one install step.
- Vite forwards `/api` requests to Express during local development, avoiding extra CORS setup for this single-origin app.
- The starter uses an in-memory health endpoint only. Persistence, semantic search, and AI answers will be added in later milestones; a lightweight database is suitable for this single-user assessment.
- A hosted AI API keeps local setup small, but requires an internet connection and a locally configured API key. The key will remain on the server and out of Git.
