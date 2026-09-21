# `str_replace_editor` Diff Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `str_replace_editor` calls as action-aware source previews, diffs, listings, or errors for `view`, `create`, `str_replace`, and `insert`.

**Architecture:** Add a pure presentation-model module that converts editor arguments and output into typed rows, then render those rows in a focused React component. `ToolCall` remains the orchestration boundary: it parses the call, delegates only `str_replace_editor`, preserves raw-data disclosures, and falls back to the existing generic output when the model cannot safely interpret a call.

**Tech Stack:** React 19, JavaScript modules, plain CSS, Vitest, Testing Library, Vite

**Spec:** `docs/superpowers/specs/2026-09-21-str-replace-editor-diff-design.md`

## Global Constraints

- Apply the action-aware renderer only to `str_replace_editor`; preserve current `file_editor` behavior.
- Treat `view` as a neutral preview/listing, never as an addition diff.
- Use arguments as the authoritative edit source and output only for context, line anchors, success/error classification, and fallback.
- Treat output beginning with `[An error occurred during execution.]` as failure even though an output object exists.
- Preserve raw arguments and raw output behind disclosures; never discard trajectory evidence.
- Add no runtime dependency.
- Preserve horizontal source layout in both full-width and comparison-pane views.

---

## File structure

- Create `src/strReplaceEditorPresentation.js`: pure parsing, error detection, line differencing, and presentation-model construction.
- Create `src/components/StrReplaceEditorView.jsx`: semantic rendering for preview, listing, diff, and error models.
- Create `src/components/StrReplaceEditorView.css`: compact review-surface layout, gutters, row colors, scrolling, and responsive behavior.
- Create `src/test/strReplaceEditorPresentation.test.js`: table-driven tests for the pure data transformation.
- Create `src/test/StrReplaceEditorView.test.jsx`: component behavior tests for semantic rows and fallback/error displays.
- Create `src/test/ToolCall.editor.test.jsx`: integration tests at the `ToolCall` boundary.
- Modify `src/components/ToolCall.jsx`: delegate `str_replace_editor`, expose raw output appropriately, and derive the correct status icon.
- Modify `src/components/ToolCall.css`: error-state and disclosure styling that belongs to the outer tool card.

### Task 1: Build the pure editor presentation model

**Files:**
- Create: `src/strReplaceEditorPresentation.js`
- Create: `src/test/strReplaceEditorPresentation.test.js`

**Interfaces:**
- Produces: `isExplicitEditorError(output: unknown): boolean`
- Produces: `parseNumberedEditorOutput(output: unknown): { intro: string, rows: Array<{ lineNumber: number, text: string }> } | null`
- Produces: `buildEditorPresentation(args: object, output: unknown): EditorPresentation`
- `EditorPresentation` is one of:

```js
{ kind: 'preview', action: 'view', path, rows }
{ kind: 'listing', action: 'view', path, lines }
{ kind: 'diff', action: 'create' | 'str_replace' | 'insert', path, rows }
{ kind: 'error', action, path, message }
{ kind: 'fallback', action, path, content }
```

- A diff/preview row has `{ type: 'context' | 'add' | 'remove', oldLine: number | null, newLine: number | null, text: string }`.

- [ ] **Step 1: Write failing tests for numbered output and explicit errors**

Add literal fixtures that prove the parser preserves source line numbers, tabs inside source text, and blank numbered lines, while rejecting directory listings. Add separate cases proving only the explicit error prefix triggers the error branch; ordinary source code containing the word `error` remains successful.

```js
expect(parseNumberedEditorOutput(
  "Here's the result of running `cat -n` on /tmp/a.py:\n    8\tvalue = 'a\\tb'\n    9\t"
)).toEqual({
  intro: "Here's the result of running `cat -n` on /tmp/a.py:",
  rows: [
    { lineNumber: 8, text: "value = 'a\\tb'" },
    { lineNumber: 9, text: '' },
  ],
});

expect(isExplicitEditorError('[An error occurred during execution.]\n\nInvalid path')).toBe(true);
expect(isExplicitEditorError('raise ValueError("error")')).toBe(false);
```

