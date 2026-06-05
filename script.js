const canvas = document.getElementById("skyCanvas");
const context = canvas.getContext("2d");

const bottomToolbar = document.querySelector(".bottom-toolbar");
const toolbarCreateButton = document.getElementById("toolbarCreateButton");
const toolbarCollectionButton = document.getElementById("toolbarCollectionButton");
const bottomPanel = document.getElementById("bottomPanel");
const createPanel = document.getElementById("createPanel");
const collectionPanel = document.getElementById("collectionPanel");
const placeModeButton = document.getElementById("placeModeButton");
const connectModeButton = document.getElementById("connectModeButton");
const deleteModeButton = document.getElementById("deleteModeButton");
const saveButton = document.getElementById("saveButton");
const saveNameModal = document.getElementById("saveNameModal");
const saveNameInput = document.getElementById("saveNameInput");
const confirmSaveButton = document.getElementById("confirmSaveButton");
const cancelSaveButton = document.getElementById("cancelSaveButton");
const resetButton = document.getElementById("resetButton");
const saveMessage = document.getElementById("saveMessage");
const collectionList = document.getElementById("collectionList");
const constellationTitle = document.getElementById("constellationTitle");

const MODE_PLACE = "place";
const MODE_CONNECT = "connect";
const MODE_DELETE = "delete";
const STORAGE_KEY = "myNightSkyCollections";

let currentMode = MODE_PLACE;
let stars = [];
let lines = [];
let selectedStarId = null;
let constellationName = "";
let nextStarId = 1;
let activePanel = null;

let backgroundStars = [];

function resizeCanvasToWindow() {
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;
  const toolbarHeight = bottomToolbar.getBoundingClientRect().height;
  const skyHeight = Math.max(1, window.innerHeight - toolbarHeight);

  canvas.width = window.innerWidth;
  canvas.height = skyHeight;

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
  deleteModeButton.classList.toggle("active", currentMode === MODE_DELETE);

  drawSky();
}

function updateConstellationTitle() {
  constellationTitle.textContent = constellationName;
}

function closeSaveNameArea() {
  saveNameModal.classList.add("is-hidden");
}

function openSaveNameArea() {
  if (stars.length === 0) {
    showSaveMessage("星を置いてから保存してください");
    alert("星を置いてから保存してください");
    return;
  }

  showSaveMessage("");
  saveNameInput.value = constellationName;
  saveNameModal.classList.remove("is-hidden");
  saveNameInput.focus();
}

function closeAllPanels() {
  activePanel = null;
  bottomPanel.classList.add("is-hidden");
  createPanel.classList.add("is-hidden");
  collectionPanel.classList.add("is-hidden");
  toolbarCreateButton.classList.remove("active");
  toolbarCollectionButton.classList.remove("active");
}

function openToolbarPanel(panelName) {
  if (panelName === "create") {
    const shouldCloseCreatePanel = activePanel === "create";

    closeAllPanels();

    if (!shouldCloseCreatePanel) {
      activePanel = "create";
      createPanel.classList.remove("is-hidden");
      toolbarCreateButton.classList.add("active");
    }

    return;
  }

  if (activePanel === panelName) {
    closeAllPanels();
    return;
  }

  activePanel = panelName;
  bottomPanel.classList.remove("is-hidden");
  createPanel.classList.toggle("is-hidden", panelName !== "create");
  collectionPanel.classList.toggle("is-hidden", panelName !== "collection");
  toolbarCreateButton.classList.toggle("active", panelName === "create");
  toolbarCollectionButton.classList.toggle("active", panelName === "collection");

  if (panelName === "collection") {
    closeSaveNameArea();
    renderCollectionList();
  }
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

function findClickedLine(x, y) {
  const clickRange = 6;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fromStar = stars.find(function(star) {
      return star.id === line.fromId;
    });
    const toStar = stars.find(function(star) {
      return star.id === line.toId;
    });

    if (!fromStar || !toStar) {
      continue;
    }

    const distance = getDistanceFromPointToLineSegment(
      x,
      y,
      fromStar.x,
      fromStar.y,
      toStar.x,
      toStar.y
    );

    if (distance <= clickRange) {
      return line;
    }
  }

  return null;
}

function getDistanceFromPointToLineSegment(pointX, pointY, startX, startY, endX, endY) {
  const lineX = endX - startX;
  const lineY = endY - startY;
  const lineLengthSquared = lineX * lineX + lineY * lineY;

  if (lineLengthSquared === 0) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const pointPosition = ((pointX - startX) * lineX + (pointY - startY) * lineY) / lineLengthSquared;
  const clampedPosition = Math.max(0, Math.min(1, pointPosition));
  const closestX = startX + clampedPosition * lineX;
  const closestY = startY + clampedPosition * lineY;

  return Math.hypot(pointX - closestX, pointY - closestY);
}

function deleteStar(starId) {
  stars = stars.filter(function(star) {
    return star.id !== starId;
  });

  // 削除した星につながっていた線も一緒に消します。
  lines = lines.filter(function(line) {
    return line.fromId !== starId && line.toId !== starId;
  });
}

function deleteLine(lineToDelete) {
  lines = lines.filter(function(line) {
    return line !== lineToDelete;
  });
}

function copyStars(starList) {
  return starList.map(function(star) {
    return {
      id: Number(star.id) || 0,
      x: Number(star.x) || 0,
      y: Number(star.y) || 0,
      radius: Number(star.radius) || 5
    };
  });
}

