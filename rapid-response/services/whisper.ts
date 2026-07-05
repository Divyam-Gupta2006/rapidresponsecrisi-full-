const DEFAULT_WHISPER_BASE_URL =
  process.env.EXPO_PUBLIC_WHISPER_BASE_URL?.trim() ||
  "http://127.0.0.1:5000";

export const WHISPER_TRANSCRIBE_URL = `${DEFAULT_WHISPER_BASE_URL}/transcribe`;

export type TranscriptionResponse = {
  requestId: string;
  transcript: string;
  normalized: string;
  language: string;
  error?: string;
  status: number;
  elapsedMs: number;
};

type TranscribeAudioOptions = {
  context?: string;
  timeoutMs?: number;
  audioType?: "wake" | "sos"; // Priority routing: 'sos' gets high priority
};

const getAudioMimeType = (uri: string) => {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();

  if (extension === "wav") {
    return { name: "audio.wav", type: "audio/wav" };
  }

  if (extension === "mp3") {
    return { name: "audio.mp3", type: "audio/mpeg" };
  }

  return { name: "audio.m4a", type: "audio/mp4" };
};

export const getBestTranscript = (response: Partial<TranscriptionResponse>) =>
  response.normalized?.trim() || response.transcript?.trim() || "";

export const transcribeAudio = async (
  uri: string,
  options: TranscribeAudioOptions = {},
): Promise<TranscriptionResponse> => {
  if (!uri) {
    throw new Error("transcribeAudio called without a file URI");
  }

  const context = options.context ?? "unknown";
  const audioType = options.audioType ?? "wake"; // Default to wake detection
  const timeoutMs = options.audioType === "sos" ? 30000 : (options.timeoutMs ?? 15000); // SOS gets longer timeout
  const requestId = `${context}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const audioFile = getAudioMimeType(uri);
  const formData = new FormData();

  formData.append("audio", {
    uri,
    name: audioFile.name,
    type: audioFile.type,
  } as any);
  formData.append("type", audioType); // Send audio type for priority routing

  console.log(
    `[Whisper] [${requestId}] sending audio uri=${uri} endpoint=${WHISPER_TRANSCRIBE_URL}`,
  );

  try {
    const response = await fetch(WHISPER_TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        "X-Request-ID": requestId,
      },
      body: formData,
      signal: controller.signal,
    });

    const rawBody = await response.text();
    console.log(
      `[Whisper] [${requestId}] response status=${response.status} body=${rawBody}`,
    );

    let parsedBody: Record<string, unknown> = {};

    try {
      parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch (error) {
      console.log(`[Whisper] [${requestId}] failed to parse JSON`, error);
      throw new Error("Backend returned invalid JSON");
    }

    if (!response.ok) {
      const backendError =
        typeof parsedBody.error === "string"
          ? parsedBody.error
          : `Backend returned status ${response.status}`;
      throw new Error(backendError);
    }

    return {
      requestId:
        typeof parsedBody.requestId === "string"
          ? parsedBody.requestId
          : requestId,
      transcript:
        typeof parsedBody.transcript === "string" ? parsedBody.transcript : "",
      normalized:
        typeof parsedBody.normalized === "string"
          ? parsedBody.normalized
          : "",
      language:
        typeof parsedBody.language === "string" ? parsedBody.language : "unknown",
      error:
        typeof parsedBody.error === "string" ? parsedBody.error : undefined,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.log(`[Whisper] [${requestId}] request failed`, error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
