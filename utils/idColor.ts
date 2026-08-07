// Derives a display color purely from an entity's id — replaces the old
// user-picked color swatches on workspaces/boards. Two entry points:
//
//   colorForNumber(n)  — for the new scoped display numbers (board.number,
//                         list.number, card.number). Use this wherever one
//                         is available.
//   colorForKey(uuid)  — fallback for entities that don't have a scoped
//                         number (currently just workspaces, which are the
//                         top of the hierarchy and don't need a shareable
//                         number of their own).
//
// Both funnel into the same mixing step so adjacent inputs (1 and 2, or
// two UUIDs that only differ in one character) land on unrelated palette
// slots — deliberately NOT a smooth/linear gradient, which is what made
// sequential ids look near-identical before.

// 32-bit integer mix — this is the finalizer from MurmurHash3, chosen
// because it has excellent avalanche behavior: flipping even one bit of
// input flips ~half the output bits. That's what makes id=1 and id=2 land
// on unrelated colors instead of adjacent ones on a gradient.
function mix32(input: number): number {
  let h = input | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Folds an arbitrary string (e.g. a UUID) down to a 32-bit int (FNV-1a)
// before feeding it through the same mixing step as the numeric path.
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A curated palette of just 16 named colors was tried first and rejected:
// even with a well-mixed hash, bucketing into only 16 slots means several
// of those slots inevitably sit close together on the color wheel (this
// palette's cyan/sky/blue, for instance) — so two adjacent numbers could
// hash to *different* slots that still look like the same color family.
// A continuous hue avoids the bucketing problem, but a plain hash-to-hue
// has a subtler issue: a hash is only *uniformly random* over a large
// sample — for a SMALL set of real items (a user's actual handful of
// workspaces, say), independent random points can and do visibly cluster
// in one region purely by chance (same as the birthday paradox). That's
// what "all my workspaces look green" was — not a bug in the hash, just
// bad luck inherent to small-N random sampling.
//
// For anything with a real sequential number (board/list/card), the fix
// is the golden angle (~137.5°): stepping hue by this exact amount per
// increment is the standard technique (phyllotaxis / D3 categorical
// color generation) for guaranteeing well-spread colors for ANY prefix of
// N sequential points, not just probabilistically for a large sample —
// consecutive numbers are always ~137.5° apart, and any run of N
// consecutive numbers ends up nicely spread around the wheel.
const GOLDEN_ANGLE = 137.50776;
const SATURATION = 68;
const LIGHTNESS = 50;

function hueToHsl(hue: number): string {
  return `hsl(${((hue % 360) + 360) % 360}, ${SATURATION}%, ${LIGHTNESS}%)`;
}

/** Color for a scoped display number (board.number, list.number, card.number). */
export function colorForNumber(n: number): string {
  return hueToHsl(n * GOLDEN_ANGLE);
}

/**
 * Color for an entity keyed only by UUID (currently: single-workspace
 * contexts — a board/board-page breadcrumb, a "creating in: X" line —
 * where only one workspace is ever shown at a time, so a stable hash is
 * enough; nothing needs to visually differ from anything else on screen).
 */
export function colorForKey(id: string): string {
  const hue = mix32(hashString(id)) % 360;
  return hueToHsl(hue);
}

/**
 * Color for an item's position within a list you're rendering right now —
 * use this instead of colorForKey whenever SEVERAL workspaces (or any
 * other UUID-keyed, non-numbered entity) are shown side by side, so they
 * inherit the same golden-angle guarantee that boards/cards get: any run
 * of N items in the list is spread around the wheel, not just probably
 * spread. Prefer colorForNumber when a real stored number exists (it's
 * stable regardless of sort order); reach for this only when the entity
 * has no number of its own at all.
 */
export function colorForIndex(index: number): string {
  return hueToHsl(index * GOLDEN_ANGLE);
}
