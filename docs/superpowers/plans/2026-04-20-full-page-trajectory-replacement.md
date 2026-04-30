# Full-page trajectory replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the page as a full-page drag-and-drop target even after a trajectory is loaded, add a floating replace-file button, and show stacked fading notifications for unsupported files and parse failures.

**Architecture:** Move dropzone ownership and file parsing into `src/App.jsx` so replacement behavior stays app-level and the viewer remains render-only. Keep the empty-state upload UI as a presentational child, add a small notification component for stacked timed toasts, and use CSS updates to preserve the current full-page feel while supporting the loaded-state replacement flow.

**Tech Stack:** React, Vite, react-dropzone, lucide-react, plain CSS

---

## File structure

- Modify: `src/App.jsx` — own dropzone state, parse/replace flow, hidden file input access, and notification lifecycle.
- Modify: `src/App.css` — page-level drop target layout, drag-active styling, floating button placement, notification positioning.
- Modify: `src/components/FileUploader.jsx` — convert to a presentational empty-state uploader surface that can receive dropzone props from `App`.
- Modify: `src/components/FileUploader.css` — keep empty-state styling compatible with app-owned drop behavior.
- Modify: `src/components/TrajectoryViewer.jsx` — optionally accept overlay/children hook only if needed; otherwise keep unchanged.
- Create: `src/components/ToastNotifications.jsx` — render stacked top-right notifications with dismiss buttons and fade-out state.
- Create: `src/components/ToastNotifications.css` — style stacked notifications, close button, and fade animation.

### Task 1: Move file loading and drop handling into App

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/FileUploader.jsx`
- Modify: `src/App.css`
- Modify: `src/components/FileUploader.css`

- [ ] **Step 1: Write the failing test substitute**

Document the manual expectation because this repo has no test runner yet:
- Empty state still shows the existing centered uploader UI.
- Dropping a valid JSON on the empty state loads the trajectory.
- Dropping a valid JSON while a trajectory is already visible replaces it without refresh.

- [ ] **Step 2: Run the current verification baseline**

Run: `npm run build`
Expected: PASS and produce `dist/`

- [ ] **Step 3: Write minimal implementation**

Implement in `src/App.jsx`:
- Move JSON file reading/parsing into shared app-level handlers.
- Initialize `useDropzone` in `App` with `noClick` enabled when a file is already loaded.
- Process only the first accepted file on drop.
- Pass dropzone root/input props into `FileUploader` for the empty state.
- Wrap the loaded viewer in the same full-page drop target.

Adapt `src/components/FileUploader.jsx` to receive props instead of owning file IO.

- [ ] **Step 4: Run verification**

Run: `npm run build`
Expected: PASS
Then run: `npm run dev`
Expected: local dev server starts successfully for browser testing

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css src/components/FileUploader.jsx src/components/FileUploader.css
git commit -m "feat: support app-level trajectory replacement"
```

### Task 2: Add floating replace-file button for loaded state

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing test substitute**

Document the manual expectation:
- In loaded state, clicking the page background does not open the file picker.
- The floating bottom-right button opens the file picker.

- [ ] **Step 2: Run quick regression build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Write minimal implementation**

Implement in `src/App.jsx` and `src/App.css`:
- Add a floating button in the bottom-right only when `fileData` exists.
- Trigger the hidden file input from that button.
- Keep empty-state click-to-select behavior unchanged.

- [ ] **Step 4: Run verification**

Run: `npm run build`
Expected: PASS
Then verify in browser:
- Empty state click still opens picker.
- Loaded-state floating button opens picker.
- Loaded-state page clicks do not open picker.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "feat: add loaded-state file picker button"
```

### Task 3: Add stacked fading notifications for invalid drops and parse failures

**Files:**
- Modify: `src/App.jsx`
- Create: `src/components/ToastNotifications.jsx`
- Create: `src/components/ToastNotifications.css`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing test substitute**

Document the manual expectation:
- Unsupported file drops show a top-right notification saying the file type is not supported.
- Invalid JSON shows a parse-failure notification.
- Notifications stack, can be dismissed individually, remain visible for 5 seconds, then fade out.
- Failed replacement leaves the current trajectory visible.

- [ ] **Step 2: Run quick regression build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Write minimal implementation**

Implement in `src/App.jsx`:
- Add notification array state with unique ids.
- Push notifications for rejected file types, file read errors, and JSON parse errors.
- Start per-notification timers for visible duration and removal after fade.
- Keep the current trajectory unchanged on failures.

Implement `src/components/ToastNotifications.jsx` and CSS for stacked panes, close button, and fade transitions.

- [ ] **Step 4: Run verification**

Run: `npm run build`
Expected: PASS
Then verify in browser:
- Multiple errors stack.
- Manual dismiss works.
- Auto-dismiss timing matches spec.
- Existing loaded trajectory stays visible after failure.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css src/components/ToastNotifications.jsx src/components/ToastNotifications.css
git commit -m "feat: add trajectory upload notifications"
```

### Task 4: Verify end-to-end behavior and simplify if needed

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Modify: `src/components/FileUploader.jsx`
- Modify: `src/components/FileUploader.css`
- Modify: `src/components/ToastNotifications.jsx`
- Modify: `src/components/ToastNotifications.css`

- [ ] **Step 1: Run full verification**

Run: `npm run build`
Expected: PASS
Run: `npm run dev`
Expected: dev server starts
Manual browser checks:
- Load one valid trajectory from empty state.
- Replace it by drag-and-drop on the loaded page.
- Replace it via the floating button.
- Drop unsupported file type and confirm notification.
- Drop invalid JSON and confirm notification while current trajectory remains visible.
- Confirm multiple notifications stack and fade independently.

- [ ] **Step 2: Simplify the implementation**

Review for unnecessary prop plumbing, duplicate styles, or viewer changes that can be removed. Keep file IO in `App` and rendering concerns in child components.

- [ ] **Step 3: Run final verification**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/App.css src/components/FileUploader.jsx src/components/FileUploader.css src/components/ToastNotifications.jsx src/components/ToastNotifications.css
git commit -m "refactor: simplify trajectory replacement flow"
```
