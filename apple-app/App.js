import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import GAME_HTML from "./game-html";

// The whole game (from the website's party-game folder) is bundled into the app,
// so it plays offline. Book links open in Safari instead of replacing the game.
export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <WebView
        style={styles.root}
        originWhitelist={["*"]}
        source={{ html: GAME_HTML, baseUrl: "https://maeserbern-ai.github.io/party-game/" }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        contentInsetAdjustmentBehavior="never"
        onOpenWindow={(e) => Linking.openURL(e.nativeEvent.targetUrl).catch(() => {})}
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith("about:") || req.url.startsWith("data:") || req.url === "https://maeserbern-ai.github.io/party-game/") return true;
          if (req.navigationType === "click" || /^https?:/.test(req.url)) {
            Linking.openURL(req.url).catch(() => {});
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#16211C" }
});
