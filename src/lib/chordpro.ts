export interface ChordProMeta {
  title: string;
  subtitle: string;
  artist: string;
  key: string;
  ccli: string;
  tempo: string;
  timeSignature: string;
  capo: string;
  tags: string[];
  comments: string[];
}

export interface ChordProParsed {
  meta: ChordProMeta;
  raw: string;
  /** Lines with chords rendered inline — for display */
  lines: { chords: string[]; text: string }[];
}

const META_DIRECTIVES = new Map([
  ['title', 'title'], ['t', 'title'],
  ['subtitle', 'subtitle'], ['st', 'subtitle'],
  ['artist', 'artist'], ['a', 'artist'],
  ['key', 'key'], ['k', 'key'],
  ['ccli', 'ccli'],
  ['tempo', 'tempo'],
  ['time', 'timeSignature'],
  ['capo', 'capo'],
]);

export function parseChordPro(input: string): ChordProParsed {
  const meta: ChordProMeta = {
    title: '', subtitle: '', artist: '', key: '', ccli: '',
    tempo: '', timeSignature: '', capo: '', tags: [], comments: [],
  };
  const lines: { chords: string[]; text: string }[] = [];
  const comments: string[] = [];

  const textLines = input.split('\n');

  for (const raw of textLines) {
    const line = raw.trimEnd();

    // Directive: {title: Amazing Grace}
    if (line.startsWith('{') && line.endsWith('}')) {
      const inner = line.slice(1, -1);
      const colonIdx = inner.indexOf(':');
      if (colonIdx !== -1) {
        const key = inner.slice(0, colonIdx).trim().toLowerCase();
        const val = inner.slice(colonIdx + 1).trim();
        const metaKey = META_DIRECTIVES.get(key);
        if (metaKey && metaKey in meta) {
          (meta as any)[metaKey] = val;
        }
      } else if (inner.startsWith('comment') || inner.startsWith('c:')) {
        const commentText = inner.includes(':') ? inner.split(':').slice(1).join(':').trim() : inner.replace(/^comment\s*/i, '');
        comments.push(commentText);
      }
      continue;
    }

    // Lyric line: may contain [chord]text
    const chords: string[] = [];
    let text = '';
    let remaining = line;
    while (remaining.length > 0) {
      const open = remaining.indexOf('[');
      if (open === -1) {
        text += remaining;
        break;
      }
      const close = remaining.indexOf(']', open);
      if (close === -1) {
        text += remaining;
        break;
      }
      text += remaining.slice(0, open);
      chords.push(remaining.slice(open + 1, close));
      remaining = remaining.slice(close + 1);
    }
    lines.push({ chords, text });
  }

  meta.comments = comments;

  // Try to infer key from first directive if not set
  if (!meta.key) {
    for (const line of textLines) {
      const match = line.match(/^\{key:\s*([^}]+)\}/i);
      if (match) { meta.key = match[1].trim(); break; }
    }
  }

  // Infer artist from subtitle if no explicit artist
  if (!meta.artist && meta.subtitle) {
    meta.artist = meta.subtitle;
  }

  // Infer tags from comments like "tag: worship"
  for (const c of comments) {
    const tagMatch = c.match(/^tag:\s*(.+)/i);
    if (tagMatch) meta.tags.push(tagMatch[1].trim());
  }

  return { meta, raw: input, lines };
}

/** Serialize parsed data back to ChordPro string */
export function toChordPro(parsed: ChordProParsed): string {
  const { meta, lines } = parsed;
  const directives: string[] = [];
  if (meta.title) directives.push(`{title: ${meta.title}}`);
  if (meta.artist) directives.push(`{artist: ${meta.artist}}`);
  if (meta.key) directives.push(`{key: ${meta.key}}`);
  if (meta.ccli) directives.push(`{ccli: ${meta.ccli}}`);
  if (meta.tempo) directives.push(`{tempo: ${meta.tempo}}`);
  if (meta.timeSignature) directives.push(`{time: ${meta.timeSignature}}`);
  if (meta.capo) directives.push(`{capo: ${meta.capo}}`);
  if (meta.subtitle) directives.push(`{subtitle: ${meta.subtitle}}`);
  for (const c of meta.comments) directives.push(`{comment: ${c}}`);
  const body = lines.map(l => {
    let line = '';
    let charIdx = 0;
    for (const chord of l.chords) {
      // Find where to insert chord in the text
      const before = l.text.slice(charIdx, charIdx + chord.length);
      line += `[${chord}]`;
      charIdx += chord.length;
    }
    line += l.text.slice(charIdx);
    return line;
  }).join('\n');
  return [...directives, '', body].join('\n');
}