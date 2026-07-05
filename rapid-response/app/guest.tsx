import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import {
  BrainCircuit,
  CheckCircle2,
  Clock,
  Mic,
  PhoneCall,
  ShieldAlert,
  User,
} from "lucide-react-native";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { sleep, startRecording, stopRecording } from "../services/audio";
import { processVoice } from "../services/voiceai/processVoice";
import { getBestTranscript, transcribeAudio } from "../services/whisper";
import {
  startWakeListener,
  type WakeDetectionEvent,
  type WakeListenerController,
} from "../services/wakeListener";
import { detectWakePhrase } from "../utils/wakePhrases";

const getGuestLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.log("[Guest] location permission denied");
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    console.log(`[Guest] location lat=${loc.coords.latitude} lng=${loc.coords.longitude}`);
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch (error) {
    console.log("[Guest] location error", error);
    return null;
  }
};

const { width } = Dimensions.get("window");

const POSITIVE_CONFIRMATIONS = [
  "yes",
  "yes help",
  "help",
  "i need help",
  "send help",
  "confirm",
];

const NEGATIVE_CONFIRMATIONS = [
  "no",
  "cancel",
  "false alarm",
  "i am safe",
  "not now",
];

type TriggerSOSOptions = {
  source: "manual-hold" | "wake-confirmed";
  useCurrentRecording?: boolean;
  transcriptOverride?: string;
};

const normalizeVoiceCommand = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getConfirmationDecision = (text: string) => {
  const normalized = normalizeVoiceCommand(text);

  if (!normalized) {
    return "unknown";
  }

  if (NEGATIVE_CONFIRMATIONS.some((phrase) => normalized.includes(phrase))) {
    return "cancel";
  }

  if (
    POSITIVE_CONFIRMATIONS.some((phrase) => normalized.includes(phrase)) ||
    detectWakePhrase(normalized)
  ) {
    return "confirm";
  }

  return "unknown";
};

