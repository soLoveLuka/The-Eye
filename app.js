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
  const profileToggle = document.getElementById("profileToggle");
  const profileMenu = document.getElementById("profileMenu");
  const profileName = document.getElementById("profileName");
  const profileColor = document.getElementById("profileColor");
  const profileGlyph = document.getElementById("profileGlyph");
  const profileBio = document.getElementById("profileBio");
  const profileSave = document.getElementById("profileSave");
  const boothsEl = document.getElementById("booths");
  const overflowEl = document.getElementById("overflowAvatars");
  const tvRoute = document.getElementById("tvRoute");
  const routeOff = document.getElementById("routeOff");
  const routeTv1 = document.getElementById("routeTv1");
  const routeTv2 = document.getElementById("routeTv2");
  const tv1 = document.getElementById("tv1");
  const tv2 = document.getElementById("tv2");
  const shareScreen = document.getElementById("shareScreen");
  const micToggle = document.getElementById("micToggle");
  const micMenuToggle = document.getElementById("micMenuToggle");
  const micMenu = document.getElementById("micMenu");
  const micInputDevice = document.getElementById("micInputDevice");
  const audioOutputDevice = document.getElementById("audioOutputDevice");
  const micGain = document.getElementById("micGain");
  const micSensitivity = document.getElementById("micSensitivity");
  const othersVolume = document.getElementById("othersVolume");
  const aecToggle = document.getElementById("aecToggle");
  const nsToggle = document.getElementById("nsToggle");
  const agcToggle = document.getElementById("agcToggle");
  const audioStatus = document.getElementById("audioStatus");
  const leaveRoom = document.getElementById("leaveRoom");
  const contextDock = document.getElementById("contextDock");
  const roomHud = document.getElementById("roomHud");
  const SIGNAL_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

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
    roomCode: "",
    ws: null,
    wsConnected: false,
    clientId: null,
    participantCount: 0,
    stream: null,
    audioStream: null,
    audioContext: null,
    sourceNode: null,
    gainNode: null,
    analyser: null,
    devicesReady: false,
    micMenuOpen: false,
    contextOpen: false,
    profileMenuOpen: false,
    profile: {
      name: "You",
      color: "#7f70ff",
      glyph: "◈",
      bio: ""
    },
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
    loadProfile();
    syncProfileForm();
    renderLetters("");
    focusInputSoon();
    refreshDeviceMenus().catch(() => {});
    tickMic();
  }

  function bindEvents() {
    form.addEventListener("submit", onGateSubmit);
    input.addEventListener("input", onType);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", () => state.mode === "gate" && focusInputSoon());
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    tvRoute.addEventListener("change", applyTvRouting);
    routeOff.addEventListener("click", () => {
      tvRoute.value = "none";
      applyTvRouting();
    });
    routeTv1.addEventListener("click", () => {
      tvRoute.value = "1";
      applyTvRouting();
    });
    routeTv2.addEventListener("click", () => {
      tvRoute.value = "2";
      applyTvRouting();
    });
    shareScreen.addEventListener("click", toggleScreenShare);
    micToggle.addEventListener("click", toggleMic);
    micMenuToggle.addEventListener("click", toggleMicMenu);
    micInputDevice.addEventListener("change", onMicDeviceChange);
    audioOutputDevice.addEventListener("change", onOutputDeviceChange);
    micGain.addEventListener("input", applyMicGain);
    othersVolume.addEventListener("input", applyOthersVolume);
    aecToggle.addEventListener("change", reconfigureMicStream);
    nsToggle.addEventListener("change", reconfigureMicStream);
    agcToggle.addEventListener("change", reconfigureMicStream);
    leaveRoom.addEventListener("click", leaveRoomNow);
    contextDock.addEventListener("click", toggleContextMenu);
    profileToggle.addEventListener("click", toggleProfileMenu);
    profileSave.addEventListener("click", saveProfileFromForm);

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDeviceMenus);
    }
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

  function connectSocket() {
    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) return;
    try {
      state.ws = new WebSocket(SIGNAL_URL);
      state.ws.addEventListener("open", () => {
        state.wsConnected = true;
        setAudioStatus("Online room sync connected.");
        if (state.roomCode) {
          sendSocket({ type: "join_room", roomCode: state.roomCode, profile: state.profile });
        }
      });
      state.ws.addEventListener("close", () => {
        state.wsConnected = false;
        setAudioStatus("Offline mode: local room only.");
      });
      state.ws.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(String(event.data || "{}"));
          handleSocketMessage(msg);
        } catch {
          // ignore malformed
        }
      });
    } catch {
      setAudioStatus("Socket setup failed; staying local.");
    }
  }

  function sendSocket(payload) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify(payload));
  }

  function handleSocketMessage(msg) {
    if (msg.type === "welcome") {
      state.clientId = msg.clientId || null;
      return;
    }
    if (msg.type === "room_state") {
      applyServerRoomState(msg);
      return;
    }
    if (msg.type === "error" && msg.message) {
      setAudioStatus(msg.message);
    }
  }

  function applyServerRoomState(msg) {
    if (!Array.isArray(msg.participants)) return;
    state.participantCount = msg.participants.length;
    const localBooths = msg.participants.slice(0, 20).map((p, i) => ({
      id: i + 1,
      userId: p.userId,
      name: p.name || `User ${i + 1}`,
      bio: p.bio || "",
      glyph: p.glyph || "◉",
      color: p.color || "",
      level: Number(p.level || 0),
      muted: !!p.muted,
      element: null,
      meter: null
    }));
    state.booths = localBooths;
    if (!state.booths.find((b) => b.id === state.activeBoothId)) state.activeBoothId = 1;
    renderBooths(state.participantCount);
    refreshActiveBooth();
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
    renderQuestionFrame(false);
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
    state.roomCode = passcode;

    state.booths = Array.from({ length: boothCount }, (_, i) => ({
      id: i + 1,
      name: i === 0 ? state.profile.name : `Booth ${i + 1}`,
      bio: i === 0 ? state.profile.bio : "",
      glyph: i === 0 ? state.profile.glyph : "◉",
      color: i === 0 ? state.profile.color : "",
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
    connectSocket();
    sendSocket({
      type: "create_or_join_room",
      roomCode: passcode,
      desiredHeads: heads,
      desiredBooths: boothCount,
      profile: state.profile,
      theme: { colors }
    });
    ensureMicInput();
    applyTvRouting();
    applyOthersVolume();
    toggleContextMenu(false);
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
        <div class="booth__orb" style="${booth.color ? `background:${booth.color};box-shadow:0 0 24px ${booth.color}88;` : ""}">${booth.glyph || "◉"}</div>
        <div class="booth__meta">
          <div class="booth__head"><span>${booth.name}</span><button type="button" class="button button--ghost boothMute">Mute</button></div>
          <p class="booth__bio">${booth.bio || "No bio yet."}</p>
          <div class="meter"><i></i></div>
        </div>
      `;

      booth.element = el;
      booth.meter = el.querySelector(".meter i");

      el.addEventListener("click", (e) => {
        if (e.target instanceof HTMLElement && e.target.classList.contains("boothMute")) {
          booth.muted = !booth.muted;
          syncBoothUi(booth);
          sendSocket({ type: "mute_participant", roomCode: state.roomCode, targetUserId: booth.userId, muted: booth.muted });
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
    const orb = booth.element.querySelector(".booth__orb");
    if (booth.muted) {
      booth.element.style.background = "rgba(120,120,120,.22)";
      booth.element.style.boxShadow = "none";
      if (orb) orb.style.filter = "grayscale(1) saturate(.2)";
      if (booth.meter) booth.meter.style.width = "0%";
    } else if (orb) {
      orb.style.filter = "none";
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
      state.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micInputDevice.value ? { exact: micInputDevice.value } : undefined,
          echoCancellation: !!aecToggle.checked,
          noiseSuppression: !!nsToggle.checked,
          autoGainControl: !!agcToggle.checked
        },
        video: false
      });
      const ctx = state.audioContext || new AudioContext();
      const source = ctx.createMediaStreamSource(state.audioStream);
      const gainNode = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(gainNode);
      gainNode.connect(analyser);
      state.audioContext = ctx;
      state.sourceNode = source;
      state.gainNode = gainNode;
      state.analyser = analyser;
      applyMicGain();
      await refreshDeviceMenus();
      setAudioStatus("Mic live.");
      updateMicButton();
    } catch {
      setWhisper("MIC ACCESS DENIED");
      setAudioStatus("Mic denied. Check browser permissions.");
    }
  }

  function setAudioStatus(text) {
    if (audioStatus) audioStatus.textContent = text;
  }

  function toggleMicMenu() {
    state.micMenuOpen = !state.micMenuOpen;
    micMenu.hidden = !state.micMenuOpen;
    micMenuToggle.setAttribute("aria-expanded", String(state.micMenuOpen));
    micMenuToggle.classList.toggle("is-open", state.micMenuOpen);
  }

  function toggleContextMenu(force) {
    state.contextOpen = typeof force === "boolean" ? force : !state.contextOpen;
    roomHud.hidden = !state.contextOpen;
    contextDock.setAttribute("aria-expanded", String(state.contextOpen));
    contextDock.classList.toggle("is-open", state.contextOpen);
  }

  function toggleProfileMenu() {
    state.profileMenuOpen = !state.profileMenuOpen;
    profileMenu.hidden = !state.profileMenuOpen;
    profileToggle.setAttribute("aria-expanded", String(state.profileMenuOpen));
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem("the-eye-profile-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state.profile = {
        name: String(parsed.name || "You").slice(0, 24),
        color: String(parsed.color || "#7f70ff"),
        glyph: String(parsed.glyph || "◈").slice(0, 2),
        bio: String(parsed.bio || "").slice(0, 280)
      };
    } catch {
      // ignore invalid profile cache
    }
  }

  function syncProfileForm() {
    profileName.value = state.profile.name;
    profileColor.value = state.profile.color;
    profileGlyph.value = state.profile.glyph;
    profileBio.value = state.profile.bio;
  }

  function saveProfileFromForm() {
    state.profile = {
      name: String(profileName.value || "You").trim().slice(0, 24) || "You",
      color: String(profileColor.value || "#7f70ff"),
      glyph: String(profileGlyph.value || "◈").trim().slice(0, 2) || "◈",
      bio: String(profileBio.value || "").trim().slice(0, 280)
    };
    try {
      localStorage.setItem("the-eye-profile-v1", JSON.stringify(state.profile));
    } catch {
      // storage optional
    }
    const me = state.booths.find((b) => b.id === 1);
    if (me) {
      me.name = state.profile.name;
      me.bio = state.profile.bio;
      me.glyph = state.profile.glyph;
      me.color = state.profile.color;
      renderBooths(Math.max(state.booths.length, 2));
      refreshActiveBooth();
    }
    sendSocket({ type: "profile_update", roomCode: state.roomCode, profile: state.profile });
    setAudioStatus("Profile saved.");
  }

  async function refreshDeviceMenus() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");
    const outputs = devices.filter((d) => d.kind === "audiooutput");

    fillSelect(micInputDevice, inputs, "Default mic");
    fillSelect(audioOutputDevice, outputs, "Default output");
    state.devicesReady = true;
  }

  function fillSelect(select, devices, fallbackLabel) {
    const current = select.value;
    select.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = fallbackLabel;
    select.appendChild(defaultOpt);
    devices.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `${fallbackLabel} ${i + 1}`;
      select.appendChild(opt);
    });
    if (current && [...select.options].some((o) => o.value === current)) select.value = current;
  }

  async function onMicDeviceChange() {
    await reconfigureMicStream();
  }

  async function reconfigureMicStream() {
    if (state.audioStream) {
      state.audioStream.getTracks().forEach((t) => t.stop());
      state.audioStream = null;
    }
    state.analyser = null;
    await ensureMicInput();
  }

  function applyMicGain() {
    if (!state.gainNode) return;
    state.gainNode.gain.value = Number(micGain.value) / 100;
  }

  async function onOutputDeviceChange() {
    const sinkId = audioOutputDevice.value;
    const videos = [tv1, tv2].filter(Boolean);
    for (const v of videos) {
      if (typeof v.setSinkId === "function") {
        try {
          await v.setSinkId(sinkId || "default");
          setAudioStatus("Output device updated.");
        } catch {
          setAudioStatus("Output device switch blocked by browser/device.");
        }
      } else {
        setAudioStatus("Output switching unsupported on this device/browser.");
      }
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
        sendSocket({ type: "level", roomCode: state.roomCode, level });
      }
    }
    requestAnimationFrame(tickMic);
  }

  function applyOthersVolume() {
    const factor = Number(othersVolume.value) / 100;
    [tv1, tv2].forEach((v) => {
      if (v) v.volume = clamp(factor, 0, 1);
    });
    state.booths.forEach((booth) => {
      if (booth.id === 1 || !booth.meter || booth.muted) return;
      const lvl = Math.round((booth.level || 24) * factor);
      booth.meter.style.width = `${lvl}%`;
      booth.element.style.opacity = String(0.52 + factor * 0.48);
    });
  }

  function toggleMic() {
    state.micMuted = !state.micMuted;
    if (state.audioStream) state.audioStream.getAudioTracks().forEach((t) => { t.enabled = !state.micMuted; });
    updateMicButton();
    setAudioStatus(state.micMuted ? "Mic muted." : "Mic live.");
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
    sendSocket({ type: "tv_route", roomCode: state.roomCode, route });
    if (route === "none") setAudioStatus("TV routing off.");
    else setAudioStatus(`Routing to TV ${route}${state.stream ? " (live)" : " (awaiting share)"}.`);
  }

  function stopScreenShare() {
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    applyTvRouting();
    shareScreen.textContent = "Share screen + audio";
  }

  function leaveRoomNow() {
    stopScreenShare();
    sendSocket({ type: "leave_room", roomCode: state.roomCode });
    state.roomCode = "";
    setMode("gate");
    state.interview.active = false;
    input.value = "";
    renderLetters("");
    setWhisper("");
    toggleContextMenu(false);
    focusInputSoon();
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && state.mode === "room") {
      if (state.contextOpen) {
        toggleContextMenu(false);
        return;
      }
      leaveRoomNow();
      return;
    }
    if (state.mode === "room") {
      const key = event.key.toLowerCase();
      if (key === "m") {
        event.preventDefault();
        toggleMic();
        return;
      }
      if (key === "v") {
        event.preventDefault();
        toggleMicMenu();
        return;
      }
      if (key === "1") {
        tvRoute.value = "1";
        applyTvRouting();
        return;
      }
      if (key === "2") {
        tvRoute.value = "2";
        applyTvRouting();
        return;
      }
      if (key === "0") {
        tvRoute.value = "none";
        applyTvRouting();
        return;
      }
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

    if (!clean) {
      typedWord.classList.add("empty");
      typedWord.innerHTML = "";
      setDynamicType(0);
      return;
    }
    typedWord.classList.remove("empty");

    const nextChars = clean.split("").map((char) => (char === " " ? "·" : char));
    const currentSpans = Array.from(typedWord.querySelectorAll(".letter"));
    const currentChars = currentSpans.map((span) => span.dataset.char || span.textContent || "");

    let firstDiff = -1;
    const shared = Math.min(currentChars.length, nextChars.length);
    for (let i = 0; i < shared; i += 1) {
      if (currentChars[i] !== nextChars[i]) {
        firstDiff = i;
        break;
      }
    }
    if (firstDiff === -1 && currentChars.length !== nextChars.length) firstDiff = shared;
    if (firstDiff === -1) {
      setDynamicType(clean.length);
      return;
    }

    for (let i = currentSpans.length - 1; i >= firstDiff; i -= 1) {
      currentSpans[i].remove();
    }

    for (let index = firstDiff; index < nextChars.length; index += 1) {
      typedWord.appendChild(createLetterSpan(nextChars[index], index));
    }

    setDynamicType(clean.length);
  }

  function createLetterSpan(char, index) {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = char;
    span.dataset.char = char;
    const seed = hash(`${char}-${index}`);
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
    return span;
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
