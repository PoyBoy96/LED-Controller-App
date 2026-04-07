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
  randomPlaybackControls: document.getElementById("randomPlaybackControls"),
  randomChaosSlider: document.getElementById("randomChaosSlider"),
  randomChaosValue: document.getElementById("randomChaosValue"),
  randomRgbToggle: document.getElementById("randomRgbToggle"),
  randomPlaybackSummary: document.getElementById("randomPlaybackSummary"),
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
  timelinePanel: document.getElementById("timelinePanel"),
  timelineSourceLabel: document.getElementById("timelineSourceLabel"),
  timelineTimeDisplay: document.getElementById("timelineTimeDisplay"),
  timelineFrameDisplay: document.getElementById("timelineFrameDisplay"),
  timelineMinutesInput: document.getElementById("timelineMinutesInput"),
  timelineSecondsInput: document.getElementById("timelineSecondsInput"),
  timelineApplyLengthBtn: document.getElementById("timelineApplyLengthBtn"),
  timelineSaveBtn: document.getElementById("timelineSaveBtn"),
  timelineSaveStatus: document.getElementById("timelineSaveStatus"),
  timelineColorR: document.getElementById("timelineColorR"),
  timelineColorG: document.getElementById("timelineColorG"),
  timelineColorB: document.getElementById("timelineColorB"),
  timelineColorW: document.getElementById("timelineColorW"),
  timelineZoomSlider: document.getElementById("timelineZoomSlider"),
  timelineZoomValue: document.getElementById("timelineZoomValue"),
  timelineBody: document.getElementById("timelineBody"),
  timelineContent: document.getElementById("timelineContent"),
  timelineRuler: document.getElementById("timelineRuler"),
  timelineRows: document.getElementById("timelineRows"),
  timelinePlayhead: document.getElementById("timelinePlayhead"),
  timelineMarquee: document.getElementById("timelineMarquee"),
};

const state = {
  server: null,
  localLayout: null,
  editMode: false,
  draggingMarkerId: null,
  draggingMarkerEl: null,
  markerDragRafId: null,
  renderRafId: null,
  touchSelectedLedId: null,
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
  randomPlaybackOptions: {
    chaos: 1,
    rgb: false,
  },
  timeline: {
    loadedRecordingId: "",
    recordingName: "",
    isPresetSource: false,
    derivedFromId: "",
    durationMs: 0,
    clips: [],
    nextClipId: 1,
    selectedClipIds: new Set(),
    selectedRowId: 0,
    playheadMs: 0,
    zoom: 1,
    pxPerMs: 0.6,
    panelFocused: false,
    dirty: false,
    saving: false,
    autoSaveTimer: null,
    saveStatusTimer: null,
    drag: null,
    marquee: null,
    scrubRafId: null,
    scrubInFlight: false,
    pendingScrubLights: null,
    statusMessage: "",
    statusTone: "",
  },
  scrubOverride: null,
};

const IMAGE_UPLOAD_ERROR = "Only PNG and JPEG images are supported.";
const IMAGE_UPLOAD_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const IMAGE_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const LIGHTING_PREVIEW_INTERVAL_MS = 45;
const KEY_CODE_BINDINGS = {
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  ArrowUp: "ARROWUP",
  ArrowLeft: "ARROWLEFT",
  ArrowDown: "ARROWDOWN",
  ArrowRight: "ARROWRIGHT",
};
const KEY_LABELS = {
  ARROWUP: "↑",
  ARROWLEFT: "←",
  ARROWDOWN: "↓",
  ARROWRIGHT: "→",
};
const RANDOM_PLAYBACK_PRESET_ID = "preset-random";
const DEFAULT_RANDOM_PLAYBACK_OPTIONS = {
  chaos: 1,
  rgb: false,
};
const MAX_BRIGHTNESS = 255;

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
  if (!state.timeline.dirty) {
    void timelineLoadFromRecordingId(recordingId);
  }
  render();
}

function getActiveLedIds() {
  if (state.scrubOverride) {
    return state.scrubOverride.activeLeds;
  }
  return Array.isArray(state.server?.active_leds) ? state.server.active_leds : [];
}

