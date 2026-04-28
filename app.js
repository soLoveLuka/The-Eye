"use strict";

/*
  IRIS ARCHIVE — ORIGIN BUILD

  Current purpose:
  - Full-screen cinematic eye loop
  - Ominous centered dimensional search
  - Smooth video handling across devices
  - Error logging
  - Open-ended secret-code architecture

  Future purpose:
  - Codes can route to state-specific transformations
  - Each state can modify video, color, audio, atmosphere, search behavior, archive copy, and page transitions
*/

const CONFIG = {
  debug: true,

  selectors: {
    origin: "#origin",
    video: "#eyeVideo",
    input: "#portalInput",
    form: "#portalSearch",
    searchShell: "#searchShell",
    whisper: "#systemWhisper"
  },

  timing: {
    whisper: 1800,
    deniedClass: 900,
    searchingMinimum: 900
  }
};

/*
  FUTURE CONTENT REGISTRY

  Do not implement your big secret-code ideas here yet.

  Later, each key becomes something like:

  LOOP: {
    label: "Looping Thought",
    route: "states/loop.html",
    transform: "loop",
    audio: "assets/audio/loop-bed.mp3",
    colors: { ... },
    onEnter() {}
  }

  Right now it stays intentionally empty.
*/

const CONTENT_REGISTRY = Object.freeze({
  // PLACEHOLDER:
  // Add future documented codes here.
});

const els = {};

const state = {
  videoReady: false,
  videoFailed: false,
  searching: false,
  lastQuery: "",
  idleTimer: null
};

boot();

function boot() {
  cacheElements();
  bindEvents();
  prepareVideo();
  log("boot", "Iris Archive initialized.");
}

function cacheElements() {
  els.origin = document.querySelector(CONFIG.selectors.origin);
  els.video = document.querySelector(CONFIG.selectors.video);
  els.input = document.querySelector(CONFIG.selectors.input);
  els.form = document.querySelector(CONFIG.selectors.form);
  els.searchShell = document.querySelector(CONFIG.selectors.searchShell);
  els.whisper = document.querySelector(CONFIG.selectors.whisper);

  const missing = Object.entries(els)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missing.length) {
    warn("missing-elements", missing);
  }
}

function bindEvents() {
  if (els.form) {
    els.form.addEventListener("submit", handleSubmit);
  }

  if (els.input) {
    els.input.addEventListener("input", handleInput);
    els.input.addEventListener("focus", handleFocus);
    els.input.addEventListener("blur", handleBlur);
  }

  document.addEventListener("visibilitychange", handleVisibility);

  window.addEventListener("pageshow", () => {
    resumeVideo("pageshow");
  });

  window.addEventListener("error", (event) => {
    warn("window-error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    warn("promise-rejection", {
      reason: event.reason
    });
  });
}

function prepareVideo() {
  if (!els.video || !els.origin) return;

  els.video.addEventListener("loadeddata", () => {
    state.videoReady = true;
    els.origin.classList.add("video-ready");
    log("video", "loadeddata");
  });

  els.video.addEventListener("canplay", () => {
    state.videoReady = true;
    els.origin.classList.add("video-ready");
    resumeVideo("canplay");
  });

  els.video.addEventListener("error", () => {
    state.videoFailed = true;
    els.origin.classList.add("video-failed");
    warn("video-error", getVideoError());
  });

  els.video.addEventListener("stalled", () => {
    warn("video-stalled", "The video stalled. Attempting recovery.");
    resumeVideo("stalled");
  });

  els.video.addEventListener("suspend", () => {
    log("video", "suspend");
  });

  resumeVideo("initial");

  setTimeout(() => {
    if (!state.videoReady && !state.videoFailed) {
      warn("video-timeout", "Video has not reported ready yet.");
    }
  }, 2600);
}

function resumeVideo(reason) {
  if (!els.video) return;

  const playAttempt = els.video.play();

  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt
      .then(() => {
        log("video-play", reason);
      })
      .catch((error) => {
        warn("video-play-blocked", {
          reason,
          error: error?.message || error
        });
      });
  }
}

function handleVisibility() {
  if (!document.hidden) {
    resumeVideo("visibilitychange");
  }
}

function handleFocus() {
  els.origin?.classList.add("searching");
  whisper("");
}

function handleBlur() {
  if (!state.searching) {
    els.origin?.classList.remove("searching");
  }
}

function handleInput(event) {
  const raw = event.target.value;
  const normalized = normalizeCode(raw);

  state.lastQuery = normalized;

  if (!raw.trim()) {
    els.origin?.classList.remove("searching");
    whisper("");
    return;
  }

  els.origin?.classList.add("searching");
}

function handleSubmit(event) {
  event.preventDefault();

  const raw = els.input?.value || "";
  const code = normalizeCode(raw);

  if (!code) {
    softDeny("empty");
    return;
  }

  state.searching = true;
  els.origin?.classList.add("searching");

  setTimeout(() => {
    const entry = CONTENT_REGISTRY[code];

    if (!entry) {
      log("query-unmatched", code);
      softDeny("undocumented");
      state.searching = false;

      if (!document.activeElement || document.activeElement !== els.input) {
        els.origin?.classList.remove("searching");
      }

      return;
    }

    enterRegisteredState(code, entry);
  }, CONFIG.timing.searchingMinimum);
}

function enterRegisteredState(code, entry) {
  /*
    Future hook.

    This is where the site will eventually:
    - transform the eye
    - alter atmosphere
    - play warped audio
    - load a state environment
    - route to a dedicated page
    - or open a hidden archive panel

    Not implemented yet by design.
  */

  log("query-matched", { code, entry });

  whisper(entry.label || "DOCUMENTED");

  if (entry.route) {
    window.location.href = entry.route;
  }
}

function softDeny(type) {
  if (!els.origin) return;

  els.origin.classList.remove("denied");
  forceReflow(els.origin);
  els.origin.classList.add("denied");

  const message =
    type === "empty"
      ? ""
      : "undocumented";

  whisper(message);

  window.setTimeout(() => {
    els.origin?.classList.remove("denied");
  }, CONFIG.timing.deniedClass);
}

function whisper(message) {
  if (!els.whisper) return;

  window.clearTimeout(state.idleTimer);

  els.whisper.textContent = message || "";

  if (!message) {
    els.whisper.classList.remove("visible");
    return;
  }

  els.whisper.classList.add("visible");

  state.idleTimer = window.setTimeout(() => {
    els.whisper.classList.remove("visible");
  }, CONFIG.timing.whisper);
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function getVideoError() {
  const error = els.video?.error;

  if (!error) {
    return "Unknown video error.";
  }

  const map = {
    1: "MEDIA_ERR_ABORTED",
    2: "MEDIA_ERR_NETWORK",
    3: "MEDIA_ERR_DECODE",
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED"
  };

  return {
    code: error.code,
    name: map[error.code] || "UNKNOWN",
    message: error.message || null
  };
}

function forceReflow(element) {
  void element.offsetWidth;
}

function log(label, payload) {
  if (!CONFIG.debug) return;
  console.log(`[IRIS:${label}]`, payload);
}

function warn(label, payload) {
  console.warn(`[IRIS:${label}]`, payload);
}