function copyLines(lineList) {
  return lineList.map(function(line) {
    return {
      fromId: Number(line.fromId) || 0,
      toId: Number(line.toId) || 0
    };
  });
}

function getSavedCollections() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEY);

    if (!savedText) {
      return [];
    }

    const parsedCollections = JSON.parse(savedText);

    if (!Array.isArray(parsedCollections)) {
      return [];
    }

    return parsedCollections;
  } catch (error) {
    return [];
  }
}

function saveCollections(collections) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    return true;
  } catch (error) {
    return false;
  }
}

function getCurrentConstellationNameForSave() {
  return saveNameInput.value.trim();
}

function validateSaveData(name) {
  if (stars.length === 0) {
    return "星を置いてから保存してください";
  }

  if (name === "") {
    return "星座名を入力してください";
  }

  return "";
}

function showSaveMessage(message) {
  saveMessage.textContent = message;
}

function saveCurrentConstellation() {
  const name = getCurrentConstellationNameForSave();
  const errorMessage = validateSaveData(name);

  if (errorMessage !== "") {
    showSaveMessage(errorMessage);
    return;
  }

  const collections = getSavedCollections();
  const savedConstellation = {
    id: "constellation-" + Date.now(),
    name: name,
    stars: copyStars(stars),
    lines: copyLines(lines),
    savedAt: new Date().toISOString()
  };

  collections.push(savedConstellation);

  if (!saveCollections(collections)) {
    showSaveMessage("保存できませんでした");
    return;
  }

  constellationName = name;
  saveNameInput.value = "";
  closeSaveNameArea();
  updateConstellationTitle();
  drawSky();
  renderCollectionList();
  showSaveMessage("保存しました");
}

function formatSavedDate(savedAt) {
  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderCollectionList() {
  const collections = getSavedCollections();
  collectionList.innerHTML = "";

  if (collections.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-collection";
    emptyMessage.textContent = "保存済みの星座はまだありません";
    collectionList.appendChild(emptyMessage);
    return;
  }

  collections.slice().reverse().forEach(function(savedConstellation) {
    const itemButton = document.createElement("button");
    itemButton.className = "collection-item";
    itemButton.type = "button";

    const nameText = document.createElement("span");
    nameText.className = "collection-name";
    nameText.textContent = savedConstellation.name || "名前のない星座";

    const dateText = document.createElement("span");
    dateText.className = "collection-date";
    dateText.textContent = formatSavedDate(savedConstellation.savedAt);

    itemButton.appendChild(nameText);
    itemButton.appendChild(dateText);
    itemButton.addEventListener("click", function() {
      loadConstellation(savedConstellation);
    });

    collectionList.appendChild(itemButton);
  });
}

function loadConstellation(savedConstellation) {
  const hasCurrentWork = stars.length > 0 || lines.length > 0 || constellationName !== "";

  if (hasCurrentWork && !confirm("現在の星空が置き換わります。読み込みますか？")) {
    return;
  }

  stars = copyStars(Array.isArray(savedConstellation.stars) ? savedConstellation.stars : []);
  lines = copyLines(Array.isArray(savedConstellation.lines) ? savedConstellation.lines : []);
  constellationName = savedConstellation.name || "";
  selectedStarId = null;
  saveNameInput.value = constellationName;
  closeSaveNameArea();
  updateConstellationTitle();

  const maxStarId = stars.reduce(function(maxId, star) {
    return Math.max(maxId, Number(star.id) || 0);
  }, 0);
  nextStarId = maxStarId + 1;

  showSaveMessage("読み込みました");
  setMode(MODE_PLACE);
  closeAllPanels();
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

  if (currentMode === MODE_DELETE) {
    handleDeleteClick(position.x, position.y);
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

function handleDeleteClick(x, y) {
  const clickedStar = findClickedStar(x, y);

  if (clickedStar) {
    deleteStar(clickedStar.id);
    drawSky();
    return;
  }

  const clickedLine = findClickedLine(x, y);

  if (clickedLine) {
    deleteLine(clickedLine);
  }

  drawSky();
}

function resetSky() {
  stars = [];
  lines = [];
  selectedStarId = null;
  constellationName = "";
  nextStarId = 1;
  saveNameInput.value = "";
  showSaveMessage("");
  closeSaveNameArea();
  updateConstellationTitle();
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
  updateConstellationTitle();
}

canvas.addEventListener("click", handleCanvasClick);
toolbarCreateButton.addEventListener("click", function() {
  openToolbarPanel("create");
});
toolbarCollectionButton.addEventListener("click", function() {
  openToolbarPanel("collection");
});
placeModeButton.addEventListener("click", function() {
  setMode(MODE_PLACE);
});
connectModeButton.addEventListener("click", function() {
  setMode(MODE_CONNECT);
});
deleteModeButton.addEventListener("click", function() {
  setMode(MODE_DELETE);
});
saveButton.addEventListener("click", openSaveNameArea);
confirmSaveButton.addEventListener("click", saveCurrentConstellation);
cancelSaveButton.addEventListener("click", function() {
  saveNameInput.value = "";
  showSaveMessage("");
  closeSaveNameArea();
});
resetButton.addEventListener("click", resetSky);
window.addEventListener("resize", resizeCanvasToWindow);

resizeCanvasToWindow();
renderCollectionList();
