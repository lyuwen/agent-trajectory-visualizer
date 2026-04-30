# Side-by-Side Trajectory Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side comparison panel so users can load a second trajectory, inspect two trajectories side by side, and toggle between locked and independent scrolling.

**Architecture:** Keep `src/App.jsx` as the orchestration layer for file ingestion, notifications, panel state, and scroll synchronization. Add focused UI components for the comparison panel and scroll-lock toggle, and keep `src/components/TrajectoryViewer.jsx` presentational by only exposing its scroll container via refs and layout props.

**Tech Stack:** React 19, Vite, react-dropzone, framer-motion, lucide-react, plain CSS, ESLint, browser-based manual verification.

---

## File map

### Modify
- `src/App.jsx` — replace single-file state with left/right trajectory state, shared file parsing, comparison panel toggling, and scroll synchronization wiring
- `src/App.css` — two-pane layout, floating action button stack, scoped drag overlays
- `src/components/TrajectoryViewer.jsx` — forward scroll container refs and accept layout/header variant props without taking on file-loading logic
- `src/components/TrajectoryViewer.css` — constrained panel behavior, full-height scrolling container variants
- `src/components/FileUploader.jsx` — optional variant props so uploader can render cleanly in the comparison panel without duplicating markup
- `src/components/FileUploader.css` — panel-sized uploader styling alongside existing full-screen uploader styling

### Create
- `src/components/ComparisonPanel.jsx` — right-side panel shell, second uploader/replace flow, close button, right viewer host
- `src/components/ComparisonPanel.css` — slide-in panel styling and responsive behavior
- `src/components/ScrollLockButton.jsx` — floating toggle for locked vs independent scrolling
- `src/components/ScrollLockButton.css` — styling for scroll mode control
- `public/dummy-left.json` — manual browser test fixture for primary trajectory
- `public/dummy-right.json` — manual browser test fixture for comparison trajectory
- `public/dummy-invalid.json` — manual browser test fixture for invalid JSON handling

## Constraints

- No automated test runner exists in this repo, so validation must use `npm run lint` and browser-based manual checks.
- Keep single-view behavior unchanged when comparison mode is not open.
- Do not add semantic comparison, persisted layout state, or more than two trajectories.
- Keep scroll synchronization in `App.jsx`; do not bury it inside `TrajectoryViewer`.

## Task 1: Refactor app state and shared file ingestion

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Replace the single trajectory state with left/right comparison state**

Update the top of `src/App.jsx` so the app owns comparison state explicitly.

```jsx
const [leftFileData, setLeftFileData] = useState(null);
const [rightFileData, setRightFileData] = useState(null);
const [comparisonOpen, setComparisonOpen] = useState(false);
const [scrollLocked, setScrollLocked] = useState(false);
```

Remove the old single-source state:

```jsx
const [fileData, setFileData] = useState(null);
```

- [ ] **Step 2: Add refs for both viewer scroll containers and scroll-sync guards**

In `src/App.jsx`, add refs near the existing notification refs.

```jsx
const leftScrollRef = useRef(null);
const rightScrollRef = useRef(null);
const syncingRef = useRef(null);
const rightFileInputRef = useRef(null);
```

- [ ] **Step 3: Replace `handleFile` with a target-aware parser**

Move the current file parsing logic into a shared callback that accepts a destination.

```jsx
const parseFileToTarget = useCallback(
  (file, target) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      addNotification(`"${file.name}" is not a supported file type. Please drop a JSON file.`);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => addNotification(`Failed to read "${file.name}".`);
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (target === 'left') {
          setLeftFileData(json);
        } else {
          setRightFileData(json);
          setComparisonOpen(true);
        }
      } catch (err) {
        addNotification(`Failed to parse "${file.name}": ${err.message}`);
      }
    };
    reader.readAsText(file);
  },
  [addNotification]
);
```

- [ ] **Step 4: Add dedicated drop handlers for left and right inputs**

Keep the root dropzone for the left trajectory and add a second handler for the comparison panel.

```jsx
const onLeftDrop = useCallback(
  (accepted, rejected) => {
    if (rejected.length > 0 && accepted.length === 0) {
      const name = rejected[0]?.file?.name || 'file';
      addNotification(`"${name}" is not a supported file type. Please drop a JSON file.`);
      return;
    }
    if (accepted.length > 0) {
      parseFileToTarget(accepted[0], 'left');
    }
  },
  [addNotification, parseFileToTarget]
);

const onRightFileSelect = useCallback(
  (file) => {
    if (file) {
      parseFileToTarget(file, 'right');
    }
  },
  [parseFileToTarget]
);
```

