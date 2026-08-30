# Fix: polish live markdown rendering in the formatted editor (Orca-style)

- **Branch:** `fix/orca-style-live-markdown`
- **Status:** in-progress
- **Created:** 2026-08-30

## Goal

Polish the live markdown rendering added in PR #1 (`FormattedEditor.tsx`) to
close known gaps, aiming for something closer to the Orca markdown editor's
feel. Scope confirmed with the user: live-rendering polish only — a
block-based outliner model, slash-command menu, and hover/drag block handles
are explicitly deferred, not part of this pass.

Gaps being closed:

1. Typing a different block marker (`> `, `# `, `---`) on a list item past
   the first does nothing, because `getBlockElement` resolves to the whole
   `<ul>`/`<ol>` (a direct child of the editable root), which is in
   `ALREADY_SPECIAL_TAGS`.
2. `[text](url)` links have no live-rendering rule.
3. A lone `---`/`***`/`___` line doesn't become `<hr>`.
4. `***bold italic***` isn't handled.

Full design is in the approved plan at
`/Users/damekz/.claude/plans/piped-beaming-meteor.md`.

## Sub-tasks (1 PR)

- [x] `getBlockElement` stops at `<li>` in addition to a direct child of the
      editable root.
- [x] `applyBlockRule` returns `HTMLElement[] | null` instead of a single
      element; add the `---`/`***`/`___` → `<hr>` + empty-paragraph branch.
- [x] `replaceListItemBlock` helper: splits the surrounding list around a
      converted list item (before-list / converted node(s) / after-list).
- [x] `reformat()` calls `replaceListItemBlock` when `block.tagName === "LI"`,
      otherwise `block.replaceWith(...converted)` as before.
- [x] `INLINE_RULES` generalized to a `build(text) => HTMLElement` shape;
      add `***text***` / `___text___` (nested `<strong><em>`) rules ahead of
      the existing bold/italic rules.
- [x] Link `[text](url)` inline check added ahead of the `INLINE_RULES` loop
      in `applyInlineRule`.
- [x] CDP-driven verification (real `Input.dispatchKeyEvent type: "char"`
      typing, not `execCommand`) covering all of the above plus a full
      regression pass over previously-verified behavior.
- [x] `npm run build` && `npm run lint` clean.

## Progress Log

- 2026-08-30 — Plan approved. Starting implementation.
- 2026-08-30 — Implemented all sub-tasks in `FormattedEditor.tsx`. Verified via headless Chrome +
  CDP (`Input.dispatchKeyEvent type: "char"` for real per-character typing):
  - Link `[text](url)`, `---`/`***`/`___` → `<hr>`, and `***bold italic***` all render live and
    round-trip cleanly through save/reload.
  - List-item → different-block-type conversion (heading/quote/hr on a list item) now correctly
    splits the surrounding `<ul>`/`<ol>` into before/converted/after pieces, tested at the start,
    middle, and end of a 3-item list.
  - Regression pass over everything from PR #1 (heading/bold/italic/code, fresh list, fresh quote,
    save-then-reload persistence) still passes.
  - Korean IME composition safety re-verified (dispatched `compositionstart`/`compositionend`
    around inserted Hangul — no mid-composition DOM replacement).
  - `npm run build` && `npm run lint` clean (only the pre-existing, accepted
    `set-state-in-effect` warning on `App.tsx`'s fetch-on-mount effect).

## Issues & Resolutions

- **Issue:** Retyping "- "/"1. " as a list item's own text (e.g. after pressing Enter for a new
  item and typing the marker out of habit) matched the bullet/ordered block rule and split the
  list into two separate `<ul>` elements around a redundant single-item list, instead of just
  leaving the existing list continuation alone.
  **Resolution:** Skip the bullet/ordered checks in `applyBlockRule` specifically when
  `block.tagName === "LI"` — being inside a list item already satisfies that marker; only a
  genuinely different marker (heading/quote/hr) should trigger a conversion from within a list.

## Needs Human Attention

- Typing a second block-level marker as a later paragraph *inside* a blockquote (i.e. pressing
  Enter while the caret is still inside a `<blockquote>`) keeps that new paragraph inside the same
  blockquote rather than "exiting" it — this matches native contentEditable/most editors'
  Enter-continues-the-container behavior for blockquotes (the same convention lists already use),
  so it wasn't changed, but flagging it here in case the user expects Enter to exit a quote by
  default.
- Redundant "- "/"1. " markers retyped inside an existing list item are now left as literal text
  (see Issues & Resolutions above) rather than silently stripped — acceptable per the approved
  plan's scope, but worth knowing if it looks like a rough edge later.
