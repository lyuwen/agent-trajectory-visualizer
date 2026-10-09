# Tool Card Header Detail and Turn Pills Design

## Goal

Make a collapsed view self-explanatory. Today a collapsed tool card shows only
`<tool name> - <summary>`, and a collapsed message shows one pill per tool name.
A reader cannot tell an edit from a read, or which commands ran, without
expanding everything. The collapsed surfaces should carry the same evidence the
expanded bodies do: file and line-change counts for edits, viewed range for
reads, split commands for shell calls, and a consistent color/symbol per kind of
work.

## Confirmed data shapes

- `str_replace_editor` edits carry their change in the arguments: `str_replace`
  has `old_str`/`new_str`, `create` has `file_text`, `insert` has `new_str` and
  `insert_line`.
- `str_replace_editor` reads (`view`) carry `path` and an optional
  `view_range`. `[start, -1]` means "from start to end of file"; a numbered
  `cat -n` output resolves the real last line. Directory views are an unnumbered
  listing with no line range.
- Shell calls (`execute_bash`, `terminal`, and similar) carry one `command`
  string that chains separate commands with `&&`, `||`, `|`, `;`, or newlines.
  Operators can appear inside quotes; heredocs span newlines.
- Trajectories use schema filler such as the string `"None"`, so action-specific
  fields rather than field presence decide rendering.

## Presentation

### Tool card header

- Keep the collapsed card exactly as it is (chevron, icon, name, status); add
  evidence chips after the name and before the summary.
- `str_replace_editor` edit: show the file path, then `++<additions>` in green
  and `--<removals>` in red.
- `str_replace_editor` read: show the file path and, when known, an
  `L<start>-<end>` range in blue. The observed numbered output is preferred over
  the requested `view_range`, because it resolves open-ended ranges and covers
  views that request no range. Directory listings show the path alone.
- Shell calls: reduce each chained command to the **program it runs** — not the
  full command — and show one cyan chip per distinct program, capped at four
  with a `+N` remainder chip. Env assignments and wrappers (`sudo`, `time`,
  `env`, `xargs`, …) are skipped, and the program path is reduced to its
  basename, so `FOO=1 sudo /usr/bin/python -m pytest` reads `python`.
- Programs that carry no signal (navigation, assignment, formatting, and pipe
  plumbing such as `cd`, `echo`, `head`, `tail`, `sort`, `wc`) are dropped when
  the chain contains at least one informative program, so
  `cd /workspace && grep -rn x . | head -40` reads `grep`. A chain made only of
  plumbing still shows those programs rather than an empty header.
- Quotes protect their contents from splitting, and a heredoc body is not split
  into separate commands. Each chip's `title` is the full command it came from.
- Long paths drop their parent directories and keep the basename
  (`…/file.py`); a basename that is itself too long keeps its right end. The
  full path stays available as the chip's `title`.
- The header row is atomic: the chips never break internally (a `--5` must not
  wrap at its hyphens) and never cut the filename off. Only the summary is
  elastic, so it absorbs any squeeze and truncates with an ellipsis.
- Counts and ranges describe the requested change and are shown even while a
  call is still pending; the expanded body still refuses to render a speculative
  diff without output.

### Colors and symbols

- One accent per nature, defined once as `--nature-*` tokens in `index.css`:
  shell (cyan, terminal), edit (pink, pencil), read (blue, eye), think (purple,
  brain), finish (green, flag), task (orange, people), other (gray, wrench).
- The tool card's leading icon uses the nature symbol and accent.
- The message title bar's pills use the same symbol and accent, and tint their
  border with it, so a collapsed turn shows at a glance what the agent did.
- Edit stats stay green/red inside the card, keeping the add/remove reading
  distinct from the read-only blue range.

### Turn pills

- Group calls by tool name *and* nature. A `str_replace_editor` turn that both
  views and edits produces a read (eye) pill and an edit (pencil) pill.
- A pill keeps the tool name when that tool has a single nature; when one tool
  spans several natures, the pills are labeled with the nature (`read`, `edit`)
  and their tooltip names the underlying tool.
- Each pill carries the collapsed-turn evidence, so the agentic flow is legible
  without expanding anything: an edit pill aggregates `++added`/`--removed`
  totals across the turn's edits, and a shell pill lists the distinct
  informative programs (capped at three with a `+N`, full list on the tooltip).
  Reads show neither, because their value is the files touched, which the name
  and count already carry.
- The pill strip wraps instead of clipping, so a narrow window grows the header
  rather than hiding the tail of the flow.
- Completion counts and titles are unchanged.

## Boundaries

- Apply the header chips only to `str_replace_editor` and the shell tool set.
  `file_editor` keeps its existing header; adding the same chips there is a
  one-line change once wanted.
- No new rendering dependency and no whole-file reconstruction: the header
  uses the same small diff helper as the expanded editor view.
- The shell splitter is a heuristic. Nested `$()`/backtick operators are not
  modelled, and arguments are intentionally discarded in the header; the
  untruncated command remains in the card body and in each chip's tooltip.
- The utility list is a curated constant, not a general shell parser: a command
  is plumbing only if its program name is in the list.
- The header is a fixed single row. At extreme card widths the title bar clips
  rather than wrapping the card taller.

## Testing

- Unit-test command splitting (chains, pipes, quotes, redirects, newlines,
  heredocs, empty input), program extraction (env assignments, wrappers, quotes,
  non-program syntax), utility filtering, nature classification, editor change
  counts, view ranges, and path formatting.
- Component-test the header chips, nature icons, caps, truncation, pending
  edits, and the unchanged fallback for other tools through `ToolCall`.
- Component-test the turn pills' nature classes, the read/edit split, and the
  aggregated line-change/program evidence through `Message`.
- Run the complete Vitest suite, ESLint, and the production build, and check the
  header row in a real browser at full and narrow (comparison-pane) widths.