const speakText = async (text: string) => {
  console.log(`[Speech] Starting TTS: "${text}"`);
  
  // Ensure Audio Mode is set for playback so it isn't muted by lingering recording modes
  try {
    const { Audio } = require("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    // Ignore if Audio is not available
  }

  return new Promise<void>((resolve) => {
    let settled = false;

    const finish = (reason: string) => {
      if (settled) {
        return;
      }

      console.log(`[Speech] TTS finished: ${reason}`);
      settled = true;
      resolve();
    };

    Speech.stop();
    Speech.speak(text, {
      rate: 0.95,
      pitch: 1,
      onDone: () => finish("done"),
      onStopped: () => finish("stopped"),
      onError: (e) => {
        console.log(`[Speech] TTS error`, e);
        finish("error");
      },
    });
  });
};

let geminiBlockedUntil = 0;

export default function Guest() {
  const [user, setUser] = useState<any>({});
  const [sosActive, setSosActive] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [myIncident, setMyIncident] = useState<any>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastAI, setLastAI] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmStepText, setConfirmStepText] = useState("");

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const holdScale = useRef(new Animated.Value(1)).current;
  const wakeControllerRef = useRef<WakeListenerController | null>(null);
  const startWakeListenerIfNeededRef = useRef<() => void>(() => {});
  const userRef = useRef(user);
  const sosActiveRef = useRef(sosActive);
  const isHoldingRef = useRef(isHolding);
  const isProcessingRef = useRef(isProcessing);

  const updateSosActive = (value: boolean) => {
    sosActiveRef.current = value;
    setSosActive(value);
  };

  const updateIsHolding = (value: boolean) => {
    isHoldingRef.current = value;
    setIsHolding(value);
  };

  const updateIsProcessing = (value: boolean) => {
    isProcessingRef.current = value;
    setIsProcessing(value);
  };

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    sosActiveRef.current = sosActive;
  }, [sosActive]);

  useEffect(() => {
    isHoldingRef.current = isHolding;
  }, [isHolding]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      const data = await AsyncStorage.getItem("user");

      if (!data) {
        return;
      }

      const parsed = JSON.parse(data);
      setUser(parsed);

      const incidentQuery = query(
        collection(db, "incidents"),
        where("guestId", "==", parsed.guestId),
        where("status", "==", "ACTIVE"),
      );

      unsubscribe = onSnapshot(incidentQuery, (snap) => {
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const incident = docSnap.data();

          setMyIncident({ id: docSnap.id, ...incident });
          setLastTranscript(incident.transcript || "");
          setLastAI({
            aiSummary: incident.aiSummary,
            type: incident.type,
            priority: incident.priority,
            source: incident.source,
          });
          updateSosActive(true);
          return;
        }

        updateSosActive(false);
        setMyIncident(null);
      });
    };

    void init();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const callGemini = async (text: string, retry = 0) => {
    const safeText = text || "";

    if (Date.now() < geminiBlockedUntil) {
      return {
        ...processVoice(safeText),
        source: "fallback",
      };
    }

    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    const model = models[retry] || models[0];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=AIzaSyA3Rb1lJOOeTkdwnxvilQgeUA`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Return ONLY JSON.

Transcript:
"${safeText}"

{
"type": "FIRE | MEDICAL | SECURITY | PANIC | OTHER",
"priority": "HIGH | MEDIUM | LOW",
"summary": "one sentence summary",
"keywords": ["keyword1", "keyword2"],
"detectedLanguage": "English | Hindi | Other",
"emotionalTone": "Calm | Panicked | Aggressive | Distressed",
"victimCount": 0,
"weaponDetected": false,
"medicalCondition": "None | Bleeding | Unconscious | Difficulty Breathing | etc",
"isFalseAlarm": false
}

Note: Return ONLY the raw JSON object. Do not include markdown formatting or explanations. If you are unsure, provide your best guess based on the transcript.`,
                  },
                ],
              },
            ],
          }),
        },
      );

      const data = await res.json();
      console.log("RAW GEMINI:", data);

      if (data.error) {
        if (data.error.code === 429) {
          geminiBlockedUntil = Date.now() + 20000;
        }

        if (retry < 1) {
          return await callGemini(safeText, retry + 1);
        }

        throw new Error(data.error.message);
      }

      if (!data.candidates?.length) {
        throw new Error("No candidates");
      }

      let output = data.candidates[0]?.content?.parts?.[0]?.text;

      if (!output) {
        throw new Error("Empty output");
      }

      output = output
        .replace(/```json|```/g, "")
        .replace(/^[^{]*/, "")
        .replace(/[^}]*$/, "")
        .trim();

      const parsed = JSON.parse(output);

      return {
        type: parsed.type || "OTHER",
        priority: parsed.priority || "LOW",
        aiSummary: parsed.summary || "",
        keywords: parsed.keywords || [],
        detectedLanguage: parsed.detectedLanguage || "Unknown",
        emotionalTone: parsed.emotionalTone || "Neutral",
        victimCount: parsed.victimCount || 0,
        weaponDetected: !!parsed.weaponDetected,
        medicalCondition: parsed.medicalCondition || "None",
        isFalseAlarm: !!parsed.isFalseAlarm,
        source: "gemini",
      };
    } catch (error) {
      console.log("Gemini failed -> fallback", error);

      const fallbackResult = processVoice(safeText);
      return {
        type: fallbackResult.type || "OTHER",
        priority: fallbackResult.priority || "LOW",
        aiSummary: fallbackResult.aiSummary || "Distress detected",
        keywords: [],
        detectedLanguage: "Unknown",
        emotionalTone: "Distressed",
        victimCount: 1,
        weaponDetected: false,
        medicalCondition: "Unknown",
        isFalseAlarm: false,
        source: "fallback",
      };
    }
  };

  const stopWakeListenerSession = async (reason: string) => {
    const controller = wakeControllerRef.current;

    if (!controller) {
      return;
    }

    wakeControllerRef.current = null;
    await controller.stop(reason);
  };

  startWakeListenerIfNeededRef.current = () => {
    if (!userRef.current?.guestId) {
      return;
    }

    if (sosActiveRef.current || isProcessingRef.current || isHoldingRef.current) {
      return;
    }

    if (wakeControllerRef.current?.isRunning()) {
      return;
    }

    wakeControllerRef.current = startWakeListener({
      chunkDurationMs: 2000,
      loopDelayMs: 250,
      errorDelayMs: 1000,
      triggerCooldownMs: 10000,
      shouldContinue: () =>
        !sosActiveRef.current &&
        !isProcessingRef.current &&
        !isHoldingRef.current,
      onTranscript: ({ iteration, transcript, response }) => {
        console.log(
          `[Guest] wake transcript iteration=${iteration} text="${transcript}" requestId=${response.requestId}`,
        );
      },
      onError: (error) => {
        console.log("[Guest] wake listener error", error);
      },
      onWake: async (event) => {
        await handleWakeFlow(event);
      },
    });
  };

  const captureConfirmationTranscript = async (durationMs = 2500) => {
    await startRecording("wake-confirmation");
    await sleep(durationMs);

    const uri = await stopRecording("wake-confirmation");
    console.log(`[Guest] confirmation recording uri=${uri ?? "null"}`);

    if (!uri) {
      return "";
    }

    try {
      const response = await transcribeAudio(uri, {
        context: "wake-confirmation",
        audioType: "wake", // Normal priority for wake word confirmation
      });
      const transcript = getBestTranscript(response);

      console.log(
        `[Guest] confirmation transcript="${transcript}" requestId=${response.requestId} language=${response.language}`,
      );

      return transcript;
    } catch (error) {
      console.log("[Guest] confirmation transcription failed", error);
      return "";
    }
  };

  const triggerSOS = async ({
    source,
    useCurrentRecording = false,
    transcriptOverride,
  }: TriggerSOSOptions) => {
    const activeUser = userRef.current;

    if (!activeUser?.guestId) {
      console.log(`[Guest] SOS skipped source=${source} reason=no-user`);
      return;
    }

    if (sosActiveRef.current || isProcessingRef.current) {
      console.log(
        `[Guest] SOS skipped source=${source} reason=already-active`,
      );
      return;
    }

    await stopWakeListenerSession(`trigger-sos:${source}`);
    updateIsProcessing(true);
    updateSosActive(true);

    let incidentCreated = false;
    let uri: string | null = null;
    let transcript = transcriptOverride?.trim() || "Manual trigger";

    try {
      if (useCurrentRecording && !transcriptOverride) {
        uri = await stopRecording(`sos:${source}`);
        console.log(`[Guest] SOS recording uri=${uri ?? "null"}`);

        if (uri) {
          try {
            const response = await transcribeAudio(uri, {
              context: `sos:${source}`,
              audioType: "sos", // HIGH PRIORITY for SOS emergencies
              timeoutMs: 30000, // Allow longer processing time for accuracy
            });

            transcript = getBestTranscript(response) || transcript;
            console.log(
              `[Guest] SOS transcript="${transcript}" requestId=${response.requestId} language=${response.language}`,
            );
          } catch (error) {
            console.log("[Guest] SOS transcription failed", error);
          }
        } else {
          console.log("[Guest] SOS proceeding without audio transcript");
        }
      } else if (transcriptOverride) {
        console.log(
          `[Guest] SOS using wake transcript override="${transcript}" source=${source}`,
        );
      }

      const [aiResult, guestLocation] = await Promise.all([
        callGemini(transcript),
        getGuestLocation(),
      ]);

      setLastTranscript(transcript);
      setLastAI(aiResult);

      await addDoc(collection(db, "incidents"), {
        guestId: activeUser.guestId || "unknown",
        name: activeUser.name || "Anonymous",
        room: activeUser.room || "Unknown",
        phone: activeUser.phone || "",
        guestLocation: guestLocation || null,
        transcript: transcript || "No transcript",
        aiSummary: aiResult.aiSummary || "Emergency reported",
        type: aiResult.type || "OTHER",
        priority: aiResult.priority || "LOW",
        keywords: aiResult.keywords || [],
        detectedLanguage: aiResult.detectedLanguage || "Unknown",
        emotionalTone: aiResult.emotionalTone || "Neutral",
        victimCount: aiResult.victimCount || 0,
        weaponDetected: !!aiResult.weaponDetected,
        medicalCondition: aiResult.medicalCondition || "None",
        isFalseAlarm: !!aiResult.isFalseAlarm,
        source: aiResult.source || "unknown",
        status: "ACTIVE",
        assignedTo: null,
        assignedName: null,
        assignedPhone: null,
        distanceKm: null,
        eta: null,
        assignedAt: null,
        acceptedAt: null,
        enRouteAt: null,
        resolvedAt: null,
        resolvedBy: null,
        timestamp: serverTimestamp(),
      });

      incidentCreated = true;
      console.log(`[Guest] SOS incident created source=${source}`);
    } catch (error) {
      console.log(`[Guest] SOS error source=${source}`, error);

      if (!incidentCreated) {
        updateSosActive(false);
      }
    } finally {
      updateIsProcessing(false);

      if (!incidentCreated && !sosActiveRef.current) {
        startWakeListenerIfNeededRef.current();
      }
    }
  };

  const handleWakeFlow = async (event: WakeDetectionEvent) => {
    console.log(
      `🚨🔥 WAKE WORD DETECTED: [${event.wakeMatch.canonicalPhrase}] Transcript: "${event.transcript}"`,
    );

    await stopWakeListenerSession("wake-confirmation");

    if (sosActiveRef.current || isProcessingRef.current) {
      console.log("[Guest] wake flow skipped because SOS is already active");
      return;
    }

    try {
      setIsConfirming(true);
      setConfirmStepText("Are you in distress?");
      await speakText("Are you in distress? Say yes to confirm.");
      await sleep(250);

      const confirmationTranscript = await captureConfirmationTranscript(2500);
      const decision = getConfirmationDecision(confirmationTranscript);

      console.log(
        `[Guest] confirmation decision=${decision} transcript="${confirmationTranscript}"`,
      );

      if (decision === "confirm") {
        setConfirmStepText("Please speak your concern...");
        await speakText("Please speak your concern.");
        await sleep(250);

        const concernTranscript = await captureConfirmationTranscript(5000);

        console.log(`[Guest] concern captured="${concernTranscript}"`);

        await triggerSOS({
          source: "wake-confirmed",
          transcriptOverride: concernTranscript || "User confirmed distress verbally but no concern was transcribed.",
        });
        return;
      }

      setConfirmStepText("Canceled");
      await speakText("False alarm. Canceling distress call.");
    } catch (error) {
      console.log("[Guest] wake flow error", error);
    } finally {
      setIsConfirming(false);
    }

    startWakeListenerIfNeededRef.current();
  };

  useEffect(() => {
    if (user?.guestId && !sosActive && !isProcessing && !isHolding) {
      startWakeListenerIfNeededRef.current();
      return;
    }

    void stopWakeListenerSession("screen-state-blocked");
  }, [user?.guestId, sosActive, isProcessing, isHolding]);

  useEffect(() => {
    return () => {
      Speech.stop();

      const controller = wakeControllerRef.current;
      wakeControllerRef.current = null;

      if (controller) {
        void controller.stop("guest-unmount");
      }
    };
  }, []);

  const handleHoldStart = async () => {
    if (isHoldingRef.current || isProcessingRef.current) {
      return;
    }

    await stopWakeListenerSession("manual-hold-start");
    await sleep(100);

    updateIsHolding(true);
    Animated.spring(holdScale, { toValue: 0.9, useNativeDriver: true }).start();

    try {
      await startRecording("manual-hold");
    } catch (error) {
      console.log("[Guest] manual recording start failed", error);
      updateIsHolding(false);
      Animated.spring(holdScale, { toValue: 1, useNativeDriver: true }).start();
      startWakeListenerIfNeededRef.current();
    }
  };

  const handleHoldEnd = async () => {
    if (!isHoldingRef.current) {
      return;
    }

    updateIsHolding(false);
    Animated.spring(holdScale, { toValue: 1, useNativeDriver: true }).start();

    await triggerSOS({
      source: "manual-hold",
      useCurrentRecording: true,
    });
  };

  const markSafe = async () => {
    if (myIncident?.id) {
      await updateDoc(doc(db, "incidents", myIncident.id), {
        status: "RESOLVED",
      });
    }

    updateSosActive(false);
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "HIGH") return "#FF3B30";
    if (priority === "MEDIUM") return "#FF9500";
    return "#4ADE80";
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={styles.safeArea}>
        {isConfirming && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmBox}>
              <Mic color="#D90429" size={56} style={{ marginBottom: 15 }} />
              <Text style={[styles.alertHeader, { fontSize: 28, textAlign: "center" }]}>
                WAKE WORD DETECTED
              </Text>
              <Text style={[styles.alertSub, { textAlign: "center", color: "#fff", marginTop: 10 }]}>
                {confirmStepText || "Are you in distress?"}
              </Text>
              <Text style={[styles.instruction, { textAlign: "center", marginTop: 15 }]}>
                {confirmStepText.includes("concern")
                  ? "Speak clearly..."
                  : "Say \"yes\" or \"help\" loudly..."}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>
              LOCATION: ROOM {user?.room || "---"}
            </Text>
            <Text style={styles.title}>{user?.name || "Guest"}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { borderColor: sosActive ? "#D90429" : "#4ADE80" },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: sosActive ? "#D90429" : "#4ADE80" },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: sosActive ? "#D90429" : "#4ADE80" },
              ]}
            >
              {sosActive
                ? myIncident?.status === "EN_ROUTE"
                  ? "RESPONDING"
                  : myIncident?.status === "ACCEPTED"
                  ? "ACCEPTED"
                  : "EMERGENCY"
                : "ENCRYPTED"}
            </Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          {!sosActive ? (
            <View style={styles.centerBox}>
              <View style={styles.sosContainer}>
                <Animated.View
                  style={[
                    styles.sosHalo,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: isHolding ? 0 : 0.4,
                    },
                  ]}
                />

                <Animated.View style={{ transform: [{ scale: holdScale }] }}>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.sos, isHolding && styles.sosHolding]}
                    onPressIn={() => {
                      void handleHoldStart();
                    }}
                    onPressOut={() => {
                      void handleHoldEnd();
                    }}
                  >
                    {isHolding ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <ShieldAlert color="#fff" size={56} strokeWidth={2.5} />
                    )}
                    <Text style={styles.sosText}>
                      {isHolding ? "LISTENING" : "SOS"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.instructionContainer}>
                <Mic color="#666" size={16} />
                <Text style={styles.instruction}>
                  Hold for 1.5s to describe emergency
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.activeContainer}>
              <Text style={styles.alertHeader}>HELP IS COMING</Text>
              <Text style={styles.alertSub}>
                Real-time location tracking active.
              </Text>

              <View style={styles.aiBox}>
                <View style={styles.aiHeader}>
                  <BrainCircuit color="#4ADE80" size={16} />
                  <Text style={styles.aiTitle}>AI SITUATION ANALYSIS</Text>
                  <View
                    style={[
                      styles.priorityTag,
                      { backgroundColor: getPriorityColor(lastAI?.priority) },
                    ]}
                  >
                    <Text style={styles.priorityText}>
                      {lastAI?.priority || "LOW"}
                    </Text>
                  </View>
                </View>

                <View style={styles.transcriptContainer}>
                  <Text style={styles.transcriptLabel}>TRANSCRIPT</Text>
                  <Text style={styles.aiTranscript}>
                    {`"${lastTranscript || "Manual SOS trigger detected."}"`}
                  </Text>
                </View>

                <Text style={styles.aiSummary}>
                  AI: {lastAI?.aiSummary || "Analyzing threat level..."}
                </Text>

                <View style={styles.aiFooter}>
                  <Text style={styles.metaLabel}>
                    TYPE: <Text style={styles.metaValue}>{lastAI?.type}</Text>
                  </Text>
                  <View style={styles.divider} />
                  <Text style={styles.metaLabel}>
                    SOURCE:{" "}
                    <Text style={styles.metaValue}>
                      {lastAI?.source?.toUpperCase()}
                    </Text>
                  </Text>
                </View>
              </View>

              <View style={styles.glassCard}>
                <Text style={styles.cardLabel}>ASSIGNED RESPONDER</Text>
                <View style={styles.responderRow}>
                  <View style={styles.avatarBox}>
                    <User color="#fff" size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staffName}>
                      {myIncident?.assignedName || "Dispatching Unit..."}
                    </Text>
                    <View style={styles.etaRow}>
                      <Clock size={14} color="#4ADE80" />
                      <Text style={styles.etaText}>
                        {" "}
                        {myIncident?.eta || "Calculating..."}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.callCircle}>
                    <PhoneCall size={20} color="#4ADE80" fill="#4ADE80" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.safeBtn}
                onPress={() => {
                  void markSafe();
                }}
                activeOpacity={0.7}
              >
                <CheckCircle2 color="#4ADE80" size={20} />
                <Text style={styles.safeText}>I AM NOW SAFE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  safeArea: { flex: 1, paddingHorizontal: 25 },

  confirmOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(5,5,5,0.9)",
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmBox: {
    backgroundColor: "#111",
    padding: 30,
    width: "100%",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#D90429",
    alignItems: "center",
    elevation: 20,
    shadowColor: "#D90429",
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },

  header: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  headerSub: {
    color: "#666",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#111",
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusText: { fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },

  mainContent: { flex: 1, justifyContent: "center" },
  centerBox: { alignItems: "center" },
  activeContainer: { width: "100%" },

  sosContainer: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  sosHalo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: "#D90429",
  },
  sos: {
    backgroundColor: "#D90429",
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
    elevation: 20,
    shadowColor: "#D90429",
    shadowOpacity: 0.8,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
  },
  sosHolding: { backgroundColor: "#FF3B30" },
  sosText: {
    color: "#fff",
    marginTop: 10,
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 1,
  },

  instructionContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
  },
  instruction: {
    color: "#444",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },

  alertHeader: {
    color: "#D90429",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  alertSub: {
    color: "#666",
    fontSize: 16,
    marginTop: 4,
    fontWeight: "500",
    marginBottom: 25,
  },

  aiBox: {
    backgroundColor: "rgba(74, 222, 128, 0.05)",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
    marginBottom: 15,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  aiTitle: {
    color: "#4ADE80",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.2,
    marginLeft: 8,
    flex: 1,
  },
  priorityTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priorityText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  transcriptContainer: { marginBottom: 12 },
  transcriptLabel: {
    color: "#444",
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 4,
  },
  aiTranscript: {
    color: "#888",
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 20,
  },
  aiSummary: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 15,
  },

  aiFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 12,
  },
  metaLabel: { color: "#444", fontSize: 10, fontWeight: "800" },
  metaValue: { color: "#888" },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: "#333",
    marginHorizontal: 15,
  },

  glassCard: {
    backgroundColor: "#0D0D0D",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    marginBottom: 30,
  },
  cardLabel: {
    color: "#444",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 15,
  },
  responderRow: { flexDirection: "row", alignItems: "center" },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: "#222",
  },
  staffName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  etaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  etaText: { color: "#4ADE80", fontSize: 13, fontWeight: "700" },
  callCircle: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  safeBtn: {
    width: "100%",
    height: 65,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#4ADE80",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  safeText: {
    color: "#4ADE80",
    fontWeight: "900",
    fontSize: 16,
    marginLeft: 10,
    letterSpacing: 1,
  },
});
