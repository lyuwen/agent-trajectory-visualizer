# `str_replace_editor` Diff Design

## Goal

Replace the generic argument/output presentation for `str_replace_editor` with an action-aware file review surface. A reader should be able to distinguish inspected source, created content, replacements, insertions, and failed operations without opening raw JSON.

## Confirmed data shapes

- `view` has `path` and optional `view_range`; successful file output contains `cat -n`-style numbered lines, while directory output is an unnumbered path listing.
- `create` has the complete new file in `file_text`; successful output is usually only a confirmation.
- `str_replace` normally has `old_str` and `new_str`; successful output often contains a numbered post-edit snippet.
- `insert` has `insert_line` and `new_str`; successful output contains a numbered post-edit snippet. In the observed data, insertion occurs after `insert_line`.
- Explicit failures begin with `[An error occurred during execution.]` and must not be represented as successful changes.
- Some trajectories contain schema filler values such as the string `"None"`; action-specific fields, rather than the presence of every possible field, determine rendering.

## Presentation

- Keep the existing collapsible tool card and path metadata.
- Render successful file `view` calls as a neutral, numbered source preview. A read operation must not receive addition markers.
- Render directory `view` calls as a compact neutral listing.
- Render successful `create` calls as an all-added diff using `file_text`.
- Render successful `str_replace` calls as a line diff computed from `old_str` and `new_str`. Use the post-edit snippet only to recover useful line-number anchors when possible.
- Render successful `insert` calls with surrounding context from the numbered post-edit snippet when it can be parsed; mark the inserted `new_str` lines as additions. Fall back to addition-only rows starting at `insert_line + 1`.
- Use two stable line-number gutters plus a marker gutter. Removal rows are restrained red, addition rows restrained green, and context/preview rows remain neutral. Long lines scroll horizontally rather than wrap, which keeps source alignment usable in comparison panes.
- Keep raw arguments in the existing disclosure. Put successful raw tool output in a second disclosure so the structured view is primary but no source information is lost.
- Show explicit failure output directly in an error panel and use an error status icon. Do not show a speculative diff for a failed mutation.
- If parsing or required action data is unavailable, preserve the current generic text output as a safe fallback.

## Boundaries

- Apply the new presentation only to `str_replace_editor`. Keep `file_editor` and all other tool renderers unchanged.
- Do not reconstruct whole-file state across calls. Each card presents only the evidence in that call's arguments and output.
- Do not add a diff dependency. A small pure line-diff helper is sufficient for the observed payload sizes and keeps the browser bundle stable.
- The out-of-scope `undo_edit` action uses the existing generic fallback.

## Testing

- Unit-test normalization and row generation for every supported action, numbered-output parsing, directory views, explicit errors, filler values, missing data, and insertion fallback.
- Component-test the rendered gutters, row semantics, error state, raw disclosures, and fallback behavior through the real `ToolCall` component.
- Run the complete Vitest suite, ESLint, and the production build.
- Visually inspect representative calls from `examples/sample-with-task.json` and `examples/test-sample-with-str_replace_editor-error.jsonl` at full width and in the comparison-pane width.
