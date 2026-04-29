(() => {
  "use strict";

  const shell = document.getElementById("eyeShell");
  const video = document.getElementById("eyeVideo");
  const form = document.getElementById("portalForm");
  const input = document.getElementById("portalInput");
  const typedWord = document.getElementById("typedWord");
  const whisper = document.getElementById("whisper");

  const voidRoom = document.getElementById("voidRoom");
  const roomTitle = document.getElementById("roomTitle");
  const roomScaleLabel = document.getElementById("roomScaleLabel");
  const roomCodeLabel = document.getElementById("roomCodeLabel");
  const boothsEl = document.getElementById("booths");
  const overflowEl = document.getElementById("overflowAvatars");
  const tvRoute = document.getElementById("tvRoute");
  const tv1 = document.getElementById("tv1");
  const tv2 = document.getElementById("tv2");
  const shareScreen = document.getElementById("shareScreen");
  const micToggle = document.getElementById("micToggle");
  const micSensitivity = document.getElementById("micSensitivity");
  const othersVolume = document.getElementById("othersVolume");
  const leaveRoom = document.getElementById("leaveRoom");

  const ROOM_SIZES = ["studio", "loft", "warehouse", "cathedral"];

  const QUESTIONS = [
    { key: "passcode", prompt: "WHAT'S THE PASSCODE?", type: "text", normalize: (v) => normalizeCode(v) || generateRoomWord() },
    { key: "heads", prompt: "HOW MANY HEADS?", type: "number", min: 2, max: 40, normalize: (v) => clampInt(v, 2, 40, 8) },
    { key: "booths", prompt: "BOOTH COUNT?", type: "number", min: 2, max: 20, normalize: (v) => clampInt(v, 2, 20, 8) },
    { key: "colors", prompt: "COLORS?", type: "text", normalize: (v) => String(v || "VIOLET").trim().toUpperCase().slice(0, 24) }
  ];

  const state = {
    mode: "gate",
    booths: [],
    activeBoothId: 1,
    micMuted: false,
    stream: null,
    audioStream: null,
    audioContext: null,
    analyser: null,
    micLevelSmooth: 0,
    micPeakHold: 0,
    whisperTimer: null,
    fallTimer: null,
    interview: {
      active: false,
      step: 0,
      answers: {},
      typing: ""
    }
  };

  init();

  function init() {
    lockViewport();
    prepareEye();
    bindEvents();
    setMode("gate");
    renderLetters("");
    focusInputSoon();
    tickMic();
  }

  function bindEvents() {
    form.addEventListener("submit", onGateSubmit);
    input.addEventListener("input", onType);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", () => state.mode === "gate" && focusInputSoon());
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    tvRoute.addEventListener("change", applyTvRouting);
    shareScreen.addEventListener("click", toggleScreenShare);
    micToggle.addEventListener("click", toggleMic);
    othersVolume.addEventListener("input", applyOthersVolume);
    leaveRoom.addEventListener("click", leaveRoomNow);
  }

  function onType() {
    const raw = String(input.value || "");
    if (state.interview.active) {
      state.interview.typing = raw;
      renderQuestionFrame();
      return;
    }
    const value = normalizeCode(raw);
    input.value = value;
    renderLetters(value);
  }

  function onGateSubmit(event) {
    event.preventDefault();

    if (state.interview.active) {
      submitInterviewAnswer();
      return;
    }

    const code = normalizeCode(input.value);
    if (code !== "CREATE") {
      triggerFall();
      setWhisper("TYPE CREATE TO START A ROOM");
      return;
    }

    beginInterview();
  }

  function beginInterview() {
    state.interview.active = true;
    state.interview.step = 0;
    state.interview.answers = {};
    state.interview.typing = "";
    input.value = "";
    renderQuestionFrame(true);
    setWhisper("ANSWER. PRESS ENTER.");
  }

  function renderQuestionFrame(withFall = false) {
    const q = QUESTIONS[state.interview.step];
    if (!q) return;

    const answerPreview = state.interview.typing ? `\n${state.interview.typing}` : "";
    const text = `${q.prompt}${answerPreview}`;

    if (withFall) triggerFall();
    renderLetters(text);
    typedWord.style.filter = "drop-shadow(0 0 18px rgba(155,113,255,.45)) drop-shadow(0 0 36px rgba(85,210,255,.35))";
  }

  function submitInterviewAnswer() {
    const q = QUESTIONS[state.interview.step];
    if (!q) return;

    const raw = state.interview.typing;
    const value = q.normalize(raw);
    if (q.type === "number" && (value < q.min || value > q.max)) {
      setWhisper(`ENTER ${q.min}-${q.max}`);
      return;
    }

    state.interview.answers[q.key] = value;
    state.interview.step += 1;
    state.interview.typing = "";
    input.value = "";

    triggerFall();

    if (state.interview.step >= QUESTIONS.length) {
      setTimeout(() => {
        state.interview.active = false;
        createRoomFromAnswers();
      }, 380);
      return;
    }

    setTimeout(() => renderQuestionFrame(), 250);
  }

  function createRoomFromAnswers() {
    const passcode = state.interview.answers.passcode;
    const heads = state.interview.answers.heads;
    const boothCount = Math.min(state.interview.answers.booths, 20, heads);
    const colors = state.interview.answers.colors;

    state.booths = Array.from({ length: boothCount }, (_, i) => ({
      id: i + 1,
      name: i === 0 ? "You" : `Booth ${i + 1}`,
      level: 0,
      muted: false,
      element: null,
      meter: null
    }));
    state.activeBoothId = 1;

    renderBooths(heads);

    setMode("room");
    voidRoom.setAttribute("aria-hidden", "false");
    roomTitle.textContent = passcode;
    roomCodeLabel.textContent = "Created room";
    roomScaleLabel.textContent = ROOM_SIZES[Math.min(ROOM_SIZES.length - 1, Math.floor(boothCount / 6))];

    applyColorTheme(colors);
    ensureMicInput();
    applyTvRouting();
    setWhisper("");
    input.value = "";
  }

  function applyColorTheme(colors) {
    const palette = colors.toUpperCase();
    let hue = 252;
    if (palette.includes("RED")) hue = 350;
    else if (palette.includes("BLUE")) hue = 220;
    else if (palette.includes("GREEN")) hue = 140;
    else if (palette.includes("GOLD")) hue = 44;
    else if (palette.includes("PINK")) hue = 320;

    shell.style.setProperty("--booth-hue", String(hue));
  }

  function renderBooths(totalParticipants) {
    boothsEl.innerHTML = "";
    state.booths.forEach((booth) => {
      const el = document.createElement("article");
      el.className = "booth" + (booth.id === state.activeBoothId ? " active" : "");
      el.dataset.id = String(booth.id);
      el.innerHTML = `
        <div class="booth__head"><span>${booth.name}</span><button type="button" class="button button--ghost boothMute">Mute</button></div>
        <div class="meter"><i></i></div>
      `;

      booth.element = el;
      booth.meter = el.querySelector(".meter i");

      el.addEventListener("click", (e) => {
        if (e.target instanceof HTMLElement && e.target.classList.contains("boothMute")) {
          booth.muted = !booth.muted;
          syncBoothUi(booth);
          return;
        }
        state.activeBoothId = booth.id;
        refreshActiveBooth();
      });

      boothsEl.appendChild(el);
      syncBoothUi(booth);
    });

    if (totalParticipants > 20) {
      overflowEl.hidden = false;
      overflowEl.textContent = `${totalParticipants - 20} MORE PARTICIPANTS APPEAR AS SIDE AVATARS.`;
    } else {
      overflowEl.hidden = true;
      overflowEl.textContent = "";
    }
  }

  function syncBoothUi(booth) {
    if (!booth.element) return;
    booth.element.classList.toggle("muted", booth.muted);
    if (booth.muted) {
      booth.element.style.background = "rgba(120,120,120,.22)";
      booth.element.style.boxShadow = "none";
      if (booth.meter) booth.meter.style.width = "0%";
    }
    const btn = booth.element.querySelector(".boothMute");
    if (btn) btn.textContent = booth.muted ? "Unmute" : "Mute";
  }

  function refreshActiveBooth() {
    state.booths.forEach((booth) => booth.element?.classList.toggle("active", booth.id === state.activeBoothId));
  }

  async function ensureMicInput() {
    if (state.audioStream) return;
    try {
      state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(state.audioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      state.audioContext = ctx;
      state.analyser = analyser;
      updateMicButton();
    } catch {
      setWhisper("MIC ACCESS DENIED");
    }
  }

  function tickMic() {
    if (state.mode === "room" && state.analyser && !state.micMuted) {
      const data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const sensitivity = Number(micSensitivity.value) / 100;
      const raw = clamp((avg / 255) * 100 * sensitivity, 0, 100);
      const gate = 6;
      const gated = raw < gate ? 0 : raw;
      const attack = 0.32;
      const release = 0.1;
      const coeff = gated > state.micLevelSmooth ? attack : release;
      state.micLevelSmooth += (gated - state.micLevelSmooth) * coeff;
      state.micPeakHold = Math.max(state.micPeakHold * 0.95, state.micLevelSmooth);

      const level = clamp(Math.round(state.micLevelSmooth), 0, 100);
      const active = state.booths.find((b) => b.id === state.activeBoothId);
      if (active && !active.muted) {
        active.level = level;
        if (active.meter) active.meter.style.width = `${level}%`;
        const hue = Number(getComputedStyle(shell).getPropertyValue("--booth-hue") || 252);
        const glow = Math.max(0.14, level / 90);
        active.element.style.background = `linear-gradient(120deg, hsla(${hue}, 90%, ${46 + level * 0.12}%, ${glow}), hsla(${(hue + 55) % 360}, 84%, ${34 + level * 0.1}%, ${Math.max(0.18, glow * 0.7)}))`;
        active.element.style.boxShadow = `0 0 ${10 + level * 0.45}px hsla(${hue}, 92%, 65%, ${Math.min(0.58, glow)}), 0 0 ${8 + level * 0.25}px hsla(${(hue + 55) % 360}, 90%, 58%, ${Math.min(0.45, glow * 0.8)})`;
      }
    }
    requestAnimationFrame(tickMic);
  }

  function applyOthersVolume() {
    const factor = Number(othersVolume.value) / 100;
    state.booths.forEach((booth) => {
      if (booth.id === 1 || !booth.meter) return;
      const lvl = booth.muted ? 0 : Math.round((20 + Math.random() * 60) * factor);
      booth.meter.style.width = `${lvl}%`;
      if (!booth.muted) booth.element.style.background = `rgba(${70 + Math.round(lvl * 1.3)}, ${50 + Math.round(lvl * 0.35)}, 150, ${0.15 + lvl / 220})`;
    });
  }

  function toggleMic() {
    state.micMuted = !state.micMuted;
    if (state.audioStream) state.audioStream.getAudioTracks().forEach((t) => { t.enabled = !state.micMuted; });
    updateMicButton();
  }

  function updateMicButton() {
    micToggle.textContent = `Mic: ${state.micMuted ? "Off" : "On"}`;
  }

  async function toggleScreenShare() {
    if (state.stream) {
      stopScreenShare();
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      applyTvRouting();
      shareScreen.textContent = "Stop share";
      const track = state.stream.getVideoTracks()[0];
      if (track) track.addEventListener("ended", stopScreenShare, { once: true });
    } catch {
      setWhisper("SCREEN SHARE CANCELLED");
    }
  }

  function applyTvRouting() {
    const route = tvRoute.value;
    [{ id: "1", el: tv1 }, { id: "2", el: tv2 }].forEach(({ id, el }) => {
      const tv = el.closest(".tv");
      if (route === id && state.stream) {
        el.srcObject = state.stream;
        el.muted = false;
        tv?.classList.add("on");
      } else {
        el.srcObject = null;
        tv?.classList.remove("on");
      }
    });
  }

  function stopScreenShare() {
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    applyTvRouting();
    shareScreen.textContent = "Share screen + audio";
  }

  function leaveRoomNow() {
    stopScreenShare();
    setMode("gate");
    state.interview.active = false;
    input.value = "";
    renderLetters("");
    setWhisper("");
    focusInputSoon();
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && state.mode === "room") {
      leaveRoomNow();
      return;
    }
    if (state.mode === "gate" && event.key.length === 1 && document.activeElement !== input) focusInputSoon();
  }

  function setMode(mode) {
    state.mode = mode;
    shell.dataset.mode = mode;
  }

  function prepareEye() {
    video.addEventListener("loadeddata", () => shell.classList.add("loaded"));
    video.addEventListener("canplay", () => { shell.classList.add("loaded"); playEye(); });
    video.addEventListener("error", () => shell.classList.add("failed"));
    playEye();
  }

  function playEye() {
    video.play().catch(() => {});
  }

  function onPointerMove(event) {
    const mx = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
    const my = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    shell.style.setProperty("--mx", mx.toFixed(3));
    shell.style.setProperty("--my", my.toFixed(3));
  }

  function triggerFall() {
    typedWord.classList.remove("falling");
    void typedWord.offsetWidth;
    typedWord.classList.add("falling");
    clearTimeout(state.fallTimer);
    state.fallTimer = setTimeout(() => typedWord.classList.remove("falling"), 1300);
  }

  function renderLetters(rawValue) {
    const value = String(rawValue || "").toUpperCase();
    const clean = value.replace(/\s+/g, " ").trim();
    typedWord.innerHTML = "";
    if (!clean) {
      typedWord.classList.add("empty");
      setDynamicType(0);
      return;
    }
    typedWord.classList.remove("empty");

    clean.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.className = "letter";
      span.textContent = char === " " ? "·" : char;
      const seed = hash(`${char}-${index}-${clean.length}`);
      const a = pseudo(seed), b = pseudo(seed + 19), c = pseudo(seed + 43), d = pseudo(seed + 71);
      span.style.setProperty("--i", index);
      span.style.setProperty("--shake-x", ((a - 0.5) * 2.8).toFixed(3));
      span.style.setProperty("--shake-y", ((b - 0.5) * 2.5).toFixed(3));
      span.style.setProperty("--shake-x2", ((c - 0.5) * 3.6).toFixed(3));
      span.style.setProperty("--shake-y2", ((d - 0.5) * 3.2).toFixed(3));
      span.style.setProperty("--rotate", ((a - 0.5) * 3.2).toFixed(3));
      span.style.setProperty("--rotate2", ((b - 0.5) * 4.4).toFixed(3));
      span.style.setProperty("--scale", (0.96 + c * 0.08).toFixed(3));
      span.style.setProperty("--origin-x", ((a - 0.5) * 90).toFixed(3));
      span.style.setProperty("--origin-y", ((b - 0.5) * 55).toFixed(3));
      span.style.setProperty("--origin-rotate", ((c - 0.5) * 26).toFixed(3));
      span.style.setProperty("--fall-x", ((a - 0.5) * 52).toFixed(3));
      span.style.setProperty("--fall-y", (30 + b * 62).toFixed(3));
      span.style.setProperty("--fall-rotate", ((d - 0.5) * 130).toFixed(3));
      span.style.setProperty("--tremor-speed", `${(1.4 + d * 1.9).toFixed(3)}s`);
      typedWord.appendChild(span);
    });

    setDynamicType(clean.length);
  }

  function setDynamicType(length) {
    const viewportFactor = Math.min(window.innerWidth, 900) / 900;
    const size = length <= 4 ? 46 : length <= 8 ? 38 : length <= 12 ? 31 : length <= 18 ? 24 : 18;
    const finalSize = Math.max(11, size * Math.max(0.72, viewportFactor));
    const spacing = length > 18 ? 0.045 : length > 10 ? 0.08 : 0.14;
    typedWord.style.setProperty("--letter-size", `${finalSize.toFixed(2)}px`);
    typedWord.style.setProperty("--letter-spacing", `${spacing.toFixed(3)}em`);
  }

  function setWhisper(message) {
    clearTimeout(state.whisperTimer);
    whisper.textContent = message || "";
    whisper.classList.toggle("visible", Boolean(message));
    if (message) state.whisperTimer = setTimeout(() => whisper.classList.remove("visible"), 1800);
  }

  function focusInputSoon() {
    setTimeout(() => input.focus({ preventScroll: true }), 80);
  }

  function lockViewport() {
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 18);
  }

  function clampInt(value, min, max, fallback) {
    const n = parseInt(String(value || ""), 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function generateRoomWord() {
    const words = ["NIGHTRADIO", "VOIDROOM", "SOFTSIGNAL", "BLACKWATER", "STARFIELD", "GLASSHOUSE"];
    return words[Math.floor(Math.random() * words.length)];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hash(inputValue) {
    let h = 2166136261;
    for (let i = 0; i < inputValue.length; i += 1) {
      h ^= inputValue.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }

  function pseudo(seed) {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
})();
