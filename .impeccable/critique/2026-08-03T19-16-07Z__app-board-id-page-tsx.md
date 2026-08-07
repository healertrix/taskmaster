---
target: board page (app/board/[id]/page.tsx)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-03T19-16-07Z
slug: app-board-id-page-tsx
---
Method: dual-agent (A: general-purpose design-review agent · B: general-purpose detector/browser agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good toasts/spinners; drag-drop failure leaves no visible rollback if the optimistic move isn't reconciled |
| 2 | Match System / Real World | 3 | Standard, appropriate Trello-style vocabulary throughout |
| 3 | User Control and Freedom | 3 | Strong save-guard on modal close; but destructive actions have no undo |
| 4 | Consistency and Standards | 2 | Two incompatible destructive-confirm patterns; light-mode `dark:` classes surviving in an always-dark app |
| 5 | Error Prevention | 2 | Board delete is well-guarded; list/card delete is one click despite cascading data loss; likely `refetch()` runtime bug in drag error path |
| 6 | Recognition Rather Than Recall | 3 | Good visual recognition aids (dots, avatars, counts); label color bars are unlabeled, hover-only |
| 7 | Flexibility and Efficiency | 2 | Keyboard support exists, but 5 card-menu actions are no-ops disguised as successes |
| 8 | Aesthetic and Minimalist Design | 3 | Clean where the system is followed; search empty-states and delete modal reintroduce off-palette color |
| 9 | Error Recovery | 2 | Generic error toasts; raw `alert()` dialogs break the custom-toast tone at failure moments |
| 10 | Help and Documentation | 2 | No legend for color-coded dots; acceptable for Operate mode but a gap for first-timers |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: Judged blind, this does not read as authored specifically for Taskmaster — it reads as a generic Trello-clone scaffold with an incomplete dark reskin layered on top. Strongest tell: `app/board/[id]/page.tsx:99-235` still ships ~140 lines of dead sample data (fictional "Home Activity", "Excali Design" cards) that never renders but sits in the bundle. Multiple modals (`page.tsx:1712-1843`, `422-555`) still carry `dark:` Tailwind variants (`bg-red-50 dark:bg-red-900/20`) — vestiges of a light/dark system that no longer exists, since the app is permanently near-black. `TaskCard.tsx:154-217` hardcodes its own 30-entry legacy color map that ignores the `labelColors` prop threaded down from `page.tsx` — that prop is dead weight passed through three components for nothing.

Checked against DESIGN.md afterward: the *documented* system (near-black void, hairline borders, one white accent, dot-based list identity) is genuinely distinctive and, where actually applied — the list-identity dot in `ColumnContainer.tsx`, the base card border/hover in `TaskCard.tsx` — looks intentional and calm. The verdict is that the design language is specific, but the implementation is only partially migrated onto it; large parts of the surface (delete modal, search empty-states, `ListActionsMenu.tsx:242`'s `text-white/80 hover:bg-white/20`) look untouched by whoever wrote DESIGN.md.

**Deterministic scan**: `detect.mjs` on the board surface + related components returned exit code 2 with 6 findings (3 warning/slop, 3 advisory/quality), zero errors:

| Antipattern | Severity | File | Line | Detail |
|---|---|---|---|---|
| side-tab | warning | `CardModal.tsx` | 2255 | `border-r-4` — thick colored border on one side of a card, the classic AI-UI tell |
| border-accent-on-rounded | warning | `header.tsx` | 375 | `border-b-2` on a rounded element |
| border-accent-on-rounded | warning | `header.tsx` | 848 | `border-b-2` on a rounded element |
| design-system-color | advisory | `TaskCard.tsx` | 217 | Undocumented `#6b7280`, outside DESIGN.md palette |
| design-system-font-size | advisory | `TaskCard.tsx` | 325 | `text-[10px]` off the type ramp |
| design-system-radius | advisory | `globals.css` | 363 | `border-radius: 2px` outside the rounded scale |

Where the two assessments agree: both independently flagged forbidden-pattern survival from an earlier visual system — the detector caught the mechanical slop (side-tab borders, off-ramp values), the LLM review caught the same drift at a higher level (light-mode remnants, forbidden white/10 overlays). Where the detector caught something the LLM review didn't dwell on: the two `border-b-2` hits in `header.tsx` (375, 848) and the `border-r-4` in `CardModal.tsx:2255` are concrete, fixable slop the qualitative review didn't call out by line. Where the LLM review caught something the detector structurally can't: `ListActionsMenu.tsx:242`'s `text-white/80 hover:bg-white/20` violates DESIGN.md's explicit "no white/10 overlay" rule, but isn't a pattern the mechanical scanner checks for — a real gap in detector coverage worth knowing about. Likewise the orphaned `.task-card-hover` class in `globals.css:298-306` (colored `shadow-primary/15` glow, banned by DESIGN.md) wasn't flagged because the class name itself doesn't match a scanned antipattern signature.

**Visual overlays**: Not available this run — the Chrome extension wasn't connected, so no live in-browser screenshots or injected overlay evidence exists. All findings above are source-level (static detector + code reading), not live-rendered.

## Overall Impression

The documented design system ("Mission Control, restrained") is a real, well-considered point of view, and where it's actually been applied — the list-identity dot, the base card treatment — it works. But the board surface as shipped is a half-finished migration: dead scaffold data, an abandoned light/dark theme still bleeding through the highest-stakes modal (board deletion), and — more seriously — a card-menu that fires fake success toasts for five actions that do nothing. The single biggest opportunity is finishing the migration onto the documented system and closing the trust gap the stub actions open, before any further visual polish.

## What's Working

1. **List-identity dot system** (`page.tsx:560-575`, `ColumnContainer.tsx:129-133`): a deterministic hash-to-color assignment giving each list a stable, restrained identity marker without washing the whole column in color — exactly what DESIGN.md promises, actually implemented as documented.
2. **Board deletion flow** (`page.tsx:1711-1843`): type-the-board-name-to-confirm, itemized consequences, in-progress messaging, post-completion summary. Thoughtful, high-stakes UX most Trello clones skip.
3. **Save-in-progress guard** (`CardModal.tsx:404-441`): actively protects an in-flight comment/date/checklist save from being lost if the user hits Escape or clicks outside. Easy to skip, present here.

## Priority Issues

**[P0] Task-card menu fires fake success toasts** — `page.tsx:907-953`: `handleEditTask`, `handleCopyTask`, `handleManageLabels`, `handleManageAssignees`, `handleManageDueDate` are no-ops that show a *success*-styled toast reading "will be implemented soon."
**Why it matters**: users click a live-looking menu item, see what looks like a normal success confirmation, and conclude something happened. Once they discover it didn't, every other toast in the app becomes suspect.
**Fix**: remove these items from the menu until built, or mark them visibly disabled/"coming soon" — never route a stub through the real success-toast path.
**Suggested command**: `/impeccable harden`

**[P0] Likely runtime bug in drag-error recovery** — `page.tsx:1448`: the `catch` block in `handleDragEnd` calls `refetch()`, which isn't destructured or defined anywhere in the component's scope.
**Why it matters**: if a card-move API call fails, the error-recovery path itself throws a ReferenceError — at best silently failing to reconcile an optimistic move (a card visually sits in a list it was never saved to), at worst crashing the board depending on error-boundary setup.
**Fix**: wire this to the actual refetch/list-reload function from the board store, or drop the call and rely on the move mutation's own rollback.
**Suggested command**: `/impeccable audit`

**[P1] Destructive-action friction doesn't scale with blast radius** — board delete requires typing the board name; list delete (`ListActionsMenu.tsx:184-231`), which can silently take every card in that list with it, is one click in a flyout.
**Why it matters**: users build a mental model that friction signals danger — this app inverts it for the most common destructive action.
**Fix**: at minimum surface the card count in the list-delete confirm ("This will delete 7 cards — this can't be undone"); consider an undo-toast instead of upfront friction for lists/cards.
**Suggested command**: `/impeccable harden`

**[P1] Design-system drift: light-mode and forbidden-overlay remnants in an always-dark app** — `page.tsx:1714-1839` (`dark:bg-red-900/20`, `bg-yellow-50 dark:bg-yellow-900/20`, etc. across the delete and description modals), `ListActionsMenu.tsx:242` (`text-white/80 hover:bg-white/20`), plus the detector-confirmed `border-r-4`/`border-b-2` side-tab hits in `CardModal.tsx:2255` and `header.tsx:375,848`, and the off-ramp values in `TaskCard.tsx:217,325` and `globals.css:363`.
**Why it matters**: these surfaces — especially the delete confirmation — are exactly where the "Mission Control, restrained" identity should feel most deliberate, and instead look like a mis-pasted light-theme component.
**Fix**: route all of these through the DESIGN.md token set (`bg-destructive/10`, `border-destructive/30`, documented radius/type ramp), delete the `dark:` variants entirely, remove the orphaned `.task-card-hover` glow class in `globals.css:298-306`.
**Suggested command**: `/impeccable polish`

**[P2] Dead scaffold code undermines product-specific feel** — `page.tsx:99-235` (140 lines of unused sample data with placeholder card names) and duplicate label-color sources (`page.tsx:90-96,238-251` threaded as unused props vs. `TaskCard.tsx:154-217`'s own inline 30-entry map).
**Why it matters**: this is the strongest evidence the surface still reads as a generic scaffold rather than a bespoke product, and it's real tech debt — the next person to touch label colors will edit the wrong map.
**Fix**: delete the dead sample data; consolidate to one label-color source of truth.
**Suggested command**: `/impeccable distill`

## Persona Red Flags

**Sam (Accessibility-Dependent)**: Label identity is conveyed by an unlabeled ~1.5px color bar (`TaskCard.tsx:236-251`) with the actual label text only in a `title` attribute — not reliably announced by screen readers, no visible text fallback on the card face. Due-date status leans on color (amber/red/emerald dot) with text appended only for overdue/due-soon states, not the "on track" state — borderline color-only signaling. The custom `createPortal`-rendered menus (`ListActionsMenu.tsx`, `TaskActionsMenu.tsx`) show no evidence of `role="menu"` or roving-focus keyboard handling in the code read, unlike a native `<select>` or a library such as Radix.

**Riley (Stress-Tester)**: List/card deletion has no undo and lighter confirm friction than the data loss warrants (see P1) — a fat-fingered "Delete this list" click destroys every card in it with only a toast as record. The `refetch()` bug (P0) is exactly the kind of failure a stress-tester finds first: drag a card, drop the network mid-request, watch the error-recovery path itself throw.

**Jordan (First-Timer)**: The colored dots next to list names and due dates have no on-surface legend — a first-timer has no way to learn what amber vs. red means except by trial. Worse, if they open a card's "..." menu and hit "Manage labels" or "Manage due date," they get a friendly success toast for something that silently didn't happen (P0) — they'll conclude they misunderstand their own board rather than that the feature is fake.

## Minor Observations

- `getColumnStyle`'s hash function (`page.tsx:568-575`) only rotates 5 colors with no spacing guarantee — boards with >5 lists can get two adjacent lists the same dot color by coincidence.
- Ad hoc z-index values scattered across files (`z-20`, `z-50`, `z-[60]`, `z-[9999]`, `z-[10000]`, `z-[10001]`) with no centralized scale — a stacking-context bug waiting to happen as more overlays are added.
- Search "no results"/"start typing" empty states (`header.tsx:558-576,1004-1046`) use saturated orange/blue circular icon badges absent from DESIGN.md's palette.

## Questions to Consider

- If "one confident accent, reserved for CTAs/active states/focus rings" is the whole design thesis, why does deleting a board — the single highest-stakes moment in the app — abandon that system for a `red-50/red-900` light-mode palette that exists nowhere else in the product?
- Five card-menu actions currently fire a *success* toast for doing nothing — was this a deliberate placeholder, and what would a real user conclude happened to their card?
- `CardModal.tsx` is 3,342 lines and owns title, description, dates, labels, members, checklists, attachments, comments, and activity in one component — at what point does that stop being "one modal," and would splitting it change how confidently a first-timer can scan it?
</content>
