import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderOpen, Plus } from 'lucide-react';
import FileUploader from './components/FileUploader';
import TrajectoryViewer from './components/TrajectoryViewer';
import Notifications from './components/Notifications';
import ComparisonPanel from './components/ComparisonPanel';
import TrajectorySidebar from './components/TrajectorySidebar';
import FilterBar from './components/FilterBar';
import KeyboardShortcutsPanel from './components/KeyboardShortcutsPanel';
import { isJSONL, parseJSONL, isATIF, normalizeATIF, computeFacets, mergeFacets, soloFilterSet, soloToolsFilterSet } from './helpers';
import { G_CHORD_TIMEOUT_MS, isTypingTarget } from './keyboardShortcuts';
import './App.css';

const MAX_NOTIFICATIONS = 5;
const DEFAULT_PANEL_WIDTH = Math.round(window.innerWidth / 2);
const MIN_PANEL_WIDTH = 360;
const PANEL_GUTTER_WIDTH = 280;
const RESIZE_STEP = 20;
const RESIZE_STEP_LARGE = 40;
const SNAP_THRESHOLD = 20;
const SNAP_FRACTIONS = [0.25, 0.5, 0.75];

const snapPanelWidth = (width, viewportWidth) => {
  for (const fraction of SNAP_FRACTIONS) {
    const snapTarget = Math.round(viewportWidth * fraction);
    if (Math.abs(width - snapTarget) <= SNAP_THRESHOLD) {
      return snapTarget;
    }
  }
  return width;
};

const getMaxPanelWidth = (viewportWidth) =>
  Math.max(MIN_PANEL_WIDTH, Math.round(Math.min(viewportWidth * 0.6, viewportWidth - PANEL_GUTTER_WIDTH)));

const clampPanelWidth = (width, viewportWidth) =>
  Math.min(getMaxPanelWidth(viewportWidth), Math.max(MIN_PANEL_WIDTH, width));

