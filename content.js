(() => {
  let lastSent = "";

  function readAndSend() {
    const el = document.querySelector("#free-progress");
    if (!el) return;

    const value = Number(el.getAttribute("value") ?? el.value);
    const max = Number(el.getAttribute("max") ?? el.max ?? 100);

    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return;

    const percent = Math.round(
      Math.max(0, Math.min(100, value / max * 100)) * 100
    ) / 100;

    const currentSprint = document.title.slice(0, 100);
    const key = `${percent}|${currentSprint}`;

    if (key === lastSent) return;
    lastSent = key;

    chrome.runtime.sendMessage({
      type: "PRACTICUM_PROGRESS",
      progress_percent: percent,
      current_sprint: currentSprint
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CHECK_PROGRESS") {
      readAndSend();
    }
  });

  readAndSend();

  const observer = new MutationObserver(readAndSend);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["value", "max"]
  });

  setInterval(readAndSend, 60000);
})();
