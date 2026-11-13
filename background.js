async function transmit(data) {
  const cfg = await chrome.storage.local.get(["serverUrl", "accessToken"]);
  if (!cfg.serverUrl || !cfg.accessToken) {
    return {accepted: false, message: "Сначала подключите компьютер одноразовым кодом."};
  }

  try {
    const response = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/ingest`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.accessToken}`
      },
      body: JSON.stringify(data)
    });

    const body = await response.text();
    let result;
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error("Шлюз вернул ответ без JSON (HTTP " + response.status + ")");
    }
    if (!response.ok || result?.ok === false || result?.success === false || result?.error) {
      const detail = typeof result?.error === "string" ? result.error.slice(0, 160) : "";
      throw new Error("Ошибка шлюза (HTTP " + response.status + ")" + (detail ? ": " + detail : ""));
    }
    const duplicate = result?.duplicate === true || result?.deduplicated === true;
    const queued = result?.queued;
    if (queued === false && !duplicate) {
      throw new Error("Шлюз сообщил, что запись не поставлена в очередь");
    }
    const relayStatus = duplicate ? "Шлюз сообщил о повторной отправке"
      : queued === true ? "Шлюз подтвердил постановку в очередь"
      : "Шлюз принял запрос (HTTP " + response.status + ")";


    await chrome.storage.local.set({
      lastSyncAt: new Date().toISOString(),
      lastProgress: data.progress_percent,
      lastSyncError: "",
      lastRelayStatus: relayStatus,
      lastSentCourse: data.course_name
    });
    return {accepted: true, message: relayStatus};
  } catch (error) {
    console.warn("Practicum Monitor sync failed:", error);
    await chrome.storage.local.set({
      lastSyncError: String(error),
      lastRelayStatus: "",
      lastSyncAt: new Date().toISOString()
    });
    return {accepted: false, message: String(error)};
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "PRACTICUM_PROGRESS") return;
  if (message.course_name !== "Бэкенд-разработчик") return;
  transmit({
    progress_percent: message.progress_percent,
    course_name: message.course_name,
    current_sprint: message.current_sprint
  }).then(sendResponse, () => sendResponse({accepted: false}));
  return true;
});

chrome.alarms.create("practicum-heartbeat", {periodInMinutes: 60});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "practicum-heartbeat") return;

  const tabs = await chrome.tabs.query({
    url: [
      "https://practicum.yandex.ru/*",
      "https://practicum.yandex.com/*"
    ]
  });

  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {type: "CHECK_PROGRESS"}).catch(() => {});
    }
  }
});
