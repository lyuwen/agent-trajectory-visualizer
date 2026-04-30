# Side-by-Side Trajectory Comparison Design

## Summary

Add a comparison mode that lets the user load and inspect two agentic trajectories side by side. The feature is activated by a floating "+" button on the right side of the page. Clicking it opens a right-side panel that accepts drag-and-drop or click-to-select JSON input. When both trajectories are loaded, the UI exposes a scroll-lock toggle so the two viewers can scroll in sync or independently.

This design extends the current single-trajectory architecture without changing how an individual trajectory is parsed or rendered.

## Goals

- Keep the existing single-trajectory flow intact.
- Let the user load any second JSON trajectory for comparison.
- Make the comparison panel feel additive rather than like a full page mode switch.
- Support both locked scrolling and independent scrolling.
- Reuse existing rendering components wherever possible.
- Keep the behavior testable with local dummy JSON files and browser interaction.
- Make the implementation reviewable by a code review subagent with clear component boundaries.

## Non-goals

- Semantic diffing between trajectories.
- Message-by-message alignment or matching.
- Shared selection state between the two viewers.
- Persisting comparison state in the URL or local storage.
- Supporting more than two simultaneous trajectories.

## Current State

Today the app keeps a single `fileData` object in `src/App.jsx`. Once a file is loaded, `App` renders one `TrajectoryViewer` and exposes a single floating action button that opens a file picker to replace that trajectory. `TrajectoryViewer` is already isolated from file ingestion and only depends on parsed trajectory data.

That separation is important because the comparison feature can be built by introducing parallel trajectory state at the `App` level while keeping `TrajectoryViewer` mostly unchanged.

## Proposed Architecture

### Top-level state in `src/App.jsx`

Replace the single `fileData` state with:

- `leftFileData`: primary trajectory data
- `rightFileData`: comparison trajectory data, initially `null`
- `comparisonOpen`: whether the right-side panel is open
- `scrollLocked`: whether the two viewers synchronize vertical scroll

The left trajectory remains the primary experience. The right trajectory only exists when the comparison panel is opened and a file is loaded.

### New components

#### `src/components/ComparisonPanel.jsx`

A dedicated sliding panel that appears from the right side of the viewport.

Responsibilities:
- render the comparison uploader when no right trajectory is loaded
- render a second `TrajectoryViewer` when `rightFileData` exists
- expose a close button
- own the hidden file input for the right-side load/replace flow
- provide a clear drop target for right-side replacement

This component should stay focused on panel-specific UI and delegate trajectory rendering back to `TrajectoryViewer`.

#### `src/components/ScrollLockButton.jsx`

A small floating control shown only when both left and right trajectories are loaded.

Responsibilities:
- show current mode: locked or independent scrolling
- toggle `scrollLocked`
- remain visually separate from file-loading controls

This keeps the scroll mode behavior explicit and avoids overloading the panel UI with global controls.

### Existing component updates

#### `src/components/TrajectoryViewer.jsx`

`TrajectoryViewer` should accept an optional container ref and optional visual variant props so it can be used cleanly in both left and right contexts.

Responsibilities remain the same:
- normalize and render messages
- render the patch viewer
- own no file-loading logic

The component should not know whether scroll sync is enabled. It should only expose the scrollable container so `App` can coordinate synchronization.

#### `src/components/FileUploader.jsx`

Keep existing behavior for the initial load. The comparison panel may reuse the existing uploader styling or a slightly adapted variant, but the ingestion flow should still use the same JSON parsing logic defined in `App`.

## UI Behavior

### Single-view mode

Before the user opens comparison mode, behavior stays effectively the same:
- one trajectory fills the page
- the existing replace button still replaces the primary trajectory
- a new "+" floating button is available on the right side

### Opening comparison mode

Clicking the new "+" button:
- opens a right-side panel with a slide-in animation
- shows a drag-and-drop target and a click-to-select affordance when empty
- does not disturb the left trajectory data

### Comparison mode with two trajectories

When the right file is loaded:
- the left viewer and right panel are visible together
- each viewer keeps its own header and patch view
- a scroll-lock floating button appears
- the right panel supports replacing only the right trajectory

### Closing comparison mode

Closing the panel:
- hides the right-side panel
- clears `rightFileData`
- resets `scrollLocked` to `false`
- returns the left trajectory to full-width layout

Resetting the scroll mode on close avoids stale coordination state when the second viewer no longer exists.

## Layout and Responsiveness

### Desktop layout

Use a two-pane layout:
- left viewer occupies the remaining width
- right comparison panel uses a fixed but roomy width, around 42vw with a sensible max width
- both panes stretch full height

A fixed-width panel is preferable to a pure 50/50 split because trajectory content is vertically dense and benefits more from stable line lengths than exact symmetry.

