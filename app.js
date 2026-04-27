const states = [
  {
    name: "Sensory Amplification",
    description: "Perception becomes heightened; ordinary stimuli feel vivid, detailed, and unusually alive.",
    perceptual: "Colors deepen, textures sharpen, sound gains space and separation.",
    cognitive: "Attention locks onto small details. Ordinary things feel newly significant.",
    emotion: "Awe, curiosity, fascination.",
    progression: "Pattern recognition, emotional expansion.",
    color: "#6de9ff"
  },
  {
    name: "Pattern Recognition",
    description: "The mind rapidly connects shapes, ideas, memories, and meanings into visible or conceptual patterns.",
    perceptual: "Repeating geometry, symmetry, texture movement, visual linking.",
    cognitive: "Associative thinking accelerates. Connections feel obvious and alive.",
    emotion: "Wonder, intensity, occasional overwhelm.",
    progression: "Symbolic thinking, over-interpretation.",
    color: "#8a6cff"
  },
  {
    name: "Symbolic Thinking",
    description: "Objects, memories, and sensations begin to feel layered with metaphor or message.",
    perceptual: "Scenes appear meaningful, theatrical, or archetypal.",
    cognitive: "Abstract interpretation increases. The mind builds narratives around experience.",
    emotion: "Insightful, strange, sacred, or emotionally charged.",
    progression: "Archetypal imagery, narrative construction.",
    color: "#e8c77c"
  },
  {
    name: "Ego Dissolution",
    description: "The usual boundary of personal identity softens, weakens, or disappears.",
    perceptual: "Self and environment may feel blended or continuous.",
    cognitive: "Less self-referencing. Thoughts may feel ownerless.",
    emotion: "Peace, awe, fear, surrender, or disorientation.",
    progression: "Unity, spaciousness, identity confusion.",
    color: "#f4efe5"
  },
  {
    name: "Time Distortion",
    description: "The perception of time becomes irregular, stretched, compressed, looped, or nonlinear.",
    perceptual: "Moments may feel elongated, frozen, or repeating.",
    cognitive: "Sequence tracking becomes difficult. Now feels unusually large.",
    emotion: "Neutral, fascinating, or unsettling.",
    progression: "Looping thought, deep presence.",
    color: "#ff6fae"
  },
  {
    name: "Looping Thought",
    description: "A thought, question, phrase, or emotional pattern repeats in a cycle that can be hard to exit.",
    perceptual: "Experience may feel circular or recursive.",
    cognitive: "The mind returns to the same point repeatedly.",
    emotion: "Anxious, trapped, curious, or analytical.",
    progression: "Anxiety, breakthrough insight, surrender.",
    color: "#ff8a5c"
  },
  {
    name: "Entity Encounter",
    description: "The perception of autonomous-seeming beings, presences, figures, guides, tricksters, or observers.",
    perceptual: "Forms may appear independent, intelligent, or responsive.",
    cognitive: "The mind interprets interaction, message, presence, or contact.",
    emotion: "Awe, fear, reverence, curiosity.",
    progression: "Archetypal imagery, narrative construction.",
    color: "#b57cff"
  },
  {
    name: "Unity / Oneness",
    description: "A state where separation between self, world, others, or existence feels reduced or absent.",
    perceptual: "Boundaries dissolve into a connected field.",
    cognitive: "Self/other distinctions soften. Meaning may feel total.",
    emotion: "Peace, completeness, devotion, awe.",
    progression: "Afterglow, integration, reverence.",
    color: "#9dffcb"
  },
  {
    name: "Visual Drift",
    description: "Surfaces appear to breathe, melt, ripple, crawl, or subtly rearrange.",
    perceptual: "Walls, textures, faces, and shadows may shift softly.",
    cognitive: "Attention becomes fascinated by motion in stillness.",
    emotion: "Playful, uncanny, beautiful, or strange.",
    progression: "Pattern recognition, geometry, immersion.",
    color: "#70ffd8"
  },
  {
    name: "Afterglow",
    description: "A post-experience state marked by emotional clarity, softness, gratitude, or renewed perspective.",
    perceptual: "The world may feel clean, quiet, or gently illuminated.",
    cognitive: "Insights feel easier to hold. Priorities may feel rearranged.",
    emotion: "Peace, tenderness, hope, humility.",
    progression: "Integration, reflection, lifestyle change.",
    color: "#ffe6a8"
  }
];

const hero = document.getElementById("hero");
const web = document.getElementById("web");
const pupil = document.getElementById("pupil");
const form = document.getElementById("searchForm");
const input = document.getElementById("stateSearch");
const suggestions = document.getElementById("suggestions");
const backButton = document.getElementById("backButton");
const nodeDock = document.getElementById("nodeDock");

