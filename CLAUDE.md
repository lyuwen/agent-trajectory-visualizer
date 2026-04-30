# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

- `npm install` — install dependencies for local development.
- `npm run dev` — start the Vite dev server.
- `npm run build` — create a production build in `dist/`.
- `npm run preview` — serve the built app locally.
- `npm run lint` — run ESLint.
- `docker build -t agent-visualizer .` — build the production image.
- `docker run -p 8080:80 agent-visualizer` — run the container locally.

## Tests

- There is currently no automated test runner configured in `package.json`.
- The repository does not contain any `*.test.*` or `*.spec.*` files.
- Because no test framework is set up yet, there is no single-test command to run.

## Build and deployment notes

- This is a static Vite build served either by Vite during development or by nginx in Docker.
- GitHub Actions deploys on pushes to `main` in two ways:
  - builds and pushes a Docker image to GHCR
  - builds and deploys the static site to GitHub Pages
- The Pages job builds with `npm run build -- --base=/agent-trajectory-visualizer/`. If you change asset paths or introduce routing, keep that base path requirement in mind.
- Both the Dockerfile and the Pages workflow currently install dependencies with `rm -f package-lock.json && npm install`. If you need to reproduce CI/container behavior locally, use the same sequence.
- `nginx.conf` is configured as an SPA: requests fall back to `/index.html`.

## Architecture overview

- This is a client-only React + Vite application. There is no backend; uploaded trajectory JSON is parsed and rendered entirely in the browser.
- `src/main.jsx` mounts `src/App.jsx`.
- `src/App.jsx` owns the single top-level state, `fileData`, and switches between the upload screen and the trajectory viewer.
- `src/components/FileUploader.jsx` is the ingestion boundary. It handles drag-and-drop / file selection, reads JSON with `FileReader`, parses it client-side, and passes the parsed object upward through `onFileLoaded`.
- `src/components/TrajectoryViewer.jsx` is the main orchestration layer for rendering a loaded run. It memoizes normalized messages from `data.messages`, renders the message timeline, and shows the final git patch from `data.test_result?.git_patch`.
- `src/helpers.js` contains the key normalization step in the app. `processMessages()` indexes `tool` role messages by `tool_call_id`, removes them from the top-level stream, and attaches each tool output to the corresponding assistant `tool_calls` entry. The UI assumes this merged shape when rendering tool executions.
- `src/components/Message.jsx` renders one normalized message at a time. It folds system messages by default, renders markdown content, shows optional reasoning text, and delegates each attached tool call to `ToolCall`.
- `src/components/ToolCall.jsx` contains most of the specialized tool UI. It parses tool arguments, attempts to pretty-print JSON output, and has custom rendering branches for `terminal`, `file_editor` / `str_replace_editor`, `think`, and `finish`. New tool-specific visual behavior should usually be added here.
- `src/components/PatchViewer.jsx` is intentionally separate from the message timeline and only renders the final git patch panel.

## Styling structure

- Styling is plain CSS imported per component, not CSS modules.
- Global theme tokens and app-wide layout defaults live in `src/index.css`.
- Component-specific styles live alongside each component in `src/components/*.css`.
- The visual design is dark-mode-first and relies on global CSS variables rather than a component library or theme provider.
