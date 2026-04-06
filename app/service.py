from __future__ import annotations

import random
import re
import threading
import time
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .defaults import make_default_layout, make_default_settings
from .led_driver import build_led_driver
from .logging_utils import get_logger
from .storage import JsonStorage


logger = get_logger("service")
WHITE_COLOR = [255, 255, 255]


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "recording"


def clamp_int(value: Any, minimum: int, maximum: int, field_name: str) -> int:
    try:
        normalized = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer.") from exc
    if normalized < minimum or normalized > maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}.")
    return normalized


def normalize_color(value: Any, field_name: str = "color") -> list[int]:
    if value is None:
        return WHITE_COLOR.copy()
    if not isinstance(value, (list, tuple)) or len(value) != 3:
        raise ValueError(f"{field_name} must contain red, green, and blue values.")
    return [
        clamp_int(value[0], 0, 255, f"{field_name}.red"),
        clamp_int(value[1], 0, 255, f"{field_name}.green"),
        clamp_int(value[2], 0, 255, f"{field_name}.blue"),
    ]


class LedControlService:
    def __init__(self, storage: JsonStorage):
        self.storage = storage
        self.lock = threading.RLock()
        self.settings = self._normalize_settings(self.storage.load_settings())
        self.storage.save_settings(self.settings)
        self.layout = self._normalize_layout(self.storage.load_layout())
        self._ensure_builtin_presets()
        self.driver = build_led_driver(self.settings)
        self.active_ids: set[int] = set()
        self.active_colors: dict[int, list[int]] = {}
        self.recording_session: dict[str, Any] | None = None
        self.unsaved_recording: dict[str, Any] | None = None
        logger.info(
            "service initialized led_count=%s pin=%s driver_mode=%s placed_leds=%s",
            self.settings.get("led_count"),
            self.settings.get("pin"),
            self.driver.info.mode,
            sum(1 for led in self.layout["leds"] if led.get("placed")),
        )
        self.playback_state = {
            "active": False,
            "recording_id": "",
            "recording_name": "",
            "loop": False,
            "started_at": None,
        }
        self.playback_stop_event = threading.Event()
        self.playback_thread: threading.Thread | None = None

    def _normalize_layout(self, payload: dict[str, Any] | None) -> dict[str, Any]:
        payload = payload or {}
        led_count = self.settings["led_count"]
        normalized = make_default_layout(led_count)
        normalized["background_image"] = payload.get("background_image", "")
        normalized["updated_at"] = payload.get("updated_at")

        incoming_leds = {
            int(led["physical_id"]): {
                "physical_id": int(led["physical_id"]),
                "display_name": str(led.get("display_name", "")).strip(),
                "x": led.get("x"),
                "y": led.get("y"),
                "key": str(led.get("key", "")).strip().upper(),
                "placed": bool(led.get("placed")),
            }
            for led in payload.get("leds", [])
            if "physical_id" in led
        }

        normalized_leds = []
        for physical_id in range(1, led_count + 1):
            led = incoming_leds.get(physical_id, normalized["leds"][physical_id - 1])
            if led.get("x") is None or led.get("y") is None:
                led["placed"] = False
            normalized_leds.append(led)
        normalized["leds"] = normalized_leds
        return normalized

    def _normalize_settings(self, payload: dict[str, Any] | None) -> dict[str, Any]:
        defaults = make_default_settings()
        payload = payload or {}
        normalized = deepcopy(defaults)
        normalized.update(payload)

        normalized["led_count"] = clamp_int(normalized.get("led_count", defaults["led_count"]), 1, 4096, "led_count")
        normalized["default_brightness"] = clamp_int(
            normalized.get("default_brightness", defaults["default_brightness"]),
            0,
            255,
            "default_brightness",
        )
        normalized["pin"] = clamp_int(normalized.get("pin", defaults["pin"]), 0, 99, "pin")
        normalized["frequency_hz"] = clamp_int(
            normalized.get("frequency_hz", defaults["frequency_hz"]),
            1,
            10_000_000,
            "frequency_hz",
        )
        normalized["dma_channel"] = clamp_int(
            normalized.get("dma_channel", defaults["dma_channel"]),
            0,
            255,
            "dma_channel",
        )
        normalized["channel"] = clamp_int(normalized.get("channel", defaults["channel"]), 0, 1, "channel")
        normalized["invert_signal"] = bool(normalized.get("invert_signal", defaults["invert_signal"]))
        normalized["all_white_mode"] = bool(normalized.get("all_white_mode", defaults["all_white_mode"]))

        active_color = normalized.get("active_color", defaults["active_color"])
        if not isinstance(active_color, (list, tuple)) or len(active_color) != 3:
            raise ValueError("active_color must contain red, green, and blue values.")
        normalized["active_color"] = [
            clamp_int(active_color[0], 0, 255, "active_color.red"),
            clamp_int(active_color[1], 0, 255, "active_color.green"),
            clamp_int(active_color[2], 0, 255, "active_color.blue"),
        ]

        allowed_keys = [str(key).strip().upper() for key in normalized.get("allowed_keys", defaults["allowed_keys"])]
        normalized["allowed_keys"] = [key for key in allowed_keys if key] or deepcopy(defaults["allowed_keys"])
        normalized["driver"] = str(normalized.get("driver", defaults["driver"])).strip().lower() or defaults["driver"]
        normalized["default_toggle_behavior"] = str(
            normalized.get("default_toggle_behavior", defaults["default_toggle_behavior"])
        ).strip() or defaults["default_toggle_behavior"]
        return normalized

    def _refresh_driver_settings(self) -> None:
        self.driver.update_settings(self.settings)
        self.driver.sync_from_colors(self.active_colors)

    def _validate_layout(self, layout: dict[str, Any]) -> dict[str, Any]:
        normalized = self._normalize_layout(layout)
        expected_ids = set(range(1, self.settings["led_count"] + 1))
        actual_ids = {led["physical_id"] for led in normalized["leds"]}
        if actual_ids != expected_ids:
            raise ValueError("Layout must contain every physical LED exactly once.")

        for led in normalized["leds"]:
            key = led["key"]
            if key:
                if key not in self.settings["allowed_keys"]:
                    raise ValueError(f"Key '{key}' is not in the allowed key list.")

            if led["placed"]:
                if led["x"] is None or led["y"] is None:
                    raise ValueError("Placed LEDs must include x and y positions.")
                if not 0 <= float(led["x"]) <= 100 or not 0 <= float(led["y"]) <= 100:
                    raise ValueError("LED positions must stay within the scene bounds.")
                led["x"] = round(float(led["x"]), 3)
                led["y"] = round(float(led["y"]), 3)
            else:
                led["x"] = None
                led["y"] = None

        normalized["updated_at"] = datetime.now(timezone.utc).isoformat()
        return normalized

    def _ensure_builtin_presets(self) -> None:
        presets = [
            self._build_wave_preset(),
            self._build_random_preset(),
        ]
        for preset in presets:
            existing = self.storage.load_recording(preset["id"])
            if existing:
                continue
            self.storage.save_recording(preset)

    def _build_wave_preset(self) -> dict[str, Any]:
        led_count = self.settings["led_count"]
        step_ms = 100
        pulse_ms = 50
        events = []
        for index in range(led_count):
            physical_id = index + 1
            started_at = index * step_ms
            events.append(
                {
                    "timestamp_ms": started_at,
                    "trigger_type": "preset",
                    "physical_id": physical_id,
                    "display_name_snapshot": f"LED {physical_id}",
                    "action": "on",
                    "active": True,
                    "color": WHITE_COLOR.copy(),
                }
            )
            events.append(
                {
                    "timestamp_ms": started_at + pulse_ms,
                    "trigger_type": "preset",
                    "physical_id": physical_id,
                    "display_name_snapshot": f"LED {physical_id}",
                    "action": "off",
                    "active": False,
                }
            )

        return {
            "id": "preset-wave",
            "name": "Wave",
            "created_at": "2026-03-31T00:00:02+00:00",
            "started_at": "2026-03-31T00:00:02+00:00",
            "duration_ms": 5000,
            "loop_preference": False,
            "is_preset": True,
            "events": events,
        }

    def _build_random_preset(self) -> dict[str, Any]:
        rng = random.Random(2811)
        led_count = self.settings["led_count"]
        step_ms = 100
        pulse_ms = 65
        total_steps = 50
        events = []
        for index in range(total_steps):
            physical_id = rng.randint(1, led_count)
            started_at = index * step_ms
            events.append(
                {
                    "timestamp_ms": started_at,
                    "trigger_type": "preset",
                    "physical_id": physical_id,
                    "display_name_snapshot": f"LED {physical_id}",
                    "action": "on",
                    "active": True,
                    "color": WHITE_COLOR.copy(),
                }
            )
            events.append(
                {
                    "timestamp_ms": started_at + pulse_ms,
                    "trigger_type": "preset",
                    "physical_id": physical_id,
                    "display_name_snapshot": f"LED {physical_id}",
                    "action": "off",
                    "active": False,
                }
            )

        return {
            "id": "preset-random",
            "name": "Random",
            "created_at": "2026-03-31T00:00:01+00:00",
            "started_at": "2026-03-31T00:00:01+00:00",
            "duration_ms": 5000,
            "loop_preference": False,
            "is_preset": True,
            "events": events,
        }

    def _led_lookup(self) -> dict[int, dict[str, Any]]:
        return {led["physical_id"]: led for led in self.layout["leds"]}

    def _record_event_at(
        self,
        physical_id: int,
        active: bool,
        source: str,
        elapsed_ms: float | None = None,
        color: list[int] | None = None,
    ) -> None:
        if not self.recording_session:
            return
        if source not in {"click", "keypress"}:
            return

        led = self._led_lookup()[physical_id]
        if elapsed_ms is None:
            elapsed_ms = (time.perf_counter() - self.recording_session["started_at"]) * 1000

        payload = {
            "timestamp_ms": round(elapsed_ms, 3),
            "trigger_type": source,
            "physical_id": physical_id,
            "display_name_snapshot": led.get("display_name", ""),
            "action": "on" if active else "off",
            "active": active,
        }
        if color is not None:
            payload["color"] = color
        self.recording_session["events"].append(payload)

    def _record_event(self, physical_id: int, active: bool, source: str, color: list[int] | None = None) -> None:
        self._record_event_at(physical_id, active, source, color=color)

    def _set_light_state(
        self,
        physical_id: int,
        active: bool,
        source: str,
        record_event: bool,
        color: list[int] | None = None,
    ) -> dict[str, Any]:
        if physical_id < 1 or physical_id > self.settings["led_count"]:
            raise ValueError("Unknown physical LED id.")

        previous_color = self.active_colors.get(physical_id)
        normalized_color = normalize_color(color) if active else None
        if active:
            self.active_ids.add(physical_id)
            self.active_colors[physical_id] = normalized_color or WHITE_COLOR.copy()
        else:
            self.active_ids.discard(physical_id)
            self.active_colors.pop(physical_id, None)
        self.driver.set_pixel(physical_id, active, color=normalized_color)

        if record_event:
            self._record_event(physical_id, active, source, color=normalized_color if active else previous_color)

        result = {
            "physical_id": physical_id,
            "active": active,
            "source": source,
            "active_leds": sorted(self.active_ids),
            "color": normalized_color if active else None,
        }
        logger.debug(
            "light state physical_id=%s active=%s source=%s record_event=%s active_leds=%s",
            physical_id,
            active,
            source,
            record_event,
            result["active_leds"],
        )
        return result

    def get_state(self) -> dict[str, Any]:
        with self.lock:
            recording_info = {
                "active": bool(self.recording_session),
                "started_at": self.recording_session["started_at_iso"] if self.recording_session else None,
                "event_count": len(self.recording_session["events"]) if self.recording_session else 0,
                "unsaved": self.unsaved_recording,
            }
            return {
                "settings": deepcopy(self.settings),
                "layout": deepcopy(self.layout),
                "active_leds": sorted(self.active_ids),
                "active_led_colors": deepcopy({physical_id: color for physical_id, color in self.active_colors.items()}),
                "recording": recording_info,
                "playback": deepcopy(self.playback_state),
                "recordings": self.storage.list_recordings(),
                "driver": {
                    "mode": self.driver.info.mode,
                    "detail": self.driver.info.detail,
                },
            }

    def save_settings(self, settings_update: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            normalized = self._normalize_settings({**self.settings, **(settings_update or {})})
            self.settings = normalized
            self.storage.save_settings(self.settings)
            self._refresh_driver_settings()
            logger.info(
                "save_settings brightness=%s active_leds=%s",
                self.settings["default_brightness"],
                sorted(self.active_ids),
            )
            return deepcopy(self.settings)

    def save_layout(self, layout: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            normalized = self._validate_layout(layout)
            self.layout = normalized
            self.storage.save_layout(self.layout)
            logger.info("save_layout completed updated_at=%s", self.layout.get("updated_at"))
            return deepcopy(self.layout)

    def toggle_light(self, physical_id: int, source: str = "click", color: list[int] | None = None) -> dict[str, Any]:
        with self.lock:
            return self._set_light_state(
                physical_id,
                active=physical_id not in self.active_ids,
                source=source,
                record_event=True,
                color=color,
            )

    def set_light(
        self,
        physical_id: int,
        active: bool,
        source: str = "click",
        color: list[int] | None = None,
    ) -> dict[str, Any]:
        with self.lock:
            return self._set_light_state(physical_id, active=active, source=source, record_event=True, color=color)

    def trigger_key(self, key: str, color: list[int] | None = None) -> dict[str, Any]:
        normalized_key = str(key).strip().upper()
        if not normalized_key:
            raise ValueError("Key is required.")

        with self.lock:
            physical_ids = [
                led["physical_id"]
                for led in self.layout["leds"]
                if led.get("key") == normalized_key
            ]
            if not physical_ids:
                raise ValueError(f"No lights are assigned to key '{normalized_key}'.")

            target_active = not all(physical_id in self.active_ids for physical_id in physical_ids)
            elapsed_ms = None
            if self.recording_session:
                elapsed_ms = (time.perf_counter() - self.recording_session["started_at"]) * 1000

            for physical_id in physical_ids:
                previous_color = deepcopy(self.active_colors.get(physical_id, WHITE_COLOR.copy()))
                self._set_light_state(
                    physical_id,
                    active=target_active,
                    source="keypress",
                    record_event=False,
                    color=color,
                )
                if self.recording_session:
                    event_color = normalize_color(color) if target_active else previous_color
                    self._record_event_at(
                        physical_id,
                        target_active,
                        "keypress",
                        elapsed_ms=elapsed_ms,
                        color=event_color,
                    )

            result = {
                "key": normalized_key,
                "physical_ids": physical_ids,
                "active": target_active,
                "active_leds": sorted(self.active_ids),
            }
            logger.info(
                "trigger_key key=%s physical_ids=%s active=%s active_leds=%s",
                normalized_key,
                physical_ids,
                target_active,
                result["active_leds"],
            )
            return result

    def all_off(self, source: str = "system") -> dict[str, Any]:
        with self.lock:
            self.active_ids.clear()
            self.active_colors.clear()
            self.driver.clear()
            logger.info("all_off source=%s", source)
            return {"active_leds": [], "source": source}

    def start_recording(self) -> dict[str, Any]:
        with self.lock:
            if self.playback_state["active"]:
                raise ValueError("Stop playback before recording.")
            self.unsaved_recording = None
            self.recording_session = {
                "started_at": time.perf_counter(),
                "started_at_iso": datetime.now(timezone.utc).isoformat(),
                "events": [],
            }
            logger.info("recording started at=%s", self.recording_session["started_at_iso"])
            return {
                "active": True,
                "started_at": self.recording_session["started_at_iso"],
            }

    def stop_recording(self) -> dict[str, Any]:
        with self.lock:
            if not self.recording_session:
                raise ValueError("No recording is currently active.")

            events = deepcopy(self.recording_session["events"])
            duration_ms = 0
            if events:
                duration_ms = events[-1]["timestamp_ms"]

            self.unsaved_recording = {
                "started_at": self.recording_session["started_at_iso"],
                "event_count": len(events),
                "duration_ms": duration_ms,
                "events": events,
            }
            self.recording_session = None
            logger.info(
                "recording stopped event_count=%s duration_ms=%s",
                self.unsaved_recording["event_count"],
                self.unsaved_recording["duration_ms"],
            )
            return deepcopy(self.unsaved_recording)

    def save_recording(self, name: str, loop_preference: bool = False) -> dict[str, Any]:
        with self.lock:
            if not self.unsaved_recording:
                raise ValueError("There is no stopped recording waiting to be saved.")

            clean_name = name.strip()
            if not clean_name:
                raise ValueError("Recording name is required.")

            timestamp = datetime.now(timezone.utc)
            record_id = f"{slugify(clean_name)}-{timestamp.strftime('%Y%m%d%H%M%S')}"
            payload = {
                "id": record_id,
                "name": clean_name,
                "created_at": timestamp.isoformat(),
                "started_at": self.unsaved_recording["started_at"],
                "duration_ms": self.unsaved_recording["duration_ms"],
                "loop_preference": bool(loop_preference),
                "events": deepcopy(self.unsaved_recording["events"]),
            }
            self.storage.save_recording(payload)
            self.unsaved_recording = None
            logger.info(
                "recording saved id=%s name=%s duration_ms=%s event_count=%s loop_preference=%s",
                payload["id"],
                payload["name"],
                payload["duration_ms"],
                len(payload["events"]),
                payload["loop_preference"],
            )
            return {
                "id": payload["id"],
                "name": payload["name"],
                "created_at": payload["created_at"],
                "duration_ms": payload["duration_ms"],
                "event_count": len(payload["events"]),
                "loop_preference": payload["loop_preference"],
            }

    def delete_recording(self, recording_id: str) -> dict[str, Any]:
        with self.lock:
            if self.playback_state["active"] and self.playback_state["recording_id"] == recording_id:
                self.stop_playback(clear_lights=True)

            recording = self.storage.load_recording(recording_id)
            if recording and recording.get("is_preset"):
                raise ValueError("Built-in presets cannot be deleted.")

            deleted = self.storage.delete_recording(recording_id)
            if not deleted:
                raise ValueError("Recording not found.")

            logger.info("recording deleted id=%s", recording_id)
            return {"deleted": True, "recording_id": recording_id}

    def start_playback(self, recording_id: str, loop: bool = False) -> dict[str, Any]:
        with self.lock:
            if self.recording_session:
                raise ValueError("Stop recording before playback.")
            if self.playback_state["active"]:
                self.stop_playback(clear_lights=False)

            recording = self.storage.load_recording(recording_id)
            if not recording:
                raise ValueError("Recording not found.")

            self.playback_stop_event = threading.Event()
            self.playback_state = {
                "active": True,
                "recording_id": recording["id"],
                "recording_name": recording["name"],
                "loop": bool(loop),
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            self.playback_thread = threading.Thread(
                target=self._run_playback,
                args=(deepcopy(recording), bool(loop), self.playback_stop_event),
                daemon=True,
            )
            self.playback_thread.start()
            logger.info(
                "playback started recording_id=%s recording_name=%s loop=%s event_count=%s",
                recording["id"],
                recording["name"],
                bool(loop),
                len(recording.get("events", [])),
            )
            return deepcopy(self.playback_state)

    def _run_playback(self, recording: dict[str, Any], loop: bool, stop_event: threading.Event) -> None:
        logger.info("playback thread running recording_id=%s loop=%s", recording.get("id"), loop)
        try:
            while not stop_event.is_set():
                self.driver.clear()
                with self.lock:
                    self.active_ids.clear()

                started_at = time.perf_counter()
                for event in recording.get("events", []):
                    target_time = float(event.get("timestamp_ms", 0)) / 1000
                    while not stop_event.is_set():
                        remaining = target_time - (time.perf_counter() - started_at)
                        if remaining <= 0:
                            break
                        time.sleep(min(remaining, 0.01))

                    if stop_event.is_set():
                        return

                    with self.lock:
                        self._set_light_state(
                            int(event["physical_id"]),
                            bool(event.get("active")),
                            source="playback",
                            record_event=False,
                            color=event.get("color"),
                        )

                if not loop:
                    logger.info("playback finished recording_id=%s loop=%s", recording.get("id"), loop)
                    return
        finally:
            with self.lock:
                self.playback_state = {
                    "active": False,
                    "recording_id": "",
                    "recording_name": "",
                    "loop": False,
                    "started_at": None,
                }

    def stop_playback(self, clear_lights: bool = True) -> dict[str, Any]:
        thread = None
        with self.lock:
            if self.playback_thread and self.playback_thread.is_alive():
                self.playback_stop_event.set()
                thread = self.playback_thread
            self.playback_state = {
                "active": False,
                "recording_id": "",
                "recording_name": "",
                "loop": False,
                "started_at": None,
            }

        if thread:
            thread.join(timeout=1.0)

        if clear_lights:
            self.all_off(source="system")

        with self.lock:
            self.playback_thread = None
            logger.info("playback stopped clear_lights=%s", clear_lights)
            return deepcopy(self.playback_state)
