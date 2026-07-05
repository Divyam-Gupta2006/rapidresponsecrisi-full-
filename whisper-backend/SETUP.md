# Dual-Server Whisper Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd whisper-backend
pip install -r requirements.txt
```

### 2. Start All Servers
```bash
python start_servers.py
```

This automatically starts:
- **Port 5002**: SOS Detection Server (base model, high accuracy)
- **Port 5001**: Wake Detection Server (tiny model, fast)
- **Port 5000**: Priority Router (main entry point)

### 3. Verify Servers are Running
```bash
curl http://10.162.69.45:5000/health
```

You should see all three servers responding.

## Architecture Overview

```
Client Request
    |
    v
Port 5000 - Priority Router
    |
    +----> type=wake -----> Port 5001 (Wake Server - Tiny Model)
    |                        Fast processing
    |                        Lower accuracy (OK for wake words)
    |
    +----> type=sos  -----> Port 5002 (SOS Server - Base Model)
                            Slower but more accurate
                            HIGH PRIORITY - preempts wake
```

## How Priority Works

### Wake Detection (Normal Priority)
- Used for continuous background listening
- Triggered by specific wake phrases
- Uses lightweight `tiny` model (1.5s processing)
- Can be paused if SOS is processing

**Request:**
```
POST /transcribe?type=wake
```

### SOS/Manual Emergency (HIGH Priority)
- Used when user holds the SOS button for emergencies
- Should respond immediately
- Uses full `base` model (3-5s, more accurate)
- Preempts wake detection
- Sends priority signal to wake server

**Request:**
```
POST /transcribe?type=sos
```

## Performance Specifications

| Metric | Wake (Tiny) | SOS (Base) |
|--------|------------|----------|
| Model Size | 39M params | 74M params |
| Processing Time | ~1.5s | ~3-5s |
| Accuracy | 85% | 95%+ |
| Priority | Normal | HIGH |
| Use Case | Background | Emergencies |

## API Examples

### Wake Word Detection
```javascript
const audio = await recordAudio(); // Returns Blob
const formData = new FormData();
formData.append('audio', audio);
formData.append('type', 'wake');

const response = await fetch('http://10.162.69.45:5000/transcribe', {
  method: 'POST',
  body: formData,
  headers: {
    'X-Request-ID': generateUUID() // Optional
  }
});

const result = await response.json();
// {
//   requestId: "...",
//   transcript: "help me now",
//   normalized: "help",
//   language: "en",
//   type: "wake_detection",
//   routed_to: "wake_server:5001"
// }
```

### SOS/Hold Emergency
```javascript
const audio = await recordSOS(); // Emergency audio
const formData = new FormData();
formData.append('audio', audio);
formData.append('type', 'sos');

const response = await fetch('http://10.162.69.45:5000/transcribe', {
  method: 'POST',
  body: formData,
  headers: {
    'X-Request-ID': generateUUID() // Optional
  }
});

const result = await response.json();
// {
//   requestId: "...",
//   transcript: "fire in building",
//   normalized: "fire",
//   language: "en",
//   type: "sos_detection",
//   priority: "HIGH",
//   routed_to: "sos_server:5002",
//   processingTime: 4.23
// }
```

## Mobile App Integration

The app already sends the correct audio types:

- **Wake confirmation**: `audioType: "wake"`
- **SOS emergency**: `audioType: "sos"`

See [services/whisper.ts](../rapid-response/services/whisper.ts) for implementation.

## Monitoring

### Check Server Status
```bash
# Full health check
curl http://10.162.69.45:5000/health | jq

# Wake server only
curl http://10.162.69.45:5001/health | jq

# SOS server only
curl http://10.162.69.45:5002/health | jq
```

### View Logs
```bash
# Last 50 requests
curl http://10.162.69.45:5000/logs?limit=50 | jq

# Architecture info
curl http://10.162.69.45:5000/status | jq
```

### Individual Server Logs
Each server logs with a prefix:
- `[ROUTER]` - Port 5000
- `[WAKE]` - Port 5001
- `[SOS]` - Port 5002

Example log output:
```
12:34:56 [ROUTER] INFO [req-123] routing transcription type=sos
12:34:56 [SOS] INFO [req-123] /transcribe/sos STARTED (HIGH PRIORITY)
12:34:56 [SOS] INFO [req-123] SOS file saved size=12345
12:35:00 [SOS] INFO [req-123] SOS detection complete text=... normalized=... time=4.23s
```

## Troubleshooting

### All servers not responding
```bash
# Check if any port is in use
netstat -tuln | grep -E "5000|5001|5002"

# Kill any processes on these ports (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Restart
python start_servers.py
```

### SOS server timeout
- Normal if base model is downloading (first time)
- Increase timeout in client: `timeoutMs: 60000`
- Check if torch/pytorch is still downloading

### Wake server not responding
- SOS might be processing (normal)
- Check logs: `[WAKE]` prefix
- Verify port 5001 is listening

### Priority not working (wake still blocking SOS)
- Check if requests have proper `type` parameter
- Verify `formData.append('type', 'sos')`
- Check router logs: should show "routing to SOS server"

## Configuration

### Change Whisper Models
Edit `app_wake.py` and `app_sos.py`:

```python
# Wake server - use tiny for speed
model = whisper.load_model("tiny")

# SOS server - use base for accuracy
model = whisper.load_model("base")
```

Options: tiny, base, small, medium, large

### Change Server Ports
Edit `priority_sync.py`:
```python
WAKE_SERVER = "http://10.162.69.45:5001"  # Change port here
SOS_SERVER = "http://10.162.69.45:5002"   # Change port here
```

### Change IP Address
Update in:
1. `.env` file (EXPO_PUBLIC_WHISPER_BASE_URL)
2. `priority_sync.py` (WAKE_SERVER, SOS_SERVER)
3. `app_sos.py` (WAKE_SERVER_URL)

## Performance Tuning

### For Better Wake Detection Accuracy
- Change wake server model: `"tiny"` → `"base"`
- Reduces speed (trade-off)

### For Faster SOS Processing
- Change SOS server model: `"base"` → `"small"`
- Reduces accuracy (trade-off)

### For Lower Memory Usage
- Use smaller models: `"tiny"` for wake, `"small"` for SOS
- Acceptable for emergency response

## Files Reference

- `app_wake.py` - Wake detection server (port 5001)
- `app_sos.py` - SOS detection server (port 5002)
- `priority_sync.py` - Priority router (port 5000)
- `start_servers.py` - Startup script for all servers
- `requirements.txt` - Python dependencies
- `ARCHITECTURE.md` - Detailed architecture documentation

## Next Steps

1. ✅ Setup complete
2. Start servers: `python start_servers.py`
3. Verify health: `curl http://10.162.69.45:5000/health`
4. Run mobile app
5. Test wake detection and SOS emergency paths
6. Monitor logs for issues
