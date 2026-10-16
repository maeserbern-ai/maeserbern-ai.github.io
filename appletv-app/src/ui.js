// Shared look + building blocks for the Apple TV screens: colors from the web
// game's style.css, a focusable button with the gold focus ring, confetti and
// the CORRECT!/WRONG! stamp.
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

export const C = {
  bg: "#16211C", bg2: "#1F2E27", ink: "#F4F3EE", inkSoft: "#C9CDC6", muted: "#8E978F",
  label: "#F4F3EE", labelInk: "#1A1C1E", pop: "#E07A55", gold: "#F2C46B", good: "#5FBF8A", bad: "#E06A5F",
  a: ["#B5654A", "#3A5A80", "#6A5482", "#3F6B57"],
  warnInk: "#B42318", unknownInk: "#8A5A00", helpBg: "#E6E3DA"
};
// System fonts: New York (Apple's serif) stands in for Fraunces, San Francisco for Inter.
export const SERIF = "ui-serif";

export function T({ style, serif, children, ...rest }) {
  return <Text {...rest} style={[{ color: C.ink, fontSize: 32 }, serif && { fontFamily: SERIF }, style]}>{children}</Text>;
}

/* ---------- focus ---------- */
// The tvOS focus engine moves focus between focusable views on its own (arrows /
// swipes). The app only says where focus should land when a screen opens or the
// game moves it on purpose: FocusContext.target + nonce.
export const FocusContext = createContext({ target: null, nonce: 0, onFocused: () => {} });

// A focusable button. `id` names it for programmatic focus. `ring` is the corner
// radius of the gold focus ring. When `focusable` is false it renders as a plain
// view so the focus engine can't land on it (used for modals and disabled buttons).
export function F({ id, onPress, style, focusedStyle, children, focusable = true, radius = 999, scale = 1.07, ringWidth = 8 }) {
  const ctx = useContext(FocusContext);
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const preferred = focusable && ctx.target === id;
  useEffect(() => {
    if (!preferred) return undefined;
    // hasTVPreferredFocus covers a freshly mounted view; requestTVFocus moves focus
    // to a view that was already on screen.
    const t = setTimeout(() => { try { ref.current && ref.current.requestTVFocus && ref.current.requestTVFocus(); } catch (e) { /* ignore */ } }, 30);
    return () => clearTimeout(t);
  }, [preferred, ctx.nonce]);
  if (!focusable) {
    return <View style={style}>{typeof children === "function" ? children({ focused: false }) : children}</View>;
  }
  return (
    <Pressable
      ref={ref}
      testID={id}
      hasTVPreferredFocus={preferred}
      tvParallaxProperties={{ magnification: scale }}
      onFocus={() => { setFocused(true); ctx.onFocused(id); }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[style, focused && focusedStyle]}
    >
      {typeof children === "function" ? children({ focused }) : children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          top: -ringWidth, left: -ringWidth, right: -ringWidth, bottom: -ringWidth,
          borderRadius: radius + ringWidth, borderWidth: ringWidth, borderColor: C.gold,
          opacity: focused ? 1 : 0
      }]} />
    </Pressable>
  );
}

/* ---------- buttons ---------- */
export function Btn({ id, label, onPress, primary, small, ghost, ghostDark, focusable, style, textStyle, children }) {
  const bg = primary ? C.pop : ghost ? "transparent" : ghostDark ? "transparent" : C.bg2;
  const border = primary ? "transparent" : ghost ? "rgba(26,28,30,0.35)" : ghostDark ? "rgba(244,243,238,0.25)" : "rgba(244,243,238,0.18)";
  const color = primary ? "#1A1C1E" : ghost ? C.labelInk : C.ink;
  return (
    <F id={id} onPress={onPress} focusable={focusable}
      style={[s.btn, small && s.btnSmall, { backgroundColor: bg, borderColor: border }, style]}>
      {children || <T style={[s.btnText, small && s.btnSmallText, { color }, textStyle]} numberOfLines={1}>{label}</T>}
    </F>
  );
}

export function Chip({ id, label, selected, onPress }) {
  return (
    <F id={id} onPress={onPress} radius={24} style={[s.chip, selected && { backgroundColor: C.ink, borderColor: C.ink }]}>
      <T style={[s.chipText, selected && { color: "#1A1C1E" }]}>{label}</T>
    </F>
  );
}

