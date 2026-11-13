(() => {
  let lastSent = "";
  let sending = false;
  let retryAfter = 0;

  async function readAndSend(force = false) {
    if (sending) return "Отправка уже выполняется.";
    if (!force && Date.now() < retryAfter) return;
    retryAfter = 0;
    const courseHeading = document.querySelector("h1.profile-overview__title");
    const courseTitle = courseHeading?.textContent?.replace(/\s+/g, " ").trim();
    const normalizedTitle = courseTitle?.toLowerCase().replace(/\s*[-–—]\s*/g, "-");
    if (normalizedTitle !== "бэкенд-разработчик" && normalizedTitle !== "бэкенд-разработка") {
      lastSent = "";
      return courseTitle ? "Открыт другой курс: " + courseTitle
        : "На вкладке не найден заголовок курса. Откройте страницу обзора курса.";
    }

    const el = document.querySelector("#free-progress");
    if (!el) return "Курс распознан, но на вкладке не найден индикатор прогресса.";

    const value = Number(el.getAttribute("value") ?? el.value);
    const max = Number(el.getAttribute("max") ?? el.max ?? 100);

    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
      return "Индикатор прогресса содержит некорректные данные.";
    }

    const percent = Math.round(
      Math.max(0, Math.min(100, value / max * 100)) * 100
    ) / 100;

    const lessonElement = document.querySelector(".current-lesson-path__content");
    const currentSprint = (lessonElement?.innerText || "").trim().slice(0, 100) || null;

    const key = `${percent}|${currentSprint}`;
    if (!force && key === lastSent) return;
    sending = true;
    try {
      const result = await chrome.runtime.sendMessage({
        type: "PRACTICUM_PROGRESS",
        progress_percent: percent,
        course_name: "Бэкенд-разработчик",
        current_sprint: currentSprint
      });
      if (result?.accepted) lastSent = key;
      else retryAfter = Date.now() + 60000;
      return result?.message ?? "Расширение не получило результат отправки.";
    } catch (error) {
      retryAfter = Date.now() + 60000;
      return "Не удалось отправить данные: " + error.message;
    } finally {
      sending = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "CHECK_PROGRESS") return;
    readAndSend(message.force === true).then(sendResponse);
    return true;
  });

  readAndSend();

  const observer = new MutationObserver(() => {
    // A failed request is retried by the timer, not on every page mutation.
    if (!retryAfter) readAndSend();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["value", "max"]
  });

  setInterval(readAndSend, 60000);
})();
