# 2026-04-20 Full-page trajectory replacement design

## Goal
Allow the app to accept drag-and-drop for a new trajectory even when a trajectory is already loaded, using a full-page drop target in both empty and loaded states.

## Recommendation
Move the dropzone responsibility to the app-level container so it stays mounted regardless of whether `fileData` is null.

## Approach
- Keep `fileData` state in `src/App.jsx`.
- Add app-level file parsing, notification state, and drop handling in `App`.
- Render a single full-page drop target around the current content.
- When no file is loaded, show the current upload prompt UI and keep click-to-select available there.
- When a file is loaded, show `TrajectoryViewer`, keep the same page-wide drop target active, and disable click-to-open on the page itself.
- Add a floating action button in the bottom-right of the loaded state to open the file picker explicitly.
- On drop, parse the first accepted JSON file and replace the current `fileData` on success.

## Component responsibilities
- `App` owns current trajectory data, replacement behavior, hidden file-picker access, and transient notifications.
- `FileUploader` becomes a presentational empty-state upload component, or is adapted to accept dropzone props from `App`.
- `TrajectoryViewer` remains read-only and focused on rendering loaded trajectory data.
- A small notification component renders stacked parse-failure panes in the top-right.

## UX details
- The entire page remains a valid drag-and-drop target at all times.
- Existing click-to-select behavior remains available in the empty state.
- While dragging over a loaded trajectory, the page should still show an active drop visual so replacement is discoverable.
- In the loaded state, browsing for a replacement file happens only through the floating bottom-right button.
- Replacing a trajectory should happen immediately after successful parse; no extra confirmation step is needed.
- If multiple files are dropped, only the first accepted JSON file is processed.

## Error handling
- Invalid JSON or file-read failures do not replace the current trajectory.
- Dropping an unsupported file type shows a brief stacked top-right notification saying the file type is not supported.
- Parse and read errors appear as stacked floating notification panes in the top-right.
- Each notification includes the error message and a close button in the pane’s top-right corner.
- Each notification remains fully visible for 5 seconds, then fades out and is removed after the fade animation completes.
- Repeated failures create additional notifications rather than replacing an existing one.

## Verification
- Load a trajectory normally.
- Drag a second valid JSON file onto the loaded viewer and confirm the rendered trajectory updates without a refresh.
- Confirm drag-active styling appears in both empty and loaded states.
- Use the floating bottom-right button to open the file picker and replace the trajectory.
- Drop invalid JSON while a trajectory is loaded and confirm the current trajectory remains visible.
- Drop an unsupported file type and confirm a brief "file type is not supported" notification appears.
- Confirm parse failures appear as stacked top-right notifications, each dismissible manually and auto-fading after 5 seconds plus fade-out time.
