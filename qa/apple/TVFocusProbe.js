// Copied into the simulator build only. Never part of a store build.
import React, { useEffect, useState } from "react";
import { Pressable, Settings, StyleSheet, Text, TVEventHandler, View } from "react-native";
import App from "./App";
import { F, FocusContext, Confetti } from "./src/ui";
import { initAudio } from "./src/sound";

export default function TVFocusProbe() {
  const mode = Settings.get("IPGQAProbe");
  if (!mode) return <App />;
  return <Probe mode={mode} />;
}

function Probe({ mode }) {
  const [focus, setFocus] = useState("none");
  const [preferred, setPreferred] = useState("First");
  const [event, setEvent] = useState("none");
  useEffect(() => {
    if (mode === "audio") initAudio();
    if (mode !== "events") return undefined;
    const sub = TVEventHandler.addListener(e => setEvent(e.eventType));
    return () => sub?.remove();
  }, [mode]);
  const focused = id => { setFocus(id); setPreferred(null); };
  const controls = ["First", "Second", "Third"].map(id => mode === "game-buttons" ? (
    <F key={id} id={id} onPress={() => setEvent(`selected-${id}`)} style={styles.button}>
      <Text style={styles.text}>{id}</Text>
    </F>
  ) : (
    <Pressable key={id} hasTVPreferredFocus={preferred === id}
      onFocus={() => focused(id)} onPress={() => setEvent(`selected-${id}`)}
      style={[styles.button, focus === id && { backgroundColor: "#326d45" }]}>
      <Text style={styles.text}>{id}</Text>
    </Pressable>
  ));
  return <View style={styles.root}>
    <Text style={styles.text}>{`Probe: ${mode}`}</Text>
    <Text style={styles.text}>{`Focused: ${focus}; Event: ${event}`}</Text>
    <FocusContext.Provider value={{ target: preferred, nonce: 0, onFocused: focused }}>
      <View style={styles.row}>{controls}</View>
    </FocusContext.Provider>
    {mode === "overlay" ? <Confetti bursts={[]} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 120, backgroundColor: "#203024", justifyContent: "center" },
  row: { flexDirection: "row", gap: 50, marginTop: 80 },
  button: { width: 300, height: 120, backgroundColor: "#3e4855", alignItems: "center", justifyContent: "center" },
  text: { color: "white", fontSize: 42 }
});
