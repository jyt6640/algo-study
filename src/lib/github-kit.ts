// 4minus1is0/algorithm-study 컨벤션을 기반으로 한 표준 PR 템플릿 · 자동 라벨 · 라벨 세트.

export const PR_TEMPLATE = `<!--
## PR 제목 예시
{주차}: {난이도}-{제목}
ex) 1주차: Lv1-치킨배달
ex) 1주차: G5-치킨배달(100351)
ex) 9주차: Easy-Path Sum
-->

## 📌 문제 정보

| 항목 | 내용 |
|------|------|
| 문제 이름 | []() |
| 난이도 |  |
| 풀이 시간 |  |
| 해결 여부 | ✅ / ❌ |

## ⏱️ 시간 / 공간 복잡도

| 항목 | 내용 |
|------|------|
| 시간 복잡도 |  |
| 공간 복잡도 |  |

## 💡 풀이 접근법

> 어떻게 생각하고 접근했는지 간단히 설명해 주세요.


## 🚧 어려웠던 점 / 시행착오

> 틀렸던 이유, 헤맸던 부분 등을 자유롭게 적어주세요. (없으면 생략 가능)
`;

// GitHub 라벨 세트 (color 는 # 없이)
export const LABELS: Array<{ name: string; color: string; description: string }> = [
  { name: "LTS", color: "d93f0b", description: "LeetCode" },
  { name: "PGS", color: "5319e7", description: "프로그래머스" },
  { name: "BOJ", color: "b8fbf7", description: "백준" },
  { name: "RESOLVED", color: "9127cc", description: "스스로 문제 풀이 완료 (남의 풀이 및 AI ❌)" },
  { name: "UNRESOLVED", color: "9127cc", description: "남의 풀이 및 AI를 보고 풀이" },
  { name: "SLOW_RESOLVED", color: "6bdfc3", description: "오래 걸려 해결" },
  { name: "BFS/DFS", color: "a81f58", description: "" },
  { name: "GRAPH", color: "92ab9e", description: "" },
  { name: "DP", color: "58e865", description: "" },
  { name: "Two Pointers", color: "315c15", description: "투 포인터" },
  { name: "SORTING", color: "d8489d", description: "" },
  { name: "PQ", color: "eb0591", description: "우선순위큐" },
  { name: "Prefix Sum", color: "eec4ac", description: "" },
  { name: "greedy", color: "5b7fe5", description: "" },
  { name: "Binary Tree", color: "1554cb", description: "이진 트리" },
];

// PR 제목·본문·변경 경로로 라벨을 자동 부여하는 워크플로우
export const AUTO_LABEL_WORKFLOW = `name: Auto label PR
on:
  pull_request_target:
    types: [opened, edited, reopened, synchronize]
permissions:
  contents: read
  pull-requests: write
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request;
            const { owner, repo } = context.repo;
            const title = pr.title || "";
            const body = pr.body || "";
            const hay = (title + "\\n" + body).toLowerCase();
            const labels = new Set();

            // 플랫폼
            if (/leetcode|\\blts\\b/.test(hay)) labels.add("LTS");
            if (/프로그래머스|programmers|\\bpgs\\b|lv\\s?\\d/.test(hay)) labels.add("PGS");
            if (/백준|baekjoon|\\bboj\\b|acmicpc/.test(hay)) labels.add("BOJ");

            // 해결 여부
            const solved = body.match(/해결\\s*여부[^\\n|]*\\|([^\\n]*)/);
            const cell = solved ? solved[1] : "";
            if (/✅|스스로/.test(cell) || /\\bresolved\\b/i.test(body)) labels.add("RESOLVED");
            if (/❌/.test(cell) || /남의\\s*풀이|\\bai\\b/i.test(hay)) labels.add("UNRESOLVED");

            // 카테고리: 변경 파일 경로 폴더명
            const files = await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: pr.number, per_page: 100 });
            const map = { "bfs_dfs": "BFS/DFS", "bfs": "BFS/DFS", "dfs": "BFS/DFS", "dp": "DP", "graph": "GRAPH", "sort": "SORTING", "greedy": "greedy", "two_pointer": "Two Pointers", "prefix_sum": "Prefix Sum", "prefixsum": "Prefix Sum", "binary_tree": "Binary Tree", "pq": "PQ", "priority_queue": "PQ" };
            for (const f of files) {
              const p = f.filename.toLowerCase();
              for (const k of Object.keys(map)) if (p.includes("/" + k + "/") || p.startsWith(k + "/")) labels.add(map[k]);
            }

            if (labels.size) {
              await github.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: [...labels] });
            }
`;