function App() {
  const [leftFileData, setLeftFileData] = useState(null);
  const [rightFileData, setRightFileData] = useState(null);
  const [leftTrajectories, setLeftTrajectories] = useState([]);
  const [rightTrajectories, setRightTrajectories] = useState([]);
  const [leftSelectedIndex, setLeftSelectedIndex] = useState(0);
  const [rightSelectedIndex, setRightSelectedIndex] = useState(0);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  // Types switched OFF in the floating filter strip. Empty = every type shown.
  const [hiddenFilters, setHiddenFilters] = useState(() => new Set());
  // The `?` cheatsheet.
  const [helpOpen, setHelpOpen] = useState(false);
  const fileInputRef = useRef(null);
  const rightFileInputRef = useRef(null);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());
  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const syncingRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const scrollBaselineRef = useRef('left');
  const resizeStateRef = useRef(null);
  // Chip the mouse is over, read by the `d` shortcut. Kept in a ref: hovering
  // changes no rendering, only which solo a keypress would run.
  const hoveredChipRef = useRef(null);
  const [focusedPanel, setFocusedPanel] = useState('left');

  const removeNotification = useCallback((id) => {
    const timers = timersRef.current.get(id);
    if (timers) {
      clearTimeout(timers.fade);
      clearTimeout(timers.remove);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const startFade = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, fading: true } : n))
    );
    const removeTimer = setTimeout(() => removeNotification(id), 500);
    const existing = timersRef.current.get(id);
    if (existing) {
      timersRef.current.set(id, { ...existing, remove: removeTimer });
    }
  }, [removeNotification]);

  const addNotification = useCallback((message) => {
    const id = ++idRef.current;
    setNotifications((prev) => {
      const next = [...prev, { id, message, fading: false }];
      if (next.length > MAX_NOTIFICATIONS) {
        const evicted = next.slice(0, next.length - MAX_NOTIFICATIONS);
        for (const n of evicted) {
          const t = timersRef.current.get(n.id);
          if (t) {
            clearTimeout(t.fade);
            clearTimeout(t.remove);
            timersRef.current.delete(n.id);
          }
        }
        return next.slice(-MAX_NOTIFICATIONS);
      }
      return next;
    });

    const fadeTimer = setTimeout(() => startFade(id), 5000);
    timersRef.current.set(id, { fade: fadeTimer, remove: null });
  }, [startFade]);

  const dismissNotification = useCallback((id) => {
    const timers = timersRef.current.get(id);
    if (timers) clearTimeout(timers.fade);
    startFade(id);
  }, [startFade]);

  const filterCounts = useMemo(
    () => mergeFacets(computeFacets(leftFileData), computeFacets(rightFileData)),
    [leftFileData, rightFileData]
  );

  const toggleFilter = useCallback((key) => {
    setHiddenFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // "Show only this": one move instead of switching every other chip off.
  const soloFilter = useCallback((key) => {
    setHiddenFilters(soloFilterSet(filterCounts, key));
  }, [filterCounts]);

  const resetFilters = useCallback(() => setHiddenFilters(new Set()), []);

  // token forces a new object identity per click so messages re-sync even when
  // the action repeats (expand-all twice in a row).
  const [expandSignal, setExpandSignal] = useState({ token: 0, expanded: true });

  const collapseAllMessages = useCallback(() => {
    setExpandSignal((prev) => ({ token: prev.token + 1, expanded: false }));
  }, []);

  const expandAllMessages = useCallback(() => {
    setExpandSignal((prev) => ({ token: prev.token + 1, expanded: true }));
  }, []);

  const parseFileToTarget = useCallback(
    (file, target) => {
      if (!file.name.endsWith('.json') && !file.name.endsWith('.jsonl') && file.type !== 'application/json') {
        addNotification(`"${file.name}" is not a supported file type. Please drop a JSON or JSONL file.`);
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => addNotification(`Failed to read "${file.name}".`);
      reader.onload = () => {
        try {
          const content = reader.result;

          // Detect if JSONL or single JSON
          if (isJSONL(content)) {
            const rawTrajectories = parseJSONL(content);
            if (rawTrajectories.length === 0) {
              addNotification(`"${file.name}" contains no valid trajectories.`);
              return;
            }
            const trajectories = rawTrajectories.map(t => isATIF(t) ? normalizeATIF(t) : t);

            if (target === 'left') {
              setLeftTrajectories(trajectories);
              setLeftFileData(trajectories[0]);
              setLeftSelectedIndex(0);
              setLeftSidebarOpen(trajectories.length > 1);
            } else {
              setRightTrajectories(trajectories);
              setRightFileData(trajectories[0]);
              setRightSelectedIndex(0);
              setRightSidebarOpen(trajectories.length > 1);
              setComparisonOpen(true);
            }
          } else {
            // Single JSON object
            const raw = JSON.parse(content);
            const json = isATIF(raw) ? normalizeATIF(raw) : raw;
            if (target === 'left') {
              setLeftTrajectories([json]);
              setLeftFileData(json);
              setLeftSelectedIndex(0);
              setLeftSidebarOpen(false);
            } else {
              setRightTrajectories([json]);
              setRightFileData(json);
              setRightSelectedIndex(0);
              setRightSidebarOpen(false);
              setComparisonOpen(true);
            }
          }
        } catch (err) {
          addNotification(`Failed to parse "${file.name}": ${err.message}`);
        }
      };
      reader.readAsText(file);
    },
    [addNotification]
  );

  const onLeftDrop = useCallback(
    (accepted, rejected) => {
      if (rejected.length > 0 && accepted.length === 0) {
        const name = rejected[0]?.file?.name || 'file';
        addNotification(`"${name}" is not a supported file type. Please drop a JSON or JSONL file.`);
        return;
      }
      if (accepted.length > 0) {
        parseFileToTarget(accepted[0], 'left');
      }
    },
    [addNotification, parseFileToTarget]
  );

  const onRightDrop = useCallback(
    (accepted, rejected) => {
      if (rejected.length > 0 && accepted.length === 0) {
        const name = rejected[0]?.file?.name || 'file';
        addNotification(`"${name}" is not a supported file type. Please drop a JSON or JSONL file.`);
        return;
      }
      if (accepted.length > 0) {
        parseFileToTarget(accepted[0], 'right');
      }
    },
    [addNotification, parseFileToTarget]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onLeftDrop,
    accept: { 'application/json': ['.json', '.jsonl'] },
    noClick: !!leftFileData,
    noKeyboard: !!leftFileData,
    multiple: false,
  });

  const rightDropzone = useDropzone({
    onDrop: onRightDrop,
    accept: { 'application/json': ['.json', '.jsonl'] },
    noClick: !!rightFileData,
    noKeyboard: true,
    noDragEventsBubbling: true,
    multiple: false,
  });

  const openComparisonPanel = useCallback((e) => {
    e?.stopPropagation?.();
    setComparisonOpen(true);
  }, []);

  const closeComparisonPanel = useCallback(() => {
    setComparisonOpen(false);
    setRightFileData(null);
    setScrollLocked(false);
  }, []);

  const toggleScrollLock = useCallback(() => {
    if (!scrollLocked) {
      const leftNode = leftScrollRef.current;
      const rightNode = rightScrollRef.current;
      if (leftNode && rightNode) {
        scrollOffsetRef.current = rightNode.scrollTop - leftNode.scrollTop;
        scrollBaselineRef.current = 'left';
      }
    }

    setScrollLocked((value) => !value);
  }, [scrollLocked]);

  // --- Keyboard shortcut actions -----------------------------------------
  // "The message in focus" is answered by the DOM rather than a React copy:
  // whichever .message-container holds focus is what Shift+D acts on (`c` is
  // handled inside Message itself, where the focus is meaningful).
  const focusedMessageNode = () => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return active && typeof active.closest === 'function'
      ? active.closest('.message-container')
      : null;
  };

  const handleChipHover = useCallback((key) => {
    hoveredChipRef.current = key;
  }, []);

  // `d` — show only the chip under the mouse, falling back to the
  // keyboard-focused chip so the gesture also works without a pointer.
  const soloHoveredChip = useCallback(() => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const focusedChip = active && typeof active.closest === 'function'
      ? active.closest('[data-filter-key]')
      : null;
    const key = hoveredChipRef.current ?? focusedChip?.dataset.filterKey;
    if (!key) return;
    soloFilter(key);
  }, [soloFilter]);

  // Shift+D — show only the tool types the focused message calls. A message
  // without calls has nothing to match, so say so instead of blanking the view.
  const soloFocusedTools = useCallback(() => {
    const node = focusedMessageNode();
    const names = node?.dataset.toolNames ? node.dataset.toolNames.split(' ').filter(Boolean) : [];
    if (names.length === 0) {
      addNotification('Focus a message that calls a tool to show only its tool calls.');
      return;
    }
    setHiddenFilters(soloToolsFilterSet(filterCounts, names));
  }, [addNotification, filterCounts]);

  // `s` — open or close the split, the same move as the panel's close button.
  const toggleSplit = useCallback(() => {
    if (comparisonOpen) {
      closeComparisonPanel();
    } else {
      setComparisonOpen(true);
    }
  }, [comparisonOpen, closeComparisonPanel]);

  // `o` — the replace-trajectory button of the pane the user is working in.
  // Keyboard focus decides, exactly as it does for `c`, Shift+D and the page
  // jumps; when nothing inside a pane holds focus the visible split answers,
  // and with no split the primary pane does. It never forces the split open.
  const openTrajectoryPicker = useCallback(() => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const inPane = (node) => !!(active && node && node.contains(active));

    if (inPane(rightScrollRef.current) || (!inPane(leftScrollRef.current) && comparisonOpen)) {
      rightFileInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  }, [comparisonOpen]);

  const toggleHelp = useCallback(() => setHelpOpen((value) => !value), []);

  // `w` — scroll lock, but only where the control exists (both panes loaded).
  const toggleScrollLockInSplit = useCallback(() => {
    if (!leftFileData || !rightFileData) return;
    toggleScrollLock();
  }, [leftFileData, rightFileData, toggleScrollLock]);

  // `gg` / Shift+G — jump the focused pane to its top or bottom. When nothing
  // inside a pane is focused, the last pane the user worked in answers.
  const scrollFocusedPanelTo = useCallback((edge) => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const fromFocus = active && typeof active.closest === 'function'
      ? active.closest('.trajectory-scroll')
      : null;
    const node = fromFocus ?? (focusedPanel === 'right' ? rightScrollRef.current : leftScrollRef.current);
    if (!node || typeof node.scrollTo !== 'function') return;
    const top = edge === 'bottom' ? node.scrollHeight : 0;
    node.scrollTo({ top, behavior: 'smooth' });
  }, [focusedPanel]);

  const handleLeftFabClick = useCallback((e) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const handleRightFabClick = useCallback(() => {
    rightFileInputRef.current?.click();
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

  const handlePanelResizeStart = useCallback((event) => {
    if (window.innerWidth <= 768) return;

    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: panelWidth,
    };
    setIsResizing(true);
  }, [panelWidth]);

  const handlePanelResizeKeyDown = useCallback((event) => {
    if (viewportWidth <= 768) return;

    const step = event.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPanelWidth((value) => clampPanelWidth(value + step, viewportWidth));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPanelWidth((value) => clampPanelWidth(value - step, viewportWidth));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setPanelWidth(MIN_PANEL_WIDTH);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setPanelWidth(getMaxPanelWidth(viewportWidth));
    }
  }, [viewportWidth]);

  const syncScrollPosition = useCallback((source, target) => {
    if (!source || !target) return;

    const offset = scrollOffsetRef.current;
    const useLeftAsBaseline = scrollBaselineRef.current === 'left';
    const nextTop = useLeftAsBaseline
      ? source === leftScrollRef.current
        ? source.scrollTop + offset
        : source.scrollTop - offset
      : source === rightScrollRef.current
        ? source.scrollTop - offset
        : source.scrollTop + offset;
    const targetMax = Math.max(0, target.scrollHeight - target.clientHeight);

    target.scrollTop = Math.min(targetMax, Math.max(0, nextTop));
  }, []);

  useEffect(() => {
    const clearResizeState = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      if (typeof event.buttons === 'number' && event.buttons === 0) {
        clearResizeState();
        return;
      }
      if (event.pointerId !== undefined && resizeState.pointerId !== undefined && event.pointerId !== resizeState.pointerId) {
        return;
      }

      const rawWidth = resizeState.startWidth - (event.clientX - resizeState.startX);
      const snapped = snapPanelWidth(rawWidth, window.innerWidth);
      setPanelWidth(clampPanelWidth(snapped, window.innerWidth));
    };

    const handleViewportResize = () => {
      setViewportWidth(window.innerWidth);
      setPanelWidth((value) => clampPanelWidth(value, window.innerWidth));
      if (window.innerWidth <= 768) {
        clearResizeState();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', clearResizeState);
    window.addEventListener('pointercancel', clearResizeState);
    window.addEventListener('blur', clearResizeState);
    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', clearResizeState);
      window.removeEventListener('pointercancel', clearResizeState);
      window.removeEventListener('blur', clearResizeState);
      window.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle arrow keys when not typing in an input/textarea
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();

      const scrollContainer = focusedPanel === 'left' ? leftScrollRef.current : rightScrollRef.current;
      if (!scrollContainer) return;

      const messages = scrollContainer.querySelectorAll('.message-container');
      if (messages.length === 0) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const containerTop = containerRect.top;

      let currentIndex = 0;
      let minDistance = Infinity;

      // Find the message whose top edge is closest to the container's top edge
      // This identifies which message is most prominently at the top of the viewport
      for (let i = 0; i < messages.length; i++) {
        const msgRect = messages[i].getBoundingClientRect();
        const distance = Math.abs(msgRect.top - containerTop);
        if (distance < minDistance) {
          minDistance = distance;
          currentIndex = i;
        }
      }

      let targetIndex = -1;

      if (event.key === 'ArrowDown') {
        // Move to next message
        targetIndex = Math.min(currentIndex + 1, messages.length - 1);
      } else {
        // ArrowUp: Move to previous message
        targetIndex = Math.max(currentIndex - 1, 0);
      }

      if (targetIndex >= 0 && targetIndex < messages.length) {
        const targetMessage = messages[targetIndex];
        // Moving the caret between messages is what makes "the message in
        // focus" reachable from the keyboard; `c` and Shift+D act on it.
        targetMessage.focus?.({ preventScroll: true });
        const targetTop = targetMessage.offsetTop;
        scrollContainer.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPanel]);

  // The shortcut handler is registered once and reads the latest actions from
  // this ref, so a data or filter change never leaves a stale binding behind.
  const shortcutStateRef = useRef(null);
  useEffect(() => {
    shortcutStateRef.current = {
      helpOpen,
      expandAll: expandAllMessages,
      collapseAll: collapseAllMessages,
      soloHoveredChip,
      soloFocusedTools,
      resetFilters,
      toggleSplit,
      openTrajectoryPicker,
      toggleScrollLockInSplit,
      scrollFocusedPanelTo,
      toggleHelp,
    };
  });

  useEffect(() => {
    let chordTimer = null;
    const clearChord = () => {
      if (chordTimer) {
        clearTimeout(chordTimer);
        chordTimer = null;
      }
    };

    const handleShortcutKeyDown = (event) => {
      const state = shortcutStateRef.current;
      if (!state) return;
      if (event.defaultPrevented) return;
      // Never shadow browser and OS chords (Ctrl+F, Ctrl+W, Cmd+S, ...).
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const { key } = event;
      const isHelpKey = key === '?';

      // While the cheatsheet is up it owns the keyboard: `?` and Escape close
      // it, and nothing fires behind it.
      if (state.helpOpen) {
        if (isHelpKey || key === 'Escape') {
          event.preventDefault();
          state.toggleHelp();
        }
        return;
      }

      if (key === 'Escape') return;
      if (isHelpKey) {
        event.preventDefault();
        state.toggleHelp();
        return;
      }

      const lower = key.length === 1 ? key.toLowerCase() : key;

      // `gg` and Shift+G are one key apart, so resolve them before the map.
      if (lower === 'g') {
        if (event.shiftKey) {
          clearChord();
          event.preventDefault();
          state.scrollFocusedPanelTo('bottom');
          return;
        }
        if (chordTimer) {
          clearChord();
          event.preventDefault();
          state.scrollFocusedPanelTo('top');
          return;
        }
        chordTimer = setTimeout(clearChord, G_CHORD_TIMEOUT_MS);
        return;
      }

      // Any other key cancels a half-typed chord rather than leaving it armed.
      clearChord();

      // Holding a key down must not re-run a one-shot action.
      if (event.repeat) return;

      switch (lower) {
        case 'e':
          event.preventDefault();
          state.expandAll();
          break;
        case 'f':
          event.preventDefault();
          state.collapseAll();
          break;
        // `c` is deliberately absent: the focused Message handles it itself,
        // and letting it fall through here still cancels a pending `gg`.
        case 'd':
          event.preventDefault();
          if (event.shiftKey) state.soloFocusedTools();
          else state.soloHoveredChip();
          break;
        case 'a':
          event.preventDefault();
          state.resetFilters();
          break;
        case 's':
          event.preventDefault();
          state.toggleSplit();
          break;
        case 'o':
          event.preventDefault();
          state.openTrajectoryPicker();
          break;
        case 'w':
          event.preventDefault();
          state.toggleScrollLockInSplit();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleShortcutKeyDown);
    return () => {
      clearChord();
      window.removeEventListener('keydown', handleShortcutKeyDown);
    };
  }, []);

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
      scrollBaselineRef.current = 'left';
      syncScrollPosition(leftNode, rightNode);
    };

    const handleRightScroll = () => {
      if (syncingRef.current === 'left') {
        syncingRef.current = null;
        return;
      }
      syncingRef.current = 'right';
      scrollBaselineRef.current = 'right';
      syncScrollPosition(rightNode, leftNode);
    };

    leftNode.addEventListener('scroll', handleLeftScroll);
    rightNode.addEventListener('scroll', handleRightScroll);

    return () => {
      leftNode.removeEventListener('scroll', handleLeftScroll);
      rightNode.removeEventListener('scroll', handleRightScroll);
      syncingRef.current = null;
    };
  }, [scrollLocked, syncScrollPosition, leftFileData, rightFileData]);

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      for (const timerSet of timers.values()) {
        clearTimeout(timerSet.fade);
        clearTimeout(timerSet.remove);
      }
      timers.clear();
    };
  }, []);

  return (
    <>
      <div
        {...getRootProps()}
        className={`app ${comparisonOpen ? 'app--comparison-open' : ''} ${isResizing ? 'app--is-resizing' : ''} ${leftFileData ? 'app--has-filter' : ''}`}
        style={comparisonOpen ? { '--comparison-panel-width': `${clampPanelWidth(panelWidth, viewportWidth)}px` } : undefined}
      >
        <input {...getInputProps()} />

        {!leftFileData ? (
          <FileUploader isDragActive={isDragActive} />
        ) : (
          <>
            <FilterBar
              counts={filterCounts}
              hiddenFilters={hiddenFilters}
              onToggle={toggleFilter}
              onSolo={soloFilter}
              onReset={resetFilters}
              comparisonOpen={!!rightFileData}
              onCollapseAll={collapseAllMessages}
              onExpandAll={expandAllMessages}
              onHoverChip={handleChipHover}
            />
            {leftTrajectories.length > 1 && (
              <TrajectorySidebar
                trajectories={leftTrajectories}
                selectedIndex={leftSelectedIndex}
                onSelect={(index) => {
                  setLeftSelectedIndex(index);
                  setLeftFileData(leftTrajectories[index]);
                }}
                isOpen={leftSidebarOpen}
                onToggle={() => setLeftSidebarOpen(!leftSidebarOpen)}
              />
            )}

            <div className="app-shell">
              <div className="primary-pane">
                <TrajectoryViewer
                  data={leftFileData}
                  title={comparisonOpen ? 'Primary trajectory' : 'Agent Trajectory'}
                  containerRef={leftScrollRef}
                  variant={comparisonOpen ? 'panel' : 'full'}
                  hiddenFilters={hiddenFilters}
                  expandSignal={expandSignal}
                  onFocus={() => setFocusedPanel('left')}
                />
                {isDragActive && (
                  <div className="drag-overlay drag-overlay--primary">
                    Drop to replace primary trajectory
                  </div>
                )}
              </div>
            </div>

            <div className="fab-stack">
              <button
                className="fab"
                onClick={handleLeftFabClick}
                title="Replace primary trajectory"
                aria-label="Replace primary trajectory"
              >
                <FolderOpen size={22} />
              </button>
              <button
                className="fab fab--accent"
                onClick={openComparisonPanel}
                title="Open comparison panel"
                aria-label="Open comparison panel"
              >
                <Plus size={22} />
              </button>
            </div>

            <ComparisonPanel
              isOpen={comparisonOpen}
              data={rightFileData}
              isDragActive={rightDropzone.isDragActive}
              getRootProps={rightDropzone.getRootProps}
              getInputProps={rightDropzone.getInputProps}
              onClose={closeComparisonPanel}
              onReplaceClick={handleRightFabClick}
              onResizeStart={handlePanelResizeStart}
              onResizeKeyDown={handlePanelResizeKeyDown}
              panelWidth={clampPanelWidth(panelWidth, viewportWidth)}
              panelWidthMin={MIN_PANEL_WIDTH}
              panelWidthMax={getMaxPanelWidth(viewportWidth)}
              scrollLocked={scrollLocked}
              onToggleScroll={toggleScrollLock}
              showScrollToggle={!!(leftFileData && rightFileData)}
              scrollRef={rightScrollRef}
              onFocus={() => setFocusedPanel('right')}
              trajectories={rightTrajectories}
              selectedIndex={rightSelectedIndex}
              onSelectTrajectory={(index) => {
                setRightSelectedIndex(index);
                setRightFileData(rightTrajectories[index]);
              }}
              sidebarOpen={rightSidebarOpen}
              onToggleSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
              hiddenFilters={hiddenFilters}
              expandSignal={expandSignal}
            />
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        data-testid="left-trajectory-input"
        accept=".json,.jsonl,application/json"
        onChange={handleLeftFabChange}
        style={{ display: 'none' }}
      />
      <input
        ref={rightFileInputRef}
        type="file"
        data-testid="right-trajectory-input"
        accept=".json,.jsonl,application/json"
        onChange={handleRightFabChange}
        style={{ display: 'none' }}
      />
      <Notifications notifications={notifications} onDismiss={dismissNotification} />
      {helpOpen && <KeyboardShortcutsPanel onClose={toggleHelp} />}
    </>
  );
}

export default App;
