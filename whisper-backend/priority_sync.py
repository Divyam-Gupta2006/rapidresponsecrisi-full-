"""
Priority Synchronization Manager (Port 5000)
Routes requests to appropriate servers:
- SOS/Manual emergency calls -> app_sos.py (port 5002, HIGH PRIORITY)
- Wake word detection -> app_wake.py (port 5001, NORMAL PRIORITY)

Maintains load balancing and prevents wake detection from blocking SOS
"""

import logging
import requests
import json
from flask import Flask, jsonify, request
import uuid

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [ROUTER] %(levelname)s %(message)s",
)

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

WAKE_SERVER = "http://10.162.69.45:5001"
SOS_SERVER = "http://10.162.69.45:5002"

# Request tracking for debugging
request_log = []


@app.route("/health", methods=["GET"])
def health():
    try:
        wake_health = requests.get(f"{WAKE_SERVER}/health", timeout=2).json()
    except:
        wake_health = {"status": "unreachable"}

    try:
        sos_health = requests.get(f"{SOS_SERVER}/health", timeout=2).json()
    except:
        sos_health = {"status": "unreachable"}

    return jsonify(
        {
            "ok": True,
            "router": "priority_sync",
            "port": 5000,
            "wake_server": wake_health,
            "sos_server": sos_health,
        }
    )


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """Main transcription endpoint - routes based on audio type"""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    audio_type = request.form.get("type", "wake").lower()  # 'wake' or 'sos'

    app.logger.info(
        "[%s] routing transcription type=%s",
        request_id,
        audio_type,
    )

    try:
        if audio_type == "sos":
            app.logger.info("[%s] routing to SOS server (HIGH PRIORITY)", request_id)
            
            # Forward to SOS server (high priority)
            response = requests.post(
                f"{SOS_SERVER}/transcribe/sos",
                files={"audio": request.files["audio"]},
                headers={"X-Request-ID": request_id},
                timeout=120,
            )
            
            result = response.json()
            result["routed_to"] = "sos_server:5002"
            return jsonify(result), response.status_code

        else:  # wake or default
            app.logger.info("[%s] routing to WAKE server (NORMAL PRIORITY)", request_id)
            
            # Forward to WAKE server
            response = requests.post(
                f"{WAKE_SERVER}/transcribe/wake",
                files={"audio": request.files["audio"]},
                headers={"X-Request-ID": request_id},
                timeout=30,
            )
            
            result = response.json()
            result["routed_to"] = "wake_server:5001"
            return jsonify(result), response.status_code

    except requests.Timeout:
        app.logger.error("[%s] server timeout type=%s", request_id, audio_type)
        return (
            jsonify(
                {
                    "error": "Processing server timeout",
                    "requestId": request_id,
                    "type": audio_type,
                }
            ),
            504,
        )
    except Exception as e:
        app.logger.exception("[%s] routing error", request_id)
        return jsonify({"error": str(e), "requestId": request_id}), 500


@app.route("/status", methods=["GET"])
def status():
    """Get status of all servers"""
    return jsonify(
        {
            "router": "priority_sync",
            "wake_server": f"{WAKE_SERVER} (port 5001, lightweight wake detection)",
            "sos_server": f"{SOS_SERVER} (port 5002, high-priority emergencies)",
            "description": "SOS requests bypass queue and get immediate processing",
        }
    )


@app.route("/logs", methods=["GET"])
def get_logs():
    """Get recent request logs"""
    limit = request.args.get("limit", 20, type=int)
    return jsonify({"logs": request_log[-limit:]})


if __name__ == "__main__":
    app.logger.info("Starting Priority Sync Router on port 5000")
    app.logger.info("Wake Server: %s:5001 (tiny model, continuous listening)", WAKE_SERVER.split("://")[1])
    app.logger.info("SOS Server: %s:5002 (base model, high priority)", SOS_SERVER.split("://")[1])
    app.run(host="0.0.0.0", port=5000, threaded=True, use_reloader=False)
