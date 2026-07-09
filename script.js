// Chromium-based browsers still expose SpeechRecognition with a vendor prefix.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const micButton = document.querySelector("#micButton");
const transcriptField = document.querySelector("#transcript");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const statusIndicator = document.querySelector("#statusIndicator");
const statusText = document.querySelector("#statusText");
const message = document.querySelector("#message");

const statuses = {
  ready: "Готово до запису",
  listening: "Слухаю...",
  off: "Мікрофон вимкнено",
};

let recognition = null;
let isListening = false;
let finalTranscript = "";
let manualStop = false;
let recognitionHadError = false;

function setStatus(type, text = statuses[type]) {
  statusText.textContent = text;
  statusIndicator.className = `status is-${type}`;
}

function setMessage(text = "", type = "") {
  message.textContent = text;
  message.className = type ? `message is-${type}` : "message";
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function appendPhrase(baseText, phrase) {
  const cleanPhrase = normalizeText(phrase);

  if (!cleanPhrase) {
    return baseText;
  }

  const cleanBase = baseText.trim();
  return cleanBase ? `${cleanBase} ${cleanPhrase}` : cleanPhrase;
}

// Final phrases are stored separately so interim text can update live without duplicates.
function updateTranscript(interimTranscript = "") {
  const cleanInterim = normalizeText(interimTranscript);
  transcriptField.value = cleanInterim
    ? appendPhrase(finalTranscript, cleanInterim)
    : finalTranscript;
}

function syncTranscriptFromField() {
  finalTranscript = transcriptField.value.trim();
}

function updateCopyButton() {
  copyButton.disabled = transcriptField.value.trim().length === 0;
}

function stopRecognition() {
  if (!recognition || !isListening) {
    return;
  }

  manualStop = true;
  recognition.stop();
}

function createRecognition() {
  const instance = new SpeechRecognition();

  // Keep recognition in Ukrainian without exposing a language selector in the UI.
  instance.lang = "uk-UA";
  instance.continuous = true;
  instance.interimResults = true;
  instance.maxAlternatives = 1;

  instance.onstart = () => {
    isListening = true;
    recognitionHadError = false;
    micButton.classList.add("is-listening");
    micButton.setAttribute("aria-label", "Зупинити запис");
    setStatus("listening");
    setMessage("Говоріть, текст з'являтиметься нижче в реальному часі.");
  };

  instance.onresult = (event) => {
    let interimTranscript = "";

    // Web Speech API returns both confirmed and interim fragments in one event.
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const phrase = event.results[index][0].transcript;

      if (event.results[index].isFinal) {
        finalTranscript = appendPhrase(finalTranscript, phrase);
      } else {
        interimTranscript += phrase;
      }
    }

    updateTranscript(interimTranscript);
    updateCopyButton();
  };

  instance.onerror = (event) => {
    recognitionHadError = true;

    const errorMessages = {
      "audio-capture": "Не вдалося отримати доступ до мікрофона. Перевірте, чи він підключений і дозволений у браузері.",
      "not-allowed": "Доступ до мікрофона заборонено. Дозвольте доступ у налаштуваннях браузера.",
      "no-speech": "Мовлення не розпізнано. Спробуйте говорити трохи ближче до мікрофона.",
      network: "Проблема з розпізнаванням мовлення. Перевірте підключення до інтернету або спробуйте ще раз.",
    };

    setMessage(errorMessages[event.error] || "Сталася помилка розпізнавання. Спробуйте ще раз.", "error");
    setStatus("error", "Мікрофон вимкнено");
  };

  instance.onend = () => {
    isListening = false;
    micButton.classList.remove("is-listening");
    micButton.setAttribute("aria-label", "Запустити запис");
    syncTranscriptFromField();

    if (recognitionHadError) {
      setStatus("off");
    } else if (manualStop) {
      setStatus("off");
      setMessage("Запис зупинено. Натисніть мікрофон, щоб продовжити.");
    } else {
      setStatus("ready");
    }

    manualStop = false;
    updateCopyButton();
  };

  return instance;
}

function startRecognition() {
  if (!SpeechRecognition) {
    return;
  }

  syncTranscriptFromField();
  manualStop = false;
  recognition = createRecognition();

  try {
    recognition.start();
  } catch (error) {
    setMessage("Не вдалося запустити розпізнавання. Оновіть сторінку й спробуйте ще раз.", "error");
    setStatus("error", "Мікрофон вимкнено");
  }
}

function toggleRecognition() {
  if (isListening) {
    stopRecognition();
  } else {
    startRecognition();
  }
}

async function copyTranscript() {
  const text = transcriptField.value.trim();

  if (!text) {
    setMessage("Поле порожнє, поки нічого копіювати.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setMessage("Текст скопійовано в буфер обміну.", "success");
  } catch (error) {
    // Fallback keeps copying usable when Clipboard API is limited on local files.
    transcriptField.select();
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    setMessage("Текст скопійовано.", "success");
  }
}

function clearTranscript() {
  transcriptField.value = "";
  finalTranscript = "";
  updateCopyButton();
  setMessage("Текст очищено.");
}

function initializeApp() {
  setStatus("ready");
  updateCopyButton();

  if (!SpeechRecognition) {
    micButton.disabled = true;
    micButton.classList.add("is-disabled");
    setStatus("error", "Мікрофон вимкнено");
    setMessage(
      "Ваш браузер не підтримує Web Speech API. Спробуйте відкрити застосунок у Google Chrome або Microsoft Edge.",
      "error"
    );
    return;
  }

  micButton.addEventListener("click", toggleRecognition);
  copyButton.addEventListener("click", copyTranscript);
  clearButton.addEventListener("click", clearTranscript);
  transcriptField.addEventListener("input", () => {
    syncTranscriptFromField();
    updateCopyButton();
  });
}

initializeApp();