Update the existing `useDropzone` hook to use `onLeftDrop`.

- [ ] **Step 5: Add open/close/replace handlers for the comparison panel**

Create explicit panel controls so the UI state is predictable.

```jsx
const openComparisonPanel = useCallback((e) => {
  e?.stopPropagation?.();
  setComparisonOpen(true);
}, []);

const closeComparisonPanel = useCallback(() => {
  setComparisonOpen(false);
  setRightFileData(null);
  setScrollLocked(false);
}, []);

const handleLeftFabChange = useCallback((e) => {
  const file = e.target.files?.[0];
  if (file) parseFileToTarget(file, 'left');
  e.target.value = '';
}, [parseFileToTarget]);

const handleRightFabChange = useCallback((e) => {
  const file = e.target.files?.[0];
  if (file) parseFileToTarget(file, 'right');
  e.target.value = '';
}, [parseFileToTarget]);
```

- [ ] **Step 6: Run lint after the state refactor scaffolding**

Run: `npm run lint`

Expected: PASS or only failures related to still-missing components that will be added in the next task.

## Task 2: Add the comparison panel and uploader variants

**Files:**
- Create: `src/components/ComparisonPanel.jsx`
- Create: `src/components/ComparisonPanel.css`
- Modify: `src/components/FileUploader.jsx`
- Modify: `src/components/FileUploader.css`

- [ ] **Step 1: Add uploader variants without duplicating uploader markup**

Update `src/components/FileUploader.jsx` to accept variant and copy props.

```jsx
const FileUploader = ({
  isDragActive,
  variant = 'fullscreen',
  idleText = "Drag 'n' drop a JSON file here, or click to select one",
  activeText = 'Drop the JSON file here ...',
}) => {
  return (
    <div className={`uploader-container uploader-container--${variant}`}>
      <div className={clsx('dropzone', `dropzone--${variant}`, isDragActive && 'active')}>
        <UploadCloud size={variant === 'panel' ? 40 : 64} className="icon" />
        <p>{isDragActive ? activeText : idleText}</p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Extend uploader styles for panel usage**

Append focused panel styles to `src/components/FileUploader.css`.

```css
.uploader-container--panel {
  height: 100%;
  min-height: 320px;
  background: transparent;
}

.dropzone--panel {
  width: 100%;
  min-height: 280px;
  padding: 2.5rem 1.5rem;
  max-width: none;
}

.dropzone--panel p {
  text-align: center;
}
```

- [ ] **Step 3: Create the comparison panel component**

Create `src/components/ComparisonPanel.jsx` with a focused interface.

```jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, X } from 'lucide-react';
import FileUploader from './FileUploader';
import TrajectoryViewer from './TrajectoryViewer';
import './ComparisonPanel.css';

