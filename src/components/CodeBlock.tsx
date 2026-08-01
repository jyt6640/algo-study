import hljs from "highlight.js/lib/common";

// LeetCode/프로그래머스가 주는 언어명 → highlight.js 언어 id
const LANG_MAP: Record<string, string> = {
  python3: "python",
  python: "python",
  cpp: "cpp",
  "c++": "cpp",
  c: "c",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  csharp: "csharp",
  "c#": "csharp",
  golang: "go",
  go: "go",
  kotlin: "kotlin",
  swift: "swift",
  ruby: "ruby",
  rust: "rust",
  scala: "scala",
  php: "php",
  mysql: "sql",
  sql: "sql",
};

function normalize(language?: string | null): string | null {
  if (!language) return null;
  const key = language.trim().toLowerCase();
  if (LANG_MAP[key]) return LANG_MAP[key];
  return hljs.getLanguage(key) ? key : null;
}

/** 코드를 하이라이트한 HTML 문자열로 변환 (서버에서 사용) */
export function highlightCode(code: string, language?: string | null): string {
  const lang = normalize(language);
  try {
    return lang
      ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value;
  } catch {
    // 하이라이트 실패 시 원문(이스케이프)로 폴백
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

export function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const lang = normalize(language);
  const html = highlightCode(code, language);

  return (
    <pre
      className="hljs overflow-auto rounded-2xl p-4 text-sm leading-relaxed"
      style={{ fontFamily: "var(--mono)" }}
    >
      <code
        className={lang ? `language-${lang}` : undefined}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}
