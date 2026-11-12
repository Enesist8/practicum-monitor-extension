async function transmit(data) {
  const cfg = await chrome.storage.local.get(["serverUrl", "accessToken"]);
  if (!cfg.serverUrl || !cfg.accessToken) return;

  try {
    const response = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.accessToken}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Ошибка ${response.status}: ${message}`);
    }

    await chrome.storage.local.set({
      lastSyncAt: new Date().toISOString(),
      lastProgress: data.progress_percent,
      lastSyncError: ""
    });
  } catch (error) {
    console.warn("Practicum Monitor sync failed:", error);
    await chrome.storage.local.set({
      lastSyncError: String(error),
      lastSyncAt: new Date().toISOString()
    });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PRACTICUM_PROGRESS") {
    transmit({
      progress_percent: message.progress_percent,
      current_sprint: message.current_sprint
    });
  }
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
