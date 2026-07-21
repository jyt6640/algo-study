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
