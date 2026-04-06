const ui = {
  editToggleBtn: document.getElementById("editToggleBtn"),
  saveLayoutBtn: document.getElementById("saveLayoutBtn"),
  allOffBtn: document.getElementById("allOffBtn"),
  editModeTools: document.getElementById("editModeTools"),
  recordBtn: document.getElementById("recordBtn"),
  stopRecordBtn: document.getElementById("stopRecordBtn"),
  recordingNameInput: document.getElementById("recordingNameInput"),
  saveRecordingBtn: document.getElementById("saveRecordingBtn"),
  saveLoopPreference: document.getElementById("saveLoopPreference"),
  recordingPicker: document.getElementById("recordingPicker"),
  recordingPickerBtn: document.getElementById("recordingPickerBtn"),
  recordingPickerLabel: document.getElementById("recordingPickerLabel"),
  recordingMenu: document.getElementById("recordingMenu"),
  playbackLoopToggle: document.getElementById("playbackLoopToggle"),
  playBtn: document.getElementById("playBtn"),
  stopPlaybackBtn: document.getElementById("stopPlaybackBtn"),
  deleteRecordingBtn: document.getElementById("deleteRecordingBtn"),
  imageUploadInput: document.getElementById("imageUploadInput"),
  gridLengthInput: document.getElementById("gridLengthInput"),
  gridWidthInput: document.getElementById("gridWidthInput"),
  buildGridBtn: document.getElementById("buildGridBtn"),
  resetLayoutBtn: document.getElementById("resetLayoutBtn"),
  gridBuilderSummary: document.getElementById("gridBuilderSummary"),
  brightnessSlider: document.getElementById("brightnessSlider"),
  brightnessValue: document.getElementById("brightnessValue"),
  lightingSummary: document.getElementById("lightingSummary"),
  ledList: document.getElementById("ledList"),
  sceneStage: document.getElementById("sceneStage"),
  sceneOverlay: document.getElementById("sceneOverlay"),
  sceneImage: document.getElementById("sceneImage"),
  scenePlaceholder: document.getElementById("scenePlaceholder"),
  modeSummary: document.getElementById("modeSummary"),
  recordingSummary: document.getElementById("recordingSummary"),
  playbackSummary: document.getElementById("playbackSummary"),
  layoutMeta: document.getElementById("layoutMeta"),
  sidebarSummary: document.getElementById("sidebarSummary"),
  driverMode: document.getElementById("driverMode"),
  driverDetail: document.getElementById("driverDetail"),
  driverDot: document.getElementById("driverDot"),
};

const state = {
  server: null,
  localLayout: null,
  editMode: false,
  draggingMarkerId: null,
  pollTimer: null,
  loadInFlight: false,
  sceneImageSource: "",
  sceneImageLoadState: "idle",
  sceneImageVersion: 0,
  sceneImagePreviewUrl: "",
  lightingSaveTimer: null,
  lightingRequestInFlight: false,
  lightingPendingSave: false,
  lightingPendingSaveSilent: true,
  lightingLastSentAt: 0,
  uploadInFlight: false,
  selectedRecordingId: "",
  recordingMenuOpen: false,
  sceneFileDragActive: false,
};

const IMAGE_UPLOAD_ERROR = "Only PNG and JPEG images are supported.";
const IMAGE_UPLOAD_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const IMAGE_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const LIGHTING_PREVIEW_INTERVAL_MS = 45;

