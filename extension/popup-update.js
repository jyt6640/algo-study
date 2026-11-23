(() => {
  const button = document.getElementById("checkUpdate");
  const status = document.getElementById("updateStatus");
  const version = document.getElementById("extensionVersion");
  version.textContent = `현재 버전 ${chrome.runtime.getManifest().version}`;

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "업데이트 확인 중…";

    try {
      const result = await chrome.runtime.requestUpdateCheck();
      switch (result.status) {
        case "update_available":
          status.textContent = "새 버전을 적용하는 중…";
          chrome.runtime.reload();
          break;
        case "no_update":
          status.textContent = "지금 받을 수 있는 새 버전이 없어요.";
          break;
        case "throttled":
          status.textContent = "Chrome이 확인 횟수를 제한했어요. 잠시 후 다시 시도해 주세요.";
          break;
        default:
          status.textContent = "업데이트 결과를 확인하지 못했어요.";
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      status.textContent = "업데이트를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
    } finally {
      button.disabled = false;
    }
  });
})();
