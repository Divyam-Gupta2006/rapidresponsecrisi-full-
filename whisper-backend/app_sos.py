"""
SOS/Manual Emergency Detection Server (Port 5002)
- High priority processing
- Real emergency calls (manual hold SOS)
- Uses full base model for accuracy
- Preempts wake detection
"""

import logging
import os
import re
import subprocess
import uuid
import threading
import queue
import requests
import time

import whisper
from flask import Flask, jsonify, request

FFMPEG_PATH = (
    r"C:\ffmpeg-2026-04-19-git-de18feb0f0-essentials_build"
    r"\ffmpeg-2026-04-19-git-de18feb0f0-essentials_build\bin\ffmpeg.exe"
)

os.environ["PATH"] = (
    r"C:\ffmpeg-2026-04-19-git-de18feb0f0-essentials_build"
    r"\ffmpeg-2026-04-19-git-de18feb0f0-essentials_build\bin;"
    + os.environ["PATH"]
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SOS] %(levelname)s %(message)s",
)

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# Use full base model for SOS (better accuracy)
model = whisper.load_model("base")
model_lock = threading.Lock()

# Priority signal to notify wake server
WAKE_SERVER_URL = "http://10.162.69.45:5001"
priority_signal_event = threading.Event()


def notify_wake_server():
    """Notify wake server that SOS is processing (high priority)"""
    try:
        requests.post(f"{WAKE_SERVER_URL}/set-priority", json={"priority": "SOS"}, timeout=1)
    except:
        pass  # Wake server might not be ready


def clear_priority():
    """Clear SOS priority signal"""
    try:
        requests.post(f"{WAKE_SERVER_URL}/clear-priority", timeout=1)
    except:
        pass


def normalize_text(text):
    text = text.lower()
    replacements = {
        "aag": "fire",
        "aag lag gayi": "fire",
        "jal raha": "fire",
        "jal gaya": "fire",
        "dhua": "smoke",
        "dhua hai": "smoke",
        "bachao": "help",
        "madad": "help",
        "chot": "injury",
        "khoon": "bleeding",
        "saans nahi aa rahi": "breathing problem",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def filter_allowed_language(text):
    allowed_pattern = r"[^a-zA-Z0-9\s\u0900-\u097F.,!?'-]"
    cleaned = re.sub(allowed_pattern, "", text)
    return cleaned.strip()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model": "base", "type": "sos_detection", "port": 5002})


@app.route("/set-priority", methods=["POST"])
def set_priority():
    """Endpoint for internal priority management"""
    priority_signal_event.set()
    return jsonify({"status": "priority_set"})


@app.route("/clear-priority", methods=["POST"])
def clear_priority_endpoint():
    """Endpoint to clear priority signal"""
    priority_signal_event.clear()
    return jsonify({"status": "priority_cleared"})


@app.route("/transcribe/sos", methods=["POST"])
def transcribe_sos():
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

    # Signal high priority - notify wake server
    notify_wake_server()

    app.logger.info(
        "[%s] /transcribe/sos STARTED (HIGH PRIORITY) content_type=%s",
        request_id,
        request.content_type,
    )

    if "audio" not in request.files:
        app.logger.warning("[%s] missing audio file", request_id)
        return jsonify({"error": "No audio file", "requestId": request_id}), 400

    uploaded_file = request.files["audio"]
    if not uploaded_file.filename:
        app.logger.warning("[%s] empty filename", request_id)
        return jsonify({"error": "Empty filename", "requestId": request_id}), 400

    input_path = f"input_sos_{uuid.uuid4()}.tmp"
    output_path = f"output_sos_{uuid.uuid4()}.wav"
    uploaded_file.save(input_path)

    try:
        input_size = os.path.getsize(input_path)
        app.logger.info("[%s] SOS file saved size=%s", request_id, input_size)

        if input_size == 0:
            return jsonify({"error": "Uploaded file is empty", "requestId": request_id}), 400

        start_time = time.time()
        
        subprocess.run(
            [
                FFMPEG_PATH,
                "-y",
                "-i",
                input_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                output_path,
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        with model_lock:
            result = model.transcribe(
                output_path,
                initial_prompt="Emergency SOS call.",
                fp16=False,
                temperature=0,
                condition_on_previous_text=False,
            )

        raw_text = (result.get("text") or "").strip()
        detected_lang = result.get("language", "unknown")
        filtered = filter_allowed_language(raw_text)
        normalized = normalize_text(filtered)
        
        processing_time = time.time() - start_time

        app.logger.info(
            "[%s] SOS detection complete text=%r normalized=%r time=%.2fs",
            request_id,
            filtered,
            normalized,
            processing_time,
        )

        return jsonify(
            {
                "requestId": request_id,
                "transcript": filtered,
                "normalized": normalized,
                "language": detected_lang,
                "type": "sos_detection",
                "priority": "HIGH",
                "processingTime": processing_time,
            }
        )
    except Exception as error:
        app.logger.exception("[%s] SOS detection FAILED", request_id)
        return jsonify({"error": str(error), "requestId": request_id}), 500
    finally:
        # Clear priority after processing
        clear_priority()
        
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, threaded=False, use_reloader=False)
