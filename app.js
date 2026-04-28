"use strict";

const CONFIG = {
  debug: true,
  videoTimeoutMs: 3200,
  deniedMs: 900,
  whisperMs: 1800,
  selectors: {
    origin: "#irisOrigin",
    video: "#eyeVideo",
    input: "#portalInput",
    form: "#searchPortal",
    whisper: "#whisper"
  }
};

const CONTENT_REGISTRY = Object.freeze({
  // Future documented codes go here.
  // LOOP: { label: "LOOP", route: "states/loop.html" }
});

const els = {};
const runtime = {
  videoReady: false,
  videoFailed: false,
  whisperTimer: null
};

init();

function init() {
  cacheElements();
  verifyElements();
  bindEvents();
  prepareVideo();
  log("init", "Iris Archive origin loaded.");
}

function cacheElements() {
  els.origin = document.querySelector(CONFIG.selectors.origin);
  els.video = document.querySelector(CONFIG.selectors.video);
  els.input = document.querySelector(CONFIG.selectors.input);
  els.form = document.querySelector(CONFIG.selectors.form);
  els.whisper = document.querySelector(CONFIG.selectors.whisper);
}

function verifyElements() {
  Object.entries(els).forEach(([name, element]) => {
    if (!element) warn("missing-element", name);
  });
}

function bindEvents() {
  els.form?.addEventListener("submit", onSubmit);
  els.input?.addEventListener("input", onInput);
  els.input?.addEventListener("focus", onFocus);
  els.input?.addEventListener("blur", onBlur);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resumeVideo("visibilitychange");
  });

  window.addEventListener("pageshow", () => resumeVideo("pageshow"));

  window.addEventListener("error", (event) => {
    warn("window-error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    warn("unhandled-promise", event.reason);
  });
}

function prepareVideo() {
  if (!els.video || !els.origin) return;

  els.video.addEventListener("loadeddata", markVideoReady);
  els.video.addEventListener("canplay", markVideoReady);

  els.video.addEventListener("error", () => {
    runtime.videoFailed = true;
    els.origin.classList.add("video-failed");
    warn("video-error", readVideoError());
  });

  els.video.addEventListener("stalled", () => {
    warn("video-stalled", "Attempting playback recovery.");
    resumeVideo("stalled");
  });

  resumeVideo("initial");

  window.setTimeout(() => {
    if (!runtime.videoReady && !runtime.videoFailed) {
      els.origin.classList.add("video-timeout");
      warn("video-timeout", "Video has not reported ready. Check assets/eye-loop.mp4 path and filename casing.");
    }
  }, CONFIG.videoTimeoutMs);
}

function markVideoReady() {
  if (!els.origin) return;
  runtime.videoReady = true;
  els.origin.classList.add("video-ready");
  resumeVideo("ready");
}

function resumeVideo(reason) {
  if (!els.video) return;
  const attempt = els.video.play();

  if (attempt && typeof attempt.catch === "function") {
    attempt
      .then(() => log("video-play", reason))
      .catch((error) => warn("video-play-blocked", { reason, error: error?.message || error }));
  }
}

function onFocus() {
  els.origin?.classList.add("searching");
  whisper("");
}

function onBlur() {
  if (!els.input?.value.trim()) {
    els.origin?.classList.remove("searching");
  }
}

function onInput() {
  if (els.input?.value.trim()) {
    els.origin?.classList.add("searching");
  } else {
    els.origin?.classList.remove("searching");
    whisper("");
  }
}

function onSubmit(event) {
  event.preventDefault();

  const code = normalizeCode(els.input?.value || "");

  if (!code) {
    whisper("");
    pulseDenied();
    return;
  }

  const entry = CONTENT_REGISTRY[code];

  if (!entry) {
    log("query-undocumented", code);
    whisper("undocumented");
    pulseDenied();
    return;
  }

  log("query-documented", { code, entry });
  whisper(entry.label || "documented");

  if (entry.route) {
    window.location.href = entry.route;
  }
}

function pulseDenied() {
  if (!els.origin) return;
  els.origin.classList.remove("denied");
  void els.origin.offsetWidth;
  els.origin.classList.add("denied");
  window.setTimeout(() => els.origin?.classList.remove("denied"), CONFIG.deniedMs);
}

function whisper(message) {
  if (!els.whisper) return;

  window.clearTimeout(runtime.whisperTimer);
  els.whisper.textContent = message;

  if (!message) {
    els.whisper.classList.remove("visible");
    return;
  }

  els.whisper.classList.add("visible");
  runtime.whisperTimer = window.setTimeout(() => {
    els.whisper?.classList.remove("visible");
  }, CONFIG.whisperMs);
}

function normalizeCode(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function readVideoError() {
  const error = els.video?.error;
  if (!error) return "Unknown video error.";

  const names = {
    1: "MEDIA_ERR_ABORTED",
    2: "MEDIA_ERR_NETWORK",
    3: "MEDIA_ERR_DECODE",
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED"
  };

  return {
    code: error.code,
    name: names[error.code] || "UNKNOWN",
    message: error.message || null
  };
}

function log(label, payload) {
  if (CONFIG.debug) console.log(`[IRIS:${label}]`, payload);
}

function warn(label, payload) {
  console.warn(`[IRIS:${label}]`, payload);
}
