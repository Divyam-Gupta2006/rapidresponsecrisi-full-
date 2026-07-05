// import {
//   collection,
//   doc,
//   getDocs,
//   increment,
//   onSnapshot,
//   serverTimestamp,
//   setDoc,
//   updateDoc,
// } from "firebase/firestore";

// import React, { useEffect, useState } from "react";
// import {
//   SafeAreaView,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
//   ActivityIndicator
// } from "react-native";

// import {
//   AlertTriangle,
//   DoorOpen,
//   Megaphone,
//   ShieldCheck,
//   User,
//   Activity,
//   Clock,
//   Mic,
//   BrainCircuit,
// } from "lucide-react-native";

// import { db } from "../services/firebase";

// export default function Manager() {
//   const [incidents, setIncidents] = useState([]);
//   const [message, setMessage] = useState("");

//   // 🔥 INCIDENT LISTENER
//   useEffect(() => {
//     const unsubscribe = onSnapshot(collection(db, "incidents"), async (snap) => {
//       const data = snap.docs.map((d) => ({
//         id: d.id,
//         ...d.data(),
//       }));

//       // Sort ACTIVE first
//       data.sort((a, b) => (a.status === "ACTIVE" ? -1 : 1));
//       setIncidents(data);

//       // 🔥 AUTO ASSIGN
//       for (let incident of data) {
//         if (!incident.assignedTo && incident.status === "ACTIVE") {
//           assignStaff(incident);
//         }
//       }
//     });

//     return () => unsubscribe();
//   }, []);

//   const assignStaff = async (incident) => {
//     try {
//       const staffSnap = await getDocs(collection(db, "staff"));
//       const best = staffSnap.docs[0]; 
//       if (!best) return;

//       await updateDoc(doc(db, "incidents", incident.id), {
//         assignedTo: best.id,
//         assignedName: best.data().name,
//         eta: "2 mins",
//       });

//       await updateDoc(doc(db, "staff", best.id), {
//         activeIncidents: increment(1),
//       });
//     } catch (e) {
//       console.log(e);
//     }
//   };

//   const sendBroadcast = async (type) => {
//     await setDoc(doc(db, "broadcast", "live"), {
//       active: true,
//       type,
//       message,
//       updatedAt: serverTimestamp(),
//     });
//   };

//   const triggerEvacuation = async () => {
//     await setDoc(doc(db, "broadcast", "live"), {
//       active: true,
//       type: "danger",
//       message: message || "Fire detected. Evacuate immediately using nearest exit.",
//       evacuation: true,
//       updatedAt: serverTimestamp(),
//     });
//   };

//   const resolveIncident = async (id) => {
//     await updateDoc(doc(db, "incidents", id), {
//       status: "RESOLVED",
//     });
//   };

//   const getPriorityColor = (p) => {
//     if (p === "HIGH" || p === "CRITICAL") return "#FF3B30";
//     if (p === "MEDIUM") return "#FF9500";
//     return "#4ADE80";
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="light-content" />
      
//       {/* 📡 SYSTEM HEADER */}
//       <View style={styles.header}>
//         <View>
//           <Text style={styles.headerSub}>EMERGENCY OPERATIONS</Text>
//           <Text style={styles.title}>Command Center</Text>
//         </View>
//         <View style={styles.liveBadge}>
//           <Activity color="#4ADE80" size={14} />
//           <Text style={styles.liveText}>LIVE</Text>
//         </View>
//       </View>

//       <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
//         {/* 📢 BROADCAST SECTION */}
//         <View style={styles.broadcastCard}>
//           <View style={styles.sectionHeader}>
//             <Megaphone color="#666" size={18} />
//             <Text style={styles.sectionTitle}>SYSTEM BROADCAST</Text>
//           </View>

//           <TextInput
//             placeholder="Type emergency instructions..."
//             placeholderTextColor="#444"
//             style={styles.input}
//             value={message}
//             onChangeText={setMessage}
//             multiline
//           />

