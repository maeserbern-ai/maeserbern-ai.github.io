import React, { useEffect } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { setAudioModeAsync } from "expo-audio";
import GAME_HTML from "./game-html";

// The whole game (from the website's party-game folder) is bundled into the app,
// so it plays offline. Book links open in Safari instead of replacing the game.
// Play music and sound even when the iPhone's silent switch is on.
setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

// Book links from the "Label of the Day" widget arrive as
// ingredientparty://book?u=<Amazon link>. The native handler (plugins/with-book-links.cjs)
// opens them; this is a fallback for any that reach JavaScript instead.
const BOOK_HOSTS = ["www.amazon.com", "amazon.com", "maeserbern-ai.github.io"];
export function bookLinkTarget(url) {
  if (!url) return null;
  let link = url;
  const m = /^ingredientparty:\/\/book\?(.*)$/i.exec(url);
  if (m) {
    const u = m[1].split("&").find((p) => p.startsWith("u="));
    if (!u) return null;
    try { link = decodeURIComponent(u.slice(2)); } catch { return null; }
  }
  const host = /^https:\/\/([^/?#]+)/i.exec(link);
  return host && BOOK_HOSTS.includes(host[1].toLowerCase()) ? link : null;
}
function openBookLink(url) {
  const link = bookLinkTarget(url);
  if (link) Linking.openURL(link).catch(() => {});
}

export default function App() {
  useEffect(() => {
    Linking.getInitialURL().then(openBookLink).catch(() => {});
    const sub = Linking.addEventListener("url", (e) => openBookLink(e.url));
    return () => sub.remove();
  }, []);
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
