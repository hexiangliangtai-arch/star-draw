const canvas = document.getElementById("skyCanvas");
const context = canvas.getContext("2d");

const placeModeButton = document.getElementById("placeModeButton");
const connectModeButton = document.getElementById("connectModeButton");
const openNameButton = document.getElementById("openNameButton");
const namePanel = document.getElementById("namePanel");
const constellationNameInput = document.getElementById("constellationNameInput");
const showNameButton = document.getElementById("showNameButton");
const resetButton = document.getElementById("resetButton");
const nameMessage = document.getElementById("nameMessage");

const MODE_PLACE = "place";
const MODE_CONNECT = "connect";

let currentMode = MODE_PLACE;
let stars = [];
let lines = [];
let selectedStarId = null;
let constellationName = "";
let nextStarId = 1;

let backgroundStars = [];

function resizeCanvasToWindow() {
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 画面サイズが変わっても、配置済みの星は同じ比率の位置に残します。
  if (previousWidth > 0 && previousHeight > 0 && stars.length > 0) {
    const scaleX = canvas.width / previousWidth;
    const scaleY = canvas.height / previousHeight;

    stars.forEach(function(star) {
      star.x = star.x * scaleX;
      star.y = star.y * scaleY;
    });
  }

  backgroundStars = createBackgroundStars(130);
  drawSky();
}

// 背景用の星は固定して、再描画しても同じ位置に出るようにします。
function createBackgroundStars(count) {
  const createdStars = [];

  for (let i = 0; i < count; i++) {
    createdStars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.6 + 0.4,
      opacity: Math.random() * 0.45 + 0.18
    });
  }

  return createdStars;
}

function setMode(mode) {
  currentMode = mode;
  selectedStarId = null;

  placeModeButton.classList.toggle("active", currentMode === MODE_PLACE);
  connectModeButton.classList.toggle("active", currentMode === MODE_CONNECT);

  drawSky();
}

function openNamePanel() {
  nameMessage.textContent = "";
  namePanel.classList.remove("is-hidden");
  constellationNameInput.focus();
}

function closeNamePanel() {
  namePanel.classList.add("is-hidden");
}

function getCanvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function addStar(x, y) {
  stars.push({
    id: nextStarId,
    x: x,
    y: y,
    radius: 5
  });

  nextStarId++;
  drawSky();
}

function findClickedStar(x, y) {
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i];
    const distance = Math.hypot(star.x - x, star.y - y);

    if (distance <= 14) {
      return star;
    }
  }

  return null;
}

function connectStars(firstStarId, secondStarId) {
  if (firstStarId === secondStarId) {
    return;
  }

  const alreadyConnected = lines.some(function(line) {
    const sameOrder = line.fromId === firstStarId && line.toId === secondStarId;
    const reverseOrder = line.fromId === secondStarId && line.toId === firstStarId;
    return sameOrder || reverseOrder;
  });

  if (!alreadyConnected) {
    lines.push({
      fromId: firstStarId,
      toId: secondStarId
    });
  }
}

function handleCanvasClick(event) {
  const position = getCanvasPosition(event);

  if (currentMode === MODE_PLACE) {
    addStar(position.x, position.y);
    return;
  }

  const clickedStar = findClickedStar(position.x, position.y);

  if (!clickedStar) {
    selectedStarId = null;
    drawSky();
    return;
  }

  // 1つ目の星を選択し、2つ目の星が選ばれたら線で結びます。
  if (selectedStarId === null) {
    selectedStarId = clickedStar.id;
  } else {
    connectStars(selectedStarId, clickedStar.id);
    selectedStarId = null;
  }

  drawSky();
}

function showConstellationName() {
  const inputName = constellationNameInput.value.trim();

  if (inputName === "") {
    nameMessage.textContent = "星座名を入力してください";
    drawSky();
    return;
  } else {
    constellationName = inputName;
  }

  constellationNameInput.value = "";
  nameMessage.textContent = "";
  closeNamePanel();
  drawSky();
}

function resetSky() {
  stars = [];
  lines = [];
  selectedStarId = null;
  constellationName = "";
  nextStarId = 1;
  constellationNameInput.value = "";
  nameMessage.textContent = "";
  closeNamePanel();
  setMode(MODE_PLACE);
}

function drawSky() {
  drawNightBackground();
  drawConstellationLines();
  drawUserStars();
  drawConstellationName();
}

function drawNightBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#17234d");
  gradient.addColorStop(0.48, "#0b1230");
  gradient.addColorStop(1, "#030612");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const moonGlow = context.createRadialGradient(770, 90, 10, 770, 90, 230);
  moonGlow.addColorStop(0, "rgba(255, 238, 183, 0.18)");
  moonGlow.addColorStop(1, "rgba(255, 238, 183, 0)");
  context.fillStyle = moonGlow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  backgroundStars.forEach(function(star) {
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(235, 242, 255, " + star.opacity + ")";
    context.fill();
  });
}

function drawConstellationLines() {
  lines.forEach(function(line) {
    const fromStar = stars.find(function(star) {
      return star.id === line.fromId;
    });
    const toStar = stars.find(function(star) {
      return star.id === line.toId;
    });

    if (!fromStar || !toStar) {
      return;
    }

    context.beginPath();
    context.moveTo(fromStar.x, fromStar.y);
    context.lineTo(toStar.x, toStar.y);
    context.strokeStyle = "rgba(194, 225, 255, 0.68)";
    context.lineWidth = 2;
    context.shadowColor = "rgba(136, 203, 255, 0.86)";
    context.shadowBlur = 10;
    context.stroke();
    context.shadowBlur = 0;
  });
}

function drawUserStars() {
  stars.forEach(function(star) {
    const isSelected = star.id === selectedStarId;
    const radius = isSelected ? star.radius + 3 : star.radius;
    const glowSize = isSelected ? 28 : 18;

    const glow = context.createRadialGradient(star.x, star.y, 1, star.x, star.y, glowSize);
    glow.addColorStop(0, "rgba(255, 246, 181, 0.95)");
    glow.addColorStop(0.35, "rgba(255, 246, 181, 0.45)");
    glow.addColorStop(1, "rgba(255, 246, 181, 0)");

    context.beginPath();
    context.arc(star.x, star.y, glowSize, 0, Math.PI * 2);
    context.fillStyle = glow;
    context.fill();

    context.beginPath();
    context.arc(star.x, star.y, radius, 0, Math.PI * 2);
    context.fillStyle = isSelected ? "#fff8c9" : "#fffdf1";
    context.shadowColor = isSelected ? "#fff1a3" : "#cfe5ff";
    context.shadowBlur = isSelected ? 18 : 12;
    context.fill();
    context.shadowBlur = 0;
  });
}

function drawConstellationName() {
  if (constellationName === "") {
    return;
  }

  context.save();
  context.font = "bold 34px 'Hiragino Sans', 'Yu Gothic', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = "rgba(255, 246, 196, 0.96)";
  context.shadowColor = "rgba(255, 228, 143, 0.8)";
  context.shadowBlur = 18;
  context.fillText(constellationName, canvas.width / 2, 28);
  context.restore();
}

canvas.addEventListener("click", handleCanvasClick);
placeModeButton.addEventListener("click", function() {
  setMode(MODE_PLACE);
});
connectModeButton.addEventListener("click", function() {
  setMode(MODE_CONNECT);
});
openNameButton.addEventListener("click", openNamePanel);
showNameButton.addEventListener("click", showConstellationName);
resetButton.addEventListener("click", resetSky);
window.addEventListener("resize", resizeCanvasToWindow);

resizeCanvasToWindow();
