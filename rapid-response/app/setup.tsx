import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { v4 as uuidv4 } from "uuid";

export default function Setup() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [phone, setPhone] = useState("");

  const router = useRouter();

  const handleContinue = async () => {
    const guestId = "guest_" + uuidv4();

    const user = {
      guestId,
      name,
      room,
      phone,
    };

    await AsyncStorage.setItem("user", JSON.stringify(user));
    if (!name || !room || !phone) return;

    await AsyncStorage.setItem("user", JSON.stringify(user));

    router.replace("/guest");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guest Setup</Text>

      <TextInput
        placeholder="Name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        placeholder="Room Number"
        style={styles.input}
        value={room}
        onChangeText={setRoom}
      />
      <TextInput
        placeholder="Phone Number"
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
      />

      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={{ color: "#fff" }}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 22, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
  button: { backgroundColor: "black", padding: 15, alignItems: "center" },
});
