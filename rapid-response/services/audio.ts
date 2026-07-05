import { Audio } from "expo-av";

let activeRecording: Audio.Recording | null = null;

const AUDIO_LOG_PREFIX = "[Audio]";

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isRecordingActive = () => activeRecording !== null;

export const startRecording = async (context = "unknown") => {
  console.log(`${AUDIO_LOG_PREFIX} [${context}] start requested`);

  if (activeRecording) {
    console.log(
      `${AUDIO_LOG_PREFIX} [${context}] start skipped because a recording is already active`,
    );
    return activeRecording;
  }

  const permission = await Audio.requestPermissionsAsync();
  console.log(
    `${AUDIO_LOG_PREFIX} [${context}] microphone permission granted=${permission.granted}`,
  );

  if (!permission.granted) {
    throw new Error("Microphone permission not granted");
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  activeRecording = recording;
  console.log(`${AUDIO_LOG_PREFIX} [${context}] recording started`);

  return recording;
};

export const stopRecording = async (context = "unknown") => {
  if (!activeRecording) {
    console.log(
      `${AUDIO_LOG_PREFIX} [${context}] stop skipped because no recording is active`,
    );
    return null;
  }

  const recording = activeRecording;
  activeRecording = null;

  try {
    const status = await recording.getStatusAsync();
    const durationMs =
      "durationMillis" in status && typeof status.durationMillis === "number"
        ? status.durationMillis
        : 0;

    console.log(
      `${AUDIO_LOG_PREFIX} [${context}] stopping recording durationMs=${durationMs}`,
    );

    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    console.log(
      `${AUDIO_LOG_PREFIX} [${context}] recording stopped uri=${uri ?? "null"}`,
    );

    return uri ?? null;
  } catch (error) {
    console.log(`${AUDIO_LOG_PREFIX} [${context}] stop failed`, error);
    return null;
  }
};
