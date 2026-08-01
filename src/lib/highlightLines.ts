/**
 * highlight.js 가 만든 HTML 을 줄 단위로 자른다.
 * 여러 줄에 걸친 span(주석·문자열 등)은 줄 끝에서 닫고 다음 줄에서 다시 연다.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";

  const token = /(<span[^>]*>)|(<\/span>)|([^<]+)|(<[^>]+>)/g;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html)) !== null) {
    const [, openTag, closeTag, text, otherTag] = match;
    if (openTag) {
      open.push(openTag);
      current += openTag;
    } else if (closeTag) {
      open.pop();
      current += closeTag;
    } else if (text !== undefined) {
      const parts = text.split("\n");
      parts.forEach((part, index) => {
        if (index > 0) {
          current += "</span>".repeat(open.length);
          lines.push(current);
          current = open.join("");
        }
        current += part;
      });
    } else if (otherTag) {
      current += otherTag;
    }
  }

  lines.push(current);
  return lines;
}
