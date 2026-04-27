const states = [
  {
    name: "Sensory Amplification",
    essence: "Ordinary sensation becomes vivid, dimensional, and strangely intimate.",
    perception: "Color, texture, sound, and space feel intensified.",
    mind: "Attention begins attaching to fine detail and pattern.",
    tone: "Awe, curiosity, fascination, and sometimes overwhelm.",
    color: "#74f4ff"
  },
  {
    name: "Pattern Recognition",
    essence: "The mind begins seeing hidden structure between shapes, memories, symbols, and events.",
    perception: "Geometry appears in surfaces; repetition becomes magnetic.",
    mind: "Association accelerates. Everything seems linked.",
    tone: "Wonder, intensity, revelation, or cognitive overload.",
    color: "#a789ff"
  },
  {
    name: "Visual Drift",
    essence: "Stillness begins to move; surfaces breathe, ripple, crawl, or softly rearrange.",
    perception: "Edges pulse, textures flow, shadows bend, walls seem alive.",
    mind: "Attention becomes hypnotized by motion in stillness.",
    tone: "Playful, eerie, beautiful, uncanny.",
    color: "#78ffc8"
  },
  {
    name: "Time Distortion",
    essence: "The clock loses authority. Moments stretch, compress, repeat, or dissolve.",
    perception: "The present feels enlarged; sequence becomes slippery.",
    mind: "Tracking before and after becomes unstable.",
    tone: "Fascination, stillness, confusion, or unease.",
    color: "#ff77bd"
  },
  {
    name: "Looping Thought",
    essence: "A thought becomes a hallway that keeps returning to the same door.",
    perception: "Experience may feel recursive, circular, or trapped.",
    mind: "The same phrase, fear, insight, or question repeats.",
    tone: "Analytical, anxious, trapped, or suddenly clarifying.",
    color: "#ff9d5c"
  },
  {
    name: "Ego Dissolution",
    essence: "The border of self softens until identity feels less fixed, private, or separate.",
    perception: "Self and world may begin to blend.",
    mind: "Thoughts feel less owned. The narrator quiets.",
    tone: "Peace, terror, awe, surrender, spaciousness.",
    color: "#eee7d8"
  },
  {
    name: "Entity Encounter",
    essence: "The mind perceives autonomous-seeming figures, presences, guides, observers, or tricksters.",
    perception: "Forms appear responsive, intelligent, or aware.",
    mind: "Experience becomes relational, symbolic, or conversational.",
    tone: "Awe, fear, reverence, curiosity.",
    color: "#c084fc"
  },
  {
    name: "Unity / Oneness",
    essence: "Separation fades; self, world, memory, and existence feel woven from the same fabric.",
    perception: "Boundaries dissolve into a shared field.",
    mind: "Division between self and other weakens.",
    tone: "Peace, devotion, completeness, sacredness.",
    color: "#b9ffd8"
  },
  {
    name: "Afterglow",
    essence: "A softened clarity remains after intensity passes, as if the world has been rinsed clean.",
    perception: "Light, space, and ordinary detail feel gentle.",
    mind: "Priorities may feel rearranged and easier to see.",
    tone: "Gratitude, tenderness, humility, hope.",
    color: "#ffe3a3"
  }
];

const origin = document.getElementById("origin");
const archive = document.getElementById("archive");
const enterButton = document.getElementById("enterButton");
const returnButton = document.getElementById("returnButton");
const searchInput = document.getElementById("searchInput");
const stateOrbit = document.getElementById("stateOrbit");

const stateIndex = document.getElementById("stateIndex");
const stateName = document.getElementById("stateName");
const stateEssence = document.getElementById("stateEssence");
const statePerception = document.getElementById("statePerception");
const stateMind = document.getElementById("stateMind");
const stateTone = document.getElementById("stateTone");

const eyeCanvas = document.getElementById("eyeCanvas");
const eyeCtx = eyeCanvas.getContext("2d");

const archiveCanvas = document.getElementById("archiveCanvas");
const archiveCtx = archiveCanvas.getContext("2d");

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = window.devicePixelRatio || 1;

let mouse = {
  x: width / 2,
  y: height / 2,
  easeX: width / 2,
  easeY: height / 2,
  down: false
};

