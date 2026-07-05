import logging
import os
import re
import subprocess
import uuid
import threading

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
    format="%(asctime)s %(levelname)s %(message)s",
)

app = Flask(__name__)
app.logger.setLevel(logging.INFO)
model = whisper.load_model("base")
model_lock = threading.Lock()


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
    return jsonify({"ok": True, "model": "base"})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

    app.logger.info(
        "[%s] /transcribe started content_type=%s content_length=%s",
        request_id,
        request.content_type,
        request.content_length,
    )

    if "audio" not in request.files:
        app.logger.warning(
            "[%s] missing audio file keys=%s",
            request_id,
            list(request.files.keys()),
        )
        return jsonify({"error": "No audio file", "requestId": request_id}), 400

    uploaded_file = request.files["audio"]

    if not uploaded_file.filename:
        app.logger.warning("[%s] empty filename", request_id)
        return jsonify({"error": "Empty filename", "requestId": request_id}), 400

    input_path = f"input_{uuid.uuid4()}.tmp"
    output_path = f"output_{uuid.uuid4()}.wav"
    uploaded_file.save(input_path)

    try:
        input_size = os.path.getsize(input_path)
        app.logger.info(
            "[%s] file saved filename=%s mimetype=%s size=%s path=%s",
            request_id,
            uploaded_file.filename,
            uploaded_file.mimetype,
            input_size,
            input_path,
        )

        if input_size == 0:
            return (
                jsonify({"error": "Uploaded file is empty", "requestId": request_id}),
                400,
            )

        ffmpeg_process = subprocess.run(
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

        output_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        app.logger.info(
            "[%s] ffmpeg complete output=%s size=%s",
            request_id,
            output_path,
            output_size,
        )

        with model_lock:
            result = model.transcribe(
                output_path,
                initial_prompt="Emergency call.",
                fp16=False,
                temperature=0,
                condition_on_previous_text=False,
            )

        raw_text = (result.get("text") or "").strip()
        detected_lang = result.get("language", "unknown")
        filtered = filter_allowed_language(raw_text)
        normalized = normalize_text(filtered)

        if detected_lang not in ["en", "hi", "unknown"]:
            app.logger.warning(
                "[%s] unexpected language=%s raw=%r",
                request_id,
                detected_lang,
                raw_text,
            )

        app.logger.info(
            "[%s] whisper language=%s raw=%r filtered=%r normalized=%r",
            request_id,
            detected_lang,
            raw_text,
            filtered,
            normalized,
        )

        return jsonify(
            {
                "requestId": request_id,
                "transcript": filtered,
                "normalized": normalized,
                "language": detected_lang,
                "ffmpegReturnCode": ffmpeg_process.returncode,
            }
        )
    except subprocess.CalledProcessError as error:
        app.logger.exception("[%s] ffmpeg conversion failed", request_id)
        return (
            jsonify(
                {
                    "error": "ffmpeg conversion failed",
                    "details": error.stderr,
                    "requestId": request_id,
                }
            ),
            500,
        )
    except Exception as error:
        app.logger.exception("[%s] transcription failed", request_id)
        return jsonify({"error": str(error), "requestId": request_id}), 500
    finally:
        if os.path.exists(input_path):
            os.remove(input_path)

        if os.path.exists(output_path):
            os.remove(output_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=False, use_reloader=False)
