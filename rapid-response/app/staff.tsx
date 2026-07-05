import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  increment,
} from "firebase/firestore";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  Mic,
  Navigation,
  Phone,
  Shield,
  User,
  Siren,
  ChevronRight,
} from "lucide-react-native";
import * as Location from "expo-location";
import { auth, db } from "../services/firebase";

const { width, height } = Dimensions.get("window");

// ── Types ───────────────────────────────────────────────────────────────────

type IncidentStatus = "ACTIVE" | "ASSIGNED" | "ACCEPTED" | "EN_ROUTE" | "RESOLVED";

interface Incident {
  id: string;
  name: string;
  room: string;
  phone: string;
  transcript: string;
  aiSummary: string;
  type: string;
  priority: string;
  status: IncidentStatus;
  assignedTo: string | null;
  assignedName: string | null;
  timestamp: any;
  emotionalTone?: string;
  victimCount?: number;
  weaponDetected?: boolean;
  medicalCondition?: string;
  isFalseAlarm?: boolean;
}

interface StaffProfile {
  name: string;
  role: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  activeIncidentId: string | null;
}

const ROLES = [
  { label: "Security", value: "Security", color: "#A855F7" },
  { label: "Medical", value: "Medical", color: "#3B82F6" },
  { label: "Fire", value: "Fire", color: "#EF4444" },
  { label: "General", value: "General", color: "#6B7280" },
];

// ── Components ──────────────────────────────────────────────────────────────