let activeState = 0;
let entering = false;
let eyeZoom = 1;
let blink = 0;
let archiveTime = 0;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = window.devicePixelRatio || 1;

  [eyeCanvas, archiveCanvas].forEach(canvas => {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  });

  eyeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  archiveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("mousedown", () => {
  mouse.down = true;
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

eyeCanvas.addEventListener("click", () => {
  enterArchive(findState(searchInput.value));
});

enterButton.addEventListener("click", () => {
  enterArchive(findState(searchInput.value));
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    enterArchive(findState(searchInput.value));
  }
});

returnButton.addEventListener("click", () => {
  origin.classList.remove("entering");
  archive.classList.remove("visible");
  entering = false;
  eyeZoom = 1;
});

function findState(query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const exact = states.findIndex(s => s.name.toLowerCase() === q);
  if (exact >= 0) return exact;

  const partial = states.findIndex(s => s.name.toLowerCase().includes(q));
  if (partial >= 0) return partial;

  return 0;
}

function enterArchive(index) {
  activeState = index;
  updateStateUI();
  entering = true;
  origin.classList.add("entering");

  setTimeout(() => {
    archive.classList.add("visible");
  }, 620);
}

function updateStateUI() {
  const s = states[activeState];

  stateIndex.textContent = String(activeState + 1).padStart(2, "0");
  stateName.textContent = s.name;
  stateEssence.textContent = s.essence;
  statePerception.textContent = s.perception;
  stateMind.textContent = s.mind;
  stateTone.textContent = s.tone;

  document.documentElement.style.setProperty("--active", s.color);

  [...stateOrbit.children].forEach((btn, i) => {
    btn.classList.toggle("active", i === activeState);
  });
}

function buildOrbit() {
  states.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.textContent = s.name;
    btn.addEventListener("click", () => {
      activeState = i;
      updateStateUI();
    });
    stateOrbit.appendChild(btn);
  });

  updateStateUI();
}

buildOrbit();

function drawEye() {
  const t = performance.now() * 0.001;

  mouse.easeX += (mouse.x - mouse.easeX) * 0.045;
  mouse.easeY += (mouse.y - mouse.easeY) * 0.045;

  if (entering) eyeZoom += (9 - eyeZoom) * 0.035;
  else eyeZoom += (1 - eyeZoom) * 0.035;

  blink = Math.max(0, blink - 0.035);
  if (Math.random() < 0.004 && !entering) blink = 1;

  eyeCtx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const min = Math.min(width, height);

  const lookX = (mouse.easeX - cx) / width;
  const lookY = (mouse.easeY - cy) / height;

  eyeCtx.save();
  eyeCtx.translate(cx, cy);
  eyeCtx.scale(eyeZoom, eyeZoom);
  eyeCtx.translate(-cx, -cy);

  drawCameraVignette(eyeCtx);
  drawWetSurface(eyeCtx, t);
  drawMacroPupil(eyeCtx, cx + lookX * 24, cy + lookY * 18, min, t);
  drawEyelidShadow(eyeCtx, blink, t);
  drawFilmNoise(eyeCtx, t);

  eyeCtx.restore();

  requestAnimationFrame(drawEye);
}