//           <View style={styles.row}>
//             <TouchableOpacity
//               style={[styles.btn, { backgroundColor: "#F59E0B" }]}
//               onPress={() => sendBroadcast("warning")}
//             >
//               <AlertTriangle color="#000" size={20} />
//               <Text style={[styles.btnText, { color: "#000" }]}>Warning</Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={[styles.btn, { backgroundColor: "#D90429" }]}
//               onPress={triggerEvacuation}
//             >
//               <DoorOpen color="#fff" size={20} />
//               <Text style={[styles.btnText, { color: "#fff" }]}>Evacuate</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* 🚨 INCIDENT FEED */}
//         <View style={styles.feedHeader}>
//           <Activity color="#666" size={18} />
//           <Text style={styles.sectionTitle}>INCIDENT REAL-TIME FEED</Text>
//         </View>

//         {incidents.map((item) => (
//           <View key={item.id} style={[styles.incidentCard, item.status === 'RESOLVED' && { opacity: 0.6 }]}>
            
//             {/* TOP INFO */}
//             <View style={styles.row}>
//               <View style={styles.userInfo}>
//                 <View style={styles.avatar}>
//                   <User color="#fff" size={20} />
//                 </View>
//                 <View>
//                   <Text style={styles.name}>{item.name || "Anonymous Guest"}</Text>
//                   <Text style={styles.room}>Unit {item.room}</Text>
//                 </View>
//               </View>
//               <View style={[styles.statusTag, { backgroundColor: item.status === 'ACTIVE' ? 'rgba(217, 4, 41, 0.2)' : 'rgba(74, 222, 128, 0.1)' }]}>
//                 <Text style={[styles.statusTagText, { color: item.status === 'ACTIVE' ? '#D90429' : '#4ADE80' }]}>{item.status}</Text>
//               </View>
//             </View>

//             {/* 🤖 AI INTELLIGENCE CARD */}
//             <View style={styles.aiBox}>
//               <View style={styles.aiHeader}>
//                 <BrainCircuit color="#4ADE80" size={14} />
//                 <Text style={styles.aiTitle}>AI ANALYSIS</Text>
//                 <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
//                   <Text style={styles.priorityText}>{item.priority || "LOW"}</Text>
//                 </View>
//               </View>
              
//               <View style={styles.transcriptRow}>
//                 <Mic color="#666" size={14} />
//                 <Text style={styles.transcriptText} numberOfLines={2}>"{item.transcript || "No audio data"}"</Text>
//               </View>
              
//               <Text style={styles.summaryText}>{item.aiSummary || "Processing incident details..."}</Text>
              
//               <Text style={styles.typeText}>CLASSIFICATION: {item.type || "GENERAL ALERT"}</Text>
//             </View>

//             {/* ASSIGNMENT STATUS */}
//             <View style={styles.assignmentRow}>
//                <Clock color="#666" size={14} />
//                <Text style={styles.assign}>
//                 Assigned: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.assignedName || "Auto-Assigning..."}</Text>
//               </Text>
//             </View>

//             {/* ACTION BUTTON */}
//             {item.status === "ACTIVE" && (
//               <TouchableOpacity
//                 style={styles.resolveBtn}
//                 onPress={() => resolveIncident(item.id)}
//               >
//                 <ShieldCheck color="#4ADE80" size={18} />
//                 <Text style={styles.resolveText}>Mark as Resolved</Text>
//               </TouchableOpacity>
//             )}
//           </View>
//         ))}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#000" },
  
//   header: {
//     paddingHorizontal: 20,
//     paddingVertical: 25,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     borderBottomWidth: 1,
//     borderBottomColor: '#1A1A1A'
//   },
//   headerSub: { color: "#444", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
//   title: { color: "#fff", fontSize: 28, fontWeight: "900" },
//   liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
//   liveText: { color: '#4ADE80', fontSize: 10, fontWeight: '900', marginLeft: 5 },

//   sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
//   sectionTitle: { color: "#666", fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginLeft: 10 },
  
//   broadcastCard: {
//     backgroundColor: "#0D0D0D",
//     margin: 20,
//     padding: 20,
//     borderRadius: 24,
//     borderWidth: 1,
//     borderColor: "#1A1A1A",
//   },
//   input: {
//     backgroundColor: "#161616",
//     color: "#fff",
//     padding: 15,
//     borderRadius: 12,
//     fontSize: 15,
//     minHeight: 60,
//     marginBottom: 20,
//     borderWidth: 1,
//     borderColor: "#222",
//   },
//   row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
//   btn: {
//     flex: 0.48,
//     flexDirection: "row",
//     paddingVertical: 14,
//     borderRadius: 14,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   btnText: { fontWeight: "900", marginLeft: 8, fontSize: 14 },