const title = document.getElementById("stateTitle");
const desc = document.getElementById("stateDescription");
const perceptual = document.getElementById("statePerceptual");
const cognitive = document.getElementById("stateCognitive");
const emotion = document.getElementById("stateEmotion");
const progression = document.getElementById("stateProgression");

const canvas = document.getElementById("webCanvas");
const ctx = canvas.getContext("2d");

let activeState = states[0];
let particles = [];
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

function resizeCanvas() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function createParticles() {
  particles = [];

  const count = window.innerWidth < 800 ? 70 : 130;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.45;

    particles.push({
      x: window.innerWidth / 2 + Math.cos(angle) * radius,
      y: window.innerHeight / 2 + Math.sin(angle) * radius,
      baseX: window.innerWidth / 2 + Math.cos(angle) * radius,
      baseY: window.innerHeight / 2 + Math.sin(angle) * radius,
      size: Math.random() * 2.6 + 0.8,
      speed: Math.random() * 0.008 + 0.002,
      angle,
      radius,
      pulse: Math.random() * Math.PI * 2
    });
  }
}

function drawWeb() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, window.innerWidth * 0.65);
  gradient.addColorStop(0, `${hexToRgba(activeState.color, 0.22)}`);
  gradient.addColorStop(0.35, "rgba(120, 70, 255, 0.08)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach((p, i) => {
    p.pulse += 0.018;
    p.angle += p.speed;

    const breathe = Math.sin(p.pulse) * 14;
    p.x = centerX + Math.cos(p.angle) * (p.radius + breathe);
    p.y = centerY + Math.sin(p.angle) * (p.radius + breathe);

    const dxMouse = mouse.x - p.x;
    const dyMouse = mouse.y - p.y;
    const mouseDist = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

    if (mouseDist < 130) {
      p.x -= dxMouse * 0.018;
      p.y -= dyMouse * 0.018;
    }

    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 125) {
        ctx.beginPath();
        ctx.strokeStyle = hexToRgba(activeState.color, 0.13 * (1 - dist / 125));
        ctx.lineWidth = 0.7;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.fillStyle = hexToRgba(activeState.color, 0.52);
    ctx.shadowBlur = 18;
    ctx.shadowColor = activeState.color;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  drawCentralNode(centerX, centerY);

  requestAnimationFrame(drawWeb);
}

function drawCentralNode(x, y) {
  const time = performance.now() * 0.001;
  const pulse = Math.sin(time * 1.5) * 8;

  ctx.beginPath();
  ctx.arc(x, y, 68 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(activeState.color, 0.08);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 28 + pulse * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(activeState.color, 0.55);
  ctx.shadowBlur = 48;
  ctx.shadowColor = activeState.color;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = "600 13px Inter";
  ctx.fillStyle = "rgba(244,239,229,0.76)";
  ctx.textAlign = "center";
  ctx.fillText(activeState.name.toUpperCase(), x, y + 92);
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function enterWeb(state = activeState) {
  setActiveState(state);
  hero.classList.add("hidden");
  web.classList.add("active");
}

function exitWeb() {
  web.classList.remove("active");
  hero.classList.remove("hidden");
}

function setActiveState(state) {
  activeState = state;

  title.textContent = state.name;
  desc.textContent = state.description;
  perceptual.textContent = state.perceptual;
  cognitive.textContent = state.cognitive;
  emotion.textContent = state.emotion;
  progression.textContent = state.progression;

  document.documentElement.style.setProperty("--active", state.color);
}

function findState(query) {
  const clean = query.trim().toLowerCase();

  return (
    states.find(s => s.name.toLowerCase() === clean) ||
    states.find(s => s.name.toLowerCase().includes(clean)) ||
    states[0]
  );
}

function renderSuggestions() {
  suggestions.innerHTML = "";
  nodeDock.innerHTML = "";

  states.forEach(state => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = state.name;
    chip.addEventListener("click", () => enterWeb(state));
    suggestions.appendChild(chip);

    const dockButton = document.createElement("button");
    dockButton.type = "button";
    dockButton.textContent = state.name;
    dockButton.addEventListener("click", () => setActiveState(state));
    nodeDock.appendChild(dockButton);
  });
}

form.addEventListener("submit", event => {
  event.preventDefault();
  enterWeb(findState(input.value));
});

pupil.addEventListener("click", () => {
  enterWeb(findState(input.value || "Sensory Amplification"));
});

backButton.addEventListener("click", exitWeb);

window.addEventListener("mousemove", event => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;

  const iris = document.getElementById("iris");
  const x = (event.clientX / window.innerWidth - 0.5) * 8;
  const y = (event.clientY / window.innerHeight - 0.5) * 8;

  iris.style.marginLeft = `${x}px`;
  iris.style.marginTop = `${y}px`;
});

renderSuggestions();
createParticles();
drawWeb();
