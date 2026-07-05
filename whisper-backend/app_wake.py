"""
Wake Word Detection Server (Port 5001)
- Lightweight, continuous background listening
- Lower priority processing
- Uses tiny model for speed
"""

import logging
import os
import re
import subprocess
import uuid
import threading
import queue
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
    format="%(asctime)s [WAKE] %(levelname)s %(message)s",
)

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# Use tiny model for wake detection (faster)
model = whisper.load_model("tiny")
model_lock = threading.Lock()

# Queue to detect if SOS server is processing
priority_queue = queue.Queue()


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


def check_sos_priority():
    """Check if SOS server has priority task"""
    try:
        status = priority_queue.get_nowait()
        if status == "SOS_PROCESSING":
            return True
    except queue.Empty:
        pass
    return False


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model": "tiny", "type": "wake_detection", "port": 5001})


@app.route("/transcribe/wake", methods=["POST"])
def transcribe_wake():
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

    # Check if SOS is processing (yield priority)
    if check_sos_priority():
        app.logger.info("[%s] SOS in processing, queuing wake detection", request_id)
        # Small delay to allow SOS to process
        time.sleep(0.5)

    app.logger.info(
        "[%s] /transcribe/wake started content_type=%s",
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

    input_path = f"input_wake_{uuid.uuid4()}.tmp"
    output_path = f"output_wake_{uuid.uuid4()}.wav"
    uploaded_file.save(input_path)

    try:
        input_size = os.path.getsize(input_path)
        app.logger.info("[%s] wake detection file saved size=%s", request_id, input_size)

        if input_size == 0:
            return jsonify({"error": "Uploaded file is empty", "requestId": request_id}), 400

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
                initial_prompt="Wake word.",
                fp16=False,
                temperature=0,
                condition_on_previous_text=False,
            )

        raw_text = (result.get("text") or "").strip()
        detected_lang = result.get("language", "unknown")
        filtered = filter_allowed_language(raw_text)
        normalized = normalize_text(filtered)

        app.logger.info(
            "[%s] wake detection complete text=%r normalized=%r",
            request_id,
            filtered,
            normalized,
        )

        return jsonify(
            {
                "requestId": request_id,
                "transcript": filtered,
                "normalized": normalized,
                "language": detected_lang,
                "type": "wake_detection",
            }
        )
    except Exception as error:
        app.logger.exception("[%s] wake detection failed", request_id)
        return jsonify({"error": str(error), "requestId": request_id}), 500
    finally:
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, threaded=False, use_reloader=False)