//   feedHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
//   incidentCard: {
//     backgroundColor: "#0D0D0D",
//     marginHorizontal: 20,
//     padding: 20,
//     borderRadius: 24,
//     marginBottom: 15,
//     borderWidth: 1,
//     borderColor: "#1A1A1A",
//   },
//   userInfo: { flexDirection: 'row', alignItems: 'center' },
//   avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#333' },
//   name: { color: "#fff", fontSize: 16, fontWeight: "800" },
//   room: { color: "#666", fontSize: 12, fontWeight: '600' },
//   statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
//   statusTagText: { fontSize: 10, fontWeight: '900' },

//   aiBox: {
//     marginTop: 15,
//     padding: 15,
//     backgroundColor: "rgba(74, 222, 128, 0.03)",
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: "rgba(74, 222, 128, 0.1)",
//   },
//   aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
//   aiTitle: { color: "#4ADE80", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginLeft: 6, flex: 1 },
//   priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
//   priorityText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  
//   transcriptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
//   transcriptText: { color: "#888", fontSize: 13, fontStyle: "italic", marginLeft: 8, flex: 1 },
//   summaryText: { color: "#DDD", fontSize: 14, fontWeight: "600", lineHeight: 20, marginBottom: 10 },
//   typeText: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1 },

//   assignmentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
//   assign: { color: "#666", fontSize: 12, marginLeft: 8 },

//   resolveBtn: {
//     marginTop: 20,
//     backgroundColor: 'rgba(74, 222, 128, 0.05)',
//     paddingVertical: 12,
//     borderRadius: 12,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     borderWidth: 1,
//     borderColor: 'rgba(74, 222, 128, 0.2)'
//   },
//   resolveText: { color: "#4ADE80", fontWeight: "800", marginLeft: 8, fontSize: 14 },
// });


import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Clock,
  DoorOpen,
  Megaphone,
  Mic,
  ShieldCheck,
  User,
} from "lucide-react-native";

import { db } from "../services/firebase";

type Incident = {
  id: string;
  status: string;
  assignedTo?: string;
  assignedName?: string;
  priority?: string;
  transcript?: string;
  aiSummary?: string;
  type?: string;
  name?: string;
  room?: string;
};

