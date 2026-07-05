import { sleep, startRecording, stopRecording } from "./audio";
import {
  getBestTranscript,
  transcribeAudio,
  type TranscriptionResponse,
} from "./whisper";
import { detectWakePhrase, type WakeMatch } from "../utils/wakePhrases";

export type WakeTranscriptEvent = {
  iteration: number;
  transcript: string;
  response: TranscriptionResponse;
};

export type WakeDetectionEvent = WakeTranscriptEvent & {
  wakeMatch: WakeMatch;
};

export type WakeListenerOptions = {
  onWake: (event: WakeDetectionEvent) => Promise<void> | void;
  onTranscript?: (event: WakeTranscriptEvent) => void;
  onError?: (error: unknown) => void;
  shouldContinue?: () => boolean;
  chunkDurationMs?: number;
  loopDelayMs?: number;
  errorDelayMs?: number;
  triggerCooldownMs?: number;
  stopOnWake?: boolean;
};

export type WakeListenerController = {
  stop: (reason?: string) => Promise<void>;
  isRunning: () => boolean;
};

const WAKE_LOG_PREFIX = "[WakeListener]";
const DEFAULT_CHUNK_DURATION_MS = 3000;
const DEFAULT_LOOP_DELAY_MS = 250;
const DEFAULT_ERROR_DELAY_MS = 1000;
const DEFAULT_TRIGGER_COOLDOWN_MS = 8000;

const wakeState = {
  activeSessionId: 0,
  running: false,
  stopReason: "idle",
  lastTriggerAt: 0,
  activeTranscriptions: 0,
};

const isSessionActive = (sessionId: number) =>
  wakeState.running && wakeState.activeSessionId === sessionId;

export const getWakeListenerState = () => ({
  ...wakeState,
});

export const stopWakeListener = async (reason = "manual-stop") => {
  if (!wakeState.running) {
    console.log(`${WAKE_LOG_PREFIX} stop skipped reason=${reason}`);
    return;
  }

  wakeState.running = false;
  wakeState.stopReason = reason;
  console.log(`${WAKE_LOG_PREFIX} stop requested reason=${reason}`);

  await stopRecording(`wake-listener:${reason}`);
};

const runWakeLoop = async (
  sessionId: number,
  {
    onWake,
    onTranscript,
    onError,
    shouldContinue,
    chunkDurationMs = DEFAULT_CHUNK_DURATION_MS,
    loopDelayMs = DEFAULT_LOOP_DELAY_MS,
    errorDelayMs = DEFAULT_ERROR_DELAY_MS,
    triggerCooldownMs = DEFAULT_TRIGGER_COOLDOWN_MS,
    stopOnWake = true,
  }: WakeListenerOptions,
) => {
  let iteration = 0;

  while (isSessionActive(sessionId)) {
    const canContinue = shouldContinue ? shouldContinue() : true;

    if (!canContinue) {
      await sleep(loopDelayMs);
      continue;
    }

    iteration += 1;
    const context = `wake-listener#${sessionId}.${iteration}`;

    if (wakeState.activeTranscriptions >= 2) {
      console.log(`${WAKE_LOG_PREFIX} [${context}] dropping chunk to prevent backend overload`);
      await sleep(errorDelayMs);
      continue;
    }

    try {
      console.log(`${WAKE_LOG_PREFIX} [${context}] recording start`);
      await startRecording(context);

      await sleep(chunkDurationMs);

      if (!isSessionActive(sessionId)) {
        await stopRecording(`${context}:session-stopped`);
        break;
      }

      const uri = await stopRecording(context);
      console.log(`${WAKE_LOG_PREFIX} [${context}] recording uri=${uri ?? "null"}`);

      if (!uri) {
        console.log(`${WAKE_LOG_PREFIX} [${context}] no URI returned`);
        await sleep(errorDelayMs);
        continue;
      }

      // Fire and forget transcription to keep the mic open immediately for the next loop
      void (async () => {
        wakeState.activeTranscriptions += 1;
        try {
          const response = await transcribeAudio(uri, { context });
          const transcript = getBestTranscript(response);

          console.log(
            `${WAKE_LOG_PREFIX} [${context}] transcript="${transcript}" language=${response.language}`,
          );

          if (!isSessionActive(sessionId) && response.status !== 200) {
            return;
          }

          onTranscript?.({
            iteration,
            transcript,
            response,
          });

          const wakeMatch = detectWakePhrase(transcript);
          console.log(
            `${WAKE_LOG_PREFIX} [${context}] detection=${wakeMatch ? wakeMatch.canonicalPhrase : "none"}`,
          );

          if (!wakeMatch) {
            return;
          }

          const elapsedSinceLastTrigger = Date.now() - wakeState.lastTriggerAt;

          if (elapsedSinceLastTrigger < triggerCooldownMs) {
            console.log(
              `${WAKE_LOG_PREFIX} [${context}] ignored due to cooldown remainingMs=${triggerCooldownMs - elapsedSinceLastTrigger}`,
            );
            return;
          }

          wakeState.lastTriggerAt = Date.now();

          if (stopOnWake) {
            wakeState.running = false;
            wakeState.stopReason = "wake-detected";
            await stopRecording(`${context}:wake-interrupt`);
          }

          console.log(
            `${WAKE_LOG_PREFIX} [${context}] wake detected phrase=${wakeMatch.canonicalPhrase}`,
          );

          await onWake({
            iteration,
            transcript,
            response,
            wakeMatch,
          });
        } catch (error) {
          console.log(`${WAKE_LOG_PREFIX} [${context}] async loop error`, error);
          onError?.(error);
        } finally {
          wakeState.activeTranscriptions -= 1;
        }
      })();

      // Instantly loop around to start the next recording to avoid the "deaf window"
      await sleep(loopDelayMs);
    } catch (error) {
      console.log(`${WAKE_LOG_PREFIX} [${context}] loop error`, error);
      await stopRecording(`${context}:error-cleanup`);
      onError?.(error);
      await sleep(errorDelayMs);
    }
  }

  if (wakeState.activeSessionId === sessionId) {
    wakeState.running = false;
  }

  console.log(
    `${WAKE_LOG_PREFIX} session=${sessionId} stopped reason=${wakeState.stopReason}`,
  );
};

export const startWakeListener = (
  options: WakeListenerOptions,
): WakeListenerController => {
  if (wakeState.running) {
    console.log(`${WAKE_LOG_PREFIX} start skipped because listener is already running`);

    return {
      stop: stopWakeListener,
      isRunning: () => wakeState.running,
    };
  }

  wakeState.activeSessionId += 1;
  wakeState.running = true;
  wakeState.stopReason = "running";

  const sessionId = wakeState.activeSessionId;
  console.log(`${WAKE_LOG_PREFIX} session=${sessionId} started`);

  void runWakeLoop(sessionId, options);

  return {
    stop: stopWakeListener,
    isRunning: () => isSessionActive(sessionId),
  };
};
