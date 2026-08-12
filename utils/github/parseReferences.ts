// Parses this app's existing board-scoped card ids (e.g. "#3-12", already
// shown everywhere in the UI — see utils/idColor.ts / colorForNumber) out
// of commit messages, PR titles/descriptions, and PR comments.
//
// Two different things get parsed for, on purpose:
//   - Any "#3-12" mention anywhere just links the commit/PR to that card
//     (shows up in its Development panel) — no state change.
//   - "Closes #3-12" (or Fixes/Resolves, case-insensitive, matching
//     GitHub's own convention) is the one that additionally triggers the
//     move-to-done automation, but ONLY on an actual PR-merged event (see
//     app/api/github/webhook/route.ts) — never from a bare mention, and
//     never from a direct push.
//   - "Closes #3-12 -> "List Name"" overrides which list it moves to
//     instead of the board's default done list.
//
// GitHub's own autolinker will independently treat the "#3" substring as a
// reference to that repo's own issue/PR #3 if one exists — a known,
// accepted cosmetic side effect (see design conversation), not something
// this parser needs to work around.

export interface CardRef {
  boardNumber: number;
  cardNumber: number;
}

export interface CloseDirective extends CardRef {
  overrideListName: string | null;
}

const CARD_REF_PATTERN = /#(\d+)-(\d+)\b/g;

const CLOSE_DIRECTIVE_PATTERN =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)-(\d+)(?:\s*->\s*"([^"]+)")?/gi;

function dedupeRefs(refs: CardRef[]): CardRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.boardNumber}-${ref.cardNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Every "#board-card" mention in the text, regardless of keyword — used to
// decide what to link (commits/PRs shown on the card), not what to close.
export function parseCardReferences(text: string): CardRef[] {
  if (!text) return [];
  const refs: CardRef[] = [];
  for (const match of text.matchAll(CARD_REF_PATTERN)) {
    refs.push({
      boardNumber: parseInt(match[1], 10),
      cardNumber: parseInt(match[2], 10),
    });
  }
  return dedupeRefs(refs);
}

// Only "Closes/Fixes/Resolves #board-card" directives — used to decide
// what the merge automation should act on.
export function parseCloseDirectives(text: string): CloseDirective[] {
  if (!text) return [];
  const directives: CloseDirective[] = [];
  for (const match of text.matchAll(CLOSE_DIRECTIVE_PATTERN)) {
    directives.push({
      boardNumber: parseInt(match[1], 10),
      cardNumber: parseInt(match[2], 10),
      overrideListName: match[3] || null,
    });
  }
  // Dedupe on the card, keeping the LAST directive seen for that card (a PR
  // description that says both "Closes #3-12" and later "Closes #3-12 ->
  // "QA"" should honor the more specific one it ends with).
  const byCard = new Map<string, CloseDirective>();
  for (const d of directives) byCard.set(`${d.boardNumber}-${d.cardNumber}`, d);
  return Array.from(byCard.values());
}
