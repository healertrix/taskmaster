// Renders a description string with a tiny, deliberately non-WYSIWYG
// markup: **bold**, _italic_, ==highlight==, and bare URLs auto-linked. No
// editor library — the textarea stays plain text, this is just how it's
// read back. Kept intentionally simple: four rules, no nesting, no
// escaping. Italic uses underscores rather than single asterisks
// specifically to avoid any ambiguity with **bold**'s double asterisks.
//
// Bold is matched before italic in the alternation so **text** is never
// mistaken for two adjacent italic markers.

const TOKEN_RE =
  /(\*\*[^*\n]+\*\*)|(_[^_\n]+_)|(==[^=\n]+==)|(https?:\/\/[^\s]+)/g;

// Trailing punctuation that's almost always sentence punctuation rather
// than part of the URL itself (e.g. "check https://x.com." or "(see
// https://x.com)").
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}]+$/;

export function renderDescription(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [full, bold, italic, highlight, url] = match;

    if (bold) {
      nodes.push(<strong key={key++}>{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      nodes.push(<em key={key++}>{italic.slice(1, -1)}</em>);
    } else if (highlight) {
      nodes.push(
        <mark
          key={key++}
          className='bg-amber-400/30 text-foreground rounded px-0.5'
        >
          {highlight.slice(2, -2)}
        </mark>
      );
    } else if (url) {
      const trailingMatch = url.match(TRAILING_PUNCTUATION_RE);
      const trailing = trailingMatch ? trailingMatch[0] : '';
      const href = trailing ? url.slice(0, -trailing.length) : url;
      nodes.push(
        <a
          key={key++}
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          onClick={(e) => e.stopPropagation()}
          className='text-primary underline underline-offset-2 hover:text-primary/80 break-all'
        >
          {href}
        </a>
      );
      if (trailing) nodes.push(trailing);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