export default function Manager() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [message, setMessage] = useState("");

  // 🔥 INCIDENT LISTENER
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "incidents"), async (snap) => {
      const data: Incident[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Incident, "id">),
      }));

      // Sort ACTIVE first
      data.sort((a, b) => {
        if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
        if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
        return 0;
      });
      setIncidents(data);
    });

    return () => unsubscribe();
  }, []);

  const sendBroadcast = async (type: string) => {
    await setDoc(doc(db, "broadcast", "live"), {
      active: true,
      type,
      message,
      updatedAt: serverTimestamp(),
    });
  };

  const triggerEvacuation = async () => {
    await setDoc(doc(db, "broadcast", "live"), {
      active: true,
      type: "danger",
      message: message || "Fire detected. Evacuate immediately using nearest exit.",
      evacuation: true,
      updatedAt: serverTimestamp(),
    });
  };

  const resolveIncident = async (id: string) => {
    await updateDoc(doc(db, "incidents", id), {
      status: "RESOLVED",
    });
  };

  const getPriorityColor = (p: string) => {
    if (p === "HIGH" || p === "CRITICAL") return "#FF3B30";
    if (p === "MEDIUM") return "#FF9500";
    return "#4ADE80";
  };

  const getStatusColor = (s: string) => {
    if (s === "ACTIVE") return "#D90429";
    if (s === "ASSIGNED") return "#F59E0B";
    if (s === "ACCEPTED") return "#3B82F6";
    if (s === "EN_ROUTE") return "#A855F7";
    return "#4ADE80";
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 📡 SYSTEM HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>EMERGENCY OPERATIONS</Text>
          <Text style={styles.title}>Command Center</Text>
        </View>
        <View style={styles.liveBadge}>
          <Activity color="#4ADE80" size={14} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* 📢 BROADCAST SECTION */}
        <View style={styles.broadcastCard}>
          <View style={styles.sectionHeader}>
            <Megaphone color="#666" size={18} />
            <Text style={styles.sectionTitle}>SYSTEM BROADCAST</Text>
          </View>

          <TextInput
            placeholder="Type emergency instructions..."
            placeholderTextColor="#444"
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#F59E0B" }]}
              onPress={() => sendBroadcast("warning")}
            >
              <AlertTriangle color="#000" size={20} />
              <Text style={[styles.btnText, { color: "#000" }]}>Warning</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#D90429" }]}
              onPress={triggerEvacuation}
            >
              <DoorOpen color="#fff" size={20} />
              <Text style={[styles.btnText, { color: "#fff" }]}>Evacuate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🚨 INCIDENT FEED */}
        <View style={styles.feedHeader}>
          <Activity color="#666" size={18} />
          <Text style={styles.sectionTitle}>INCIDENT REAL-TIME FEED</Text>
        </View>

        {incidents.map((item) => (
          <View key={item.id} style={[styles.incidentCard, item.status === 'RESOLVED' && { opacity: 0.6 }]}>
            
            {/* TOP INFO */}
            <View style={styles.row}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <User color="#fff" size={20} />
                </View>
                <View>
                  <Text style={styles.name}>{item.name || "Anonymous Guest"}</Text>
                  <Text style={styles.room}>Unit {item.room}</Text>
                </View>
              </View>
              <View style={[styles.statusTag, { backgroundColor: getStatusColor(item.status) + '33' }]}>
                <Text style={[styles.statusTagText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>

            {/* 🤖 AI INTELLIGENCE CARD */}
            <View style={styles.aiBox}>
              <View style={styles.aiHeader}>
                <BrainCircuit color="#4ADE80" size={14} />
                <Text style={styles.aiTitle}>AI ANALYSIS</Text>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority || "LOW") }]}>
                  <Text style={styles.priorityText}>{item.priority || "LOW"}</Text>
                </View>
              </View>
              
              <View style={styles.transcriptRow}>
                <Mic color="#666" size={14} />
                <Text style={styles.transcriptText} numberOfLines={2}>"{item.transcript || "No audio data"}"</Text>
              </View>
              
              <Text style={styles.summaryText}>{item.aiSummary || "Processing incident details..."}</Text>
              
              <Text style={styles.typeText}>CLASSIFICATION: {item.type || "GENERAL ALERT"}</Text>
            </View>

            {/* ASSIGNMENT STATUS */}
            <View style={styles.assignmentRow}>
               <Clock color="#666" size={14} />
               <Text style={styles.assign}>
                Assigned: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.assignedName || "Auto-Assigning..."}</Text>
              </Text>
            </View>

            {/* ACTION BUTTON */}
            {item.status === "ACTIVE" && (
              <TouchableOpacity
                style={styles.resolveBtn}
                onPress={() => resolveIncident(item.id)}
              >
                <ShieldCheck color="#4ADE80" size={18} />
                <Text style={styles.resolveText}>Mark as Resolved</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  
  header: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A'
  },
  headerSub: { color: "#444", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveText: { color: '#4ADE80', fontSize: 10, fontWeight: '900', marginLeft: 5 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: "#666", fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginLeft: 10 },
  
  broadcastCard: {
    backgroundColor: "#0D0D0D",
    margin: 20,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  input: {
    backgroundColor: "#161616",
    color: "#fff",
    padding: 15,
    borderRadius: 12,
    fontSize: 15,
    minHeight: 60,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#222",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btn: {
    flex: 0.48,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "900", marginLeft: 8, fontSize: 14 },

  feedHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  incidentCard: {
    backgroundColor: "#0D0D0D",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 24,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#333' },
  name: { color: "#fff", fontSize: 16, fontWeight: "800" },
  room: { color: "#666", fontSize: 12, fontWeight: '600' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 10, fontWeight: '900' },

  aiBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "rgba(74, 222, 128, 0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.1)",
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  aiTitle: { color: "#4ADE80", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginLeft: 6, flex: 1 },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priorityText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  
  transcriptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  transcriptText: { color: "#888", fontSize: 13, fontStyle: "italic", marginLeft: 8, flex: 1 },
  summaryText: { color: "#DDD", fontSize: 14, fontWeight: "600", lineHeight: 20, marginBottom: 10 },
  typeText: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  assignmentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  assign: { color: "#666", fontSize: 12, marginLeft: 8 },

  resolveBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)'
  },
  resolveText: { color: "#4ADE80", fontWeight: "800", marginLeft: 8, fontSize: 14 },
});