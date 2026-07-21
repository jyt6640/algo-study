const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["apiBase", "token"]).then(({ apiBase, token }) => {
  if (apiBase) $("apiBase").value = apiBase;
  if (token) $("token").value = token;
});

$("save").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim();
  const token = $("token").value.trim();
  await chrome.storage.local.set({ apiBase, token });
  $("status").textContent = "저장됐어요 ✓";
  setTimeout(() => ($("status").textContent = ""), 1500);
});

// LeetCode 로그인 세션에서 현재 username 을 감지해 계정에 연동
$("link").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim();
  const token = $("token").value.trim();
  const set = $("linkStatus");
  set.style.color = "#34d399";
  set.textContent = "";

  if (!apiBase || !token) {
    set.style.color = "#f87171";
    set.textContent = "API 주소와 토큰을 먼저 저장하세요.";
    return;
  }

  try {
    set.textContent = "LeetCode 로그인 확인 중…";
    const gql = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include", // 로그인 쿠키 포함
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ userStatus { isSignedIn username } }" }),
    });
    const data = await gql.json();
    const status = data?.data?.userStatus;
    if (!status?.isSignedIn || !status.username) {
      set.style.color = "#f87171";
      set.textContent = "leetcode.com 에 로그인돼 있지 않아요. 로그인 후 다시 시도하세요.";
      return;
    }

    set.textContent = `@${status.username} 연동 중…`;
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ handle: status.username }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);

    set.style.color = "#34d399";
    set.textContent = `연동 완료 ✓  @${status.username}`;
  } catch (e) {
    set.style.color = "#f87171";
    set.textContent = "연동 실패: " + (e instanceof Error ? e.message : String(e));
  }
});
