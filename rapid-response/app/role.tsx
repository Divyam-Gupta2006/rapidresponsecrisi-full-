import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View, SafeAreaView, StatusBar } from "react-native";
import { User, Shield, Briefcase } from "lucide-react-native";

export default function RoleSelector() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Shield color="#D90429" size={50} />
          <Text style={styles.title}>ACCESS PORTAL</Text>
          <Text style={styles.subtitle}>Select your operational role</Text>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.replace("/guest")}
          >
            <View style={styles.iconBox}>
              <User color="#4ADE80" size={30} />
            </View>
            <Text style={styles.cardTitle}>GUEST</Text>
            <Text style={styles.cardDesc}>SOS & Emergency Help</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.replace("/staff")}
          >
            <View style={[styles.iconBox, { borderColor: '#3B82F6' }]}>
              <Briefcase color="#3B82F6" size={30} />
            </View>
            <Text style={styles.cardTitle}>STAFF</Text>
            <Text style={styles.cardDesc}>Responder Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.fullWidth]}
            onPress={() => router.replace("/manager")}
          >
            <View style={[styles.iconBox, { borderColor: '#F59E0B' }]}>
              <Shield color="#F59E0B" size={30} />
            </View>
            <Text style={styles.cardTitle}>MANAGER</Text>
            <Text style={styles.cardDesc}>Command Center & Operations</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  content: { flex: 1, justifyContent: "center", padding: 30 },
  header: { alignItems: "center", marginBottom: 50 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 15, letterSpacing: 2 },
  subtitle: { color: "#666", fontSize: 14, marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    backgroundColor: '#0D0D0D',
    width: '48%',
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    marginBottom: 15
  },
  fullWidth: { width: '100%' },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4ADE80'
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardDesc: { color: "#444", fontSize: 10, fontWeight: "700", marginTop: 4 }
});
