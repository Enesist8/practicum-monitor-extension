const RELAY_URL = "https://practicum-monitor-relay.beleckymaksim91.workers.dev";
const $ = (id) => document.getElementById(id);

(async () => {
  const cfg = await chrome.storage.local.get([
    "lastProgress", "lastSyncAt", "lastSyncError", "studentName", "lastRelayStatus", "lastSentCourse"
  ]);

  if (cfg.studentName) {
    $("status").textContent = `Подключён профиль: ${cfg.studentName}`;
  }

  if (cfg.lastSyncAt) {
    $("status").textContent +=
      `\nПоследняя попытка: ${new Date(cfg.lastSyncAt).toLocaleString()}` +
      `\nПоследний принятый прогресс: ${cfg.lastProgress ?? "—"}%` +
      `\n${cfg.lastSyncError || [cfg.lastSentCourse, cfg.lastRelayStatus].filter(Boolean).join("\n")}`;
  }
})();

$("check").addEventListener("click", async () => {
  const button = $("check");
  const result = $("checkResult");
  button.disabled = true;
  result.textContent = "Проверяю текущую вкладку…";
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error("Нет активной вкладки");
    result.textContent = await chrome.tabs.sendMessage(tab.id, {
      type: "CHECK_PROGRESS", force: true
    }) ?? "Вкладка не вернула результат проверки.";
  } catch {
    result.textContent = "Откройте обзор курса в Яндекс Практикуме и обновите вкладку.";
  } finally {
    button.disabled = false;
  }
});

$("connect").addEventListener("click", async () => {
  const code = $("code").value.trim().toUpperCase();

  if (!code) {
    $("status").textContent = "Введите одноразовый код.";
    return;
  }

  try {
    const response = await fetch(`${RELAY_URL}/link`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({code})
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.detail || `Ошибка ${response.status}`);
    }

    await chrome.storage.local.set({
      serverUrl: RELAY_URL,
      accessToken: result.access_token,
      studentName: result.student_name,
      lastSyncError: "",
      lastSyncAt: null,
      lastProgress: null,
      lastRelayStatus: "",
      lastSentCourse: ""
    });

    $("code").value = "";
    $("status").textContent =
      `Компьютер подключён к профилю: ${result.student_name}.\n` +
      "Откройте страницу курса и обновите её.";
  } catch (error) {
    $("status").textContent = `Не удалось подключиться: ${error.message}`;
  }
});
