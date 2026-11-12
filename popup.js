const RELAY_URL = "https://practicum-monitor-relay.beleckymaksim91.workers.dev";
const $ = (id) => document.getElementById(id);

(async () => {
  const cfg = await chrome.storage.local.get([
    "lastProgress", "lastSyncAt", "lastSyncError", "studentName"
  ]);

  if (cfg.studentName) {
    $("status").textContent = `Подключён профиль: ${cfg.studentName}`;
  }

  if (cfg.lastSyncAt) {
    $("status").textContent +=
      `\nПоследняя отправка: ${new Date(cfg.lastSyncAt).toLocaleString()}` +
      `\nПоследний прогресс: ${cfg.lastProgress ?? "—"}%` +
      `\n${cfg.lastSyncError || ""}`;
  }
})();

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
      lastSyncError: ""
    });

    $("code").value = "";
    $("status").textContent =
      `Компьютер подключён к профилю: ${result.student_name}.\n` +
      "Откройте страницу курса и обновите её.";
  } catch (error) {
    $("status").textContent = `Не удалось подключиться: ${error.message}`;
  }
});
