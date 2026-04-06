from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .logging_utils import configure_logging, get_logger
from .service import LedControlService
from .storage import JsonStorage


configure_logging()
logger = get_logger("app")


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
ALLOWED_UPLOAD_SUFFIXES = {".png", ".jpg", ".jpeg"}
ALLOWED_UPLOAD_MIME_TYPES = {"image/png", "image/jpeg"}

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

storage = JsonStorage(BASE_DIR)
service = LedControlService(storage)
logger.info("flask app booted static_dir=%s", STATIC_DIR)


@app.errorhandler(ValueError)
def handle_value_error(error):
    logger.warning("value error path=%s error=%s", request.path, error)
    return jsonify({"error": str(error)}), 400


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/uploads/<path:filename>")
def uploads(filename: str):
    return send_from_directory(storage.uploads_dir, filename)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/state")
def state():
    return jsonify(service.get_state())


@app.post("/api/settings")
def save_settings():
    payload = request.get_json(force=True, silent=False) or {}
    return jsonify({"settings": service.save_settings(payload)})


@app.post("/api/layout")
def save_layout():
    payload = request.get_json(force=True, silent=False) or {}
    return jsonify({"layout": service.save_layout(payload)})


@app.post("/api/upload-image")
def upload_image():
    upload = request.files.get("image")
    if not upload:
        raise ValueError("No image file was uploaded.")
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise ValueError("Only PNG and JPEG images are supported.")
    mimetype = str(upload.mimetype or "").lower()
    if mimetype and mimetype not in ALLOWED_UPLOAD_MIME_TYPES:
        raise ValueError("Only PNG and JPEG images are supported.")
    filename = storage.store_upload(upload)
    return jsonify({"filename": filename, "url": f"/uploads/{filename}"})


@app.post("/api/lights/<int:physical_id>/toggle")
def toggle_light(physical_id: int):
    payload = request.get_json(silent=True) or {}
    source = payload.get("source", "click")
    return jsonify(service.toggle_light(physical_id, source=source, color=payload.get("color")))


@app.post("/api/lights/<int:physical_id>/set")
def set_light(physical_id: int):
    payload = request.get_json(force=True, silent=False) or {}
    if "active" not in payload:
        raise ValueError("Request body must include an 'active' value.")
    source = payload.get("source", "click")
    return jsonify(service.set_light(physical_id, bool(payload["active"]), source=source, color=payload.get("color")))


@app.post("/api/lights/all-off")
def all_off():
    payload = request.get_json(silent=True) or {}
    source = payload.get("source", "system")
    return jsonify(service.all_off(source=source))


@app.post("/api/keys/trigger")
def trigger_key():
    payload = request.get_json(force=True, silent=False) or {}
    return jsonify(service.trigger_key(payload.get("key", ""), color=payload.get("color")))


@app.post("/api/recordings/start")
def start_recording():
    return jsonify(service.start_recording())


@app.post("/api/recordings/stop")
def stop_recording():
    return jsonify(service.stop_recording())


@app.post("/api/recordings/save")
def save_recording():
    payload = request.get_json(force=True, silent=False) or {}
    return jsonify(
        service.save_recording(
            name=payload.get("name", ""),
            loop_preference=bool(payload.get("loop_preference", False)),
        )
    )


@app.get("/api/recordings")
def list_recordings():
    return jsonify({"recordings": storage.list_recordings()})


@app.get("/api/recordings/<recording_id>")
def get_recording(recording_id: str):
    recording = storage.load_recording(recording_id)
    if not recording:
        return jsonify({"error": "Recording not found."}), 404
    return jsonify(recording)


@app.delete("/api/recordings/<recording_id>")
def delete_recording(recording_id: str):
    return jsonify(service.delete_recording(recording_id))


@app.post("/api/playback/start")
def start_playback():
    payload = request.get_json(force=True, silent=False) or {}
    recording_id = payload.get("recording_id", "")
    if not recording_id:
        raise ValueError("recording_id is required.")
    return jsonify(
        service.start_playback(
            recording_id,
            loop=bool(payload.get("loop", False)),
            random_options=payload.get("random_options"),
        )
    )


@app.post("/api/playback/stop")
def stop_playback():
    return jsonify(service.stop_playback())


if __name__ == "__main__":
    logger.info("starting development server host=0.0.0.0 port=8000 debug=true")
    app.run(host="0.0.0.0", port=8000, debug=True)
