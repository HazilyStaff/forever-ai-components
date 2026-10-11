import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'preview-bridge.js'), 'utf8');
const tag = `<script data-fc-bridge>\n${source}</script>\n`;

/** Returns a copy of a component's HTML with the preview bridge as the first script. */
export function withBridge(html) {
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + '\n' + tag + html.slice(head.index + head[0].length);
  const root = /<html[^>]*>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + '\n' + tag + html.slice(root.index + root[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return doctype[0] + '\n' + tag + html.slice(doctype[0].length);
  return tag + html;
}