function getActiveLedColorMap() {
  if (state.scrubOverride) {
    return state.scrubOverride.colors;
  }
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
  return led.key ? `Physical ${led.physical_id} • Key ${formatKeyBindingLabel(led.key)}` : `Physical ${led.physical_id}`;
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

function normalizeKeyBinding(key) {
  return String(key || "").trim().toUpperCase();
}

function formatKeyBindingLabel(key) {
  const normalized = normalizeKeyBinding(key);
  return KEY_LABELS[normalized] || normalized;
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function normalizeRandomPlaybackOptions(options = {}) {
  return {
    chaos: Math.round(clampNumber(options.chaos ?? DEFAULT_RANDOM_PLAYBACK_OPTIONS.chaos, 1, 10)),
    rgb: Boolean(options.rgb),
  };
}

function brightnessValueToPercent(value) {
  return Math.round((clampNumber(value, 0, MAX_BRIGHTNESS) / MAX_BRIGHTNESS) * 100);
}

function brightnessPercentToValue(percent) {
  return Math.round((clampNumber(percent, 0, 100) / 100) * MAX_BRIGHTNESS);
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
  if (KEY_CODE_BINDINGS[code]) {
    return KEY_CODE_BINDINGS[code];
  }
  return "";
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

  const allowedKeys = Array.isArray(state.server?.settings?.allowed_keys) ? state.server.settings.allowed_keys : [];
  state.localLayout.leds.forEach((led) => {
    led.display_name = "";
    led.placed = false;
    led.x = null;
    led.y = null;
    led.key = allowedKeys[led.physical_id - 1] || "";
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
    state.touchSelectedLedId = null;
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
  if (playback.recording_id === RANDOM_PLAYBACK_PRESET_ID && playback.random_options) {
    state.randomPlaybackOptions = normalizeRandomPlaybackOptions(playback.random_options);
  }
  ui.playbackSummary.textContent = playback.active
    ? `Playing "${playback.recording_name}"${playback.loop ? " in loop" : ""}.`
    : "Playback idle";

  ui.driverMode.textContent = state.server.driver.mode === "real" ? "Real driver" : "Mock driver";
  ui.driverDetail.textContent = state.server.driver.detail;
  ui.driverDot.classList.toggle("real", state.server.driver.mode === "real");
  ui.driverDot.classList.toggle("mock", state.server.driver.mode !== "real");

  renderRecordingPicker(selectedRecording);
  renderRandomPlaybackControls(selectedRecording, playback, recording);

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

// Coalesces multiple render() requests into one per animation frame.
// Used by high-frequency input handlers (sliders) to avoid rebuilding the DOM
// 30-60+ times per second during touch drags.
function scheduleRender() {
  if (state.renderRafId) {
    return;
  }
  state.renderRafId = requestAnimationFrame(() => {
    state.renderRafId = null;
    render();
  });
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

function renderRandomPlaybackControls(selectedRecording, playback, recording) {
  const visible = selectedRecording?.id === RANDOM_PLAYBACK_PRESET_ID;
  ui.randomPlaybackControls.hidden = !visible;
  if (!visible) {
    return;
  }

  const options = normalizeRandomPlaybackOptions(state.randomPlaybackOptions);
  state.randomPlaybackOptions = options;
  if (document.activeElement !== ui.randomChaosSlider) {
    ui.randomChaosSlider.value = String(options.chaos);
  }
  ui.randomChaosValue.textContent = String(options.chaos);
  ui.randomRgbToggle.checked = options.rgb;
  const disabled = Boolean(recording.active || playback.active);
  ui.randomChaosSlider.disabled = disabled;
  ui.randomRgbToggle.disabled = disabled;
  ui.randomPlaybackSummary.textContent = options.rgb
    ? `Each burst lights 1-${options.chaos} LEDs, with every active LED choosing its own RGB color.`
    : `Each burst lights 1-${options.chaos} LEDs in white.`;
}

function renderLightingControls(settings) {
  if (!settings) {
    return;
  }

  const brightnessPercent = brightnessValueToPercent(settings.default_brightness ?? MAX_BRIGHTNESS);
  if (document.activeElement !== ui.brightnessSlider) {
    ui.brightnessSlider.value = String(brightnessPercent);
  }
  ui.brightnessValue.textContent = `${ui.brightnessSlider.value}%`;
  ui.brightnessSlider.disabled = false;
  ui.lightingSummary.textContent = "Hold Shift for red, Ctrl for green, Alt for blue. No modifier stays white.";
}

function renderSidebar(layout, activeIds) {
  ui.ledList.innerHTML = "";

  layout.leds.forEach((led) => {
    const row = document.createElement("div");
    const isTouchSelected = state.editMode && state.touchSelectedLedId === led.physical_id;
    row.className = `led-row${activeIds.has(led.physical_id) ? " active" : ""}${state.editMode ? "" : " live compact"}${isTouchSelected ? " touch-selected" : ""}`;
    row.draggable = state.editMode;
    row.dataset.ledId = String(led.physical_id);
    row.addEventListener("dragstart", handleSidebarDragStart);

    if (state.editMode) {
      // Tap-to-select for touch users (alternative to HTML5 drag-and-drop).
      // Tap a sidebar row to highlight it, then tap the scene to place it.
      row.addEventListener("click", (event) => {
        if (event.target.closest("input") || event.target.closest("button")) {
          return;
        }
        if (state.touchSelectedLedId === led.physical_id) {
          state.touchSelectedLedId = null;
        } else {
          state.touchSelectedLedId = led.physical_id;
        }
        ui.ledList.querySelectorAll(".led-row").forEach((r) => {
          r.classList.toggle(
            "touch-selected",
            Number(r.dataset.ledId) === state.touchSelectedLedId
          );
        });
      });
    }

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
      keyInput.placeholder = "Press key";
      keyInput.readOnly = true;
      keyInput.value = formatKeyBindingLabel(led.key || "");
      keyInput.addEventListener("keydown", (event) => {
        let key = "";
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
        } else {
          key = getKeyboardKeyFromEvent(event);
          if (!key) {
            return;
          }
          event.preventDefault();
          if (!state.server?.settings?.allowed_keys?.includes(key)) {
            showError(new Error(`Key ${formatKeyBindingLabel(key)} is not in the allowed key list.`));
            return;
          }
        }

        keyInput.value = formatKeyBindingLabel(key);
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
  const target = event.currentTarget;
  state.draggingMarkerId = Number(target.dataset.ledId);
  state.draggingMarkerEl = target;
  // Pointer capture ensures we keep receiving events even if the finger/cursor
  // moves outside the marker bounds. Critical for touch where fast swipes can
  // otherwise drop pointer events.
  try {
    target.setPointerCapture(event.pointerId);
  } catch (error) {
    // Ignore - some browsers may reject capture for synthetic pointers.
  }
  // Suppress page scroll/zoom while dragging on touch devices.
  ui.sceneOverlay.style.touchAction = "none";
  target.addEventListener("pointermove", handleMarkerDrag);
  target.addEventListener("pointerup", stopMarkerDrag, { once: true });
  target.addEventListener("lostpointercapture", stopMarkerDrag, { once: true });
}

function handleMarkerDrag(event) {
  if (!state.draggingMarkerId) {
    return;
  }
  const clientX = event.clientX;
  const clientY = event.clientY;
  if (state.markerDragRafId) {
    cancelAnimationFrame(state.markerDragRafId);
  }
  state.markerDragRafId = requestAnimationFrame(() => {
    state.markerDragRafId = null;
    if (!state.draggingMarkerId) {
      return;
    }
    const { x, y } = calculatePercentPosition(clientX, clientY);
    updateLocalLed(state.draggingMarkerId, { x, y, placed: true });
    // Update the marker element's position directly. We avoid renderScene()
    // here because it would destroy and recreate the captured element,
    // breaking the drag mid-stream.
    if (state.draggingMarkerEl) {
      state.draggingMarkerEl.style.left = `${x}%`;
      state.draggingMarkerEl.style.top = `${y}%`;
    }
  });
}

function stopMarkerDrag() {
  const el = state.draggingMarkerEl;
  state.draggingMarkerId = null;
  state.draggingMarkerEl = null;
  if (state.markerDragRafId) {
    cancelAnimationFrame(state.markerDragRafId);
    state.markerDragRafId = null;
  }
  ui.sceneOverlay.style.touchAction = "";
  if (el) {
    el.removeEventListener("pointermove", handleMarkerDrag);
    el.removeEventListener("pointerup", stopMarkerDrag);
    el.removeEventListener("lostpointercapture", stopMarkerDrag);
  } else {
    // Defensive cleanup for any legacy window listener.
    window.removeEventListener("pointermove", handleMarkerDrag);
  }
  // Final render to sync the rest of the UI with the new marker position.
  if (state.server) {
    renderScene(getViewLayout(), getActiveIdSet());
  }
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

  state.server.settings.default_brightness = brightnessPercentToValue(ui.brightnessSlider.value);
  scheduleRender();
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

  const confirmed = window.confirm(
    "Remove all placed lights, clear their names, and restore the default keyboard order? You can still edit keys after."
  );
  if (!confirmed) {
    return;
  }

  resetEditLayout();
  render();
}

function handleRandomChaosInput() {
  state.randomPlaybackOptions = normalizeRandomPlaybackOptions({
    ...state.randomPlaybackOptions,
    chaos: ui.randomChaosSlider.value,
  });
  scheduleRender();
}

function handleRandomRgbToggle() {
  state.randomPlaybackOptions = normalizeRandomPlaybackOptions({
    ...state.randomPlaybackOptions,
    rgb: ui.randomRgbToggle.checked,
  });
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
  const selectedRecording = getSelectedRecording();
  if (!state.selectedRecordingId || !selectedRecording) {
    window.alert("Select a recording first.");
    return;
  }

  // Random preset no longer plays via the server — instead it generates
  // a fresh randomized timeline locally and previews it inline.
  if (selectedRecording.id === RANDOM_PLAYBACK_PRESET_ID) {
    randomizeTimelineFromChaos();
    focusTimelinePanel();
    startTimelinePreviewPlayback();
    return;
  }

  try {
    const payload = {
      recording_id: state.selectedRecordingId,
      loop: ui.playbackLoopToggle.checked,
    };
    await api("/api/playback/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await loadState({ silent: true, force: true });
  } catch (error) {
    showError(error);
  }
}

function randomizeTimelineFromChaos() {
  const t = state.timeline;
  const layout = getViewLayout();
  const leds = (layout?.leds || []).filter((l) => Number.isFinite(l.scene_x));
  if (!leds.length) {
    window.alert("Place some lights on the scene first.");
    return;
  }
  const opts = normalizeRandomPlaybackOptions(state.randomPlaybackOptions);
  const chaos = Math.max(1, Math.min(10, Number(opts.chaos) || 1));
  const useRgb = !!opts.rgb;

  // Chaos drives: total length, clip count per LED, duration jitter, color variety.
  const durationMs = Math.max(2000, Math.round(4000 + chaos * 1500));
  const clipsPerLed = Math.max(1, Math.round(1 + chaos * 0.9));
  const minClipFrames = Math.max(1, 6 - Math.floor(chaos / 2));
  const maxClipFrames = 6 + chaos * 4;
  const palette = useRgb
    ? [[0, 255, 0], [255, 0, 0], [0, 0, 255], [255, 255, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]]
    : [[255, 255, 255]];

  const newClips = [];
  let nextId = 1;
  for (const led of leds) {
    for (let i = 0; i < clipsPerLed; i++) {
      const lenFrames = Math.floor(minClipFrames + Math.random() * (maxClipFrames - minClipFrames + 1));
      const lenMs = lenFrames * TIMELINE_MS_PER_FRAME;
      const maxStart = Math.max(0, durationMs - lenMs);
      const startMs = snapMsToFrame(Math.random() * maxStart);
      const color = palette[Math.floor(Math.random() * palette.length)];
      newClips.push({
        id: nextId++,
        ledId: led.physical_id,
        startMs,
        endMs: snapMsToFrame(startMs + lenMs),
        color: [...color],
      });
    }
  }
  // Resolve overlaps per LED by sorting and pushing later clips after earlier ones.
  const byLed = new Map();
  for (const c of newClips) {
    if (!byLed.has(c.ledId)) byLed.set(c.ledId, []);
    byLed.get(c.ledId).push(c);
  }
  for (const list of byLed.values()) {
    list.sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < list.length; i++) {
      if (list[i].startMs < list[i - 1].endMs) {
        const len = list[i].endMs - list[i].startMs;
        list[i].startMs = list[i - 1].endMs;
        list[i].endMs = Math.min(durationMs, list[i].startMs + len);
      }
    }
  }

  t.clips = newClips;
  t.nextClipId = nextId;
  t.durationMs = durationMs;
  t.recordingName = `Random (chaos ${chaos})`;
  t.isPresetSource = true;
  t.loadedRecordingId = RANDOM_PLAYBACK_PRESET_ID;
  t.derivedFromId = "";
  t.selectedClipIds = new Set();
  t.playheadMs = 0;
  markTimelineDirty();
  if (ui.timelineSourceLabel) ui.timelineSourceLabel.textContent = t.recordingName;
  if (ui.timelineMinutesInput) ui.timelineMinutesInput.value = String(Math.floor(durationMs / 60000));
  if (ui.timelineSecondsInput) ui.timelineSecondsInput.value = String(Math.floor((durationMs % 60000) / 1000));
  if (ui.timelinePanel) ui.timelinePanel.hidden = false;
  renderTimeline();
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

// ============================================================
// Timeline editor
// ============================================================

const TIMELINE_FPS = 30;
const TIMELINE_MS_PER_FRAME = 1000 / TIMELINE_FPS;
const TIMELINE_MIN_PX_PER_MS = 0.02;
const TIMELINE_MAX_PX_PER_MS = 1.5;
const TIMELINE_LABEL_WIDTH_PX = 140;

function timelineZoomSliderToPxPerMs(sliderValue) {
  const t = Math.max(0, Math.min(100, Number(sliderValue) || 0)) / 100;
  const logMin = Math.log(TIMELINE_MIN_PX_PER_MS);
  const logMax = Math.log(TIMELINE_MAX_PX_PER_MS);
  return Math.exp(logMin + (logMax - logMin) * t);
}

function timelinePxPerMsToSlider(pxPerMs) {
  const logMin = Math.log(TIMELINE_MIN_PX_PER_MS);
  const logMax = Math.log(TIMELINE_MAX_PX_PER_MS);
  const t = (Math.log(pxPerMs) - logMin) / (logMax - logMin);
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

function snapMsToFrame(ms) {
  return Math.round(ms / TIMELINE_MS_PER_FRAME) * TIMELINE_MS_PER_FRAME;
}

function tlMsToPx(ms) {
  return ms * state.timeline.pxPerMs;
}

function tlPxToMs(px) {
  return px / state.timeline.pxPerMs;
}

function formatTimelineTime(ms) {
  const total = Math.max(0, Math.round(ms));
  const mins = Math.floor(total / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  const rem = total % 1000;
  return `${mins}:${String(secs).padStart(2, "0")}.${String(rem).padStart(3, "0")}`;
}

function formatTimelineFrame(ms) {
  return `f${Math.round(ms / TIMELINE_MS_PER_FRAME)}`;
}

function eventsToClips(events) {
  const byLed = new Map();
  for (const ev of events || []) {
    const pid = Number(ev.physical_id);
    if (!pid) continue;
    if (!byLed.has(pid)) byLed.set(pid, []);
    byLed.get(pid).push(ev);
  }
  const clips = [];
  for (const [ledId, list] of byLed) {
    list.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    let open = null;
    for (const ev of list) {
      if (ev.action === "on") {
        if (open) {
          clips.push({
            id: state.timeline.nextClipId++,
            ledId,
            startMs: open.start,
            endMs: ev.timestamp_ms,
            color: open.color,
          });
        }
        open = {
          start: ev.timestamp_ms,
          color: Array.isArray(ev.color) ? [...ev.color] : [255, 255, 255],
        };
      } else if (ev.action === "off" && open) {
        clips.push({
          id: state.timeline.nextClipId++,
          ledId,
          startMs: open.start,
          endMs: ev.timestamp_ms,
          color: open.color,
        });
        open = null;
      }
    }
    if (open) {
      clips.push({
        id: state.timeline.nextClipId++,
        ledId,
        startMs: open.start,
        endMs: Math.max(open.start + TIMELINE_MS_PER_FRAME, state.timeline.durationMs),
        color: open.color,
      });
    }
  }
  return clips;
}

function clipsToEvents(clips, layout) {
  const lookup = new Map();
  if (layout?.leds) {
    for (const led of layout.leds) lookup.set(led.physical_id, led);
  }
  const events = [];
  for (const clip of clips) {
    const led = lookup.get(clip.ledId);
    const name = led?.display_name || `LED ${clip.ledId}`;
    events.push({
      timestamp_ms: Math.round(clip.startMs * 1000) / 1000,
      trigger_type: "edit",
      physical_id: clip.ledId,
      display_name_snapshot: name,
      action: "on",
      active: true,
      color: [...clip.color],
    });
    events.push({
      timestamp_ms: Math.round(clip.endMs * 1000) / 1000,
      trigger_type: "edit",
      physical_id: clip.ledId,
      display_name_snapshot: name,
      action: "off",
      active: false,
    });
  }
  events.sort((a, b) => a.timestamp_ms - b.timestamp_ms || a.physical_id - b.physical_id);
  return events;
}

async function timelineLoadFromRecordingId(recordingId) {
  if (!recordingId) {
    resetTimelineData();
    renderTimeline();
    return;
  }
  try {
    const recording = await api(`/api/recordings/${recordingId}`);
    loadTimelineFromRecording(recording);
  } catch (error) {
    showError(error);
  }
}

function loadTimelineFromRecording(recording) {
  const t = state.timeline;
  t.loadedRecordingId = recording.id;
  t.recordingName = recording.name || "";
  t.isPresetSource = Boolean(recording.is_preset);
  t.derivedFromId = recording.derived_from || "";
  t.durationMs = Math.max(0, Number(recording.duration_ms) || 0);
  t.nextClipId = 1;
  t.clips = eventsToClips(recording.events || []);
  t.selectedClipIds = new Set();
  t.selectedRowId = 0;
  t.playheadMs = 0;
  t.dirty = false;
  setTimelineStatus("", "");
  updateTimelineLengthInputs();
  renderTimeline();
}

function resetTimelineData() {
  const t = state.timeline;
  t.loadedRecordingId = "";
  t.recordingName = "";
  t.isPresetSource = false;
  t.derivedFromId = "";
  t.durationMs = 0;
  t.clips = [];
  t.selectedClipIds = new Set();
  t.selectedRowId = 0;
  t.playheadMs = 0;
  t.dirty = false;
}

function updateTimelineLengthInputs() {
  const totalSec = Math.floor(state.timeline.durationMs / 1000);
  ui.timelineMinutesInput.value = String(Math.floor(totalSec / 60));
  ui.timelineSecondsInput.value = String(totalSec % 60);
}

function getTimelineLedRows() {
  const layout = getViewLayout();
  if (!layout) return [];
  return layout.leds.slice().sort((a, b) => a.physical_id - b.physical_id);
}

function setTimelineStatus(message, tone = "") {
  state.timeline.statusMessage = message;
  state.timeline.statusTone = tone;
  if (!ui.timelineSaveStatus) return;
  ui.timelineSaveStatus.textContent = message;
  ui.timelineSaveStatus.classList.remove("success", "error");
  if (tone) ui.timelineSaveStatus.classList.add(tone);
  if (state.timeline.saveStatusTimer) {
    clearTimeout(state.timeline.saveStatusTimer);
    state.timeline.saveStatusTimer = null;
  }
  if (message && tone === "success") {
    state.timeline.saveStatusTimer = window.setTimeout(() => {
      ui.timelineSaveStatus.textContent = "";
      ui.timelineSaveStatus.classList.remove("success", "error");
    }, 2500);
  }
}

function renderTimeline() {
  const t = state.timeline;
  const panel = ui.timelinePanel;
  if (!panel) return;
  panel.hidden = false;

  const hasRecording = Boolean(t.loadedRecordingId);
  if (!hasRecording) {
    ui.timelineSourceLabel.textContent = "Select a recording to load the timeline.";
    ui.timelineRuler.innerHTML = "";
    ui.timelineRows.innerHTML = "";
    ui.timelinePlayhead.style.display = "none";
    ui.timelineSaveBtn.disabled = true;
    return;
  }

  ui.timelinePlayhead.style.display = "";
  let suffix = "";
  if (t.isPresetSource) suffix = " · preset (first edit will save a copy)";
  else if (t.derivedFromId) suffix = " · edit copy";
  ui.timelineSourceLabel.textContent = `${t.recordingName}${suffix}`;
  ui.timelineSaveBtn.disabled = !t.dirty || t.saving;

  const trackWidthPx = Math.max(400, tlMsToPx(Math.max(1, t.durationMs)));
  const frameWidthPx = tlMsToPx(TIMELINE_MS_PER_FRAME);
  const secondWidthPx = tlMsToPx(1000);
  ui.timelinePanel.style.setProperty("--timeline-track-width", `${trackWidthPx}px`);
  ui.timelinePanel.style.setProperty("--timeline-frame-width", `${frameWidthPx}px`);
  ui.timelinePanel.style.setProperty("--timeline-second-width", `${secondWidthPx}px`);

  renderTimelineRuler(secondWidthPx);
  renderTimelineRows();
  updateTimelinePlayhead();
  updateTimelineTimeDisplay();

  ui.timelineZoomValue.textContent = `${t.pxPerMs.toFixed(2)} px/ms`;
}

function renderTimelineRuler(secondWidthPx) {
  const ruler = ui.timelineRuler;
  ruler.innerHTML = "";
  const totalSec = Math.max(1, Math.ceil(state.timeline.durationMs / 1000));
  const minSpacingPx = 60;
  let step = 1;
  while (secondWidthPx * step < minSpacingPx && step < 3600) step *= 2;
  for (let s = 0; s <= totalSec; s += step) {
    const tick = document.createElement("div");
    tick.className = "timeline-ruler-tick";
    tick.style.left = `${tlMsToPx(s * 1000)}px`;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    tick.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
    ruler.appendChild(tick);
  }
  ruler.addEventListener("pointerdown", handleRulerPointerDown);
}

function renderTimelineRows() {
  const rowsEl = ui.timelineRows;
  rowsEl.innerHTML = "";
  const leds = getTimelineLedRows();
  const clipsByLed = new Map();
  for (const c of state.timeline.clips) {
    if (!clipsByLed.has(c.ledId)) clipsByLed.set(c.ledId, []);
    clipsByLed.get(c.ledId).push(c);
  }

  for (const led of leds) {
    const row = document.createElement("div");
    row.className = `timeline-row${state.timeline.selectedRowId === led.physical_id ? " row-selected" : ""}`;
    row.dataset.ledId = String(led.physical_id);

    const label = document.createElement("div");
    label.className = "timeline-row-label";
    label.textContent = led.display_name
      ? `${led.physical_id}: ${led.display_name}`
      : `LED ${led.physical_id}`;
    row.appendChild(label);

    const track = document.createElement("div");
    track.className = "timeline-row-track";
    track.dataset.ledId = String(led.physical_id);
    track.addEventListener("pointerdown", handleTrackPointerDown);

    const clips = clipsByLed.get(led.physical_id) || [];
    for (const clip of clips) {
      track.appendChild(createClipElement(clip));
    }
    row.appendChild(track);
    rowsEl.appendChild(row);
  }
}

function createClipElement(clip) {
  const el = document.createElement("div");
  el.className = `timeline-clip${state.timeline.selectedClipIds.has(clip.id) ? " selected" : ""}`;
  el.dataset.clipId = String(clip.id);
  const left = tlMsToPx(clip.startMs);
  const width = Math.max(3, tlMsToPx(clip.endMs - clip.startMs));
  el.style.left = `${left}px`;
  el.style.width = `${width}px`;
  // Hardware is GRB-ordered, so swap r/g for on-screen preview to match physical output.
  const [r, g, b] = clip.color;
  const dr = g, dg = r, db = b;
  el.style.background = `rgb(${dr}, ${dg}, ${db})`;
  const luminance = (0.299 * dr + 0.587 * dg + 0.114 * db) / 255;
  el.style.color = luminance > 0.55 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.92)";

  const leftHandle = document.createElement("div");
  leftHandle.className = "timeline-clip-handle left";
  leftHandle.dataset.mode = "trim-start";
  el.appendChild(leftHandle);

  const rightHandle = document.createElement("div");
  rightHandle.className = "timeline-clip-handle right";
  rightHandle.dataset.mode = "trim-end";
  el.appendChild(rightHandle);

  if (width > 50) {
    const lbl = document.createElement("span");
    lbl.className = "timeline-clip-label";
    lbl.textContent = `${Math.round(clip.endMs - clip.startMs)}ms`;
    el.appendChild(lbl);
  }

  el.addEventListener("pointerdown", handleClipPointerDown);
  return el;
}

function updateTimelinePlayhead() {
  const left = tlMsToPx(state.timeline.playheadMs) + TIMELINE_LABEL_WIDTH_PX;
  ui.timelinePlayhead.style.left = `${left}px`;
}

function updateTimelineTimeDisplay() {
  ui.timelineTimeDisplay.textContent = formatTimelineTime(state.timeline.playheadMs);
  ui.timelineFrameDisplay.textContent = formatTimelineFrame(state.timeline.playheadMs);
}

function updateTimelineClipPositionsOnly() {
  for (const clip of state.timeline.clips) {
    const el = ui.timelineRows.querySelector(`.timeline-clip[data-clip-id="${clip.id}"]`);
    if (!el) continue;
    el.style.left = `${tlMsToPx(clip.startMs)}px`;
    el.style.width = `${Math.max(3, tlMsToPx(clip.endMs - clip.startMs))}px`;
  }
}

function computeActiveLightsAtMs(ms) {
  const out = [];
  for (const clip of state.timeline.clips) {
    if (ms >= clip.startMs && ms < clip.endMs) {
      out.push({ physical_id: clip.ledId, color: [...clip.color] });
    }
  }
  return out;
}

function applyScrubOverrideFromMs(ms) {
  const lights = computeActiveLightsAtMs(ms);
  const ids = lights.map((l) => l.physical_id).sort((a, b) => a - b);
  const colors = {};
  for (const l of lights) colors[l.physical_id] = [...l.color];
  state.scrubOverride = { activeLeds: ids, colors };
  const layout = getViewLayout();
  if (layout) {
    renderScene(layout, new Set(ids));
    renderSidebar(layout, new Set(ids));
  }
  pushScrubToServer(lights);
}

async function pushScrubToServer(lights) {
  state.timeline.pendingScrubLights = lights;
  if (state.timeline.scrubInFlight) return;
  state.timeline.scrubInFlight = true;
  try {
    while (state.timeline.pendingScrubLights) {
      const payload = state.timeline.pendingScrubLights;
      state.timeline.pendingScrubLights = null;
      await api("/api/lights/state", {
        method: "POST",
        body: JSON.stringify({ lights: payload, source: "scrub" }),
      });
    }
  } catch (error) {
    // Silent — scrub is best-effort.
  } finally {
    state.timeline.scrubInFlight = false;
  }
}

function clearScrubOverride() {
  if (state.scrubOverride) {
    state.scrubOverride = null;
    if (state.server) render();
  }
}

function setPlayheadMs(ms) {
  const clamped = Math.max(0, Math.min(state.timeline.durationMs, ms));
  state.timeline.playheadMs = clamped;
  updateTimelinePlayhead();
  updateTimelineTimeDisplay();
  applyScrubOverrideFromMs(clamped);
}

function handleRulerPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  focusTimelinePanel();
  beginScrub(event);
}

function handleTrackPointerDown(event) {
  if (event.target.closest(".timeline-clip")) return;
  if (event.button !== undefined && event.button !== 0) return;
  focusTimelinePanel();

  const track = event.currentTarget;
  const ledId = Number(track.dataset.ledId);
  state.timeline.selectedRowId = ledId;

  if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
    state.timeline.selectedClipIds.clear();
  }
  renderTimeline();
  beginScrub(event);
}

function beginScrub(initialEvent) {
  const body = ui.timelineBody;
  try {
    body.setPointerCapture(initialEvent.pointerId);
  } catch (error) {
    // ignore
  }

  const updateFromClientX = (clientX) => {
    const bodyRect = body.getBoundingClientRect();
    const x = clientX - bodyRect.left + body.scrollLeft - TIMELINE_LABEL_WIDTH_PX;
    setPlayheadMs(tlPxToMs(x));
  };
  updateFromClientX(initialEvent.clientX);

  const onMove = (e) => {
    if (state.timeline.scrubRafId) cancelAnimationFrame(state.timeline.scrubRafId);
    const clientX = e.clientX;
    state.timeline.scrubRafId = requestAnimationFrame(() => {
      state.timeline.scrubRafId = null;
      updateFromClientX(clientX);
    });
  };
  const onUp = () => {
    body.removeEventListener("pointermove", onMove);
    body.removeEventListener("pointerup", onUp);
    body.removeEventListener("lostpointercapture", onUp);
    if (state.timeline.scrubRafId) {
      cancelAnimationFrame(state.timeline.scrubRafId);
      state.timeline.scrubRafId = null;
    }
  };
  body.addEventListener("pointermove", onMove);
  body.addEventListener("pointerup", onUp, { once: true });
  body.addEventListener("lostpointercapture", onUp, { once: true });
}

function handleClipPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.stopPropagation();
  focusTimelinePanel();

  const clipEl = event.currentTarget;
  const clipId = Number(clipEl.dataset.clipId);
  const clip = state.timeline.clips.find((c) => c.id === clipId);
  if (!clip) return;

  const handleEl = event.target.closest(".timeline-clip-handle");
  const mode = handleEl ? handleEl.dataset.mode : "move";

  const t = state.timeline;
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    if (t.selectedClipIds.has(clipId)) {
      t.selectedClipIds.delete(clipId);
    } else {
      t.selectedClipIds.add(clipId);
    }
  } else if (!t.selectedClipIds.has(clipId)) {
    t.selectedClipIds = new Set([clipId]);
  }
  t.selectedRowId = clip.ledId;
  // Update selection classes in-place — do NOT rebuild DOM here, or
  // pointer capture below would latch onto a detached element.
  ui.timelineRows.querySelectorAll(".timeline-clip").forEach((node) => {
    const id = Number(node.dataset.clipId);
    node.classList.toggle("selected", t.selectedClipIds.has(id));
  });

  if (!t.selectedClipIds.has(clipId)) return;

  try {
    clipEl.setPointerCapture(event.pointerId);
  } catch (error) {
    // ignore
  }

  const startClientX = event.clientX;
  const startSnapshot = new Map();
  for (const id of t.selectedClipIds) {
    const c = t.clips.find((x) => x.id === id);
    if (c) startSnapshot.set(id, { startMs: c.startMs, endMs: c.endMs });
  }

  const onMove = (e) => {
    const deltaPx = e.clientX - startClientX;
    const deltaMs = tlPxToMs(deltaPx);
    applyDragToSelection(mode, startSnapshot, deltaMs);
    updateTimelineClipPositionsOnly();
  };
  const onUp = () => {
    clipEl.removeEventListener("pointermove", onMove);
    clipEl.removeEventListener("pointerup", onUp);
    clipEl.removeEventListener("lostpointercapture", onUp);
    markTimelineDirty();
    renderTimeline();
  };
  clipEl.addEventListener("pointermove", onMove);
  clipEl.addEventListener("pointerup", onUp, { once: true });
  clipEl.addEventListener("lostpointercapture", onUp, { once: true });
}

function applyDragToSelection(mode, startSnapshot, deltaMs) {
  const t = state.timeline;
  const frame = TIMELINE_MS_PER_FRAME;
  for (const [id, orig] of startSnapshot) {
    const clip = t.clips.find((c) => c.id === id);
    if (!clip) continue;

    const neighbors = t.clips.filter((c) => c.ledId === clip.ledId && !startSnapshot.has(c.id));
    let minStart = 0;
    let maxEnd = t.durationMs;
    for (const n of neighbors) {
      if (n.endMs <= orig.startMs && n.endMs > minStart) minStart = n.endMs;
      if (n.startMs >= orig.endMs && n.startMs < maxEnd) maxEnd = n.startMs;
    }

    if (mode === "move") {
      const len = orig.endMs - orig.startMs;
      let newStart = orig.startMs + deltaMs;
      newStart = Math.max(minStart, Math.min(maxEnd - len, newStart));
      newStart = snapMsToFrame(newStart);
      clip.startMs = newStart;
      clip.endMs = newStart + len;
    } else if (mode === "trim-start") {
      let newStart = orig.startMs + deltaMs;
      newStart = Math.max(minStart, Math.min(orig.endMs - frame, newStart));
      clip.startMs = snapMsToFrame(newStart);
      if (clip.endMs - clip.startMs < frame) clip.startMs = clip.endMs - frame;
    } else if (mode === "trim-end") {
      let newEnd = orig.endMs + deltaMs;
      newEnd = Math.max(orig.startMs + frame, Math.min(maxEnd, newEnd));
      clip.endMs = snapMsToFrame(newEnd);
      if (clip.endMs - clip.startMs < frame) clip.endMs = clip.startMs + frame;
    }
  }
}

function markTimelineDirty() {
  state.timeline.dirty = true;
  setTimelineStatus("Unsaved changes", "");
  if (ui.timelineSaveBtn) ui.timelineSaveBtn.disabled = false;
}

function applyColorToSelected(color) {
  const t = state.timeline;
  if (!t.selectedClipIds.size) return;
  for (const clip of t.clips) {
    if (t.selectedClipIds.has(clip.id)) clip.color = [...color];
  }
  markTimelineDirty();
  renderTimeline();
}

function splitSelectedClipsAtPlayhead() {
  const t = state.timeline;
  const playhead = snapMsToFrame(t.playheadMs);
  const newClips = [];
  const newSelection = new Set();
  let didSplit = false;
  for (const clip of t.clips) {
    const selected = t.selectedClipIds.has(clip.id);
    if (selected && playhead > clip.startMs + 0.5 && playhead < clip.endMs - 0.5) {
      const left = {
        id: t.nextClipId++,
        ledId: clip.ledId,
        startMs: clip.startMs,
        endMs: playhead,
        color: [...clip.color],
      };
      const right = {
        id: t.nextClipId++,
        ledId: clip.ledId,
        startMs: playhead,
        endMs: clip.endMs,
        color: [...clip.color],
      };
      newClips.push(left, right);
      newSelection.add(left.id);
      newSelection.add(right.id);
      didSplit = true;
    } else {
      newClips.push(clip);
      if (selected) newSelection.add(clip.id);
    }
  }
  if (didSplit) {
    t.clips = newClips;
    t.selectedClipIds = newSelection;
    markTimelineDirty();
    renderTimeline();
  }
}

function deleteSelectedClips() {
  const t = state.timeline;
  if (!t.selectedClipIds.size) return;
  t.clips = t.clips.filter((c) => !t.selectedClipIds.has(c.id));
  t.selectedClipIds.clear();
  markTimelineDirty();
  renderTimeline();
}

function adjustTimelineZoom(delta) {
  const next = Math.max(0, Math.min(100, Number(ui.timelineZoomSlider.value) + delta));
  ui.timelineZoomSlider.value = String(next);
  state.timeline.pxPerMs = timelineZoomSliderToPxPerMs(next);
  renderTimeline();
}

function handleTimelineKeydown(event) {
  if (!state.timeline.panelFocused) return;
  const target = event.target;
  const tag = target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;

  if (ctrl && key.toLowerCase() === "s") {
    event.preventDefault();
    void saveTimeline({ manual: true });
    return;
  }
  if (key === "+" || key === "=") {
    event.preventDefault();
    adjustTimelineZoom(+5);
    return;
  }
  if (key === "-" || key === "_") {
    event.preventDefault();
    adjustTimelineZoom(-5);
    return;
  }
  if (key === "ArrowLeft") {
    event.preventDefault();
    setPlayheadMs(state.timeline.playheadMs - TIMELINE_MS_PER_FRAME);
    return;
  }
  if (key === "ArrowRight") {
    event.preventDefault();
    setPlayheadMs(state.timeline.playheadMs + TIMELINE_MS_PER_FRAME);
    return;
  }
  if (key === "ArrowUp" || key === "ArrowDown") {
    event.preventDefault();
    const leds = getTimelineLedRows();
    if (!leds.length) return;
    const currentIdx = leds.findIndex((l) => l.physical_id === state.timeline.selectedRowId);
    const delta = key === "ArrowDown" ? 1 : -1;
    const nextIdx = Math.max(0, Math.min(leds.length - 1, (currentIdx === -1 ? 0 : currentIdx + delta)));
    state.timeline.selectedRowId = leds[nextIdx].physical_id;
    renderTimeline();
    return;
  }
  if (key.toLowerCase() === "b") {
    event.preventDefault();
    splitSelectedClipsAtPlayhead();
    return;
  }
  if (key === "Delete" || key === "Backspace") {
    event.preventDefault();
    deleteSelectedClips();
    return;
  }
  if (key === " " || key === "Spacebar") {
    event.preventDefault();
    toggleTimelinePreviewPlayback();
    return;
  }
}

function toggleTimelinePreviewPlayback() {
  const t = state.timeline;
  if (t.previewRafId) {
    stopTimelinePreviewPlayback();
  } else {
    startTimelinePreviewPlayback();
  }
}

function startTimelinePreviewPlayback() {
  const t = state.timeline;
  if (t.previewRafId) return;
  if (t.playheadMs >= t.durationMs) t.playheadMs = 0;
  t.previewStartWall = performance.now();
  t.previewStartMs = t.playheadMs;
  const tick = () => {
    const elapsed = performance.now() - t.previewStartWall;
    const ms = t.previewStartMs + elapsed;
    if (ms >= t.durationMs) {
      setPlayheadMs(t.durationMs);
      stopTimelinePreviewPlayback();
      return;
    }
    setPlayheadMs(ms);
    t.previewRafId = requestAnimationFrame(tick);
  };
  t.previewRafId = requestAnimationFrame(tick);
}

function stopTimelinePreviewPlayback() {
  const t = state.timeline;
  if (t.previewRafId) {
    cancelAnimationFrame(t.previewRafId);
    t.previewRafId = null;
  }
}

async function saveTimeline({ manual = false } = {}) {
  const t = state.timeline;
  if (!t.dirty || t.saving || !t.loadedRecordingId) return;
  t.saving = true;
  setTimelineStatus("Saving…", "");
  if (ui.timelineSaveBtn) ui.timelineSaveBtn.disabled = true;
  try {
    let targetId = t.loadedRecordingId;
    if (t.isPresetSource) {
      const copy = await api(`/api/recordings/${targetId}/duplicate`, { method: "POST" });
      targetId = copy.id;
      t.loadedRecordingId = copy.id;
      t.recordingName = copy.name;
      t.isPresetSource = false;
      t.derivedFromId = copy.derived_from || "";
      state.selectedRecordingId = copy.id;
    }
    const events = clipsToEvents(t.clips, getViewLayout());
    await api(`/api/recordings/${targetId}`, {
      method: "PUT",
      body: JSON.stringify({
        events,
        duration_ms: Math.round(t.durationMs),
      }),
    });
    t.dirty = false;
    setTimelineStatus(manual ? "Saved ✓" : "Auto-saved ✓", "success");
    await loadState({ silent: true, force: true });
  } catch (error) {
    setTimelineStatus("Save failed", "error");
    showError(error);
  } finally {
    t.saving = false;
    renderTimeline();
  }
}

function focusTimelinePanel() {
  if (!ui.timelinePanel) return;
  if (document.activeElement !== ui.timelinePanel && !ui.timelinePanel.contains(document.activeElement)) {
    ui.timelinePanel.focus({ preventScroll: true });
  }
}

function handleTimelinePanelFocus() {
  state.timeline.panelFocused = true;
  ui.timelinePanel.classList.add("focused");
}

function handleTimelinePanelBlur(event) {
  const next = event.relatedTarget;
  if (next && ui.timelinePanel.contains(next)) return;
  state.timeline.panelFocused = false;
  ui.timelinePanel.classList.remove("focused");
  clearScrubOverride();
  if (state.timeline.dirty) void saveTimeline({ manual: false });
}

function handleTimelineApplyLength() {
  const mins = Math.max(0, Number(ui.timelineMinutesInput.value) || 0);
  const secs = Math.max(0, Math.min(59, Number(ui.timelineSecondsInput.value) || 0));
  const newDur = (mins * 60 + secs) * 1000;
  const t = state.timeline;
  if (newDur === t.durationMs) return;
  t.durationMs = newDur;
  t.clips = t.clips
    .filter((c) => c.startMs < newDur)
    .map((c) => ({ ...c, endMs: Math.min(c.endMs, newDur) }));
  if (t.playheadMs > newDur) t.playheadMs = newDur;
  markTimelineDirty();
  renderTimeline();
}

function handleTimelineZoomInput() {
  state.timeline.pxPerMs = timelineZoomSliderToPxPerMs(ui.timelineZoomSlider.value);
  renderTimeline();
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

  if (state.timeline.panelFocused) {
    handleTimelineKeydown(event);
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
ui.randomChaosSlider.addEventListener("input", handleRandomChaosInput);
ui.randomRgbToggle.addEventListener("change", handleRandomRgbToggle);
ui.brightnessSlider.addEventListener("input", handleLightingInput);
ui.brightnessSlider.addEventListener("change", handleLightingCommit);
ui.sceneStage.addEventListener("dragover", handleSceneDragOver);
ui.sceneStage.addEventListener("drop", handleSceneDrop);
ui.sceneStage.addEventListener("dragleave", handleSceneDragLeave);
ui.sceneOverlay.addEventListener("dragover", handleSceneDragOver);
ui.sceneOverlay.addEventListener("drop", handleSceneDrop);
ui.sceneOverlay.addEventListener("dragleave", handleSceneDragLeave);
ui.sceneOverlay.addEventListener("click", (event) => {
  // Tap-to-place: if a sidebar LED is selected for placement (touch flow),
  // a tap on empty scene area places it. Ignore taps on existing markers.
  if (!state.editMode || !state.touchSelectedLedId || !state.localLayout) {
    return;
  }
  if (event.target.closest(".scene-led")) {
    return;
  }
  const { x, y } = calculatePercentPosition(event.clientX, event.clientY);
  updateLocalLed(state.touchSelectedLedId, { placed: true, x, y });
  state.touchSelectedLedId = null;
  render();
});
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

// Timeline bindings
ui.timelinePanel.addEventListener("focus", handleTimelinePanelFocus);
ui.timelinePanel.addEventListener("blur", handleTimelinePanelBlur, true);
ui.timelinePanel.addEventListener("pointerdown", focusTimelinePanel);
ui.timelineZoomSlider.addEventListener("input", handleTimelineZoomInput);
ui.timelineApplyLengthBtn.addEventListener("click", handleTimelineApplyLength);
ui.timelineSaveBtn.addEventListener("click", () => {
  void saveTimeline({ manual: true });
});
// Hardware is GRB-ordered — base app's getModifierColor already pre-swaps.
// Match that convention here so R button turns lights red physically.
ui.timelineColorR.addEventListener("click", () => applyColorToSelected([0, 255, 0]));
ui.timelineColorG.addEventListener("click", () => applyColorToSelected([255, 0, 0]));
ui.timelineColorB.addEventListener("click", () => applyColorToSelected([0, 0, 255]));
ui.timelineColorW.addEventListener("click", () => applyColorToSelected([255, 255, 255]));
ui.timelineMinutesInput.addEventListener("change", handleTimelineApplyLength);
ui.timelineSecondsInput.addEventListener("change", handleTimelineApplyLength);

async function init() {
  // Pick a sensible initial zoom so 1 frame (~33ms) is ~20px wide.
  const initialPxPerMs = 0.6;
  state.timeline.pxPerMs = initialPxPerMs;
  ui.timelineZoomSlider.value = String(timelinePxPerMsToSlider(initialPxPerMs));

  await loadState({ force: true });
  if (state.selectedRecordingId) {
    void timelineLoadFromRecordingId(state.selectedRecordingId);
  } else {
    renderTimeline();
  }
}

void init();
