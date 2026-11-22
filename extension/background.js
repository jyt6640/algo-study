// 배경 서비스 워커: content script 로부터 받은 제출을 우리 백엔드 /api/ingest 로 POST 한다.

const API_BASE = "https://algo-study-eight.vercel.app";

async function leetcodeGql(query, variables) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`LeetCode 요청 실패 (HTTP ${response.status})`);
  return response.json();
}

async function fetchLeetCodeSubmission(id) {
  const result = await leetcodeGql("query d($id:Int!){submissionDetails(submissionId:$id){code lang{name}}}", { id });
  const detail = result?.data?.submissionDetails;
  return {
    code: typeof detail?.code === "string" ? detail.code : "",
    language: typeof detail?.lang?.name === "string" ? detail.lang.name : "",
  };
}

async function fetchRecentLeetcode() {
  const user = await leetcodeGql("{ userStatus { isSignedIn username } }");
  const status = user?.data?.userStatus;
  if (!status?.isSignedIn || !status.username) {
    return { error: "leetcode.com 에 로그인돼 있지 않아요. LeetCode 로그인 후 다시 시도하세요." };
  }

  const recent = await leetcodeGql(
    "query r($u:String!){recentAcSubmissionList(username:$u,limit:20){id title titleSlug timestamp}}",
    { u: status.username },
  );
  const list = recent?.data?.recentAcSubmissionList || [];
  const problems = [];
  for (const submission of list) {
    let code = "";
    let language = "";
    try {
      ({ code, language } = await fetchLeetCodeSubmission(Number(submission.id)));
    } catch {
      code = "";
      language = "";
    }
    problems.push({
      slug: submission.titleSlug,
      title: submission.title,
      acceptedAt: new Date(Number(submission.timestamp) * 1000).toISOString(),
      code,
      language,
    });
  }
  return { problems };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "ALGOSTUDY_FETCH_LEETCODE") {
    fetchRecentLeetcode()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : "LeetCode 조회 실패" }));
    return true;
  }

  if (msg?.type !== "ALGOSTUDY_INGEST") return;

  (async () => {
    try {
      const stored = await chrome.storage.local.get(["apiBase", "token"]);
      const apiBase = stored.apiBase || API_BASE;
      const token = stored.token;
      if (!token) {
        sendResponse({ ok: false, error: "확장 팝업에서 연동 토큰을 먼저 입력하세요." });
        return;
      }

      let payload = msg.payload;
      const submissionId = Number(msg.leetcodeSubmissionId);
      if (Number.isSafeInteger(submissionId) && submissionId > 0 && !payload.code?.trim()) {
        const { code, language } = await fetchLeetCodeSubmission(submissionId);
        if (!code.trim()) {
          sendResponse({ ok: false, error: "LeetCode에서 제출 코드를 읽지 못했어요. 로그인 상태를 확인해 주세요." });
          return;
        }
        payload = { ...payload, code, language: language || payload.language };
      }

      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) sendResponse({ ok: false, error: data.error || `HTTP ${res.status}` });
      else sendResponse({ ok: true, ...data });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  return true; // async sendResponse
});
