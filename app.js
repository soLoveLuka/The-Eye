(() => {
  "use strict";

  const shell = document.getElementById("eyeShell");
  const video = document.getElementById("eyeVideo");
  const form = document.getElementById("codeForm");
  const input = document.getElementById("codeInput");
  const typed = document.getElementById("typedCode");
  const signal = document.getElementById("signal");
  const creator = document.getElementById("creator");
  const creatorForm = document.getElementById("creatorForm");
  const closeCreator = document.getElementById("closeCreator");
  const roomWord = document.getElementById("roomWord");
  const roomSize = document.getElementById("roomSize");
  const fogLevel = document.getElementById("fogLevel");
  const backgroundPull = document.getElementById("backgroundPull");
  const voiceReach = document.getElementById("voiceReach");
  const screenReach = document.getElementById("screenReach");
  const voidRoom = document.getElementById("voidRoom");
  const roomPlane = document.getElementById("roomPlane");
  const avatar = document.getElementById("avatar");
  const roomTitle = document.getElementById("roomTitle");
  const roomScaleLabel = document.getElementById("roomScaleLabel");
  const roomCodeLabel = document.getElementById("roomCodeLabel");
  const liveVoiceReach = document.getElementById("liveVoiceReach");
  const liveScreenReach = document.getElementById("liveScreenReach");
  const spectrum = document.getElementById("spectrum");
  const shareScreen = document.getElementById("shareScreen");
  const leaveRoom = document.getElementById("leaveRoom");
  const screenPortal = document.getElementById("screenPortal");
  const screenVideo = document.getElementById("screenVideo");

  const ROOM_SIZES = {
    studio: "54vmin",
    loft: "68vmin",
    warehouse: "86vmin",
    cathedral: "112vmin",
    universe: "150vmax"
  };

  const state = {
    mouseX: 0,
    mouseY: 0,
    avatarX: 50,
    avatarY: 50,
    stream: null,
    signalTimer: null
  };

  init();

  function init() {
    lockViewport();
    prepareEye();
    buildSpectrum();
    bindEvents();
    setMode("gate");
    focusInputSoon();
  }

  function bindEvents() {
    form.addEventListener("submit", onGateSubmit);
    input.addEventListener("input", onType);
    window.addEventListener("click", () => shell.dataset.mode === "gate" && focusInputSoon());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", lockViewport);
    window.addEventListener("pageshow", () => { lockViewport(); playEye(); });
    document.addEventListener("visibilitychange", () => !document.hidden && playEye());

    closeCreator.addEventListener("click", () => returnToGate());
    creatorForm.addEventListener("submit", onCreateRoom);
    [fogLevel, backgroundPull, voiceReach, screenReach].forEach((control) => {
      control.addEventListener("input", syncAtmosphereControls);
    });
    liveVoiceReach.addEventListener("input", () => setReach(liveVoiceReach.value, liveScreenReach.value));
    liveScreenReach.addEventListener("input", () => setReach(liveVoiceReach.value, liveScreenReach.value));
    roomPlane.addEventListener("pointerdown", moveAvatarFromEvent);
    leaveRoom.addEventListener("click", leaveVoid);
    shareScreen.addEventListener("click", requestScreenShare);
  }

  function onType() {
    const value = normalizeCode(input.value);
    input.value = value;
    typed.textContent = value;
    if (value) whisper("", false);
  }

  function onGateSubmit(event) {
    event.preventDefault();
    const code = normalizeCode(input.value);
    if (!code) return pulse("TYPE TO OPEN THE EYE");
    if (code === "CREATE") return openCreator();
    enterRoom({ code, size: "studio", fog: 62, pull: 74, voice: 32, screen: 45, created: false });
  }

  function openCreator() {
    setMode("creator");
    creator.setAttribute("aria-hidden", "false");
    input.blur();
    if (!roomWord.value) roomWord.value = generateRoomWord();
    syncAtmosphereControls();
    setTimeout(() => roomWord.focus(), 650);
  }

  function onCreateRoom(event) {
    event.preventDefault();
    const code = normalizeCode(roomWord.value || generateRoomWord());
    enterRoom({
      code,
      size: roomSize.value,
      fog: Number(fogLevel.value),
      pull: Number(backgroundPull.value),
      voice: Number(voiceReach.value),
      screen: Number(screenReach.value),
      created: true
    });
  }

  function enterRoom(config) {
    setMode("room");
    creator.setAttribute("aria-hidden", "true");
    voidRoom.setAttribute("aria-hidden", "false");
    roomTitle.textContent = config.code;
    roomCodeLabel.textContent = config.created ? "Created room" : "Joined room";
    roomScaleLabel.textContent = labelForSize(config.size);
    shell.style.setProperty("--room-size", ROOM_SIZES[config.size] || ROOM_SIZES.studio);
    shell.style.setProperty("--fog", config.fog);
    shell.style.setProperty("--pull", config.pull);
    liveVoiceReach.value = config.voice;
    liveScreenReach.value = config.screen;
    setReach(config.voice, config.screen);
    input.value = "";
    typed.textContent = "";
    whisper("A TEMPORARY CHANNEL EXISTS WHILE PRESENCE HOLDS IT", true);
    avatar.focus({ preventScroll: true });
  }

  function leaveVoid() {
    stopScreenShare();
    returnToGate();
  }

  async function requestScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      pulse("SCREEN SHARING NEEDS A SECURE BROWSER CONTEXT");
      return;
    }
    try {
      stopScreenShare();
      state.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenVideo.srcObject = state.stream;
      screenPortal.classList.add("is-live");
      const [track] = state.stream.getVideoTracks();
      track?.addEventListener("ended", stopScreenShare, { once: true });
    } catch (error) {
      pulse("SCREEN SIGNAL CANCELLED");
    }
  }

  function stopScreenShare() {
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    screenVideo.srcObject = null;
    screenPortal.classList.remove("is-live");
  }

  function moveAvatarFromEvent(event) {
    const rect = roomPlane.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setAvatar(clamp(x, 3, 97), clamp(y, 3, 97));
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (shell.dataset.mode === "room") return leaveVoid();
      if (shell.dataset.mode === "creator") return returnToGate();
    }
    if (shell.dataset.mode === "room") {
      const step = event.shiftKey ? 6 : 2.8;
      if (event.key === "ArrowUp") setAvatar(state.avatarX, state.avatarY - step);
      if (event.key === "ArrowDown") setAvatar(state.avatarX, state.avatarY + step);
      if (event.key === "ArrowLeft") setAvatar(state.avatarX - step, state.avatarY);
      if (event.key === "ArrowRight") setAvatar(state.avatarX + step, state.avatarY);
      return;
    }
    if (shell.dataset.mode === "gate" && event.key.length === 1 && document.activeElement !== input) focusInputSoon();
  }

  function setAvatar(x, y) {
    state.avatarX = clamp(x, 3, 97);
    state.avatarY = clamp(y, 3, 97);
    shell.style.setProperty("--avatar-x", `${state.avatarX}%`);
    shell.style.setProperty("--avatar-y", `${state.avatarY}%`);
  }

  function setReach(voice, screen) {
    shell.style.setProperty("--voice", clamp(Number(voice), 8, 100));
    shell.style.setProperty("--screen", clamp(Number(screen), 8, 100));
  }

  function syncAtmosphereControls() {
    shell.style.setProperty("--fog", fogLevel.value);
    shell.style.setProperty("--pull", backgroundPull.value);
    setReach(voiceReach.value, screenReach.value);
  }

  function setMode(mode) {
    shell.dataset.mode = mode;
  }

  function returnToGate() {
    setMode("gate");
    creator.setAttribute("aria-hidden", "true");
    voidRoom.setAttribute("aria-hidden", "true");
    typed.textContent = "";
    input.value = "";
    whisper("", false);
    focusInputSoon();
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
    state.mouseX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
    state.mouseY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    shell.style.setProperty("--mx", state.mouseX.toFixed(3));
    shell.style.setProperty("--my", state.mouseY.toFixed(3));
  }

  function buildSpectrum() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 40; i += 1) {
      const bar = document.createElement("i");
      bar.style.setProperty("--i", i);
      bar.style.setProperty("--h", 12 + Math.round(Math.abs(Math.sin(i * 0.72)) * 74));
      fragment.appendChild(bar);
    }
    spectrum.appendChild(fragment);
  }

  function whisper(message, persistent = false) {
    clearTimeout(state.signalTimer);
    signal.textContent = message;
    signal.classList.toggle("is-visible", Boolean(message));
    if (message && !persistent) state.signalTimer = setTimeout(() => whisper("", false), 1500);
  }

  function pulse(message) {
    whisper(message);
    typed.animate([
      { transform: "translate(-50%, -50%) translateY(72px) scale(1)", filter: "blur(0)" },
      { transform: "translate(-50%, -50%) translateY(72px) scale(1.035)", filter: "blur(1px)" },
      { transform: "translate(-50%, -50%) translateY(72px) scale(1)", filter: "blur(0)" }
    ], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" });
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

  function generateRoomWord() {
    const words = ["NIGHTRADIO", "VOIDROOM", "SOFTSIGNAL", "BLACKWATER", "STARFIELD", "GLASSHOUSE"];
    return words[Math.floor(Math.random() * words.length)];
  }

  function labelForSize(value) {
    return ({ studio: "Studio", loft: "Loft", warehouse: "Warehouse", cathedral: "Cathedral", universe: "Universe" })[value] || "Studio";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