- [ ] **Step 2: Add throwing export stubs, then run the focused test and confirm RED**

Create `src/strReplaceEditorPresentation.js` with the three named exports, each throwing `new Error('not implemented')`. This is resolver scaffolding only; it must not return a value that could satisfy an assertion.

Run: `npm test -- --run src/test/strReplaceEditorPresentation.test.js`

Expected: FAIL at the first call with `not implemented`, proving the test reaches the production boundary.

- [ ] **Step 3: Implement output parsing and error detection**

Parse only lines matching `^\\s*(\\d+)\\t(.*)$`; everything before the first numbered line is `intro`. Return `null` when no numbered row exists. Coerce non-string output to a stable text fallback without throwing.

- [ ] **Step 4: Re-run the focused test and confirm GREEN**

Run: `npm test -- --run src/test/strReplaceEditorPresentation.test.js`

Expected: PASS.

- [ ] **Step 5: Write failing table-driven tests for all four actions**

Use hand-derived expected rows to cover these observable behaviors:

```js
const cases = [
  {
    name: 'view preserves numbered source as neutral rows',
    args: { command: 'view', path: '/tmp/a.py', view_range: [8, 9] },
    output: "header\n    8\tone\n    9\ttwo",
    want: [
      { type: 'context', oldLine: 8, newLine: 8, text: 'one' },
      { type: 'context', oldLine: 9, newLine: 9, text: 'two' },
    ],
  },
  {
    name: 'create renders every file_text line as added',
    args: { command: 'create', path: '/tmp/a.py', file_text: 'one\ntwo' },
    want: [
      { type: 'add', oldLine: null, newLine: 1, text: 'one' },
      { type: 'add', oldLine: null, newLine: 2, text: 'two' },
    ],
  },
  {
    name: 'insert starts after insert_line when output context is unavailable',
    args: { command: 'insert', path: '/tmp/a.py', insert_line: 9, new_str: 'one\ntwo' },
    want: [
      { type: 'add', oldLine: null, newLine: 10, text: 'one' },
      { type: 'add', oldLine: null, newLine: 11, text: 'two' },
    ],
  },
];
```

Also cover:

- directory `view` output becoming `kind: 'listing'`;
- `str_replace` producing interleaved context/remove/add rows rather than two wholesale blocks;
- successful `str_replace` line numbers being anchored when `new_str` occurs in the numbered post-edit snippet;
- `insert` combining numbered surrounding context with the inserted rows when the output contains the insertion;
- explicit failures becoming `kind: 'error'` for every supported action;
- missing required fields, the string `"None"`, malformed arguments, and unsupported `undo_edit` becoming `kind: 'fallback'` without throwing.

- [ ] **Step 6: Run the focused test and confirm RED**

Run: `npm test -- --run src/test/strReplaceEditorPresentation.test.js`

Expected: FAIL because `buildEditorPresentation()` does not yet implement the action branches.

- [ ] **Step 7: Implement the minimal action model and internal line differ**

Implement an internal line-based longest-common-subsequence differ. Trim only the synthetic final array element caused by a trailing newline; do not trim source whitespace. Use common prefix/suffix reduction before the LCS matrix. If the middle matrix would exceed 250,000 cells, emit the unmatched old middle as removals and unmatched new middle as additions rather than allocating an unbounded matrix.

For `str_replace`, attempt to locate the exact `new_str` line sequence in parsed post-edit output and use its first line as the new-line anchor. When no anchor is available, leave both line numbers `null`. For `insert`, first try the same exact sequence match in output context; otherwise start new line numbers at `insert_line + 1`.

- [ ] **Step 8: Re-run the model tests and confirm GREEN**

Run: `npm test -- --run src/test/strReplaceEditorPresentation.test.js`

Expected: PASS with no warnings.

- [ ] **Step 9: Commit the pure model**

```bash
git add src/strReplaceEditorPresentation.js src/test/strReplaceEditorPresentation.test.js
git commit -m "feat: model str replace editor diffs"
```

### Task 2: Render the review surface