const ComparisonPanel = ({
  isOpen,
  data,
  isDragActive,
  getRootProps,
  getInputProps,
  onClose,
  onReplaceClick,
  scrollRef,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          className="comparison-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div className="comparison-panel__header">
            <div>
              <p className="comparison-panel__eyebrow">Comparison</p>
              <h2>Second trajectory</h2>
            </div>
            <div className="comparison-panel__actions">
              {data && (
                <button className="comparison-panel__icon-button" onClick={onReplaceClick} title="Replace comparison trajectory">
                  <FolderOpen size={18} />
                </button>
              )}
              <button className="comparison-panel__icon-button" onClick={onClose} title="Close comparison panel">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="comparison-panel__body" {...getRootProps()}>
            <input {...getInputProps()} />
            {data ? (
              <TrajectoryViewer
                data={data}
                title="Comparison trajectory"
                containerRef={scrollRef}
                variant="panel"
              />
            ) : (
              <FileUploader
                isDragActive={isDragActive}
                variant="panel"
                idleText="Drag 'n' drop a comparison JSON file here, or click to select one"
                activeText="Drop the comparison JSON file here ..."
              />
            )}
          </div>

          {!data && (
            <button className="comparison-panel__cta" onClick={onReplaceClick}>
              <Plus size={16} />
              Select comparison file
            </button>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default ComparisonPanel;
```

- [ ] **Step 4: Add comparison panel styles**

Create `src/components/ComparisonPanel.css`.

```css
.comparison-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: min(42vw, 720px);
  height: 100vh;
  z-index: 850;
  background: rgba(9, 9, 11, 0.96);
  border-left: 1px solid var(--border-color);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.comparison-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.comparison-panel__eyebrow {
  margin: 0 0 0.35rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
}

.comparison-panel__header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.comparison-panel__actions {
  display: flex;
  gap: 0.5rem;
}

.comparison-panel__icon-button,
.comparison-panel__cta {
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.comparison-panel__icon-button {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.comparison-panel__icon-button:hover,
.comparison-panel__cta:hover {
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.16);
}

.comparison-panel__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.comparison-panel__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 1rem 1.25rem 1.25rem;
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
}

@media (max-width: 1100px) {
  .comparison-panel {
    width: min(50vw, 640px);
  }
}

@media (max-width: 768px) {
  .comparison-panel {
    width: min(100vw, 100%);
  }
}
```

- [ ] **Step 5: Run lint after adding the panel component**

Run: `npm run lint`

Expected: PASS or only failures related to the still-unwired `App.jsx` render tree that will be fixed in Task 4.

## Task 3: Make `TrajectoryViewer` reusable in both left and right panes

**Files:**
- Modify: `src/components/TrajectoryViewer.jsx`
- Modify: `src/components/TrajectoryViewer.css`

- [ ] **Step 1: Convert `TrajectoryViewer` to accept a forwarded scroll container ref**

Update the component signature and wrapper markup in `src/components/TrajectoryViewer.jsx`.

```jsx
import React, { forwardRef, useMemo } from 'react';
import clsx from 'clsx';
import Message from './Message';
import PatchViewer from './PatchViewer';
import { processMessages } from '../helpers';
import './TrajectoryViewer.css';

const TrajectoryViewer = forwardRef(function TrajectoryViewer(
  { data, title = 'Agent Trajectory', variant = 'full', containerRef },
  _ref
) {
  const processedMessages = useMemo(() => {
    if (!data?.messages) return [];
    return processMessages(data.messages);
  }, [data]);

  const patch = data.test_result?.git_patch;

  return (
    <div className={clsx('trajectory-wrapper', `trajectory-wrapper--${variant}`)}>
      <div className={clsx('trajectory-scroll', `trajectory-scroll--${variant}`)} ref={containerRef}>
        <div className="trajectory-container">
          <div className="viewer-header">
            <h1>{title}</h1>
            <div className="meta">
              Instance ID: <span className="id-tag">{data.instance_id}</span>
            </div>
          </div>

          <div className="messages-list">
            {processedMessages.map((msg, index) => (
              <Message key={index} message={msg} />
            ))}
          </div>

          <PatchViewer patch={patch} />
        </div>
      </div>
    </div>
  );
});

export default TrajectoryViewer;
```

- [ ] **Step 2: Add full-height scrollable variants to the viewer styles**

Replace the top-level layout in `src/components/TrajectoryViewer.css` with variant-aware styles.

```css
.trajectory-wrapper {
  width: 100%;
  min-height: 100vh;
}

.trajectory-wrapper--full {
  min-height: 100vh;
}

.trajectory-wrapper--panel {
  min-height: 100%;
}

.trajectory-scroll {
  min-height: 100vh;
}

.trajectory-scroll--full {
  padding: 2rem;
  padding-top: 4rem;
  max-width: 1000px;
  margin: 0 auto;
}

.trajectory-scroll--panel {
  height: 100%;
  overflow-y: auto;
  padding: 1.25rem;
}

.viewer-header {
  margin-bottom: 3rem;
  text-align: center;
}

.trajectory-wrapper--panel .viewer-header {
  margin-bottom: 2rem;
}

.trajectory-wrapper--panel .viewer-header h1 {
  font-size: 1.8rem;
}
```

Keep the existing `.viewer-header`, `.meta`, `.id-tag`, and `.messages-list` rules below these new blocks.

- [ ] **Step 3: Add a scroll ref to the primary viewer render path later in `App.jsx`**

When wiring the component in Task 4, the left viewer should be rendered like this:

```jsx
<TrajectoryViewer
  data={leftFileData}
  title="Primary trajectory"
  containerRef={leftScrollRef}
  variant={comparisonOpen ? 'panel' : 'full'}
/>
```

- [ ] **Step 4: Run lint after making `TrajectoryViewer` reusable**

Run: `npm run lint`

Expected: PASS or only failures related to the old `App.jsx` render tree that will be replaced in Task 4.

## Task 4: Wire the comparison layout, drag targets, and floating controls

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Create: `src/components/ScrollLockButton.jsx`
- Create: `src/components/ScrollLockButton.css`

- [ ] **Step 1: Create the scroll-lock toggle component**

Create `src/components/ScrollLockButton.jsx`.

```jsx
import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import './ScrollLockButton.css';

const ScrollLockButton = ({ locked, onClick }) => {
  return (
    <button
      className={`scroll-lock-button ${locked ? 'is-locked' : ''}`}
      onClick={onClick}
      title={locked ? 'Unlock scrolling' : 'Lock scrolling'}
      aria-pressed={locked}
    >
      {locked ? <Lock size={18} /> : <Unlock size={18} />}
      <span>{locked ? 'Scroll locked' : 'Independent scroll'}</span>
    </button>
  );
};

export default ScrollLockButton;
```

- [ ] **Step 2: Create the scroll-lock button styles**

Create `src/components/ScrollLockButton.css`.

```css
.scroll-lock-button {
  position: fixed;
  right: 1.5rem;
  bottom: 5.25rem;
  z-index: 820;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.scroll-lock-button:hover,
.scroll-lock-button.is-locked {
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.16);
}

.scroll-lock-button span {
  font-size: 0.9rem;
}
```

- [ ] **Step 3: Add a right-side dropzone hook in `src/App.jsx`**

Create a second dropzone hook dedicated to the comparison panel.

```jsx
const rightDropzone = useDropzone({
  onDrop: (accepted, rejected) => {
    if (rejected.length > 0 && accepted.length === 0) {
      const name = rejected[0]?.file?.name || 'file';
      addNotification(`"${name}" is not a supported file type. Please drop a JSON file.`);
      return;
    }
    if (accepted.length > 0) {
      parseFileToTarget(accepted[0], 'right');
    }
  },
  accept: { 'application/json': ['.json'] },
  noClick: false,
  noKeyboard: true,
  multiple: false,
});
```

Keep the root app dropzone using `noClick: !!leftFileData` so the app still supports drag-to-replace for the left trajectory.

- [ ] **Step 4: Replace the old single-view render tree with the comparison layout**

Update the render section in `src/App.jsx` so it composes the primary viewer, comparison panel, and floating controls.

```jsx
return (
  <>
    <div {...getRootProps()} className={`app ${comparisonOpen ? 'app--comparison-open' : ''}`}>
      <input {...getInputProps()} />

      {!leftFileData ? (
        <FileUploader isDragActive={isDragActive} />
      ) : (
        <>
          <div className="app-shell">
            <div className={`primary-pane ${comparisonOpen ? 'primary-pane--split' : ''}`}>
              <TrajectoryViewer
                data={leftFileData}
                title="Primary trajectory"
                containerRef={leftScrollRef}
                variant={comparisonOpen ? 'panel' : 'full'}
              />
            </div>
          </div>

          {isDragActive && <div className="drag-overlay">Drop to replace primary trajectory</div>}

          <div className="fab-stack">
            <button className="fab" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} title="Replace primary trajectory">
              <FolderOpen size={22} />
            </button>
            <button className="fab fab--accent" onClick={openComparisonPanel} title="Open comparison panel">
              <Plus size={22} />
            </button>
          </div>

          {leftFileData && rightFileData && (
            <ScrollLockButton locked={scrollLocked} onClick={() => setScrollLocked((value) => !value)} />
          )}

          <ComparisonPanel
            isOpen={comparisonOpen}
            data={rightFileData}
            isDragActive={rightDropzone.isDragActive}
            getRootProps={rightDropzone.getRootProps}
            getInputProps={rightDropzone.getInputProps}
            onClose={closeComparisonPanel}
            onReplaceClick={() => rightFileInputRef.current?.click()}
            scrollRef={rightScrollRef}
          />
        </>
      )}
    </div>

    <input
      ref={fileInputRef}
      type="file"
      accept=".json,application/json"
      onChange={handleLeftFabChange}
      style={{ display: 'none' }}
    />
    <input
      ref={rightFileInputRef}
      type="file"
      accept=".json,application/json"
      onChange={handleRightFabChange}
      style={{ display: 'none' }}
    />
    <Notifications notifications={notifications} onDismiss={dismissNotification} />
  </>
);
```

Add the missing imports at the top of `src/App.jsx`.

```jsx
import { FolderOpen, Plus } from 'lucide-react';
import ComparisonPanel from './components/ComparisonPanel';
import ScrollLockButton from './components/ScrollLockButton';
```

- [ ] **Step 5: Extend `src/App.css` for split mode and FAB stacking**

Append the following styles to `src/App.css`.

```css
.app-shell {
  min-height: 100vh;
}

.primary-pane {
  width: 100%;
  transition: width 0.24s ease;
}

.app--comparison-open .primary-pane {
  width: calc(100% - min(42vw, 720px));
}

.fab-stack {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 800;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fab {
  position: static;
}

.fab--accent {
  background: var(--accent-color);
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.fab--accent:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

@media (max-width: 1100px) {
  .app--comparison-open .primary-pane {
    width: calc(100% - min(50vw, 640px));
  }
}

@media (max-width: 768px) {
  .app--comparison-open .primary-pane {
    width: 100%;
  }

  .fab-stack {
    right: 1rem;
    bottom: 1rem;
  }
}
```

- [ ] **Step 6: Run lint after wiring the layout**

Run: `npm run lint`

Expected: PASS.

## Task 5: Implement scroll synchronization and lifecycle cleanup

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add a ratio-based sync helper**

In `src/App.jsx`, add a helper that maps one scroll position into the other pane.

```jsx
const syncScrollPosition = useCallback((source, target) => {
  if (!source || !target) return;

  const sourceMax = source.scrollHeight - source.clientHeight;
  const targetMax = target.scrollHeight - target.clientHeight;

  if (sourceMax <= 0 || targetMax <= 0) {
    target.scrollTop = 0;
    return;
  }

  const ratio = source.scrollTop / sourceMax;
  target.scrollTop = ratio * targetMax;
}, []);
```

- [ ] **Step 2: Attach and clean up synchronized scroll listeners with `useEffect`**

In `src/App.jsx`, add an effect that only runs while both viewers exist and lock mode is enabled.

```jsx
useEffect(() => {
  const leftNode = leftScrollRef.current;
  const rightNode = rightScrollRef.current;

  if (!scrollLocked || !leftNode || !rightNode) {
    syncingRef.current = null;
    return undefined;
  }

  const handleLeftScroll = () => {
    if (syncingRef.current === 'right') {
      syncingRef.current = null;
      return;
    }
    syncingRef.current = 'left';
    syncScrollPosition(leftNode, rightNode);
  };

  const handleRightScroll = () => {
    if (syncingRef.current === 'left') {
      syncingRef.current = null;
      return;
    }
    syncingRef.current = 'right';
    syncScrollPosition(rightNode, leftNode);
  };

  leftNode.addEventListener('scroll', handleLeftScroll);
  rightNode.addEventListener('scroll', handleRightScroll);

  syncScrollPosition(leftNode, rightNode);

  return () => {
    leftNode.removeEventListener('scroll', handleLeftScroll);
    rightNode.removeEventListener('scroll', handleRightScroll);
    syncingRef.current = null;
  };
}, [scrollLocked, syncScrollPosition, leftFileData, rightFileData]);
```

- [ ] **Step 3: Ensure notification timers still clean up when the component unmounts**

While editing `src/App.jsx`, add an unmount cleanup effect for notification timers if one does not already exist.

```jsx
useEffect(() => {
  return () => {
    for (const timers of timersRef.current.values()) {
      clearTimeout(timers.fade);
      clearTimeout(timers.remove);
    }
    timersRef.current.clear();
  };
}, []);
```

- [ ] **Step 4: Run lint after scroll synchronization is in place**

Run: `npm run lint`

Expected: PASS.

## Task 6: Add manual browser fixtures and verify the feature end to end

**Files:**
- Create: `public/dummy-left.json`
- Create: `public/dummy-right.json`
- Create: `public/dummy-invalid.json`

- [ ] **Step 1: Create a primary trajectory fixture with enough messages to scroll**

Create `public/dummy-left.json` with a valid shape matching the current viewer.

```json
{
  "instance_id": "dummy-left-run",
  "messages": [
    { "role": "system", "content": "You are a coding agent." },
    { "role": "user", "content": "Implement a navbar." },
    { "role": "assistant", "content": "I'll inspect the codebase first." },
    { "role": "assistant", "content": "I found the header component and updated it." },
    { "role": "assistant", "content": "I tested the result in the browser." },
    { "role": "assistant", "content": "The navbar now supports mobile collapse." },
    { "role": "assistant", "content": "I also cleaned up the spacing and alignment." },
    { "role": "assistant", "content": "The final diff is ready for review." }
  ],
  "test_result": {
    "git_patch": "diff --git a/src/Nav.jsx b/src/Nav.jsx\n+ added navbar changes\n"
  }
}
```

- [ ] **Step 2: Create a comparison trajectory fixture with different overall length**

Create `public/dummy-right.json` with more messages than the left fixture so scroll ratio syncing is visible.

```json
{
  "instance_id": "dummy-right-run",
  "messages": [
    { "role": "system", "content": "You are a coding agent." },
    { "role": "user", "content": "Implement a navbar." },
    { "role": "assistant", "content": "I'll compare multiple approaches." },
    { "role": "assistant", "content": "First I explored the existing header styles." },
    { "role": "assistant", "content": "Then I tested a compact layout for mobile." },
    { "role": "assistant", "content": "I updated the menu button interactions." },
    { "role": "assistant", "content": "I adjusted the animation timing." },
    { "role": "assistant", "content": "I verified the focus styles." },
    { "role": "assistant", "content": "I ran a final browser check." },
    { "role": "assistant", "content": "This version favors a denser desktop layout." },
    { "role": "assistant", "content": "The final diff is ready for review." }
  ],
  "test_result": {
    "git_patch": "diff --git a/src/Nav.jsx b/src/Nav.jsx\n+ alternative navbar changes\n"
  }
}
```

- [ ] **Step 3: Create an invalid JSON fixture for error handling**

Create `public/dummy-invalid.json` with deliberately invalid content.

```json
{
  "instance_id": "broken-json",
  "messages": [
```

- [ ] **Step 4: Start the dev server and verify the UI in a browser**

Run: `npm run dev`

Expected: Vite dev server starts and prints a local URL.

Then verify these scenarios in a browser:
- load `/dummy-left.json` into the primary viewer
- open the comparison panel with the new `+` button
- load `/dummy-right.json` into the comparison viewer
- toggle the scroll-lock control on and off
- replace the left trajectory and confirm the right one remains visible
- replace the right trajectory and confirm the left one remains visible
- close the comparison panel and confirm the app returns to single-view mode
- attempt to load `/dummy-invalid.json` and verify a notification appears
- try drag-and-drop for the primary surface and the comparison panel
- verify desktop and narrow-width behavior

- [ ] **Step 5: Run lint after manual verification**

Run: `npm run lint`

Expected: PASS.

## Task 7: Review and finish

**Files:**
- Review: all modified files above

- [ ] **Step 1: Request a structured code review from a review subagent**

Use the review path after implementation is complete. The reviewer should inspect:
- `src/App.jsx`
- `src/App.css`
- `src/components/ComparisonPanel.jsx`
- `src/components/ComparisonPanel.css`
- `src/components/ScrollLockButton.jsx`
- `src/components/ScrollLockButton.css`
- `src/components/TrajectoryViewer.jsx`
- `src/components/TrajectoryViewer.css`
- `src/components/FileUploader.jsx`
- `src/components/FileUploader.css`

Focus the review on:
- scroll synchronization correctness and cleanup
- drag-and-drop scoping
- whether single-view behavior regressed
- whether component boundaries remain clean
- responsive layout edge cases

- [ ] **Step 2: Address review feedback and re-run verification**

After fixes, repeat:
- `npm run lint`
- browser verification of the key compare-mode scenarios

Expected: PASS, with review issues resolved.

- [ ] **Step 3: Run final completion verification before reporting done**

Final checks:
- `npm run lint`
- browser check for single-view flow
- browser check for comparison flow
- browser check for invalid-file notifications

Expected: PASS.

## Self-review

### Spec coverage

- Right-side panel opened by floating `+` button: covered in Task 4.
- Drag-and-drop and click-to-select for the second trajectory: covered in Task 2 and Task 4.
- Two side-by-side viewers with independent replacement flows: covered in Task 1 and Task 4.
- Locked vs independent scrolling: covered in Task 5 and verified in Task 6.
- Browser testing with dummy files: covered in Task 6.
- Review-subagent readiness: covered in Task 7.

No spec gaps found.

### Placeholder scan

No `TBD`, `TODO`, or unresolved placeholders remain in the plan. Validation commands and concrete file paths are included for every task.

### Type consistency

State names, prop names, and component names are consistent across tasks:
- `leftFileData`
- `rightFileData`
- `comparisonOpen`
- `scrollLocked`
- `containerRef`
- `ComparisonPanel`
- `ScrollLockButton`

