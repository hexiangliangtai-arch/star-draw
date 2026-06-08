const canvas = document.getElementById("skyCanvas");
const context = canvas.getContext("2d");

const bottomToolbar = document.querySelector(".bottom-toolbar");
const toolbarCreateButton = document.getElementById("toolbarCreateButton");
const toolbarCollectionButton = document.getElementById("toolbarCollectionButton");
const toolbarMySkyButton = document.getElementById("toolbarMySkyButton");
const bottomPanel = document.getElementById("bottomPanel");
const createPanel = document.getElementById("createPanel");
const collectionPanel = document.getElementById("collectionPanel");
const mySkyPanel = document.getElementById("mySkyPanel");
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
const mySkyConstellationList = document.getElementById("mySkyConstellationList");
const selectedMySkyName = document.getElementById("selectedMySkyName");
const mySkyMessage = document.getElementById("mySkyMessage");
const mySkyPlaceModeButton = document.getElementById("mySkyPlaceModeButton");
const mySkyDeleteModeButton = document.getElementById("mySkyDeleteModeButton");
const selectedPlacedConstellationName = document.getElementById("selectedPlacedConstellationName");
const scaleDownButton = document.getElementById("scaleDownButton");
const scaleUpButton = document.getElementById("scaleUpButton");
const scaleActions = document.querySelector(".scale-actions");
const floatingScaleControls = document.createElement("div");
const floatingScaleDownButton = document.createElement("button");
const floatingScaleUpButton = document.createElement("button");
const mySkyResetButton = document.getElementById("mySkyResetButton");
const constellationTitle = document.getElementById("constellationTitle");

const APP_MODE_CREATE = "create";
const APP_MODE_COLLECTION = "collection";
const APP_MODE_MY_SKY = "mySky";
const MODE_PLACE = "place";
const MODE_CONNECT = "connect";
const MODE_DELETE = "delete";
const MY_SKY_MODE_PLACE = "place";
const MY_SKY_MODE_DELETE = "delete";
const MIN_PLACED_SCALE = 0.4;
const MAX_PLACED_SCALE = 2;
const PLACED_SCALE_STEP = 0.1;
const DRAG_START_DISTANCE = 4;
const STORAGE_KEY = "myNightSkyCollections";

let appMode = APP_MODE_CREATE;
let currentMode = MODE_PLACE;
let mySkyMode = MY_SKY_MODE_PLACE;
let stars = [];
let lines = [];
let selectedStarId = null;
let constellationName = "";
let nextStarId = 1;
let activePanel = null;
let selectedConstellationForMySky = null;
let placedConstellations = [];
let nextPlacedConstellationId = 1;
let selectedPlacedConstellationId = null;
let pendingDragPlacedConstellationId = null;
let draggingPlacedConstellationId = null;
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;
let hasDraggedMySkyConstellation = false;
let suppressNextCanvasClick = false;

let backgroundStars = [];

