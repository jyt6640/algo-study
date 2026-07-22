// 우리 웹앱 페이지에서 실행되는 브리지.
// 웹 페이지는 CORS 때문에 leetcode.com 에 직접 접근 못 하므로, 확장이 대신 LeetCode 세션으로
// 최근 Accepted 풀이의 코드를 가져와 페이지로 돌려준다. (페이지가 그걸 자기 세션으로 서버에 저장)

function gql(query, variables) {
  return fetch("https://leetcode.com/graphql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  }).then((r) => r.json());
}

async function fetchLeetcode() {
  const us = await gql("{ userStatus { isSignedIn username } }");
  const status = us?.data?.userStatus;
  if (!status?.isSignedIn || !status.username) {
    return { error: "leetcode.com 에 로그인돼 있지 않아요. LeetCode 로그인 후 다시 시도하세요." };
  }
  const rec = await gql(
    "query r($u:String!){recentAcSubmissionList(username:$u,limit:20){id title titleSlug timestamp}}",
    { u: status.username },
  );
  const list = rec?.data?.recentAcSubmissionList || [];
  const problems = [];
  for (const s of list) {
    let code = "";
    let language = "";
    try {
      const d = await gql("query d($id:Int!){submissionDetails(submissionId:$id){code lang{name}}}", {
        id: Number(s.id),
      });
      code = d?.data?.submissionDetails?.code || "";
      language = d?.data?.submissionDetails?.lang?.name || "";
    } catch (e) {
      /* noop */
    }
    problems.push({
      slug: s.titleSlug,
      title: s.title,
      acceptedAt: new Date(Number(s.timestamp) * 1000).toISOString(),
      code,
      language,
    });
  }
  return { problems };
}

window.addEventListener("message", async (ev) => {
  if (ev.source !== window || !ev.data) return;
  if (ev.data.type === "ALGOSTUDY_PING") {
    window.postMessage({ type: "ALGOSTUDY_PONG" }, "*");
    return;
  }
  if (ev.data.type === "ALGOSTUDY_FETCH_LEETCODE") {
    try {
      const res = await fetchLeetcode();
      window.postMessage({ type: "ALGOSTUDY_LEETCODE_DATA", ...res }, "*");
    } catch (e) {
      window.postMessage({ type: "ALGOSTUDY_LEETCODE_DATA", error: String(e) }, "*");
    }
  }
});

// 페이지가 확장 존재를 감지할 수 있게 표식
window.postMessage({ type: "ALGOSTUDY_PONG" }, "*");
