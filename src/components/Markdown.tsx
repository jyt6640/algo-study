import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * 노션풍 마크다운 렌더러.
 * 원문 HTML 은 허용하지 않는다(rehype-raw 미사용) — 사용자 입력이 그대로 실행되지 않게.
 */
export function Markdown({ children, compact }: { children: string; compact?: boolean }) {
  return (
    <div className={`md ${compact ? "md-compact" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // 코드펜스(```java 등)에 신택스 하이라이팅. 언어를 몰라도 자동 감지.
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          // 표는 좁은 화면에서 가로 스크롤
          table: ({ children }) => (
            <div className="md-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