**Files:**
- Create: `src/components/StrReplaceEditorView.jsx`
- Create: `src/components/StrReplaceEditorView.css`
- Create: `src/test/StrReplaceEditorView.test.jsx`

**Interfaces:**
- Consumes: `presentation: EditorPresentation` from Task 1.
- Produces: `<StrReplaceEditorView presentation={presentation} />`.

- [ ] **Step 1: Write failing component tests for semantic rendering**

Render literal presentation models and assert behavior, not implementation details:

- a preview exposes a region labelled `Viewed source` and shows line numbers without `+`/`−` markers;
- a replacement exposes a region labelled `Changes`, with accessible `removed line` and `added line` row labels;
- a listing exposes `Directory contents` and preserves each path;
- an error exposes an alert with the original failure message;
- a fallback exposes `Tool output` as preformatted text;
- a 300-character source line remains one text row, making horizontal scrolling possible rather than wrapping into fabricated lines.

```jsx
render(<StrReplaceEditorView presentation={{
  kind: 'diff',
  action: 'str_replace',
  path: '/tmp/a.py',
  rows: [
    { type: 'remove', oldLine: 4, newLine: null, text: 'old()' },
    { type: 'add', oldLine: null, newLine: 4, text: 'new()' },
  ],
}} />);

expect(screen.getByRole('region', { name: 'Changes' })).toBeInTheDocument();
expect(screen.getByLabelText('removed line 4')).toHaveTextContent('old()');
expect(screen.getByLabelText('added line 4')).toHaveTextContent('new()');
```

- [ ] **Step 2: Add a throwing component stub, then run the component test and confirm RED**

Create `src/components/StrReplaceEditorView.jsx` with a default component that throws `new Error('not implemented')`. Do not add markup yet.

Run: `npm test -- --run src/test/StrReplaceEditorView.test.jsx`

Expected: FAIL during render with `not implemented`, proving the test exercises the real component boundary.

- [ ] **Step 3: Implement the semantic row renderer**

Use a single scroll container with CSS-grid rows containing old-line, new-line, marker, and code cells. Render source text with text nodes inside `<code>`; do not use `dangerouslySetInnerHTML`. Give additions/removals restrained backgrounds and left-edge accents based on existing dark theme tokens. Keep context neutral and errors visually distinct.

- [ ] **Step 4: Implement focused responsive CSS**

Use tabular numerals in gutters, `white-space: pre`, and horizontal overflow on the review surface. Keep gutters sticky on horizontal scroll if they do not obscure text. At narrow comparison widths, reduce gutter padding but never hide line numbers or markers. Add a visible focus style to the scroll region.

- [ ] **Step 5: Re-run the component test and confirm GREEN**

Run: `npm test -- --run src/test/StrReplaceEditorView.test.jsx`

Expected: PASS with no accessibility or React warnings.

- [ ] **Step 6: Commit the renderer**

```bash
git add src/components/StrReplaceEditorView.jsx src/components/StrReplaceEditorView.css src/test/StrReplaceEditorView.test.jsx
git commit -m "feat: render editor calls as review surfaces"
```

### Task 3: Integrate the renderer into `ToolCall`

**Files:**
- Modify: `src/components/ToolCall.jsx`
- Modify: `src/components/ToolCall.css`
- Create: `src/test/ToolCall.editor.test.jsx`

**Interfaces:**
- Consumes: `buildEditorPresentation(parsedArgs, rawOutputContent)` and `isExplicitEditorError(rawOutputContent)` from Task 1.
- Consumes: `StrReplaceEditorView` from Task 2.
- Preserves: existing `ToolCall({ toolCall })` public props.

- [ ] **Step 1: Write failing integration tests against the real `ToolCall`**

Use `userEvent` to expand calls with complete real tool-call shapes. Prove:

- `str_replace_editor/view` renders the path plus `Viewed source` after expansion;
- `str_replace_editor/str_replace` renders remove/add rows and does not show the generic `Output` block by default;
- successful calls offer closed `Raw Arguments` and `Raw Output` disclosures;
- opening `Raw Output` reveals the unmodified tool result;
- an explicit failure displays a red failure icon/state and visible alert, not a green completion icon or speculative diff;
- unsupported editor commands preserve generic output;
- `file_editor` still renders its existing action/path/output presentation.