### Smaller screens

On narrower viewports, keep the right panel functional by reducing width first. If the viewport becomes too narrow for comfortable side-by-side reading, switch to a stacked layout inside comparison mode where the right panel overlays most of the screen while the left remains partially visible or compressed behind it.

The implementation should favor a simple responsive breakpoint rather than a complex resizable splitter.

## File Loading and Data Flow

### Left trajectory flow

The existing root uploader and primary replace button keep writing to `leftFileData`.

### Right trajectory flow

The comparison panel owns its own file input and drop target, but both left and right ingestion flows should share a common parsing helper in `App`:

- validate file type at the browser boundary
- read file with `FileReader`
- parse JSON
- route parsed data to either the left or right state target
- surface errors through the existing notification system

This keeps parsing logic consistent and avoids duplicate file-handling code.

## Scroll Synchronization Design

### Scroll model

When scroll lock is enabled, vertical scrolling in one viewer should update the other viewer based on scroll percentage rather than raw pixel offset.

Formula:
- source ratio = `scrollTop / (scrollHeight - clientHeight)`
- target scrollTop = `ratio * (targetScrollHeight - targetClientHeight)`

This handles trajectories with different overall heights better than pixel mirroring.

### Coordination strategy

`App` should own refs to the left and right scroll containers and attach scroll listeners only when:
- both containers exist
- `scrollLocked` is true

To prevent feedback loops:
- track whether a sync update is programmatic
- ignore the reciprocal event caused by that update
- clean up listeners whenever lock mode changes or a panel closes

This keeps synchronization centralized and easy to reason about during review.

## Error Handling and Edge Cases

- Invalid JSON on either side should show an existing notification and keep the current valid trajectory unchanged.
- Loading a valid right trajectory should not affect the left side.
- Replacing the left trajectory while comparison mode is open should preserve the right trajectory.
- Replacing the right trajectory should preserve the left trajectory.
- If one viewer has no scrollable overflow, locked scrolling should still behave safely and simply produce no meaningful movement on that side.
- Drag overlays must remain visually scoped so the user understands whether they are replacing the primary or comparison trajectory.

## Styling Changes

Expected styling work:
- extend `src/App.css` for a two-pane shell and dual FAB stack
- add `src/components/ComparisonPanel.css`
- add `src/components/ScrollLockButton.css`
- make small updates in `src/components/TrajectoryViewer.css` so the viewer behaves well inside a constrained panel

The visual style should stay consistent with the repo's dark-mode glass-like controls.

## Testing Strategy

Because the repo has no automated test runner today, verification is browser-driven.

### Manual scenarios

1. Load a single dummy trajectory and confirm the existing viewer still works.
2. Open the comparison panel and load a second dummy trajectory.
3. Replace the left trajectory while the right trajectory remains visible.
4. Replace the right trajectory without affecting the left.
5. Toggle scroll lock on and verify both panes sync.
6. Turn scroll lock off and verify panes scroll independently.
7. Close the comparison panel and confirm the left viewer returns to full width.
8. Try invalid JSON and wrong file types on both sides.
9. Test drag-and-drop behavior for both the root uploader and the comparison panel.
10. Verify layout behavior in a browser at narrow and wide widths.

### Review strategy

The implementation should be suitable for a review subagent by keeping responsibilities separated:
- `App.jsx` owns state and synchronization wiring
- `ComparisonPanel` owns right-panel interactions
- `TrajectoryViewer` stays presentational
- scroll sync logic remains localized and testable

## Implementation Outline

1. Refactor `App.jsx` to manage left/right trajectory state and shared parse logic.
2. Add the comparison panel component and styles.
3. Add the scroll-lock control and styles.
4. Update layout CSS for single-view and comparison-view modes.
5. Expose scroll container refs from `TrajectoryViewer`.
6. Implement scroll synchronization in `App.jsx`.
7. Create dummy trajectory files for browser testing.
8. Run browser-based verification.
9. Run lint and request review from a review subagent before calling the work complete.

## Open Decisions Resolved

- Comparison is optimized for either same-problem comparison or general exploration.
- The feature is additive, not a dedicated compare page.
- Scroll synchronization is a simple lock toggle, not a more advanced alignment system.
- The right-side comparison panel clears when closed so the UI returns to a clean single-view state.

## Success Criteria

The feature is complete when:
- the existing single-view flow still works
- a second trajectory can be loaded from a sliding right-side panel
- both trajectories render side by side
- the user can switch between locked and independent scrolling
- left and right replacement flows are independent
- invalid files fail safely with notifications
- the browser-verified behavior passes manual testing
- the resulting code is clean enough for a review subagent to assess in focused pieces
