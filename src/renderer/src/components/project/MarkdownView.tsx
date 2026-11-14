import { Fragment, type ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

/** Minimal, safe Markdown block parser (no raw HTML is ever rendered). */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = (): void => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (list) {
      blocks.push({ kind: 'list', ...list });
      list = null;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        code.push(lines[i] ?? '');
        i += 1;
      }
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s*(.+)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1]?.length ?? 1, text: heading[2] ?? '' });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || ordered) {
      if (paragraph.length) {
        blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
        paragraph = [];
      }
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        if (list) {
          blocks.push({ kind: 'list', ...list });
        }
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet?.[1] ?? ordered?.[1] ?? '').trim());
      continue;
    }
    if (list && /^\s{2,}/.test(line)) {
      // Continuation of the previous list item.
      const last = list.items.length - 1;
      list.items[last] = `${list.items[last] ?? ''} ${trimmed}`;
      continue;
    }
    if (list) {
      blocks.push({ kind: 'list', ...list });
      list = null;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={index} className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.85em] text-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
      return (
        <strong key={index} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

const HEADING_CLASSES = [
  'text-lg font-bold',
  'text-base font-semibold',
  'text-sm font-semibold',
  'text-sm font-semibold text-muted'
];

export function MarkdownView({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <article data-testid="markdown-view" className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const level = Math.min(block.level, 4);
            const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2';
            return (
              <Tag key={index} className={`${HEADING_CLASSES[level - 1] ?? ''} mt-2 text-fg`}>
                {renderInline(block.text)}
              </Tag>
            );
          }
          case 'paragraph':
            return <p key={index}>{renderInline(block.text)}</p>;
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag
                key={index}
                className={`flex flex-col gap-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ListTag>
            );
          }
          case 'code':
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-lg border border-line bg-sunken p-3 font-mono text-xs text-fg"
              >
                {block.text}
              </pre>
            );
          case 'rule':
            return <hr key={index} className="border-line" />;
        }
      })}
    </article>
  );
}