function drawCameraVignette(ctx) {
  const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.72);
  g.addColorStop(0, "rgba(255,255,255,0.02)");
  g.addColorStop(0.42, "rgba(0,0,0,0.06)");
  g.addColorStop(0.76, "rgba(0,0,0,0.54)");
  g.addColorStop(1, "rgba(0,0,0,0.96)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawWetSurface(ctx, t) {
  for (let i = 0; i < 16; i++) {
    const x = width * noiseLike(i * 12.7, t * 0.08);
    const y = height * noiseLike(i * 4.3, t * 0.07);
    const r = 80 + 180 * noiseLike(i * 9.1, t * 0.04);

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.035)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMacroPupil(ctx, cx, cy, min, t) {
  const irisR = min * 0.55;
  const pupilR = min * (0.145 + Math.sin(t * 0.7) * 0.006 + (mouse.down ? 0.018 : 0));

  const irisGradient = ctx.createRadialGradient(cx, cy, pupilR * 0.4, cx, cy, irisR);
  irisGradient.addColorStop(0.00, "#000000");
  irisGradient.addColorStop(0.19, "#050407");
  irisGradient.addColorStop(0.25, "#1b1028");
  irisGradient.addColorStop(0.42, "#263b47");
  irisGradient.addColorStop(0.58, "#8b7549");
  irisGradient.addColorStop(0.76, "#201329");
  irisGradient.addColorStop(1.00, "#030304");

  ctx.fillStyle = irisGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);

  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2;
    const wobble =
      Math.sin(a * 9 + t * 0.7) * 0.018 +
      Math.sin(a * 23 - t * 0.5) * 0.009;

    const inner = pupilR * (1.05 + Math.sin(i) * 0.03);
    const outer = irisR * (0.72 + wobble + Math.random() * 0.002);

    const alpha = 0.035 + 0.08 * Math.abs(Math.sin(a * 4 + t));
    const hueShift = i % 3;

    ctx.beginPath();
    ctx.strokeStyle =
      hueShift === 0 ? `rgba(238,231,216,${alpha})` :
      hueShift === 1 ? `rgba(116,244,255,${alpha * 0.55})` :
      `rgba(167,137,255,${alpha * 0.45})`;

    ctx.lineWidth = Math.random() * 1.2 + 0.2;

    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a + wobble) * outer, Math.sin(a + wobble) * outer);
    ctx.stroke();
  }

  for (let r = 0.22; r < 0.98; r += 0.055) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(238,231,216,${0.025 + Math.sin(t + r * 20) * 0.015})`;
    ctx.lineWidth = 1;
    ctx.arc(0, 0, irisR * r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  const pupilGradient = ctx.createRadialGradient(
    cx - pupilR * 0.25,
    cy - pupilR * 0.32,
    0,
    cx,
    cy,
    pupilR * 1.2
  );
  pupilGradient.addColorStop(0, "#08040b");
  pupilGradient.addColorStop(0.48, "#000000");
  pupilGradient.addColorStop(1, "#000000");

  ctx.fillStyle = pupilGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
  ctx.fill();

  const glow = ctx.createRadialGradient(cx, cy, pupilR * 0.2, cx, cy, pupilR * 2.2);
  glow.addColorStop(0, "rgba(0,0,0,0.95)");
  glow.addColorStop(0.48, "rgba(0,0,0,0.18)");
  glow.addColorStop(1, "rgba(116,244,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.beginPath();
  ctx.ellipse(cx - irisR * 0.22, cy - irisR * 0.23, irisR * 0.095, irisR * 0.035, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx + irisR * 0.17, cy + irisR * 0.16, irisR * 0.045, irisR * 0.018, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyelidShadow(ctx, blinkAmount, t) {
  const top = height * (0.08 + blinkAmount * 0.42 + Math.sin(t * 0.8) * 0.01);
  const bottom = height * (0.92 - blinkAmount * 0.42);

  const topGrad = ctx.createLinearGradient(0, 0, 0, top + height * 0.18);
  topGrad.addColorStop(0, "rgba(0,0,0,0.98)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, top + height * 0.18);

  const botGrad = ctx.createLinearGradient(0, bottom - height * 0.18, 0, height);
  botGrad.addColorStop(0, "rgba(0,0,0,0)");
  botGrad.addColorStop(1, "rgba(0,0,0,0.98)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, bottom - height * 0.18, width, height);
}

function drawFilmNoise(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawArchive() {
  archiveTime += 0.01;

  const s = states[activeState];
  const cx = width * 0.54;
  const cy = height * 0.46;

  archiveCtx.clearRect(0, 0, width, height);

  const bg = archiveCtx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.8);
  bg.addColorStop(0, hexToRgba(s.color, 0.18));
  bg.addColorStop(0.28, "rgba(10,8,18,0.72)");
  bg.addColorStop(1, "rgba(0,0,0,1)");
  archiveCtx.fillStyle = bg;
  archiveCtx.fillRect(0, 0, width, height);

  archiveCtx.save();
  archiveCtx.translate(cx, cy);

  drawLiquidGeometry(archiveCtx, s.color, archiveTime);
  drawMemoryThreads(archiveCtx, s.color, archiveTime);
  drawArchivePupil(archiveCtx, s.color, archiveTime);

  archiveCtx.restore();

  requestAnimationFrame(drawArchive);
}

function drawLiquidGeometry(ctx, color, t) {
  for (let layer = 0; layer < 7; layer++) {
    const points = 7 + layer * 2;
    const baseR = 70 + layer * 58;

    ctx.beginPath();

    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const distortion =
        Math.sin(a * 3 + t * (0.7 + layer * 0.08)) * 20 +
        Math.sin(a * 7 - t * 0.6) * 8;

      const r = baseR + distortion;
      const x = Math.cos(a + t * 0.045 * (layer % 2 ? 1 : -1)) * r;
      const y = Math.sin(a + t * 0.045 * (layer % 2 ? 1 : -1)) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.strokeStyle = hexToRgba(color, 0.12 - layer * 0.01);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function drawMemoryThreads(ctx, color, t) {
  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2 + Math.sin(t + i) * 0.08;
    const r1 = 48 + Math.sin(t * 2 + i) * 8;
    const r2 = 480 + Math.sin(t + i * 0.4) * 70;

    const cp1 = r2 * 0.35;
    const cp2 = r2 * 0.68;

    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.bezierCurveTo(
      Math.cos(a + 0.5) * cp1,
      Math.sin(a + 0.5) * cp1,
      Math.cos(a - 0.42) * cp2,
      Math.sin(a - 0.42) * cp2,
      Math.cos(a) * r2,
      Math.sin(a) * r2
    );

    ctx.strokeStyle = hexToRgba(color, 0.08);
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
}

function drawArchivePupil(ctx, color, t) {
  const pulse = Math.sin(t * 2) * 4;

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 170);
  g.addColorStop(0, "#000");
  g.addColorStop(0.42, "#030305");
  g.addColorStop(0.72, hexToRgba(color, 0.18));
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 170 + pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 42 + pulse * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 54 + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(color, 0.32);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = bigint >> 16 & 255;
  const g = bigint >> 8 & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function noiseLike(seed, time) {
  return (Math.sin(seed * 12.9898 + time * 78.233) * 43758.5453) % 1 * 0.5 + 0.5;
}

drawEye();
drawArchive();
