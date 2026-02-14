const writingFields = {
  1: document.getElementById("writing-1"),
  2: document.getElementById("writing-2"),
  3: document.getElementById("writing-3"),
};

const writingWordStatus = {
  1: document.getElementById("word-writing-1"),
  2: document.getElementById("word-writing-2"),
  3: document.getElementById("word-writing-3"),
};

const timerDisplay = document.getElementById("timer-display");
let timerSeconds = 60 * 60;
let timerHandle = null;

function formatSeconds(totalSeconds) {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatSeconds(timerSeconds);
  timerDisplay.classList.toggle("over-time", timerSeconds <= 300);
}

function startTimer() {
  if (timerHandle) return;
  timerHandle = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds -= 1;
      updateTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerHandle) return;
  clearInterval(timerHandle);
  timerHandle = null;
}

function resetTimer() {
  pauseTimer();
  timerSeconds = 60 * 60;
  updateTimerDisplay();
}

function wordCount(text) {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

function updateWordCount(task) {
  const count = wordCount(writingFields[task].value);
  writingWordStatus[task].textContent = `${count} words`;
}

async function copyText(value, label) {
  if (!value.trim()) {
    alert(`No text available for ${label}.`);
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    alert(`${label} copied to clipboard.`);
  } catch (_err) {
    alert("Clipboard copy failed. Please copy manually.");
  }
}

function bindButtons() {
  document.querySelectorAll("button[data-action='copy-writing']").forEach((button) => {
    button.addEventListener("click", () => {
      const task = Number(button.dataset.task);
      copyText(writingFields[task].value, `Writing Task ${task}`);
    });
  });

  document.getElementById("start-timer").addEventListener("click", startTimer);
  document.getElementById("pause-timer").addEventListener("click", pauseTimer);
  document.getElementById("reset-timer").addEventListener("click", resetTimer);
}

function bindWritingCounters() {
  Object.keys(writingFields).forEach((taskKey) => {
    const task = Number(taskKey);
    writingFields[task].addEventListener("input", () => updateWordCount(task));
    updateWordCount(task);
  });
}

function init() {
  bindButtons();
  bindWritingCounters();
  updateTimerDisplay();
}

init();