function resizeCanvasToWindow() {
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;
  const toolbarHeight = bottomToolbar.getBoundingClientRect().height;
  const skyHeight = Math.max(1, window.innerHeight - toolbarHeight);

  canvas.width = window.innerWidth;
  canvas.height = skyHeight;

  // 画面サイズが変わっても、配置済みの星は同じ比率の位置に残します。
  if (previousWidth > 0 && previousHeight > 0 && (stars.length > 0 || placedConstellations.length > 0)) {
    const scaleX = canvas.width / previousWidth;
    const scaleY = canvas.height / previousHeight;

    stars.forEach(function(star) {
      star.x = star.x * scaleX;
      star.y = star.y * scaleY;
    });

    placedConstellations.forEach(function(placedConstellation) {
      placedConstellation.x = placedConstellation.x * scaleX;
      placedConstellation.y = placedConstellation.y * scaleY;
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
  appMode = APP_MODE_CREATE;
  clearMySkyDragState();
  currentMode = mode;
  selectedStarId = null;

  placeModeButton.classList.toggle("active", currentMode === MODE_PLACE);
  connectModeButton.classList.toggle("active", currentMode === MODE_CONNECT);
  deleteModeButton.classList.toggle("active", currentMode === MODE_DELETE);

  drawSky();
  updateCanvasCursorState();
}

function updateConstellationTitle() {
  constellationTitle.textContent = appMode === APP_MODE_CREATE ? constellationName : "";
}

function clearMySkyDragState() {
  pendingDragPlacedConstellationId = null;
  draggingPlacedConstellationId = null;
  dragStartX = 0;
  dragStartY = 0;
  dragOffsetX = 0;
  dragOffsetY = 0;
  hasDraggedMySkyConstellation = false;
  setScaleActionsHidden(false);
  updateCanvasCursorState();
}

function setScaleActionsHidden(isHidden) {
  scaleActions.style.display = isHidden ? "none" : "";
}

function setupFloatingScaleControls() {
  floatingScaleControls.className = "floating-scale-controls is-hidden";
  floatingScaleDownButton.className = "button";
  floatingScaleUpButton.className = "button";
  floatingScaleDownButton.type = "button";
  floatingScaleUpButton.type = "button";
  floatingScaleDownButton.textContent = "縮小";
  floatingScaleUpButton.textContent = "拡大";

  floatingScaleControls.appendChild(floatingScaleDownButton);
  floatingScaleControls.appendChild(floatingScaleUpButton);
  document.body.appendChild(floatingScaleControls);
}

function hideFloatingScaleControls() {
  floatingScaleControls.classList.add("is-hidden");
}

function updateFloatingScaleControls() {
  const selectedConstellation = getPlacedConstellationById(selectedPlacedConstellationId);

  if (!selectedConstellation) {
    floatingScaleDownButton.disabled = true;
    floatingScaleUpButton.disabled = true;
    return;
  }

  const scale = getPlacedConstellationScale(selectedConstellation);
  floatingScaleDownButton.disabled = scale <= MIN_PLACED_SCALE;
  floatingScaleUpButton.disabled = scale >= MAX_PLACED_SCALE;
}

function showFloatingScaleControls(canvasX, canvasY) {
  updateFloatingScaleControls();
  floatingScaleControls.classList.remove("is-hidden");

  const canvasRect = canvas.getBoundingClientRect();
  const controlsRect = floatingScaleControls.getBoundingClientRect();
  const toolbarHeight = bottomToolbar.getBoundingClientRect().height;
  const viewportX = canvasRect.left + (canvasX / canvas.width) * canvasRect.width;
  const viewportY = canvasRect.top + (canvasY / canvas.height) * canvasRect.height;
  const maxLeft = window.innerWidth - controlsRect.width - 8;
  const maxTop = window.innerHeight - toolbarHeight - controlsRect.height - 8;
  const nextLeft = Math.min(Math.max(8, viewportX + 14), Math.max(8, maxLeft));
  const nextTop = Math.min(Math.max(8, viewportY - controlsRect.height - 14), Math.max(8, maxTop));

  floatingScaleControls.style.left = nextLeft + "px";
  floatingScaleControls.style.top = nextTop + "px";
}

function updateCanvasCursorState() {
  const canDrag = appMode === APP_MODE_MY_SKY &&
    mySkyMode === MY_SKY_MODE_PLACE &&
    activePanel !== "collection";

  canvas.classList.toggle("is-my-sky-draggable", canDrag && draggingPlacedConstellationId === null);
  canvas.classList.toggle("is-my-sky-dragging", draggingPlacedConstellationId !== null);
}

function setMySkyMode(mode) {
  clearMySkyDragState();
  hideFloatingScaleControls();
  mySkyMode = mode;

  mySkyPlaceModeButton.classList.toggle("active", mySkyMode === MY_SKY_MODE_PLACE);
  mySkyDeleteModeButton.classList.toggle("active", mySkyMode === MY_SKY_MODE_DELETE);

  if (mySkyMode === MY_SKY_MODE_DELETE) {
    selectedPlacedConstellationId = null;
    updatePlacedConstellationControls();
    drawSky();
    updateCanvasCursorState();
    showMySkyMessage("削除したい星座をクリックしてください");
    return;
  }

  if (selectedConstellationForMySky) {
    showMySkyMessage("夜空をクリックして配置できます");
  } else {
    showMySkyMessage("配置する星座を選んでください");
  }

  updateCanvasCursorState();
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
  appMode = APP_MODE_CREATE;
  selectedStarId = null;
  selectedPlacedConstellationId = null;
  updatePlacedConstellationControls();
  clearMySkyDragState();
  closePanelsOnly();
}

function closePanelsOnly() {
  activePanel = null;
  hideFloatingScaleControls();
  bottomPanel.classList.add("is-hidden");
  createPanel.classList.add("is-hidden");
  collectionPanel.classList.add("is-hidden");
  mySkyPanel.classList.add("is-hidden");
  updateToolbarActiveState();
  updateCanvasCursorState();
}

function updateToolbarActiveState() {
  toolbarCreateButton.classList.toggle("active", appMode === APP_MODE_CREATE && activePanel === "create");
  toolbarCollectionButton.classList.toggle("active", activePanel === "collection");
  toolbarMySkyButton.classList.toggle("active", appMode === APP_MODE_MY_SKY);
}

function openToolbarPanel(panelName) {
  if (panelName === "create") {
    openCreatePanel();
    return;
  }

  if (panelName === "collection") {
    toggleCollectionPanel();
    return;
  }

  if (panelName === "mySky") {
    toggleMySkyPanel();
    return;
  }
}

function openCreatePanel() {
  if (activePanel === "create") {
    appMode = APP_MODE_CREATE;
    selectedStarId = null;
    clearMySkyDragState();
    closePanelsOnly();
    drawSky();
    updateToolbarActiveState();
    return;
  }

  appMode = APP_MODE_CREATE;
  selectedStarId = null;
  selectedPlacedConstellationId = null;
  updatePlacedConstellationControls();
  clearMySkyDragState();
  activePanel = "create";
  bottomPanel.classList.add("is-hidden");
  createPanel.classList.remove("is-hidden");
  collectionPanel.classList.add("is-hidden");
  mySkyPanel.classList.add("is-hidden");
  closeSaveNameArea();
  updateToolbarActiveState();
  drawSky();
  updateCanvasCursorState();
}

function toggleCollectionPanel() {
  if (activePanel === "collection") {
    closePanelsOnly();
    drawSky();
    return;
  }

  selectedStarId = null;
  clearMySkyDragState();
  activePanel = "collection";
  bottomPanel.classList.remove("is-hidden");
  createPanel.classList.add("is-hidden");
  collectionPanel.classList.remove("is-hidden");
  mySkyPanel.classList.add("is-hidden");
  closeSaveNameArea();
  renderCollectionList();
  updateToolbarActiveState();
  drawSky();
  updateCanvasCursorState();
}

function toggleMySkyPanel() {
  hideFloatingScaleControls();

  if (appMode !== APP_MODE_MY_SKY) {
    appMode = APP_MODE_MY_SKY;
    setMySkyMode(MY_SKY_MODE_PLACE);
  } else {
    clearMySkyDragState();
  }

  selectedStarId = null;
  closeSaveNameArea();

  if (activePanel === "mySky") {
    closePanelsOnly();
    drawSky();
    updateToolbarActiveState();
    updateCanvasCursorState();
    return;
  }

  activePanel = "mySky";
  bottomPanel.classList.remove("is-hidden");
  createPanel.classList.add("is-hidden");
  collectionPanel.classList.add("is-hidden");
  mySkyPanel.classList.remove("is-hidden");
  renderMySkyConstellationList();
  updateMySkySelectedName();
  updatePlacedConstellationControls();
  updateToolbarActiveState();
  drawSky();
  updateCanvasCursorState();
}

function showMySkyPanelForPlacedSelection() {
  activePanel = "mySky";
  bottomPanel.classList.remove("is-hidden");
  createPanel.classList.add("is-hidden");
  collectionPanel.classList.add("is-hidden");
  mySkyPanel.classList.remove("is-hidden");
  renderMySkyConstellationList();
  updateMySkySelectedName();
  updatePlacedConstellationControls();
  updateToolbarActiveState();
  updateCanvasCursorState();
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
  renderMySkyConstellationList();
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
    const item = document.createElement("div");
    item.className = "collection-item";

    const info = document.createElement("div");
    info.className = "collection-info";

    const nameText = document.createElement("span");
    nameText.className = "collection-name";
    nameText.textContent = savedConstellation.name || "名前のない星座";

    const dateText = document.createElement("span");
    dateText.className = "collection-date";
    dateText.textContent = formatSavedDate(savedConstellation.savedAt);

    const actions = document.createElement("div");
    actions.className = "collection-actions";

    const loadButton = document.createElement("button");
    loadButton.className = "collection-load-button";
    loadButton.type = "button";
    loadButton.textContent = "読み込む";
    loadButton.addEventListener("click", function() {
      loadConstellation(savedConstellation);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "collection-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", function() {
      confirmDeleteSavedConstellation(savedConstellation);
    });

    info.appendChild(nameText);
    info.appendChild(dateText);
    actions.appendChild(loadButton);
    actions.appendChild(deleteButton);
    item.appendChild(info);
    item.appendChild(actions);
    collectionList.appendChild(item);
  });
}

function showMySkyMessage(message) {
  mySkyMessage.textContent = message;
}

function updateMySkySelectedName() {
  if (!selectedConstellationForMySky) {
    selectedMySkyName.textContent = "選択中の星座はありません";
    return;
  }

  selectedMySkyName.textContent = "選択中: " + selectedConstellationForMySky.name;
}

function updatePlacedConstellationControls() {
  const selectedConstellation = getPlacedConstellationById(selectedPlacedConstellationId);

  if (!selectedConstellation) {
    selectedPlacedConstellationName.textContent = "選択中の配置済み星座はありません";
    scaleDownButton.disabled = true;
    scaleUpButton.disabled = true;
    return;
  }

  const scale = getPlacedConstellationScale(selectedConstellation);
  selectedPlacedConstellationName.textContent = "選択中: " + selectedConstellation.name + "（" + scale.toFixed(1) + "倍）";
  scaleDownButton.disabled = scale <= MIN_PLACED_SCALE;
  scaleUpButton.disabled = scale >= MAX_PLACED_SCALE;
}

function renderMySkyConstellationList() {
  const collections = getSavedCollections();
  mySkyConstellationList.innerHTML = "";

  if (collections.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-my-sky";
    emptyMessage.textContent = "保存済みの星座はまだありません";
    mySkyConstellationList.appendChild(emptyMessage);
    return;
  }

  collections.slice().reverse().forEach(function(savedConstellation) {
    const selectButton = document.createElement("button");
    const savedName = savedConstellation.name || "名前のない星座";
    selectButton.className = "my-sky-select-button";
    selectButton.type = "button";
    selectButton.classList.toggle(
      "active",
      selectedConstellationForMySky !== null && selectedConstellationForMySky.sourceId === savedConstellation.id
    );

    const nameText = document.createElement("span");
    nameText.className = "collection-name";
    nameText.textContent = savedName;

    const dateText = document.createElement("span");
    dateText.className = "collection-date";
    dateText.textContent = formatSavedDate(savedConstellation.savedAt);

    selectButton.appendChild(nameText);
    selectButton.appendChild(dateText);
    selectButton.addEventListener("click", function() {
      selectConstellationForMySky(savedConstellation);
    });

    mySkyConstellationList.appendChild(selectButton);
  });
}

function selectConstellationForMySky(savedConstellation) {
  const copiedStars = copyStars(Array.isArray(savedConstellation.stars) ? savedConstellation.stars : []);

  if (copiedStars.length === 0) {
    showMySkyMessage("星がない星座は配置できません");
    return;
  }

  selectedConstellationForMySky = {
    sourceId: savedConstellation.id,
    name: savedConstellation.name || "名前のない星座",
    stars: copiedStars,
    lines: copyLines(Array.isArray(savedConstellation.lines) ? savedConstellation.lines : [])
  };

  updateMySkySelectedName();
  renderMySkyConstellationList();
  setMySkyMode(MY_SKY_MODE_PLACE);
}

function placeSelectedConstellationOnMySky(x, y) {
  if (!selectedConstellationForMySky) {
    showMySkyMessage("配置する星座を選んでください");
    return;
  }

  const placedConstellationId = nextPlacedConstellationId;

  placedConstellations.push({
    id: placedConstellationId,
    sourceId: selectedConstellationForMySky.sourceId,
    name: selectedConstellationForMySky.name,
    x: x,
    y: y,
    scale: 1,
    stars: copyStars(selectedConstellationForMySky.stars),
    lines: copyLines(selectedConstellationForMySky.lines)
  });

  nextPlacedConstellationId++;
  selectedPlacedConstellationId = placedConstellationId;
  updatePlacedConstellationControls();
  showMySkyMessage("配置しました");
  drawSky();
}

function deletePlacedConstellation(placedConstellationId) {
  placedConstellations = placedConstellations.filter(function(placedConstellation) {
    return placedConstellation.id !== placedConstellationId;
  });

  if (selectedPlacedConstellationId === placedConstellationId) {
    selectedPlacedConstellationId = null;
    hideFloatingScaleControls();
  }

  if (draggingPlacedConstellationId === placedConstellationId) {
    clearMySkyDragState();
  }

  updatePlacedConstellationControls();
  updateFloatingScaleControls();
}

function getPlacedConstellationById(placedConstellationId) {
  return placedConstellations.find(function(placedConstellation) {
    return placedConstellation.id === placedConstellationId;
  }) || null;
}

function getPlacedConstellationScale(placedConstellation) {
  const scale = Number(placedConstellation.scale);

  if (Number.isFinite(scale)) {
    return Math.min(MAX_PLACED_SCALE, Math.max(MIN_PLACED_SCALE, scale));
  }

  return 1;
}

function scaleSelectedPlacedConstellation(scaleChange) {
  const selectedConstellation = getPlacedConstellationById(selectedPlacedConstellationId);

  if (!selectedConstellation) {
    showMySkyMessage("拡大縮小する星座を選択してください");
    updatePlacedConstellationControls();
    hideFloatingScaleControls();
    return;
  }

  clearMySkyDragState();

  const currentScale = getPlacedConstellationScale(selectedConstellation);
  const nextScale = Math.min(MAX_PLACED_SCALE, Math.max(MIN_PLACED_SCALE, currentScale + scaleChange));
  selectedConstellation.scale = Number(nextScale.toFixed(2));

  updatePlacedConstellationControls();
  updateFloatingScaleControls();
  showMySkyMessage("大きさを変更しました");
  drawSky();
}

function handlePlacedConstellationDeleteClick(x, y) {
  const clickedConstellation = findClickedPlacedConstellation(x, y);

  if (!clickedConstellation) {
    showMySkyMessage("削除する星座が見つかりませんでした");
    return;
  }

  deletePlacedConstellation(clickedConstellation.id);
  showMySkyMessage("削除しました");
  drawSky();
}

function resetMySky() {
  if (placedConstellations.length === 0) {
    showMySkyMessage("配置済みの星座はありません");
    return;
  }

  if (!confirm("My夜空に配置した星座をすべて削除しますか？")) {
    return;
  }

  placedConstellations = [];
  nextPlacedConstellationId = 1;
  selectedPlacedConstellationId = null;
  clearMySkyDragState();
  updatePlacedConstellationControls();
  hideFloatingScaleControls();
  showMySkyMessage("My夜空をリセットしました");
  drawSky();
}

function confirmDeleteSavedConstellation(savedConstellation) {
  const name = savedConstellation.name || "名前のない星座";

  if (!confirm("『" + name + "』をコレクションから削除しますか？")) {
    return;
  }

  deleteSavedConstellation(savedConstellation.id);
}

function deleteSavedConstellation(savedConstellationId) {
  const collections = getSavedCollections();
  const updatedCollections = collections.filter(function(savedConstellation) {
    return savedConstellation.id !== savedConstellationId;
  });

  saveCollections(updatedCollections);
  renderCollectionList();
  renderMySkyConstellationList();
}

function loadConstellation(savedConstellation) {
  const hasCurrentWork = stars.length > 0 || lines.length > 0 || constellationName !== "";

  if (hasCurrentWork && !confirm("現在の星空が『" + (savedConstellation.name || "名前のない星座") + "』に置き換わります。読み込みますか？")) {
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
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }

  if (activePanel === "collection") {
    return;
  }

  const position = getCanvasPosition(event);

  if (appMode === APP_MODE_CREATE) {
    handleCreateCanvasClick(position.x, position.y);
    return;
  }

  if (appMode === APP_MODE_MY_SKY) {
    handleMySkyCanvasClick(position.x, position.y);
    return;
  }

  return;
}

function handleCreateCanvasClick(x, y) {
  if (currentMode === MODE_PLACE) {
    addStar(x, y);
    return;
  }

  if (currentMode === MODE_DELETE) {
    handleDeleteClick(x, y);
    return;
  }

  const clickedStar = findClickedStar(x, y);

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

function handleMySkyCanvasClick(x, y) {
  if (mySkyMode === MY_SKY_MODE_DELETE) {
    handlePlacedConstellationDeleteClick(x, y);
    return;
  }

  placeSelectedConstellationOnMySky(x, y);
}

function handleMySkyPointerDown(event) {
  if (activePanel === "collection" || appMode !== APP_MODE_MY_SKY || mySkyMode !== MY_SKY_MODE_PLACE) {
    return;
  }

  const position = getCanvasPosition(event);
  const clickedConstellation = findClickedPlacedConstellation(position.x, position.y);

  if (!clickedConstellation) {
    selectedPlacedConstellationId = null;
    updatePlacedConstellationControls();
    hideFloatingScaleControls();
    drawSky();
    return;
  }

  selectedPlacedConstellationId = clickedConstellation.id;
  pendingDragPlacedConstellationId = clickedConstellation.id;
  dragStartX = position.x;
  dragStartY = position.y;
  dragOffsetX = position.x - clickedConstellation.x;
  dragOffsetY = position.y - clickedConstellation.y;
  hasDraggedMySkyConstellation = false;
  suppressNextCanvasClick = true;
  event.preventDefault();

  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(event.pointerId);
  }

  updateCanvasCursorState();
  updatePlacedConstellationControls();
  showFloatingScaleControls(position.x, position.y);
  drawSky();
  showMySkyMessage("小さく・大きくで調整できます");
}

function handleMySkyPointerMove(event) {
  if (pendingDragPlacedConstellationId === null && draggingPlacedConstellationId === null) {
    return;
  }

  const targetId = draggingPlacedConstellationId !== null ?
    draggingPlacedConstellationId :
    pendingDragPlacedConstellationId;
  const targetConstellation = getPlacedConstellationById(targetId);

  if (!targetConstellation) {
    clearMySkyDragState();
    return;
  }

  event.preventDefault();

  const position = getCanvasPosition(event);
  const nextX = position.x - dragOffsetX;
  const nextY = position.y - dragOffsetY;
  const distanceFromStart = Math.hypot(position.x - dragStartX, position.y - dragStartY);

  if (draggingPlacedConstellationId === null) {
    if (distanceFromStart < DRAG_START_DISTANCE) {
      return;
    }

    draggingPlacedConstellationId = pendingDragPlacedConstellationId;
    hideFloatingScaleControls();
    setScaleActionsHidden(true);
    updateCanvasCursorState();
    showMySkyMessage("ドラッグして移動できます");
  }

  const movedDistance = Math.hypot(targetConstellation.x - nextX, targetConstellation.y - nextY);

  if (movedDistance > 1) {
    hasDraggedMySkyConstellation = true;
  }

  targetConstellation.x = nextX;
  targetConstellation.y = nextY;
  drawSky();
}

function finishMySkyDrag(event) {
  if (pendingDragPlacedConstellationId === null && draggingPlacedConstellationId === null) {
    return;
  }

  if (event && canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (hasDraggedMySkyConstellation) {
    showMySkyMessage("移動しました");
  }

  clearMySkyDragState();
  updatePlacedConstellationControls();
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

  if (appMode === APP_MODE_CREATE) {
    drawEditingConstellation();
  }

  if (appMode === APP_MODE_MY_SKY) {
    drawMySky();
  }

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

function drawLine(fromStar, toStar, options) {
  const lineColor = options && options.color ? options.color : "rgba(194, 225, 255, 0.68)";
  const glowColor = options && options.glowColor ? options.glowColor : "rgba(136, 203, 255, 0.86)";
  const lineWidth = options && options.width ? options.width : 2;

  context.beginPath();
  context.moveTo(fromStar.x, fromStar.y);
  context.lineTo(toStar.x, toStar.y);
  context.strokeStyle = lineColor;
  context.lineWidth = lineWidth;
  context.shadowColor = glowColor;
  context.shadowBlur = 10;
  context.stroke();
  context.shadowBlur = 0;
}

function drawStar(star, options) {
  const isSelected = Boolean(options && options.isSelected);
  const starColor = options && options.starColor ? options.starColor : "#fffdf1";
  const selectedColor = options && options.selectedColor ? options.selectedColor : "#fff8c9";
  const glowColor = options && options.glowColor ? options.glowColor : "255, 246, 181";
  const shadowColor = options && options.shadowColor ? options.shadowColor : "#cfe5ff";
  const selectedShadowColor = options && options.selectedShadowColor ? options.selectedShadowColor : "#fff1a3";
  const radius = isSelected ? star.radius + 3 : star.radius;
  const glowSize = isSelected ? 28 : 18;

  const glow = context.createRadialGradient(star.x, star.y, 1, star.x, star.y, glowSize);
  glow.addColorStop(0, "rgba(" + glowColor + ", 0.95)");
  glow.addColorStop(0.35, "rgba(" + glowColor + ", 0.45)");
  glow.addColorStop(1, "rgba(" + glowColor + ", 0)");

  context.beginPath();
  context.arc(star.x, star.y, glowSize, 0, Math.PI * 2);
  context.fillStyle = glow;
  context.fill();

  context.beginPath();
  context.arc(star.x, star.y, radius, 0, Math.PI * 2);
  context.fillStyle = isSelected ? selectedColor : starColor;
  context.shadowColor = isSelected ? selectedShadowColor : shadowColor;
  context.shadowBlur = isSelected ? 18 : 12;
  context.fill();
  context.shadowBlur = 0;
}

function drawEditingConstellation() {
  drawConstellationLines();
  drawUserStars();
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

    drawLine(fromStar, toStar);
  });
}

function drawUserStars() {
  stars.forEach(function(star) {
    drawStar(star, {
      isSelected: star.id === selectedStarId
    });
  });
}

function drawMySky() {
  placedConstellations.forEach(function(placedConstellation) {
    drawPlacedConstellation(placedConstellation);
  });
}

function drawPlacedConstellation(placedConstellation) {
  const placedStars = getPlacedConstellationStars(placedConstellation);
  const isHighlighted = placedConstellation.id === selectedPlacedConstellationId ||
    placedConstellation.id === draggingPlacedConstellationId;

  placedConstellation.lines.forEach(function(line) {
    const fromStar = placedStars.find(function(star) {
      return star.id === line.fromId;
    });
    const toStar = placedStars.find(function(star) {
      return star.id === line.toId;
    });

    if (!fromStar || !toStar) {
      return;
    }

    drawLine(fromStar, toStar, {
      color: isHighlighted ? "rgba(220, 242, 255, 0.78)" : "rgba(178, 220, 255, 0.5)",
      glowColor: isHighlighted ? "rgba(170, 222, 255, 0.86)" : "rgba(116, 191, 255, 0.62)",
      width: isHighlighted ? 2.5 : 1.7
    });
  });

  placedStars.forEach(function(star) {
    drawStar(star, {
      isSelected: isHighlighted,
      starColor: "#f7fbff",
      selectedColor: "#ffffff",
      glowColor: "218, 236, 255",
      shadowColor: "#b8dcff",
      selectedShadowColor: "#e9f7ff"
    });
  });
}

function getPlacedConstellationStars(placedConstellation) {
  return getTransformedStars(placedConstellation);
}

function getTransformedStars(placedConstellation) {
  const center = getConstellationCenter(placedConstellation.stars);
  const scale = getPlacedConstellationScale(placedConstellation);

  return placedConstellation.stars.map(function(star) {
    return {
      id: star.id,
      x: placedConstellation.x + (star.x - center.x) * scale,
      y: placedConstellation.y + (star.y - center.y) * scale,
      radius: Math.max(3, star.radius * scale)
    };
  });
}

function findClickedPlacedConstellation(x, y) {
  const starClickRange = 12;
  const lineClickRange = 8;

  for (let i = placedConstellations.length - 1; i >= 0; i--) {
    const placedConstellation = placedConstellations[i];
    const placedStars = getPlacedConstellationStars(placedConstellation);
    const clickedStar = placedStars.find(function(star) {
      return Math.hypot(star.x - x, star.y - y) <= starClickRange;
    });

    if (clickedStar) {
      return placedConstellation;
    }

    const clickedLine = placedConstellation.lines.some(function(line) {
      const fromStar = placedStars.find(function(star) {
        return star.id === line.fromId;
      });
      const toStar = placedStars.find(function(star) {
        return star.id === line.toId;
      });

      if (!fromStar || !toStar) {
        return false;
      }

      return getDistanceFromPointToLineSegment(
        x,
        y,
        fromStar.x,
        fromStar.y,
        toStar.x,
        toStar.y
      ) <= lineClickRange;
    });

    if (clickedLine) {
      return placedConstellation;
    }
  }

  return null;
}

function getConstellationCenter(starList) {
  if (starList.length === 0) {
    return {
      x: 0,
      y: 0
    };
  }

  const total = starList.reduce(function(sum, star) {
    return {
      x: sum.x + star.x,
      y: sum.y + star.y
    };
  }, {
    x: 0,
    y: 0
  });

  return {
    x: total.x / starList.length,
    y: total.y / starList.length
  };
}

function drawConstellationName() {
  updateConstellationTitle();
}

setupFloatingScaleControls();
floatingScaleControls.addEventListener("pointerdown", function(event) {
  event.stopPropagation();
});
floatingScaleDownButton.addEventListener("click", function(event) {
  event.stopPropagation();
  scaleSelectedPlacedConstellation(-PLACED_SCALE_STEP);
});
floatingScaleUpButton.addEventListener("click", function(event) {
  event.stopPropagation();
  scaleSelectedPlacedConstellation(PLACED_SCALE_STEP);
});
canvas.addEventListener("pointerdown", handleMySkyPointerDown);
canvas.addEventListener("pointermove", handleMySkyPointerMove);
canvas.addEventListener("pointerup", finishMySkyDrag);
canvas.addEventListener("pointerleave", finishMySkyDrag);
canvas.addEventListener("pointercancel", finishMySkyDrag);
canvas.addEventListener("click", handleCanvasClick);
toolbarCreateButton.addEventListener("click", function() {
  openToolbarPanel("create");
});
toolbarCollectionButton.addEventListener("click", function() {
  openToolbarPanel("collection");
});
toolbarMySkyButton.addEventListener("click", function() {
  openToolbarPanel("mySky");
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
mySkyPlaceModeButton.addEventListener("click", function() {
  setMySkyMode(MY_SKY_MODE_PLACE);
});
mySkyDeleteModeButton.addEventListener("click", function() {
  setMySkyMode(MY_SKY_MODE_DELETE);
});
scaleDownButton.addEventListener("click", function() {
  scaleSelectedPlacedConstellation(-PLACED_SCALE_STEP);
});
scaleUpButton.addEventListener("click", function() {
  scaleSelectedPlacedConstellation(PLACED_SCALE_STEP);
});
saveButton.addEventListener("click", openSaveNameArea);
confirmSaveButton.addEventListener("click", saveCurrentConstellation);
cancelSaveButton.addEventListener("click", function() {
  saveNameInput.value = "";
  showSaveMessage("");
  closeSaveNameArea();
});
resetButton.addEventListener("click", resetSky);
mySkyResetButton.addEventListener("click", resetMySky);
window.addEventListener("resize", resizeCanvasToWindow);

resizeCanvasToWindow();
renderCollectionList();
renderMySkyConstellationList();
updateMySkySelectedName();
updatePlacedConstellationControls();
updateCanvasCursorState();