/* ---------- CORRECT! / WRONG! stamp ---------- */
export function Stamp({ pop }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }).start();
  }, [pop, a]);
  if (!pop) return null;
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] });
  const opacity = a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.popWrap, { backgroundColor: pop.good ? "rgba(6,50,28,0.55)" : "rgba(60,8,6,0.55)" }]}>
      <Animated.View style={[s.popBox, { backgroundColor: pop.good ? "#2F8F5B" : C.bad, opacity, transform: [{ scale }, { rotate: "-6deg" }] }]}>
        <T serif style={[s.popTitle, pop.good && { fontSize: 210 }]}>{pop.good ? "CORRECT!" : "WRONG!"}</T>
      </Animated.View>
      <T style={s.popSub}>{pop.sub}</T>
    </View>
  );
}

/* ---------- confetti ---------- */
// The web game paints confetti on a canvas; here each piece is a small native-driver
// animated view. Bursts are capped so older Apple TVs stay smooth.
const MAX_PIECES = 90;
export function Confetti({ bursts }) {
  // A full-screen native View occludes tvOS focus candidates, even with
  // pointerEvents="none". Keep decoration as individual stage-level pieces.
  return bursts.map((b) => <Burst key={b.id} burst={b} />);
}
function Burst({ burst }) {
  const pieces = useRef(null);
  if (!pieces.current) {
    const n = Math.min(MAX_PIECES, burst.count);
    pieces.current = Array.from({ length: n }, (_, i) => {
      const x = 960 + (Math.random() - 0.5) * 900, y = -20 - Math.random() * 300;
      const vx = (Math.random() - 0.5) * 9 * 60, fall = 1120 - y;
      return {
        x, y, dx: vx * 3, fall,
        w: 14 + Math.random() * 14, h: 8 + Math.random() * 10,
        r0: Math.random() * 180, spin: (Math.random() - 0.5) * 1000,
        c: burst.colors[i % burst.colors.length],
        dur: 2600 + Math.random() * 2200,
        v: new Animated.Value(0)
      };
    });
  }
  useEffect(() => {
    Animated.parallel(pieces.current.map((p) =>
      Animated.timing(p.v, { toValue: 1, duration: p.dur, easing: Easing.in(Easing.quad), useNativeDriver: true }))).start();
  }, []);
  return pieces.current.map((p, i) => (
    <Animated.View key={i} pointerEvents="none" accessible={false} style={{
      position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, backgroundColor: p.c,
      transform: [
        { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.fall] }) },
        { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
        { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: [`${p.r0}deg`, `${p.r0 + p.spin}deg`] }) },
        { scaleY: p.v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.2, 1, 0.2, 1] }) }
      ]
    }} />
  ));
}

/* ---------- a gentle pulse (final-round banner) ---------- */
export function Pulse({ active, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { a.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, a]);
  return <Animated.View style={[style, { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}>{children}</Animated.View>;
}

// Winner name springs in (web: @keyframes win).
export function PopIn({ trigger, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(2.5)), useNativeDriver: true }).start();
  }, [trigger, a]);
  return (
    <Animated.View style={[style, { opacity: a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: 999, paddingVertical: 26, paddingHorizontal: 56, borderWidth: 3, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  btnText: { fontSize: 40, fontWeight: "800" },
  btnSmall: { paddingVertical: 12, paddingHorizontal: 24 },
  btnSmallText: { fontSize: 26 },
  chip: { borderRadius: 24, minWidth: 124, paddingVertical: 22, paddingHorizontal: 32, backgroundColor: C.bg2, borderWidth: 3, borderColor: "rgba(244,243,238,0.18)", alignItems: "center" },
  chipText: { fontSize: 40, fontWeight: "800" },
  popWrap: { zIndex: 15, alignItems: "center", justifyContent: "center" },
  popBox: { paddingTop: 20, paddingBottom: 40, paddingHorizontal: 90, borderRadius: 40, borderWidth: 16, borderColor: "rgba(255,255,255,0.9)" },
  popTitle: { fontSize: 300, lineHeight: 300, fontWeight: "900", color: "#fff" },
  popSub: { marginTop: 56, fontSize: 52, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 18, textShadowOffset: { width: 0, height: 4 } }
});