export default function Staff() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Security");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // ── Auth & Profile Listener ─────────────────────────────────────────────
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        setProfile(null);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, "staff", user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as StaffProfile);
      }
      setLoading(false);
    });

    const q = query(
      collection(db, "incidents"),
      where("assignedTo", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubIncidents = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Incident);
      setIncidents(data);
      
      // Auto-select active incident
      const active = data.find(i => i.status !== "RESOLVED");
      if (active && !selectedIncident) {
        setSelectedIncident(active);
      }
    });

    return () => {
      unsubProfile();
      unsubIncidents();
    };
  }, [user]);

  // ── Heartbeat & Location ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let watchId: any;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      watchId = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (pos) => {
          updateDoc(doc(db, "staff", user.uid), {
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            locationUpdatedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
          });
        }
      );
    };

    startTracking();
    const heartbeat = setInterval(() => {
      updateDoc(doc(db, "staff", user.uid), { lastSeen: serverTimestamp() });
    }, 30000);

    return () => {
      if (watchId) watchId.remove();
      clearInterval(heartbeat);
    };
  }, [user]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    setLoading(true);
    try {
      if (authMode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "staff", cred.user.uid), {
          name,
          role,
          email,
          status: "AVAILABLE",
          activeIncidentId: null,
          totalResolved: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateIncidentStatus = async (id: string, newStatus: IncidentStatus) => {
    try {
      await runTransaction(db, async (txn) => {
        const incRef = doc(db, "incidents", id);
        const staffRef = doc(db, "staff", user!.uid);
        
        txn.update(incRef, { status: newStatus });
        
        if (newStatus === "ACCEPTED") {
          txn.update(incRef, { acceptedAt: serverTimestamp() });
        } else if (newStatus === "EN_ROUTE") {
          txn.update(incRef, { enRouteAt: serverTimestamp() });
        } else if (newStatus === "RESOLVED") {
          txn.update(incRef, { 
            resolvedAt: serverTimestamp(),
            resolvedBy: "staff"
          });
          txn.update(staffRef, { 
            status: "AVAILABLE",
            activeIncidentId: null,
            totalResolved: increment(1)
          });
        }
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const toggleAvailability = async () => {
    if (!user || !profile) return;
    const newStatus = profile.status === "AVAILABLE" ? "BUSY" : "AVAILABLE";
    await updateDoc(doc(db, "staff", user.uid), { status: newStatus });
  };

  // ── Render Helpers ──────────────────────────────────────────────────────
  if (loading && !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#D90429" size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authBox}>
            <Shield color="#D90429" size={60} strokeWidth={2.5} />
            <Text style={styles.authTitle}>RAPID RESPONSE</Text>
            <Text style={styles.authSub}>Staff Emergency Dashboard</Text>

            <View style={styles.inputGroup}>
              {authMode === "register" && (
                <>
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor="#444"
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                  />
                  <Text style={[styles.label, { marginTop: 10, marginBottom: 10 }]}>SELECT YOUR ROLE</Text>
                  <View style={styles.roleGrid}>
                    {ROLES.map((r) => (
                      <TouchableOpacity
                        key={r.value}
                        style={[
                          styles.roleBtn,
                          role === r.value && { borderColor: r.color, backgroundColor: r.color + '10' }
                        ]}
                        onPress={() => setRole(r.value)}
                      >
                        <Text style={[styles.roleBtnText, role === r.value && { color: r.color }]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <TextInput
                placeholder="Email"
                placeholderTextColor="#444"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor="#444"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.authBtn} onPress={handleAuth}>
              <Text style={styles.authBtnText}>
                {authMode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAuthMode(authMode === "login" ? "register" : "login")}>
              <Text style={styles.authSwitch}>
                {authMode === "login" ? "Need an account? Register" : "Have an account? Login"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerName}>{profile?.name || "Officer"}</Text>
          <Text style={styles.headerRole}>{profile?.role || "Responder"}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.statusToggle, { borderColor: profile?.status === 'AVAILABLE' ? '#4ADE80' : '#666' }]}
            onPress={toggleAvailability}
          >
            <View style={[styles.statusDot, { backgroundColor: profile?.status === 'AVAILABLE' ? '#4ADE80' : '#666' }]} />
            <Text style={[styles.statusText, { color: profile?.status === 'AVAILABLE' ? '#4ADE80' : '#666' }]}>
              {profile?.status || "OFFLINE"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut(auth)} style={styles.logoutBtn}>
            <LogOut color="#666" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Incident List (Horizontal Feed) */}
        <View style={styles.feedSection}>
          <View style={styles.sectionHeader}>
            <Activity color="#666" size={16} />
            <Text style={styles.sectionTitle}>MY ASSIGNMENTS</Text>
          </View>
          <FlatList
            horizontal
            data={incidents}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.incidentCard, 
                  selectedIncident?.id === item.id && styles.selectedCard,
                  item.status === 'RESOLVED' && { opacity: 0.5 }
                ]}
                onPress={() => setSelectedIncident(item)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name || "Guest"}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: item.priority === 'HIGH' ? '#D90429' : '#F59E0B' }]}>
                    <Text style={styles.priorityText}>{item.priority}</Text>
                  </View>
                </View>
                <Text style={styles.cardRoom}>Unit {item.room}</Text>
                <View style={styles.cardStatusRow}>
                   <Activity color="#4ADE80" size={12} />
                   <Text style={styles.cardStatus}>{item.status}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyFeed}>
                <Text style={styles.emptyText}>No active assignments</Text>
              </View>
            }
          />
        </View>

        {/* Selected Incident Detail */}
        {selectedIncident ? (
          <ScrollView style={styles.detailSection} showsVerticalScrollIndicator={false}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={styles.detailIconBox}>
                  <Siren color="#D90429" size={24} />
                </View>
                <View>
                  <Text style={styles.detailTitle}>{selectedIncident.name || "Anonymous"}</Text>
                  <Text style={styles.detailSub}>Unit {selectedIncident.room} • {selectedIncident.type}</Text>
                </View>
              </View>

              {/* AI Insight */}
              <View style={styles.aiBox}>
                <View style={styles.aiHeader}>
                  <BrainCircuit color="#4ADE80" size={16} />
                  <Text style={styles.aiTitle}>AI SITUATION ANALYSIS</Text>
                </View>
                
                {selectedIncident.isFalseAlarm && (
                  <View style={styles.falseAlarmBadge}>
                    <Text style={styles.falseAlarmText}>POTENTIAL FALSE ALARM</Text>
                  </View>
                )}

                <View style={styles.transcriptRow}>
                  <Mic color="#666" size={14} />
                  <Text style={styles.transcriptText}>"{selectedIncident.transcript}"</Text>
                </View>
                <Text style={styles.summaryText}>{selectedIncident.aiSummary}</Text>
                
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>TONE</Text>
                    <Text style={styles.metaValue}>{selectedIncident.emotionalTone || "Unknown"}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>VICTIMS</Text>
                    <Text style={styles.metaValue}>{selectedIncident.victimCount || "0"}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>MEDICAL</Text>
                    <Text style={styles.metaValue}>{selectedIncident.medicalCondition || "None"}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>WEAPONS</Text>
                    <Text style={styles.metaValue}>{selectedIncident.weaponDetected ? "YES" : "NO"}</Text>
                  </View>
                </View>
              </View>

              {/* Info Rows */}
              <View style={styles.infoGrid}>
                 <View style={styles.infoItem}>
                    <MapPin color="#666" size={16} />
                    <Text style={styles.infoValue}>Floor 2, Room {selectedIncident.room}</Text>
                 </View>
                 <View style={styles.infoItem}>
                    <Phone color="#666" size={16} />
                    <Text style={styles.infoValue}>{selectedIncident.phone || "No contact"}</Text>
                 </View>
                 <View style={styles.infoItem}>
                    <Clock color="#666" size={16} />
                    <Text style={styles.infoValue}>ETA: 2 mins</Text>
                 </View>
              </View>

              {/* Actions */}
              <View style={styles.actionBox}>
                {selectedIncident.status === "ASSIGNED" && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#4ADE80' }]}
                    onPress={() => updateIncidentStatus(selectedIncident.id, "ACCEPTED")}
                  >
                    <CheckCircle2 color="#000" size={20} />
                    <Text style={[styles.actionBtnText, { color: '#000' }]}>ACCEPT INCIDENT</Text>
                  </TouchableOpacity>
                )}
                {selectedIncident.status === "ACCEPTED" && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                    onPress={() => updateIncidentStatus(selectedIncident.id, "EN_ROUTE")}
                  >
                    <Navigation color="#fff" size={20} />
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>EN ROUTE</Text>
                  </TouchableOpacity>
                )}
                {selectedIncident.status === "EN_ROUTE" && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#D90429' }]}
                    onPress={() => updateIncidentStatus(selectedIncident.id, "RESOLVED")}
                  >
                    <CheckCircle2 color="#fff" size={20} />
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>RESOLVE INCIDENT</Text>
                  </TouchableOpacity>
                )}
                {selectedIncident.status === "RESOLVED" && (
                   <View style={styles.resolvedBadge}>
                      <CheckCircle2 color="#4ADE80" size={24} />
                      <Text style={styles.resolvedText}>INCIDENT RESOLVED</Text>
                   </View>
                )}
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyDetail}>
            <Shield color="#222" size={80} />
            <Text style={styles.emptyDetailText}>Select an incident to view details</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050505" },
  
  // Auth
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  authBox: { alignItems: 'center' },
  authTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 20, letterSpacing: -1 },
  authSub: { color: '#666', fontSize: 14, marginTop: 5, marginBottom: 40 },
  inputGroup: { width: '100%', marginBottom: 25 },
  label: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  roleBtn: { 
    width: '48%', 
    height: 45, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#222', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 10 
  },
  roleBtnText: { color: '#444', fontSize: 12, fontWeight: '800' },
  input: { 
    backgroundColor: '#111', 
    width: '100%', 
    height: 60, 
    borderRadius: 16, 
    paddingHorizontal: 20, 
    color: '#fff', 
    fontSize: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  authBtn: { 
    backgroundColor: '#D90429', 
    width: '100%', 
    height: 65, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#D90429',
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  authSwitch: { color: '#D90429', marginTop: 20, fontWeight: '700' },

  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 25, 
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111'
  },
  headerName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  headerRole: { color: '#666', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  statusToggle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20,
    marginRight: 15
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  logoutBtn: { padding: 5 },

  content: { flex: 1 },

  // Feed Section
  feedSection: { paddingVertical: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, marginBottom: 15 },
  sectionTitle: { color: '#444', fontSize: 11, fontWeight: '900', marginLeft: 8, letterSpacing: 1 },
  incidentCard: { 
    backgroundColor: '#0D0D0D', 
    width: 200, 
    padding: 18, 
    borderRadius: 24, 
    marginLeft: 25,
    borderWidth: 1,
    borderColor: '#1A1A1A'
  },
  selectedCard: { borderColor: '#D90429', backgroundColor: '#110204' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priorityText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  cardRoom: { color: '#666', fontSize: 13, marginBottom: 15 },
  cardStatusRow: { flexDirection: 'row', alignItems: 'center' },
  cardStatus: { color: '#4ADE80', fontSize: 10, fontWeight: '900', marginLeft: 5, textTransform: 'uppercase' },
  emptyFeed: { width: width - 50, height: 100, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#222', fontSize: 14, fontWeight: '600' },

  // Detail Section
  detailSection: { flex: 1, paddingHorizontal: 25 },
  detailCard: { backgroundColor: '#0D0D0D', borderRadius: 32, padding: 25, borderWidth: 1, borderColor: '#111', marginBottom: 30 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  detailIconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#110204', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#300' },
  detailTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  detailSub: { color: '#666', fontSize: 13, marginTop: 2 },

  aiBox: { backgroundColor: 'rgba(74, 222, 128, 0.05)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.2)', marginBottom: 25 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  aiTitle: { color: '#4ADE80', fontSize: 11, fontWeight: '900', marginLeft: 8, letterSpacing: 1.2 },
  
  falseAlarmBadge: { backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 10, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', alignItems: 'center' },
  falseAlarmText: { color: '#F59E0B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  transcriptRow: { flexDirection: 'row', marginBottom: 10 },
  transcriptText: { color: '#888', fontStyle: 'italic', fontSize: 13, marginLeft: 8, flex: 1 },
  summaryText: { color: '#fff', fontSize: 15, lineHeight: 22, fontWeight: '500', marginBottom: 20 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15 },
  metaItem: { width: '48%', marginBottom: 12 },
  metaLabel: { color: '#444', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { color: '#fff', fontSize: 13, fontWeight: '700' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 30 },
  infoItem: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 },
  infoValue: { color: '#aaa', fontSize: 14, marginLeft: 10, fontWeight: '600' },

  actionBox: { marginTop: 10 },
  actionBtn: { height: 70, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16, fontWeight: '900', marginLeft: 10, letterSpacing: 1 },
  resolvedBadge: { alignItems: 'center', padding: 20 },
  resolvedText: { color: '#4ADE80', fontSize: 16, fontWeight: '900', marginTop: 10 },

  emptyDetail: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  emptyDetailText: { color: '#444', fontSize: 14, marginTop: 15, fontWeight: '600' }
});