- [ ] **Step 2: Run the integration test and confirm RED**

Run: `npm test -- --run src/test/ToolCall.editor.test.jsx`

Expected: FAIL because `ToolCall` still renders generic output for every editor action.

- [ ] **Step 3: Delegate only `str_replace_editor` to the new component**

Keep raw output before JSON pretty-printing for the presentation builder; the current pretty-printed/ANSI-cleaned value remains available to generic tools. Memoize the presentation from parsed arguments and raw output. Render the new component before disclosures and suppress the old always-visible output block only when the specialized presentation is active.

- [ ] **Step 4: Correct the editor status state**

For `str_replace_editor`, derive `failed` from the explicit error prefix. Render success only when output exists and is not a failure; render error when failed; retain the current pending state when output is absent. Add an accessible status label so tests and screen-reader users do not infer state from color alone.

- [ ] **Step 5: Add successful raw-output disclosure and error-card styling**

Reuse the visual language of `Raw Arguments`. Keep error output visible in the main body and do not duplicate it in an open section. Ensure ANSI cleanup still applies to generic tool output and raw editor output.

- [ ] **Step 6: Re-run integration and existing message tests**

Run:

```bash
npm test -- --run src/test/ToolCall.editor.test.jsx src/test/Message.test.jsx src/test/Message.header.test.jsx
```

Expected: PASS. Existing message tool summaries still count output-bearing calls as complete; this task changes the detailed card status, not facet counting.

- [ ] **Step 7: Commit the integration**

```bash
git add src/components/ToolCall.jsx src/components/ToolCall.css src/test/ToolCall.editor.test.jsx
git commit -m "feat: integrate editor diff visualization"
```

### Task 4: Verify real trajectories and the complete application

**Files:**
- Modify if defects are found: files from Tasks 1–3 and their corresponding tests only.

**Interfaces:**
- Consumes real examples: `examples/sample-with-task.json` and `examples/test-sample-with-str_replace_editor-error.jsonl`.
- Produces no new public interface.

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all tests pass, ESLint reports no errors, and Vite completes a production build.

- [ ] **Step 2: Start the development server for visual verification**

Run: `npm run dev -- --host 127.0.0.1`

Open the app and load `examples/sample-with-task.json`. Check one `view`, one `create`, and one successful `str_replace` call at full width and in comparison mode.

- [ ] **Step 3: Verify insertion and failure cases from the large JSONL fixture**

Load a trajectory from `examples/test-sample-with-str_replace_editor-error.jsonl` containing `insert`, then one containing an output that begins `[An error occurred during execution.]`. Confirm context/addition alignment, horizontal scrolling, explicit failure state, and raw disclosures.

- [ ] **Step 4: Check layout at representative widths**

Inspect approximately 1000 px full-view width, a 500 px comparison pane, and a 360 px narrow viewport. Confirm gutters remain legible, long source lines scroll, disclosure summaries remain reachable by keyboard, and the outer trajectory does not gain unintended horizontal overflow.

- [ ] **Step 5: Fix only observed defects test-first**

For each defect, add the smallest failing model or component test, run it to confirm RED, implement the correction, and rerun the focused test before repeating the full verification commands.

- [ ] **Step 6: Commit verification fixes if any**

```bash
git add src/strReplaceEditorPresentation.js src/components/StrReplaceEditorView.jsx src/components/StrReplaceEditorView.css src/components/ToolCall.jsx src/components/ToolCall.css src/test/strReplaceEditorPresentation.test.js src/test/StrReplaceEditorView.test.jsx src/test/ToolCall.editor.test.jsx
git commit -m "fix: polish editor diff visualization"
```

- [ ] **Step 7: Review the final branch diff**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -5
```

Expected: only planned files are changed, `git diff --check` is silent, and the task commits are visible. Do not merge, push, publish, or open a pull request unless explicitly requested.