async function api(path, options = {}) {
  const config = {
    headers: {},
    ...options,
  };

  if (config.body !== undefined && !(config.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, config);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

function getViewLayout() {
  if (state.editMode && state.localLayout) {
    return state.localLayout;
  }
  return state.server?.layout || null;
}

function getRecordings() {
  return Array.isArray(state.server?.recordings) ? state.server.recordings : [];
}

function getSelectedRecording() {
  return getRecordings().find((recording) => recording.id === state.selectedRecordingId) || null;
}

function applySelectedRecordingDefaults() {
  const selected = getSelectedRecording();
  if (!selected) {
    return;
  }
  ui.playbackLoopToggle.checked = Boolean(selected.loop_preference);
}

function syncSelectedRecording() {
  const recordings = getRecordings();
  const playbackRecordingId = state.server?.playback?.recording_id || "";

  if (recordings.some((recording) => recording.id === state.selectedRecordingId)) {
    return;
  }

  if (playbackRecordingId && recordings.some((recording) => recording.id === playbackRecordingId)) {
    state.selectedRecordingId = playbackRecordingId;
    applySelectedRecordingDefaults();
    return;
  }

  state.selectedRecordingId = recordings[0]?.id || "";
  applySelectedRecordingDefaults();
}

function selectRecording(recordingId, { closeMenu = true, applyDefaults = true } = {}) {
  state.selectedRecordingId = recordingId;
  if (applyDefaults) {
    applySelectedRecordingDefaults();
  }
  if (closeMenu) {
    closeRecordingMenu();
  }
  render();
}

function getActiveLedIds() {
  return Array.isArray(state.server?.active_leds) ? state.server.active_leds : [];
}

function getActiveLedColorMap() {
  if (!state.server?.active_led_colors || typeof state.server.active_led_colors !== "object") {
    return {};
  }
  return state.server.active_led_colors;
}

function getActiveLedColor(physicalId) {
  const colorMap = getActiveLedColorMap();
  return colorMap[String(physicalId)] || colorMap[physicalId] || null;
}

function getActiveIdSet() {
  return new Set(getActiveLedIds());
}

function setActiveLedIds(nextIds) {
  if (!state.server) {
    return;
  }
  state.server.active_leds = [...nextIds].sort((left, right) => left - right);
}

function setActiveLedColor(physicalId, color) {
  if (!state.server) {
    return;
  }
  state.server.active_led_colors = {
    ...getActiveLedColorMap(),
    [physicalId]: [...color],
  };
}

function removeActiveLedColor(physicalId) {
  if (!state.server) {
    return;
  }
  const nextColors = { ...getActiveLedColorMap() };
  delete nextColors[String(physicalId)];
  delete nextColors[physicalId];
  state.server.active_led_colors = nextColors;
}

function colorsMatch(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 3 || right.length !== 3) {
    return false;
  }
  return left.every((value, index) => Number(value) === Number(right[index]));
}

function getMappedLedIdsForKey(key) {
  const normalizedKey = String(key).trim().toUpperCase();
  if (!normalizedKey || !state.server?.layout?.leds) {
    return [];
  }
  return state.server.layout.leds
    .filter((led) => led.key === normalizedKey)
    .map((led) => led.physical_id);
}

function formatLedLabel(led) {
  return led.display_name ? `${led.physical_id}: ${led.display_name}` : `${led.physical_id}`;
}

function formatLedMeta(led) {
  return led.key ? `Physical ${led.physical_id} • Key ${led.key}` : `Physical ${led.physical_id}`;
}

function formatDuration(durationMs) {
  const totalSeconds = Math.floor((durationMs || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildSceneImageSrc(path) {
  if (!path) {
    return "";
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${state.sceneImageVersion || 0}`;
}

function getSceneStatusText(layout, placedCount) {
  if (state.uploadInFlight) {
    return `${placedCount} of ${layout.leds.length} LEDs placed • uploading image`;
  }
  if (state.sceneImagePreviewUrl) {
    return `${placedCount} of ${layout.leds.length} LEDs placed • previewing selected image`;
  }
  if (!layout.background_image) {
    return `${placedCount} of ${layout.leds.length} LEDs placed • no scene image`;
  }
  if (state.sceneImageLoadState === "loading") {
    return `${placedCount} of ${layout.leds.length} LEDs placed • loading image`;
  }
  if (state.sceneImageLoadState === "error") {
    return `${placedCount} of ${layout.leds.length} LEDs placed • image failed to load`;
  }
  return `${placedCount} of ${layout.leds.length} LEDs placed • scene image ready`;
}

function showError(error) {
  window.alert(error.message || String(error));
}

function getFileExtension(filename) {
  const name = String(filename || "").toLowerCase();
  const match = name.match(/(\.[^.]+)$/);
  return match ? match[1] : "";
}

function isAllowedImageFile(file) {
  if (!file) {
    return false;
  }
  const mimeType = String(file.type || "").toLowerCase();
  if (mimeType && IMAGE_UPLOAD_MIME_TYPES.has(mimeType)) {
    return true;
  }
  return IMAGE_UPLOAD_EXTENSIONS.includes(getFileExtension(file.name));
}

function validateImageFile(file) {
  if (!isAllowedImageFile(file)) {
    throw new Error(IMAGE_UPLOAD_ERROR);
  }
  return file;
}

function ensureEditLayout() {
  if (state.editMode && state.localLayout) {
    return true;
  }
  if (!state.server?.layout) {
    return false;
  }
  setEditMode(true);
  return Boolean(state.localLayout);
}

function setSceneFileDragActive(nextValue) {
  state.sceneFileDragActive = Boolean(nextValue);
  ui.sceneStage.classList.toggle("file-drag-active", state.sceneFileDragActive);
}

function eventHasFiles(event) {
  const types = Array.from(event.dataTransfer?.types || []);
  if (types.includes("Files")) {
    return true;
  }
  return (event.dataTransfer?.files?.length || 0) > 0;
}

function getDroppedImageFile(event) {
  const files = Array.from(event.dataTransfer?.files || []);
  return files[0] || null;
}

function getModifierColor(event) {
  if (event?.shiftKey) {
    return [0, 255, 0];
  }
  if (event?.ctrlKey) {
    return [255, 0, 0];
  }
  if (event?.altKey) {
    return [0, 0, 255];
  }
  return [255, 255, 255];
}

function getKeyboardKeyFromEvent(event) {
  const code = String(event.code || "");
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  const key = String(event.key || "").toUpperCase();
  return key.length === 1 ? key : "";
}

function revokeScenePreviewUrl() {
  if (!state.sceneImagePreviewUrl) {
    return;
  }
  URL.revokeObjectURL(state.sceneImagePreviewUrl);
  state.sceneImagePreviewUrl = "";
}

function updateLocalLed(physicalId, changes) {
  if (!state.localLayout) {
    return;
  }
  const target = state.localLayout.leds.find((led) => led.physical_id === physicalId);
  if (!target) {
    return;
  }
  Object.assign(target, changes);
}

function parsePositiveInteger(value, fieldLabel) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error(`${fieldLabel} must be a whole number greater than 0.`);
  }
  return normalized;
}

function getGridAxisPosition(index, count, minimum, maximum) {
  if (count <= 1) {
    return 50;
  }
  const span = maximum - minimum;
  return minimum + (span * index) / (count - 1);
}

function renderGridBuilderSummary(maxLights) {
  const lengthValue = Number(ui.gridLengthInput.value);
  const widthValue = Number(ui.gridWidthInput.value);
  const lengthValid = Number.isInteger(lengthValue) && lengthValue > 0;
  const widthValid = Number.isInteger(widthValue) && widthValue > 0;

  if (!state.editMode) {
    ui.gridBuilderSummary.textContent = "Enter edit mode to build a serpentine grid layout.";
    return;
  }

  if (!lengthValid || !widthValid) {
    ui.gridBuilderSummary.textContent = `Set L and W to whole numbers. Max ${maxLights} lights.`;
    return;
  }

  const totalLights = lengthValue * widthValue;
  if (totalLights > maxLights) {
    ui.gridBuilderSummary.textContent = `Grid needs ${totalLights} lights. Max ${maxLights}.`;
    return;
  }

  ui.gridBuilderSummary.textContent = `Builds ${totalLights} lights in a serpentine grid layout.`;
}

function buildGridLayout() {
  if (!state.editMode || !state.localLayout || !state.server) {
    return;
  }

  const length = parsePositiveInteger(ui.gridLengthInput.value, "L");
  const width = parsePositiveInteger(ui.gridWidthInput.value, "W");
  const maxLights = state.server.settings?.led_count ?? state.localLayout.leds.length;
  const totalLights = length * width;

  if (totalLights > maxLights) {
    throw new Error(`Grid ${length} x ${width} needs ${totalLights} lights, but only ${maxLights} are available.`);
  }

  const xMinimum = 10;
  const xMaximum = 90;
  const yMinimum = 12;
  const yMaximum = 88;

  state.localLayout.leds.forEach((led) => {
    if (led.physical_id > totalLights) {
      led.placed = false;
      led.x = null;
      led.y = null;
      return;
    }

    const zeroBasedIndex = led.physical_id - 1;
    const rowIndex = Math.floor(zeroBasedIndex / length);
    const stepIndex = zeroBasedIndex % length;
    const columnIndex = rowIndex % 2 === 0 ? stepIndex : length - 1 - stepIndex;
    led.placed = true;
    led.x = Number(getGridAxisPosition(columnIndex, length, xMinimum, xMaximum).toFixed(3));
    led.y = Number(getGridAxisPosition(rowIndex, width, yMinimum, yMaximum).toFixed(3));
  });
}

function resetEditLayout() {
  if (!state.editMode || !state.localLayout) {
    return;
  }

  state.localLayout.leds.forEach((led) => {
    led.display_name = "";
    led.placed = false;
    led.x = null;
    led.y = null;
  });
}

function closeRecordingMenu() {
  state.recordingMenuOpen = false;
  ui.recordingPickerBtn.classList.remove("open");
  ui.recordingMenu.classList.remove("open");
  ui.recordingPickerBtn.setAttribute("aria-expanded", "false");
}

function openRecordingMenu() {
  state.recordingMenuOpen = true;
  ui.recordingPickerBtn.classList.add("open");
  ui.recordingMenu.classList.add("open");
  ui.recordingPickerBtn.setAttribute("aria-expanded", "true");
}

function toggleRecordingMenu() {
  if (state.recordingMenuOpen) {
    closeRecordingMenu();
  } else {
    openRecordingMenu();
  }
}

function setEditMode(nextValue) {
  state.editMode = nextValue;
  if (nextValue) {
    state.localLayout = cloneLayout(state.server.layout);
  } else {
    state.localLayout = null;
    revokeScenePreviewUrl();
  }
  closeRecordingMenu();
  schedulePoll();
  render();
}

function getPollDelay() {
  if (state.editMode) {
    return null;
  }
  if (state.server?.playback?.active) {
    return 60;
  }
  if (state.server?.recording?.active) {
    return 120;
  }
  return 350;
}

function schedulePoll() {
  window.clearTimeout(state.pollTimer);
  const delay = getPollDelay();
  if (delay === null) {
    return;
  }
  state.pollTimer = window.setTimeout(() => {
    void loadState({ silent: true });
  }, delay);
}

async function loadState({ silent = false, force = false } = {}) {
  if (state.loadInFlight && !force) {
    schedulePoll();
    return;
  }

  state.loadInFlight = true;
  try {
    state.server = await api("/api/state");
    if (!state.editMode) {
      state.localLayout = null;
    }
    syncSelectedRecording();
    render();
  } catch (error) {
    if (!silent) {
      showError(error);
    }
  } finally {
    state.loadInFlight = false;
    schedulePoll();
  }
}

function render() {
  if (!state.server) {
    return;
  }

  syncSelectedRecording();

  const layout = getViewLayout();
  const settings = state.server?.settings || null;
  const activeIds = getActiveIdSet();
  const placedCount = layout.leds.filter((led) => led.placed).length;
  const selectedRecording = getSelectedRecording();

  ui.modeSummary.textContent = state.editMode
    ? "Edit mode active. Drag lights onto the scene, rename them, map keys, then save."
    : "Live mode active. Click a light in the list or on the scene to toggle it.";
  ui.layoutMeta.textContent = getSceneStatusText(layout, placedCount);
  ui.sidebarSummary.textContent = `${layout.leds.length} physical LEDs`;
  ui.editToggleBtn.textContent = state.editMode ? "Done" : "Edit";
  ui.editModeTools.hidden = !state.editMode;
  ui.sceneStage.classList.toggle("editing", state.editMode);

  const recording = state.server.recording;
  if (recording.active) {
    ui.recordingSummary.textContent = `Recording live. ${recording.event_count} events captured.`;
  } else if (recording.unsaved) {
    ui.recordingSummary.textContent = `Stopped. ${recording.unsaved.event_count} events, ${formatDuration(recording.unsaved.duration_ms)} duration.`;
  } else {
    ui.recordingSummary.textContent = "No active recording";
  }

  const playback = state.server.playback;
  ui.playbackSummary.textContent = playback.active
    ? `Playing "${playback.recording_name}"${playback.loop ? " in loop" : ""}.`
    : "Playback idle";

  ui.driverMode.textContent = state.server.driver.mode === "real" ? "Real driver" : "Mock driver";
  ui.driverDetail.textContent = state.server.driver.detail;
  ui.driverDot.classList.toggle("real", state.server.driver.mode === "real");
  ui.driverDot.classList.toggle("mock", state.server.driver.mode !== "real");

  renderRecordingPicker(selectedRecording);

  ui.recordBtn.disabled = recording.active || playback.active || state.editMode;
  ui.stopRecordBtn.disabled = !recording.active;
  ui.playBtn.disabled = recording.active || state.editMode || !selectedRecording;
  ui.stopPlaybackBtn.disabled = !playback.active;
  ui.deleteRecordingBtn.disabled = playback.active || !selectedRecording || selectedRecording.is_preset;
  ui.deleteRecordingBtn.title = selectedRecording?.is_preset ? "Built-in presets cannot be deleted." : "";
  ui.saveRecordingBtn.disabled = !recording.unsaved;
  ui.editToggleBtn.disabled = state.uploadInFlight;
  ui.saveLayoutBtn.disabled = !state.editMode || state.uploadInFlight;
  ui.imageUploadInput.disabled = state.uploadInFlight;
  ui.gridLengthInput.disabled = !state.editMode || state.uploadInFlight;
  ui.gridWidthInput.disabled = !state.editMode || state.uploadInFlight;
  ui.buildGridBtn.disabled = !state.editMode || state.uploadInFlight;
  ui.resetLayoutBtn.disabled = !state.editMode || state.uploadInFlight;

  renderLightingControls(settings);
  renderGridBuilderSummary(layout.leds.length);
  renderSidebar(layout, activeIds);
  renderScene(layout, activeIds);
}

function renderRecordingPicker(selectedRecording) {
  const recordings = getRecordings();

  if (!selectedRecording) {
    ui.recordingPickerLabel.textContent = recordings.length ? "Select a recording" : "No recordings saved";
  } else {
    ui.recordingPickerLabel.textContent = `${selectedRecording.name} • ${formatDuration(selectedRecording.duration_ms)}`;
  }

  ui.recordingPickerBtn.classList.toggle("open", state.recordingMenuOpen);
  ui.recordingMenu.classList.toggle("open", state.recordingMenuOpen);
  ui.recordingPickerBtn.setAttribute("aria-expanded", state.recordingMenuOpen ? "true" : "false");

  ui.recordingMenu.innerHTML = "";

  if (!recordings.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "dropdown-option-meta";
    emptyState.textContent = "No recordings saved yet.";
    ui.recordingMenu.appendChild(emptyState);
    return;
  }

  recordings.forEach((recording) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = `dropdown-option${recording.id === state.selectedRecordingId ? " selected" : ""}`;

    const main = document.createElement("div");
    main.className = "dropdown-option-main";

    const title = document.createElement("span");
    title.className = "dropdown-option-title";
    title.textContent = recording.name;

    const meta = document.createElement("span");
    meta.className = "dropdown-option-meta";
    meta.textContent = `${formatDuration(recording.duration_ms)} • ${recording.event_count} events`;

    main.append(title, meta);
    option.appendChild(main);

    if (recording.is_preset) {
      const badge = document.createElement("span");
      badge.className = "dropdown-badge";
      badge.textContent = "Preset";
      option.appendChild(badge);
    }

    option.addEventListener("click", () => {
      selectRecording(recording.id);
    });

    ui.recordingMenu.appendChild(option);
  });
}

function renderLightingControls(settings) {
  if (!settings) {
    return;
  }

  if (document.activeElement !== ui.brightnessSlider) {
    ui.brightnessSlider.value = String(settings.default_brightness ?? 96);
  }
  ui.brightnessValue.textContent = ui.brightnessSlider.value;
  ui.brightnessSlider.disabled = false;
  ui.lightingSummary.textContent = "Hold Shift for red, Ctrl for green, Alt for blue. No modifier stays white.";
}

function renderSidebar(layout, activeIds) {
  ui.ledList.innerHTML = "";

  layout.leds.forEach((led) => {
    const row = document.createElement("div");
    row.className = `led-row${activeIds.has(led.physical_id) ? " active" : ""}${state.editMode ? "" : " live compact"}`;
    row.draggable = state.editMode;
    row.dataset.ledId = String(led.physical_id);
    row.addEventListener("dragstart", handleSidebarDragStart);

    const topLine = document.createElement("div");
    topLine.className = "led-topline";

    const label = document.createElement("div");
    label.className = "led-label";

    const titleNode = document.createElement("strong");
    titleNode.textContent = formatLedLabel(led);
    const metaNode = document.createElement("span");
    metaNode.className = "led-meta";
    metaNode.textContent = formatLedMeta(led);

    label.append(titleNode, metaNode);

    const status = document.createElement("span");
    status.className = "led-meta";
    status.textContent = led.placed ? "Placed" : "Unplaced";

    topLine.append(label, status);
    row.appendChild(topLine);

    if (state.editMode) {
      const inputs = document.createElement("div");
      inputs.className = "led-inputs";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "Display name";
      nameInput.value = led.display_name || "";
      nameInput.addEventListener("input", (event) => {
        const displayName = event.target.value;
        updateLocalLed(led.physical_id, { display_name: displayName });
        titleNode.textContent = formatLedLabel({ ...led, display_name: displayName });
        if (led.placed) {
          renderScene(getViewLayout(), getActiveIdSet());
        }
      });

      const keyInput = document.createElement("input");
      keyInput.type = "text";
      keyInput.placeholder = "Key";
      keyInput.maxLength = 1;
      keyInput.value = led.key || "";
      keyInput.addEventListener("input", (event) => {
        const key = event.target.value.toUpperCase().trim();
        event.target.value = key;
        updateLocalLed(led.physical_id, { key });
        metaNode.textContent = formatLedMeta({ ...led, key });
      });

      inputs.append(nameInput, keyInput);
      row.appendChild(inputs);

      const actions = document.createElement("div");
      actions.className = "led-actions";

      if (led.placed) {
        const clearButton = document.createElement("button");
        clearButton.textContent = "Remove";
        clearButton.addEventListener("click", () => {
          updateLocalLed(led.physical_id, { placed: false, x: null, y: null });
          render();
        });
        actions.appendChild(clearButton);
      }

      row.appendChild(actions);
    } else {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) {
          return;
        }
        void triggerLed(led.physical_id, "click", event);
      });

      const actions = document.createElement("div");
      actions.className = "led-actions";

      const toggleButton = document.createElement("button");
      toggleButton.textContent = activeIds.has(led.physical_id) ? "Turn Off" : "Turn On";
      toggleButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void triggerLed(led.physical_id, "click", event);
      });
      actions.appendChild(toggleButton);
      row.appendChild(actions);
    }

    ui.ledList.appendChild(row);
  });
}

function renderScene(layout, activeIds) {
  const desiredImage = state.sceneImagePreviewUrl || layout.background_image || "";
  const hasImage = Boolean(desiredImage);

  if (desiredImage !== state.sceneImageSource) {
    state.sceneImageSource = desiredImage;
    if (desiredImage) {
      state.sceneImageLoadState = "loading";
      ui.sceneImage.src = state.sceneImagePreviewUrl ? desiredImage : buildSceneImageSrc(desiredImage);
    } else {
      state.sceneImageLoadState = "idle";
      ui.sceneImage.removeAttribute("src");
    }
  }

  const imageReady = hasImage && state.sceneImageLoadState !== "error";
  ui.sceneImage.classList.toggle("visible", imageReady);

  if (!hasImage) {
    ui.scenePlaceholder.style.display = "grid";
    ui.scenePlaceholder.textContent = state.editMode
      ? "Drop a PNG or JPEG here, or choose a file above, then drag LEDs into position."
      : "Drop a PNG or JPEG here, or choose a file above to start editing.";
  } else if (state.sceneImageLoadState === "loading") {
    ui.scenePlaceholder.style.display = "grid";
    ui.scenePlaceholder.textContent = "Loading scene image...";
  } else if (state.sceneImageLoadState === "error") {
    ui.scenePlaceholder.style.display = "grid";
    ui.scenePlaceholder.textContent = "The uploaded image could not be displayed.";
  } else {
    ui.scenePlaceholder.style.display = "none";
  }

  ui.sceneOverlay.innerHTML = "";
  layout.leds
    .filter((led) => led.placed && led.x !== null && led.y !== null)
    .forEach((led) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = `scene-led${activeIds.has(led.physical_id) ? " active" : ""}${state.editMode ? " editing" : ""}`;
      marker.style.left = `${led.x}%`;
      marker.style.top = `${led.y}%`;
      marker.dataset.ledId = String(led.physical_id);
      marker.innerHTML = `${led.physical_id}<small>${led.display_name || "Light"}</small>`;

      if (state.editMode) {
        marker.addEventListener("pointerdown", startMarkerDrag);
      } else {
        marker.addEventListener("click", (event) => {
          event.stopPropagation();
          void triggerLed(led.physical_id, "click", event);
        });
      }

      ui.sceneOverlay.appendChild(marker);
    });
}

function handleSidebarDragStart(event) {
  if (!state.editMode) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData("text/plain", event.currentTarget.dataset.ledId);
}

function calculatePercentPosition(clientX, clientY) {
  const rect = ui.sceneStage.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

function startMarkerDrag(event) {
  if (!state.editMode) {
    return;
  }
  event.preventDefault();
  state.draggingMarkerId = Number(event.currentTarget.dataset.ledId);
  window.addEventListener("pointermove", handleMarkerDrag);
  window.addEventListener("pointerup", stopMarkerDrag, { once: true });
}

function handleMarkerDrag(event) {
  if (!state.draggingMarkerId) {
    return;
  }
  const { x, y } = calculatePercentPosition(event.clientX, event.clientY);
  updateLocalLed(state.draggingMarkerId, { x, y, placed: true });
  renderScene(getViewLayout(), getActiveIdSet());
}

function stopMarkerDrag() {
  state.draggingMarkerId = null;
  window.removeEventListener("pointermove", handleMarkerDrag);
}

async function triggerLed(physicalId, source, event = null) {
  const previousActiveIds = [...getActiveLedIds()];
  const previousActiveColors = { ...getActiveLedColorMap() };
  const nextActiveIds = new Set(previousActiveIds);
  const color = getModifierColor(event);
  const currentColor = getActiveLedColor(physicalId);

  if (nextActiveIds.has(physicalId) && colorsMatch(currentColor, color)) {
    nextActiveIds.delete(physicalId);
    removeActiveLedColor(physicalId);
  } else {
    nextActiveIds.add(physicalId);
    setActiveLedColor(physicalId, color);
  }

  setActiveLedIds(nextActiveIds);
  render();

  try {
    await api(`/api/lights/${physicalId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ source, color }),
    });
    await loadState({ silent: true, force: true });
  } catch (error) {
    setActiveLedIds(previousActiveIds);
    state.server.active_led_colors = previousActiveColors;
    render();
    showError(error);
  }
}

async function triggerKeyAssignment(key, event = null) {
  const normalizedKey = String(key).trim().toUpperCase();
  const mappedIds = getMappedLedIdsForKey(normalizedKey);
  if (!mappedIds.length) {
    return;
  }

  const previousActiveIds = [...getActiveLedIds()];
  const previousActiveColors = { ...getActiveLedColorMap() };
  const nextActiveIds = new Set(previousActiveIds);
  const color = getModifierColor(event);
  const targetActive = !mappedIds.every(
    (physicalId) => nextActiveIds.has(physicalId) && colorsMatch(getActiveLedColor(physicalId), color)
  );

  mappedIds.forEach((physicalId) => {
    if (targetActive) {
      nextActiveIds.add(physicalId);
      setActiveLedColor(physicalId, color);
    } else {
      nextActiveIds.delete(physicalId);
      removeActiveLedColor(physicalId);
    }
  });

  setActiveLedIds(nextActiveIds);
  render();

  try {
    await api("/api/keys/trigger", {
      method: "POST",
      body: JSON.stringify({ key: normalizedKey, color }),
    });
    await loadState({ silent: true, force: true });
  } catch (error) {
    setActiveLedIds(previousActiveIds);
    state.server.active_led_colors = previousActiveColors;
    render();
    showError(error);
  }
}

async function saveLayout({ exitEditMode = false } = {}) {
  if (!state.localLayout || state.uploadInFlight) {
    return;
  }

  try {
    const payload = cloneLayout(state.localLayout);
    const response = await api("/api/layout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.server.layout = response.layout;
    state.localLayout = cloneLayout(response.layout);
    if (exitEditMode) {
      setEditMode(false);
    } else {
      render();
    }
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function saveLightingSettings({ silent = false } = {}) {
  if (!state.server?.settings) {
    return;
  }

  try {
    const payload = {
      default_brightness: Number(state.server.settings.default_brightness),
    };
    const response = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.server.settings = response.settings;
    render();
  } catch (error) {
    if (!silent) {
      showError(error);
    }
    void loadState({ silent: true, force: true });
    if (silent) {
      throw error;
    }
  }
}

async function flushLightingSettings() {
  if (!state.server?.settings || !state.lightingPendingSave || state.lightingRequestInFlight) {
    return;
  }

  const silent = state.lightingPendingSaveSilent;
  state.lightingPendingSave = false;
  state.lightingPendingSaveSilent = true;
  state.lightingRequestInFlight = true;
  state.lightingLastSentAt = Date.now();

  try {
    await saveLightingSettings({ silent });
  } catch (error) {
    if (!silent) {
      showError(error);
    }
  } finally {
    state.lightingRequestInFlight = false;
    if (state.lightingPendingSave) {
      queueSaveLightingSettings({ immediate: true, silent: state.lightingPendingSaveSilent });
    }
  }
}

function queueSaveLightingSettings({ immediate = false, silent = true } = {}) {
  const alreadyPending = state.lightingPendingSave;
  state.lightingPendingSave = true;
  state.lightingPendingSaveSilent = alreadyPending ? state.lightingPendingSaveSilent && silent : silent;

  if (state.lightingRequestInFlight) {
    return;
  }

  window.clearTimeout(state.lightingSaveTimer);
  const elapsed = Date.now() - state.lightingLastSentAt;
  const delay = immediate ? 0 : Math.max(0, LIGHTING_PREVIEW_INTERVAL_MS - elapsed);
  state.lightingSaveTimer = window.setTimeout(() => {
    state.lightingSaveTimer = null;
    void flushLightingSettings();
  }, delay);
}

function handleLightingInput() {
  if (!state.server?.settings) {
    return;
  }

  state.server.settings.default_brightness = Number(ui.brightnessSlider.value);
  render();
  queueSaveLightingSettings({ silent: true });
}

function handleLightingCommit() {
  if (!state.server?.settings) {
    return;
  }
  queueSaveLightingSettings({ immediate: true, silent: false });
}

async function uploadImage(file) {
  if (!state.editMode || !state.localLayout || !file) {
    return;
  }

  state.uploadInFlight = true;
  render();

  try {
    const formData = new FormData();
    formData.append("image", file);
    const response = await api("/api/upload-image", {
      method: "POST",
      body: formData,
    });
    state.sceneImageVersion = Date.now();
    state.sceneImageSource = "";
    state.localLayout.background_image = response.url;
    render();
  } catch (error) {
    showError(error);
  } finally {
    state.uploadInFlight = false;
    ui.imageUploadInput.value = "";
    render();
  }
}

function beginImageUpload(file) {
  if (!file || state.uploadInFlight) {
    return;
  }

  try {
    validateImageFile(file);
  } catch (error) {
    ui.imageUploadInput.value = "";
    showError(error);
    return;
  }

  if (!ensureEditLayout()) {
    return;
  }

  revokeScenePreviewUrl();
  state.sceneImagePreviewUrl = URL.createObjectURL(file);
  state.sceneImageSource = "";
  render();
  void uploadImage(file);
}

function handleImageSelection(event) {
  const file = event.target.files[0];
  beginImageUpload(file);
}

function handleBuildGrid() {
  try {
    buildGridLayout();
    render();
  } catch (error) {
    showError(error);
  }
}

function handleResetLayout() {
  if (!state.editMode || !state.localLayout) {
    return;
  }

  const confirmed = window.confirm("Remove all placed lights and clear their names? Key bindings will stay.");
  if (!confirmed) {
    return;
  }

  resetEditLayout();
  render();
}

async function startRecording() {
  try {
    await api("/api/recordings/start", { method: "POST" });
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function stopRecording() {
  try {
    await api("/api/recordings/stop", { method: "POST" });
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function saveRecording() {
  const name = ui.recordingNameInput.value.trim();
  if (!name) {
    window.alert("Name the recording before saving.");
    return;
  }

  try {
    const response = await api("/api/recordings/save", {
      method: "POST",
      body: JSON.stringify({
        name,
        loop_preference: ui.saveLoopPreference.checked,
      }),
    });
    ui.recordingNameInput.value = "";
    ui.saveLoopPreference.checked = false;
    state.selectedRecordingId = response.id;
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function startPlayback() {
  if (!state.selectedRecordingId) {
    window.alert("Select a recording first.");
    return;
  }

  try {
    await api("/api/playback/start", {
      method: "POST",
      body: JSON.stringify({
        recording_id: state.selectedRecordingId,
        loop: ui.playbackLoopToggle.checked,
      }),
    });
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function stopPlayback() {
  try {
    await api("/api/playback/stop", { method: "POST" });
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function deleteRecording() {
  const selectedRecording = getSelectedRecording();
  if (!selectedRecording) {
    window.alert("Select a recording first.");
    return;
  }

  const confirmed = window.confirm(`Delete ${selectedRecording.name}?`);
  if (!confirmed) {
    return;
  }

  try {
    await api(`/api/recordings/${selectedRecording.id}`, {
      method: "DELETE",
    });
    state.selectedRecordingId = "";
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

async function allOff() {
  const previousActiveIds = [...getActiveLedIds()];
  setActiveLedIds([]);
  render();

  try {
    await api("/api/lights/all-off", {
      method: "POST",
      body: JSON.stringify({ source: "system" }),
    });
    await loadState({ silent: true, force: true });
  } catch (error) {
    setActiveLedIds(previousActiveIds);
    render();
    showError(error);
  }
}

function handleSceneDragOver(event) {
  const hasFiles = eventHasFiles(event);
  if (!state.editMode && !hasFiles) {
    return;
  }
  event.preventDefault();
  if (hasFiles) {
    event.dataTransfer.dropEffect = "copy";
    setSceneFileDragActive(true);
  }
}

function handleSceneDrop(event) {
  event.preventDefault();
  setSceneFileDragActive(false);

  if (eventHasFiles(event)) {
    const file = getDroppedImageFile(event);
    beginImageUpload(file);
    return;
  }

  if (!state.editMode) {
    return;
  }

  const physicalId = Number(event.dataTransfer.getData("text/plain"));
  if (!physicalId) {
    return;
  }
  const { x, y } = calculatePercentPosition(event.clientX, event.clientY);
  updateLocalLed(physicalId, { placed: true, x, y });
  render();
}

function handleSceneDragLeave(event) {
  if (!ui.sceneStage.contains(event.relatedTarget)) {
    setSceneFileDragActive(false);
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && state.recordingMenuOpen) {
    closeRecordingMenu();
    return;
  }

  if (state.editMode || !state.server || event.repeat || event.metaKey) {
    return;
  }

  const targetTag = event.target?.tagName?.toLowerCase();
  if (targetTag === "input" || targetTag === "textarea" || targetTag === "select" || event.target.closest(".dropdown")) {
    return;
  }

  const key = getKeyboardKeyFromEvent(event);
  if (!key) {
    return;
  }
  const mappedIds = getMappedLedIdsForKey(key);
  if (!mappedIds.length) {
    return;
  }

  event.preventDefault();
  void triggerKeyAssignment(key, event);
}

function handleWindowPointerDown(event) {
  if (!state.recordingMenuOpen) {
    return;
  }
  if (!event.target.closest("#recordingPicker")) {
    closeRecordingMenu();
  }
}

ui.editToggleBtn.addEventListener("click", async () => {
  if (state.editMode) {
    await saveLayout({ exitEditMode: true });
  } else {
    setEditMode(true);
  }
});

ui.saveLayoutBtn.addEventListener("click", () => {
  void saveLayout();
});
ui.recordBtn.addEventListener("click", () => {
  void startRecording();
});
ui.stopRecordBtn.addEventListener("click", () => {
  void stopRecording();
});
ui.saveRecordingBtn.addEventListener("click", () => {
  void saveRecording();
});
ui.playBtn.addEventListener("click", () => {
  void startPlayback();
});
ui.stopPlaybackBtn.addEventListener("click", () => {
  void stopPlayback();
});
ui.deleteRecordingBtn.addEventListener("click", () => {
  void deleteRecording();
});
ui.allOffBtn.addEventListener("click", () => {
  void allOff();
});
ui.recordingPickerBtn.addEventListener("click", () => {
  toggleRecordingMenu();
});
ui.imageUploadInput.addEventListener("change", handleImageSelection);
ui.gridLengthInput.addEventListener("input", () => {
  if (state.server) {
    renderGridBuilderSummary(state.server.layout.leds.length);
  }
});
ui.gridWidthInput.addEventListener("input", () => {
  if (state.server) {
    renderGridBuilderSummary(state.server.layout.leds.length);
  }
});
ui.buildGridBtn.addEventListener("click", handleBuildGrid);
ui.resetLayoutBtn.addEventListener("click", handleResetLayout);
ui.brightnessSlider.addEventListener("input", handleLightingInput);
ui.brightnessSlider.addEventListener("change", handleLightingCommit);
ui.sceneStage.addEventListener("dragover", handleSceneDragOver);
ui.sceneStage.addEventListener("drop", handleSceneDrop);
ui.sceneStage.addEventListener("dragleave", handleSceneDragLeave);
ui.sceneOverlay.addEventListener("dragover", handleSceneDragOver);
ui.sceneOverlay.addEventListener("drop", handleSceneDrop);
ui.sceneOverlay.addEventListener("dragleave", handleSceneDragLeave);
ui.sceneImage.addEventListener("load", () => {
  state.sceneImageLoadState = "loaded";
  render();
});
ui.sceneImage.addEventListener("error", () => {
  state.sceneImageLoadState = "error";
  render();
});
window.addEventListener("keydown", handleGlobalKeydown);
window.addEventListener("pointerdown", handleWindowPointerDown);

async function init() {
  await loadState({ force: true });
}

void init();
