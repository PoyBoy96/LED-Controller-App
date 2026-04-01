from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from .defaults import make_default_layout, make_default_settings


class JsonStorage:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.data_dir = base_dir / "data"
        self.uploads_dir = self.data_dir / "uploads"
        self.recordings_dir = self.data_dir / "recordings"
        self.layout_path = self.data_dir / "layout.json"
        self.settings_path = self.data_dir / "settings.json"
        self._ensure_structure()

    def _ensure_structure(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.recordings_dir.mkdir(parents=True, exist_ok=True)

        if not self.settings_path.exists():
            self.save_settings(make_default_settings())

        settings = self.load_settings()
        if not self.layout_path.exists():
            self.save_layout(make_default_layout(settings["led_count"]))

    def _read_json(self, path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_json(self, path: Path, payload: Any) -> None:
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

    def load_settings(self) -> dict[str, Any]:
        return self._read_json(self.settings_path, make_default_settings())

    def save_settings(self, settings: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.settings_path, settings)
        return settings

    def load_layout(self) -> dict[str, Any]:
        settings = self.load_settings()
        return self._read_json(self.layout_path, make_default_layout(settings["led_count"]))

    def save_layout(self, layout: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.layout_path, layout)
        return layout

    def list_recordings(self) -> list[dict[str, Any]]:
        recordings: list[dict[str, Any]] = []
        for path in sorted(self.recordings_dir.glob("*.json"), reverse=True):
            payload = self._read_json(path, {})
            if not payload:
                continue
            recordings.append(
                {
                    "id": payload.get("id", path.stem),
                    "name": payload.get("name", path.stem),
                    "created_at": payload.get("created_at"),
                    "duration_ms": payload.get("duration_ms", 0),
                    "event_count": len(payload.get("events", [])),
                    "loop_preference": payload.get("loop_preference", False),
                    "is_preset": bool(payload.get("is_preset", False)),
                }
            )
        recordings.sort(key=lambda item: (item.get("is_preset", False), item.get("created_at") or ""), reverse=True)
        return recordings

    def load_recording(self, recording_id: str) -> dict[str, Any] | None:
        path = self.recordings_dir / f"{recording_id}.json"
        if not path.exists():
            return None
        return self._read_json(path, None)

    def save_recording(self, recording: dict[str, Any]) -> dict[str, Any]:
        record_id = recording["id"]
        path = self.recordings_dir / f"{record_id}.json"
        self._write_json(path, recording)
        return recording

    def delete_recording(self, recording_id: str) -> bool:
        path = self.recordings_dir / f"{recording_id}.json"
        if not path.exists():
            return False
        path.unlink()
        return True

    def store_upload(self, upload: FileStorage) -> str:
        original_name = secure_filename(upload.filename or "scene-image")
        stem = Path(original_name).stem or "scene-image"
        suffix = Path(original_name).suffix or ".png"
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        filename = f"{stem}-{timestamp}{suffix}"
        destination = self.uploads_dir / filename
        upload.save(destination)
        return filename
