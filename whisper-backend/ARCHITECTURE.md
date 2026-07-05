# Two-Server Whisper Architecture

## Problem
Single Whisper server was overloaded handling both continuous wake-word detection and real emergency SOS calls, causing long processing delays.

## Solution
Split into two specialized servers with priority synchronization:

### Architecture

```
┌─────────────────────────────────────────────────┐
│     Mobile App (Rapid Response)                  │
│     Port 5000 - Priority Router                  │
└────────┬──────────────────────┬──────────────────┘
         │                      │
         │ type=wake            │ type=sos
         ▼                      ▼
    ┌─────────────┐        ┌──────────────┐
    │  Port 5001  │        │  Port 5002   │
    │  WAKE       │        │  SOS/HOLD    │
    │  DETECTION  │        │  DETECTION   │
    ├─────────────┤        ├──────────────┤
    │ Model:tiny  │        │ Model: base  │
    │ Priority:   │        │ Priority:    │
    │ NORMAL      │        │ HIGH         │
    │             │        │              │
    │ Continuous  │◄───────┤ Preempts     │
    │ listening   │  Priority Signal      │
    └─────────────┘        └──────────────┘
```

## Servers

### 1. Priority Router (Port 5000)
**Entry point for all transcription requests**
- Routes requests to appropriate backend
- Load balancing
- Single API interface for mobile app
- Maintains request logs

**Endpoints:**
```
GET  /health      - Check all servers
POST /transcribe  - Main transcription (routes based on type parameter)
GET  /status      - Architecture status
GET  /logs        - Request logs
```

### 2. Wake Detection Server (Port 5001)
**Lightweight, continuous background listening**
- Uses `tiny` model (fast, lower accuracy but sufficient for wake words)
- Normal priority processing
- Handles continuous audio stream
- Can be paused if SOS is processing

**Characteristics:**
- Faster processing
- Lower memory usage
- Non-blocking for SOS requests

### 3. SOS Detection Server (Port 5002)
**High-priority emergency calls**
- Uses full `base` model (higher accuracy)
- Immediate processing
- Preempts wake detection
- Signals router of high-priority task

**Characteristics:**
- Higher accuracy for critical emergencies
- Full Whisper capabilities
- Real-time response

## Usage

### Start Servers
```bash
python start_servers.py
```

This launches:
1. Port 5002: SOS Server (starts first)
2. Port 5001: Wake Server
3. Port 5000: Priority Router

### Mobile App Integration

**For Wake Word Detection:**
```javascript
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('type', 'wake');

const response = await fetch('http://10.162.69.45:5000/transcribe', {
    method: 'POST',
    body: formData
});
```

**For SOS/Manual Hold Detection:**
```javascript
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('type', 'sos');

const response = await fetch('http://10.162.69.45:5000/transcribe', {
    method: 'POST',
    body: formData
});
```

### Request Headers (Optional)
```
X-Request-ID: <unique-request-id>  (for tracking, UUID generated if not provided)
```

### Response Format

**Success (200):**
```json
{
    "requestId": "uuid",
    "transcript": "help me now",
    "normalized": "help",
    "language": "en",
    "type": "wake_detection|sos_detection",
    "priority": "NORMAL|HIGH",
    "routed_to": "wake_server:5001|sos_server:5002",
    "processingTime": 2.34
}
```

**Error (4xx/5xx):**
```json
{
    "error": "description",
    "requestId": "uuid"
}
```

## Performance Improvements

### Before (Single Server)
- Wake detection blocked by SOS
- High latency for both
- CPU bottleneck

### After (Dual Server)
- SOS gets immediate processing
- Wake detection doesn't block emergencies
- Parallel processing capability
- Optimized models for each use case

## Configuration

### Model Selection
- **Wake Server (`tiny`)**: 39M parameters, 1.5s processing
- **SOS Server (`base`)**: 74M parameters, 3-5s processing (acceptable for emergencies)

### Server Locations
- Wake: `10.162.69.45:5001`
- SOS: `10.162.69.45:5002`
- Router: `10.162.69.45:5000`

## Environment Variables
Set in `.env`:
```
WHISPER_BASE_URL=http://10.162.69.45:5000
WAKE_SERVER_PORT=5001
SOS_SERVER_PORT=5002
ROUTER_PORT=5000
```

## Monitoring

### Health Check
```bash
curl http://10.162.69.45:5000/health
```

Response includes status of all three servers.

### Request Logs
```bash
curl http://10.162.69.45:5000/logs?limit=50
```

## Troubleshooting

### SOS not processing
- Check if SOS server is running on port 5002
- Verify network connectivity
- Check logs in SOS server terminal

### Wake detection slow
- Normal if SOS is processing (yields priority)
- Check if wake server on port 5001 is responding
- Verify router is running on port 5000

### Router returning 504
- A server is unresponsive
- Check individual server health at ports 5001 and 5002
- Restart all servers with `python start_servers.py`

## Logs

Each server logs with a prefix:
- `[ROUTER]` - Priority Router (port 5000)
- `[WAKE]` - Wake Detection Server (port 5001)
- `[SOS]` - SOS Detection Server (port 5002)

Format:
```
HH:MM:SS [PREFIX] LEVEL [RequestID] message
```

Example:
```
12:34:56 [SOS] INFO [abc-def-123] /transcribe/sos STARTED (HIGH PRIORITY)
```
