// Ingredient Dictionary: The Party Game — Apple TV.
// A React Native port of ../party-game (index.html + game.js). tvOS has no
// WebView, so every screen is drawn with native views; the rules live in
// src/logic.js, the look in src/ui.js. Screen ids and wording match the web game.
import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { AppState, BackHandler, Image, Platform, StyleSheet, TVEventControl, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as L from "./src/logic";
import { C, T, F, Btn, Chip, Stamp, Confetti, Pulse, PopIn, FocusContext } from "./src/ui";
import { COVERS, QR, LOGO } from "./src/images";
import { initAudio, playSfx, startMusic as playMusic, stopMusic as haltMusic } from "./src/sound";
import { load, save } from "./src/storage";

const MENU_SCREENS = ["title", "books", "howto", "setup", "order"];
const DEFAULT_FOCUS = { title: "title-play", howto: "howto-play", result: "next", final: "final-start", round: "answer-0" };
const LOCKABLE = new Set(["answer", "reveal", "help", "menu", "extend"]);
const QUIET = new Set(["answer", "reveal", "help", "wager", "sound", "music"]);

let menuKeyOn = null;
function setMenuKey(on) {
  if (menuKeyOn === on) return;
  menuKeyOn = on;
  // On the title screen the Menu button must leave the app (Apple TV convention),
  // everywhere else it is "Back" inside the game.
  try { if (Platform.isTV && TVEventControl) on ? TVEventControl.enableTVMenuKey() : TVEventControl.disableTVMenuKey(); } catch (e) { /* ignore */ }
}

export default function App() {
  const [, render] = useReducer((x) => x + 1, 0);
  const { width, height } = useWindowDimensions();

  // Everything mutable lives in one ref (like the web game's module variables).
  const R = useRef(null);
  if (!R.current) {
    let seen = new Set();
    try { seen = new Set(JSON.parse(load("idpg-seen", "[]"))); } catch (e) { /* ignore */ }
    R.current = {
      settings: L.defaultSettings(),
      soundOn: load("idpg-sound", "on") !== "off",
      musicOn: load("idpg-music", "on") !== "off",
      seen,
      game: null,
      screen: "title",
      modal: null,          // "quit" or null
      steal: null,          // the "Steal it?" offer on screen, or null
      pop: null,            // { good, sub } while the stamp shows
      order: { mode: "pick", tip: "" },
      help: null,           // ingredient help text
      flash: -1,            // ingredient just revealed (gold flash)
      timer: null,          // { total, left, last, id, lastSec }
      final: null, dare: "",
      bursts: [], burstId: 0,
      focus: { target: "title-play", nonce: 0 },
      lastFocused: null, focusBeforeModal: null, quietUntil: 0,
      timeouts: []
    };
  }
  const S = R.current;

  /* ---------- sound ---------- */
  const sfx = (name) => { if (S.soundOn) playSfx(name); };
  const startMusic = (mode = "main") => { if (S.musicOn) playMusic(mode); else haltMusic(); };
  const stopMusic = () => haltMusic();
  const later = (ms, fn) => { const id = setTimeout(fn, ms); S.timeouts.push(id); return id; };

  /* ---------- focus ---------- */
  const focus = (id) => {
    S.focus = { target: id, nonce: S.focus.nonce + 1 };
    S.quietUntil = Date.now() + 350;   // programmatic moves don't make the "move" blip
  };
  const onFocused = useCallback((id) => {
    if (id !== S.lastFocused && Date.now() > S.quietUntil) sfx("move");
    S.lastFocused = id;
    // Focus arrived where the game asked: stop preferring it, so later re-renders
    // never pull focus back while the players move around.
    if (id === S.focus.target) S.focus = { target: null, nonce: S.focus.nonce };
  }, []);

  /* ---------- screens ---------- */
  function show(screen, focusId) {
    S.steal = null;
    S.screen = screen;
    if (screen !== "round") {
      stopTimer();
      if (MENU_SCREENS.includes(screen)) startMusic("main"); else stopMusic();
    }
    focus(focusId || defaultFocus(screen));
    render();
  }
  function defaultFocus(screen) {
    if (screen === "books") return `book-${S.settings.book}`;
    if (screen === "setup") return `teams-${S.settings.teams}`;
    if (screen === "order") return S.order.mode === "pick" ? "order-shuffle" : "order-go";
    return DEFAULT_FOCUS[screen];
  }

  /* ---------- confetti ---------- */
  function confetti(count, colors) {
    const id = ++S.burstId;
    S.bursts = S.bursts.concat({ id, count, colors });
    later(5200, () => { S.bursts = S.bursts.filter((b) => b.id !== id); render(); });
    render();
  }

  /* ---------- answer timer ---------- */
  function startTimer(seconds) {
    stopTimer();
    if (!S.settings.timer || S.screen !== "round") return;
    const total = (seconds || L.TIMER_SECONDS[S.settings.level]) * 1000;
    S.timer = { total, left: total, last: Date.now(), id: 0, lastSec: null };
    resumeTimer();
  }
  function resumeTimer() {
    if (!S.timer) return;
    S.timer.last = Date.now();
    clearInterval(S.timer.id);
    S.timer.id = setInterval(tickTimer, 100);
    tickTimer();
  }
  function pauseTimer() { if (S.timer) clearInterval(S.timer.id); }
  function stopTimer() {
    if (S.timer) clearInterval(S.timer.id);
    S.timer = null;
  }
  function tickTimer() {
    const t = S.timer;
    if (!t) return;
    const now = Date.now();
    t.left -= now - t.last; t.last = now;
    const sec = Math.max(0, Math.ceil(t.left / 1000));
    const urgent = t.left <= 10000;   // last 10 seconds: red bar + ticking
    if (urgent && sec !== t.lastSec && sec > 0) sfx("tick");
    t.lastSec = sec;
    if (t.left <= 0) { stopTimer(); answer(null); return; }
    render();
  }

  /* ---------- settings toggles ---------- */
  function setSound(on) {
    S.soundOn = on;
    save("idpg-sound", on ? "on" : "off");
    if (on) sfx("click");
  }
  function setMusic(on) {
    S.musicOn = on;
    save("idpg-music", on ? "on" : "off");
    if (!on) stopMusic();
    else if (MENU_SCREENS.includes(S.screen) && !S.modal) startMusic("main");
  }
  function saveSeen() { save("idpg-seen", JSON.stringify([...S.seen])); }

  /* ---------- game flow ---------- */
  function chooseBook(book) {
    S.settings.book = book;
    show("setup", `teams-${S.settings.teams}`);
  }
  function pick(key, value) {
    S.settings[key] = value;
    // Guide the remote: teams -> rounds -> level -> timer -> steal -> dare -> Start.
    const next = { teams: `rounds-${S.settings.rounds}`, rounds: `level-${S.settings.level}`, level: `timer-${S.settings.timer}`,
      timer: `steal-${S.settings.steal}`, steal: `dare-${S.settings.dare}`, dare: "setup-start" }[key];
    focus(next);
    render();
  }
  function startGame() {
    S.bursts = [];
    S.game = L.newGame(S.settings, S.seen);
    saveSeen();
    if (S.game.teams > 1) showPick(); else startRound();
  }
  function showPick(focusId) {
    S.order = { mode: "pick", tip: L.pickTip(S.game) };
    show("order", focusId || "order-shuffle");
  }
  function toggleColor(c) {
    L.toggleColor(S.game, c);
    sfx("move");
    S.order.tip = L.pickTip(S.game);
    render();
  }
  function shuffleOrder() {
    const r = L.shuffleOrder(S.game);
    if (!r.ok) { sfx("wrong"); S.order.tip = r.tip; render(); return; }
    S.order = { mode: "shown", tip: "Pass the remote to whoever's turn it is — or let one person be the host." };
    show("order", "order-go");
    sfx("steal");
  }

  function startRound() {
    const g = S.game;
    L.startRound(g, S.seen);
    saveSeen();
    S.help = null; S.flash = -1; S.pop = null;
    if (L.isFinalLapStart(g)) { sfx("final"); confetti(90, ["#F2C46B", "#E07A55"]); }
    show("round", "answer-0");
    startMusic("main");
    if (!L.isWager(g, g.index)) startTimer();
  }
  function placeWager(amount) {
    L.placeWager(S.game, amount);
    sfx("bet");
    focus("answer-0");
    startTimer();   // the bet isn't timed; the question is
    render();
  }
  function reveal(pickIdx) {
    const g = S.game;
    const idx = L.reveal(g, pickIdx);
    if (idx < 0) return;
    S.flash = idx;
    sfx("reveal");
    if (!L.canReveal(g)) focus("answer-0");
    render();
    later(450, () => { if (S.flash === idx) { S.flash = -1; render(); } });
  }
  function help(i) {
    const r = L.help(S.game, i);
    if (r.first) sfx("help");
    S.help = r;
    render();
  }
  function extendTime() {
    const g = S.game;
    if (!L.canExtend(g, !!S.timer)) return;
    L.applyExtend(g);
    S.timer.left += L.EXTEND_SECONDS * 1000;
    S.timer.total = Math.max(S.timer.total, S.timer.left);
    S.timer.lastSec = null;
    sfx("bet");
    focus("answer-0");   // the +15 sec button goes away
    render();
  }

  // Big CORRECT! / WRONG! stamp over the question, then carry on.
  function showPop(good, sub, then) {
    S.pop = { good, sub };
    S.game.locked = true;   // no clicks or keys while the stamp is on screen
    render();
    later(1600, () => {
      S.pop = null;
      if (S.game) S.game.locked = false;
      if (S.screen === "round") then(); else render();
    });
  }
  function answer(choice) {
    const g = S.game;
    if (!g || g.locked) return;
    stopMusic(); stopTimer();
    const r = L.answer(g, choice);
    sfx(r.sfx);
    if (r.type === "miss") {
      showPop(false, r.popSub, () => { if (g.chain) offerSteal(); });
      return;
    }
    if (r.confetti) confetti(r.confetti.count, r.confetti.colors);
    showPop(r.pop.good, r.pop.sub, showResult);
  }
  function offerSteal() {
    const r = L.offerSteal(S.game);
    if (r.type === "nobody") { showResult(); return; }
    S.steal = r;
    focus(`stealer-${r.teams[0]}`);
    render();
    startMusic("suspense");
    sfx("steal");
  }
  function startSteal(team) {
    const g = S.game;
    S.steal = null;
    L.startSteal(g, team);
    S.help = { stealNote: true };
    const first = g.options.findIndex((o) => !L.isStruck(g, o));
    focus(`answer-${Math.max(0, first)}`);
    render();
    startMusic("suspense");
    startTimer(L.STEAL_SECONDS);
  }
  function noSteal() {
    S.steal = null;
    L.nobodyGotIt(S.game);
    showResult();
  }
  function showResult() {
    S.game.steal = null;
    S.result = L.resultInfo(S.game);
    S.game.chain = null;
    show("result", "next");
  }
  function next() {
    if (L.advance(S.game)) finish(); else startRound();
  }
  function finish() {
    const g = S.game;
    S.final = L.finish(g);
    S.dare = S.final.dareWho ? L.pickDare("") : "";
    sfx("win");
    if (S.final.dareWho) later(2600, () => { if (S.screen === "final") sfx("dare"); });
    show("final", "final-start");
    confetti(260, S.final.winColors.concat(["#F2C46B", "#F4F3EE"]));
    later(900, () => { if (S.screen === "final") { confetti(160, S.final.winColors.concat(["#F2C46B"])); render(); } });
  }

  /* ---------- pause menu ---------- */
  function toggleTimer() {
    S.settings.timer = S.settings.timer ? 0 : 1;
    if (!S.settings.timer) stopTimer();
  }
  function toggleSteal() { S.settings.steal = S.settings.steal ? 0 : 1; }
  function openQuit() {
    stopMusic(); pauseTimer();
    S.focusBeforeModal = S.lastFocused;
    S.modal = "quit";
    focus("quit-no");
    render();
  }
  function closeQuit() {
    const g = S.game;
    S.modal = null;
    focus(S.focusBeforeModal || defaultFocus(S.screen));
    if (S.screen === "round" && g) {
      startMusic(g.steal || S.steal ? "suspense" : "main");
      // Timer just switched on: start the clock now (after the bet on the finale).
      if (S.settings.timer && !S.timer && !g.locked && !S.steal && !L.needsWager(g)) startTimer(g.steal ? L.STEAL_SECONDS : undefined);
      else resumeTimer();
    }
    render();
  }

  /* ---------- actions (same names as the web game's data-action) ---------- */
  function act(action, arg) {
    const g = S.game;
    if (g && g.locked && LOCKABLE.has(action)) return;
    if (!QUIET.has(action)) sfx("click");
    switch (action) {
      case "teams": case "rounds": case "level": case "timer": case "steal": case "dare": pick(action, arg); break;
      case "sfx": setSound(arg); render(); break;
      case "tune": setMusic(arg); render(); break;
      case "book": chooseBook(arg); break;
      case "books": show("books"); break;
      case "howto": show("howto"); break;
      case "title": show("title"); break;
      case "start": startGame(); break;
      case "go": startRound(); break;
      case "shuffle-order": shuffleOrder(); break;
      case "pick-colors": showPick(); break;
      case "color": toggleColor(arg); break;
      case "setup": show("setup", "setup-start"); break;
      case "reveal": reveal(arg); break;
      case "extend": extendTime(); break;
      case "answer": answer(arg); break;
      case "next": next(); break;
      case "new-dare": S.dare = L.pickDare(S.dare); render(); break;
      case "help": help(arg); break;
      case "stealer": startSteal(arg); break;
      case "no-steal": noSteal(); break;
      case "wager": placeWager(arg); break;
      case "quit-yes": S.modal = null; show("title"); break;
      case "menu": openQuit(); break;
      case "sound": setSound(!S.soundOn); render(); break;
      case "music": setMusic(!S.musicOn); render(); break;
      case "timer-toggle": toggleTimer(); render(); break;
      case "steal-toggle": toggleSteal(); render(); break;
      case "change-game": S.modal = null; show("books"); break;
      case "quit-no": closeQuit(); break;
    }
  }
  const A = (action, arg) => () => act(action, arg);

  // Menu button on the Siri Remote (web: Back / Esc).
  function back() {
    const g = S.game;
    if (g && g.locked) return true;
    if (S.modal) { closeQuit(); return true; }
    if (S.steal) return true;   // pick a team or "No steal"
    if (S.screen === "round" || S.screen === "result") { openQuit(); return true; }
    if (S.screen === "setup") { act("books"); return true; }
    if (S.screen === "order") { act(S.order.mode === "shown" ? "pick-colors" : "setup"); return true; }
    if (S.screen !== "title") { show("title"); return true; }
    return false;   // title screen: let tvOS go back to the Home screen
  }
  const backRef = useRef(back);
  backRef.current = back;

  /* ---------- lifecycle ---------- */
  useEffect(() => {
    initAudio();
    startMusic("main");
    const sub = BackHandler.addEventListener("hardwareBackPress", () => backRef.current());
    // If the Apple TV goes to sleep or another app takes over, pause the clock and the music.
    const app = AppState.addEventListener("change", (st) => {
      if (st !== "active") { stopMusic(); pauseTimer(); return; }
      if (MENU_SCREENS.includes(S.screen)) startMusic("main");
      if (S.screen === "round" && S.game && !S.modal) {
        resumeTimer();
        startMusic(S.game.steal || S.steal ? "suspense" : "main");
      }
    });
    return () => {
      sub.remove(); app.remove();
      S.timeouts.forEach(clearTimeout);
      stopTimer(); stopMusic();
    };
  }, []);
  useEffect(() => { setMenuKey(S.screen !== "title" || !!S.modal); });

  /* ---------- render ---------- */
  const scale = Math.min(width / 1920, height / 1080);
  const focusCtx = { target: S.focus.target, nonce: S.focus.nonce, onFocused };
  const overlay = !!(S.modal || S.steal);
  let body = null;
  switch (S.screen) {
    case "title": body = <TitleScreen S={S} A={A} />; break;
    case "howto": body = <HowToScreen A={A} />; break;
    case "books": body = <BooksScreen A={A} />; break;
    case "setup": body = <SetupScreen S={S} A={A} />; break;
    case "order": body = <OrderScreen S={S} A={A} />; break;
    case "round": body = <RoundScreen S={S} A={A} overlay={overlay} />; break;
    case "result": body = <ResultScreen S={S} A={A} overlay={overlay} />; break;
    case "final": body = <FinalScreen S={S} A={A} />; break;
  }
  return (
    <View style={st.root}>
      {Platform.isTV ? null : <StatusBar hidden />}
      <FocusContext.Provider value={focusCtx}>
        <View style={[st.stage, { left: (width - 1920) / 2, top: (height - 1080) / 2, transform: [{ scale }] }]}>
          <View style={st.screen} key={S.screen}>{body}</View>
          <Stamp pop={S.pop} />
          {S.steal ? <StealModal S={S} A={A} /> : null}
          {S.modal === "quit" ? <QuitModal S={S} A={A} /> : null}
          <Confetti bursts={S.bursts} />
        </View>
      </FocusContext.Provider>
    </View>
  );
}

/* =================== screens =================== */

function Row({ children, style }) { return <View style={[st.row, style]}>{children}</View>; }
const onOff = (on) => (on ? "On" : "Off");

function TitleScreen({ S, A }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingBottom: 110 }}>
      <T style={st.series}>INGREDIENT DICTIONARY</T>
      <T serif style={st.logo}>The <T serif style={st.logoPop}>Party</T>{"\n"}Game</T>
      <T serif style={st.hook}>Snack or Shampoo?</T>
      <T style={st.tag}>Read the ingredient list. Guess the product.{"\n"}Fewer clues, more points.</T>
      <Row>
        <Btn id="title-play" primary label="Play" onPress={A("books")} />
        <Btn id="title-howto" label="How to play" onPress={A("howto")} />
        <Btn id="title-sound" label={`Sound: ${onOff(S.soundOn)}`} onPress={A("sound")} />
        <Btn id="title-music" label={`Music: ${onOff(S.musicOn)}`} onPress={A("music")} />
      </Row>
      <View style={st.credit}><T style={st.creditText}>From the <T style={[st.creditText, { color: C.inkSoft, fontWeight: "800" }]}>Ingredient Dictionary</T> book series by Maeser</T></View>
    </View>
  );
}

// [bold, plain, italic] pieces for each "How to play" line (web: #s-howto .steps).
const STEPS = [
  [["b", "Split into teams"], " and pick your colors. The TV shuffles who goes first. ", ["i", "No arguing."]],
  [["b", "Read the 3 ingredients"], " and guess the product. ", ["i", "Snack or Shampoo?"]],
  [["b", "Look it up — free."], " Select any ingredient to see its definition. It costs nothing."],
  [["b", "Need another clue?"], " Press ", ["b", "Next ingredient"], " or select a covered box to reveal one more (−1 point)."],
  [["b", "Right answer = points."], " Wrong answer = zero. ", ["i", "And a little shame."]],
  [["b", "Steal!"], " Miss it and the first team to yell ", ["b", "“STEAL!”"], " tries for half the points. Miss, lose them."],
  [["warn", "Red"], " ingredients are worth knowing about. ", ["unknown", "Amber"], " ones are kept secret."],
  [["b", "Points go up"], " every round, and your last round counts double. ", ["i", "Comebacks happen."]],
  [["b", "Hard mode"], " starts with the weird chemicals and pays more. ", ["i", "Sweating optional."]],
  [["b", "Timer"], " (optional): Easy 60 sec, Medium 45, Hard 30, steals 10. Buy +15 sec once."],
  [["b", "Finale:"], " bet your points on toilet paper trivia. Lowest score does a dare. ", ["i", "Yes, really."]]
];
const PIECE = { b: { color: C.ink, fontWeight: "800" }, i: { color: C.gold, fontStyle: "italic" }, warn: { color: "#F08A80" }, unknown: { color: C.gold } };

function HowToScreen({ A }) {
  return (
    <View style={{ flex: 1 }}>
      <T serif style={[st.h2, { marginTop: 0, marginBottom: 24 }]}>How to play</T>
      <View style={{ marginBottom: 26 }}>
        {STEPS.map((parts, k) => (
          <View key={k} style={st.stepRow}>
            <View style={st.stepDot} />
            <T style={st.stepText} numberOfLines={1}>
              {parts.map((p, j) => (typeof p === "string" ? p : <T key={j} style={[st.stepText, PIECE[p[0]]]}>{p[1]}</T>))}
            </T>
          </View>
        ))}
      </View>
      <T style={st.hint}>Siri Remote: <T style={st.hintB}>swipe or press the edges</T> to move, <T style={st.hintB}>click</T> to pick. Pass it to the team whose turn it is. <T style={st.hintB}>Back</T> pauses the game.</T>
      <Row>
        <Btn id="howto-play" primary label="Let's play" onPress={A("books")} />
        <Btn id="howto-back" label="Back" onPress={A("title")} />
      </Row>
    </View>
  );
}

function BooksScreen({ A }) {
  const keys = Object.keys(L.BOOKS);
  return (
    <View style={{ flex: 1 }}>
      <T style={[st.series, st.seriesSmall]}>INGREDIENT DICTIONARY</T>
      <T serif style={[st.h2, { marginTop: 4 }]}>Pick your book</T>
      <View style={st.books}>
        {keys.map((key) => (
          <F key={key} id={`book-${key}`} radius={20} onPress={A("book", key)} style={st.book} focusedStyle={{ backgroundColor: C.bg2 }}>
            <Image source={COVERS[key]} style={st.bookImg} resizeMode="cover" />
            <T style={st.bookName}>{L.BOOKS[key].name}</T>
            <T style={st.bookCount}>{L.deckFor(key).length} {L.BOOKS[key].trueFalse ? "true or false" : "puzzles"}</T>
          </F>
        ))}
        <F id="book-all" radius={20} onPress={A("book", "all")} style={st.book} focusedStyle={{ backgroundColor: C.bg2 }}>
          <View style={[st.bookImg, st.mix]}>
            {keys.map((key) => <Image key={key} source={COVERS[key]} style={st.mixImg} resizeMode="cover" />)}
          </View>
          <T style={st.bookName}>Mix all books</T>
          <T style={st.bookCount}>{L.PUZZLES.length} puzzles</T>
        </F>
      </View>
      <Row><Btn id="books-back" label="Back" onPress={A("title")} /></Row>
    </View>
  );
}

function Setting({ label, children }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <T style={st.settingLabel}>{label}</T>
      <View style={[st.row, { gap: 20, flexWrap: "nowrap" }]}>{children}</View>
    </View>
  );
}
function SetupScreen({ S, A }) {
  const set = S.settings;
  const chips = (key, opts) => opts.map(([v, label]) => (
    <Chip key={v} id={`${key}-${v}`} label={label} selected={set[key] === v} onPress={A(key, v)} />
  ));
  const toggle = (key, on) => [[1, "On"], [0, "Off"]].map(([v, label]) => (
    <Chip key={v} id={`${key}-${v}`} label={label} selected={(v === 1) === on} onPress={A(key, v === 1)} />
  ));
  return (
    <View style={{ flex: 1 }}>
      <T style={[st.series, st.seriesSmall]}>{L.bookLabel(set.book).toUpperCase()}</T>
      <T serif style={[st.h2, { marginTop: 4, marginBottom: 26 }]}>Game setup</T>
      <View style={{ flexDirection: "row", gap: 100 }}>
        <View>
          <Setting label="Teams">{chips("teams", [[1, "Solo"], [2, "2"], [3, "3"], [4, "4"]])}</Setting>
          <Setting label="Rounds per team">{chips("rounds", [[3, "3"], [5, "5"], [8, "8"]])}</Setting>
          <Setting label="Difficulty — which ingredients show first">{chips("level", [[1, "Easy"], [2, "Medium"], [3, "Hard"]])}</Setting>
        </View>
        <View>
          <Setting label="Answer timer">{chips("timer", [[1, "On"], [0, "Off"]])}</Setting>
          <Setting label="Steals">{chips("steal", [[1, "On"], [0, "Off"]])}</Setting>
          <Setting label="Loser's dare">{chips("dare", [[1, "On"], [0, "Off"]])}</Setting>
        </View>
        <View>
          <Setting label="Sound">{toggle("sfx", S.soundOn)}</Setting>
          <Setting label="Music">{toggle("tune", S.musicOn)}</Setting>
        </View>
      </View>
      <T style={st.total}>{L.setupTotalText(set)}</T>
      <Row style={{ marginTop: 30 }}>
        <Btn id="setup-start" primary label="Start game" onPress={A("start")} />
        <Btn id="setup-back" label="Back" onPress={A("books")} />
      </Row>
    </View>
  );
}

function OrderScreen({ S, A }) {
  const g = S.game;
  const picking = S.order.mode === "pick";
  return (
    <View style={{ flex: 1 }}>
      <T style={[st.series, st.seriesSmall]}>{picking ? "BEFORE WE START" : "THE TV SHUFFLED THE TEAMS"}</T>
      <T serif style={[st.h2, { marginTop: 4, marginBottom: 0 }]}>{picking ? "Pick your team colors" : "Here's who goes first"}</T>
      <View style={st.orderList}>
        {picking
          ? L.TEAM_NAMES.map((name, c) => {
            const on = g.colors.includes(c), color = L.TEAM_COLORS_HEX[c];
            return (
              <F key={c} id={`color-${c}`} radius={24} scale={1.04} onPress={A("color", c)}
                style={[st.orderCard, on ? { backgroundColor: color, borderColor: color } : { borderColor: color, backgroundColor: "transparent" }]}>
                <T style={[st.orderN, { color: on ? "#16181A" : color }]}>{on ? "✓ Playing" : "Not playing"}</T>
                <T serif style={[st.orderName, { color: on ? "#16181A" : color }]}>{name}</T>
              </F>
            );
          })
          : g.turnOrder.map((t, k) => (
            <View key={t} style={[st.orderCard, { backgroundColor: L.teamHex(g, t), borderColor: L.teamHex(g, t) }, k === 0 && { transform: [{ scale: 1.06 }] }]}>
              <T style={[st.orderN, { color: "#16181A", opacity: 0.75 }]}>{["1st", "2nd", "3rd", "4th"][k]}</T>
              <T serif style={[st.orderName, { color: "#16181A" }]}>{L.teamName(g, t)}</T>
            </View>
          ))}
      </View>
      <T style={st.orderTip}>{S.order.tip}</T>
      <Row>
        {picking ? (
          <>
            <Btn id="order-shuffle" primary label="Shuffle the order" onPress={A("shuffle-order")} />
            <Btn id="order-back" label="Back" onPress={A("setup")} />
            <Btn id="order-menu" label="Menu" onPress={A("title")} />
          </>
        ) : (
          <>
            <Btn id="order-go" primary label="Let's go" onPress={A("go")} />
            <Btn id="order-shuffle" label="Shuffle again" onPress={A("shuffle-order")} />
            <Btn id="order-pick" label="Back" onPress={A("pick-colors")} />
            <Btn id="order-menu" label="Menu" onPress={A("title")} />
          </>
        )}
      </Row>
    </View>
  );
}

/* ---------- round ---------- */
function Hud({ S }) {
  const g = S.game, p = L.currentPuzzle(g);
  const crowded = g.teams >= 3;
  const stake = L.stakes(g);
  const turnTeam = g.steal ? g.steal.team : g.team;
  const turnText = g.steal ? L.teamName(g, g.steal.team) + " — steal it!" : g.teams === 1 ? "Your turn" : L.teamName(g, g.team) + "'s turn";
  const finaleQ = p.type === "tf" && g.book !== "tp";
  const bookName = finaleQ ? L.BOOKS.tp.name : g.book === "all" ? "All books" : L.BOOKS[g.book].name;
  return (
    <View style={[st.hud, crowded && { gap: 20 }]}>
      <View style={st.turnWrap}>
        <T serif style={[st.turn, crowded && { fontSize: 50 }, { color: L.teamHex(g, turnTeam) }]} numberOfLines={1}>{turnText}</T>
        {stake ? (
          <Pulse active={stake.kind === "final"} style={[st.stakes, stake.kind === "final" && st.stakesFinal, stake.kind === "steal" && st.stakesSteal]}>
            <T style={[st.stakesText, stake.kind !== "up" && { color: "#1A1C1E" }]} numberOfLines={1}>{stake.text.toUpperCase()}</T>
          </Pulse>
        ) : null}
      </View>
      <View style={[st.scores, crowded && { gap: 10 }]}>
        {g.teams === 1 ? (
          <View style={[st.score, { borderColor: L.teamHex(g, 0) }]}>
            <View style={[st.scoreDot, { backgroundColor: L.teamHex(g, 0) }]} />
            <T style={st.scoreText}>{g.scores[0]} pts</T>
          </View>
        ) : g.turnOrder.map((i) => {
          const on = g.steal ? i === g.steal.team : i === g.team;
          return (
            <View key={i} style={[st.score, crowded && { paddingVertical: 8, paddingHorizontal: 16, gap: 10 }, on && { borderColor: L.teamHex(g, i) }]}>
              <View style={[st.scoreDot, { backgroundColor: L.teamHex(g, i) }]} />
              <T style={[st.scoreText, crowded && { fontSize: 30 }]}>{g.scores[i]}</T>
            </View>
          );
        })}
      </View>
      <View>
        <T style={[st.roundBook, crowded && { fontSize: 22 }]}>{bookName.toUpperCase()}</T>
        <T style={[st.progress, crowded && { fontSize: 26 }]}>Round {g.index + 1} of {g.deck.length}</T>
      </View>
    </View>
  );
}

// Long labels shrink their text so every ingredient stays on screen (web: fitIngredients).
function Ingredients({ S, A, overlay }) {
  const g = S.game, p = L.currentPuzzle(g);
  const [size, setSize] = React.useState(34);
  const box = useRef({ h: 0, c: 0 });
  const key = g.index + ":" + g.shown;
  useEffect(() => { setSize(34); }, [key]);
  const check = () => {
    if (box.current.h && box.current.c > box.current.h + 1 && size > 22) setSize(size - 2);
  };
  return (
    <View style={st.ingBox} onLayout={(e) => { box.current.h = e.nativeEvent.layout.height; check(); }}>
      <View style={st.ingWrap} onLayout={(e) => { box.current.c = e.nativeEvent.layout.height; check(); }}>
        {p.ingredients.map((ing, i) => {
          const open = g.open.has(i);
          if (!open) {
            return (
              <F key={i} id={`ing-${i}`} radius={12} scale={1.05} ringWidth={6} focusable={!overlay && !g.steal}
                onPress={A("reveal", i)} style={[st.ing, st.ingHidden]}>
                <T style={[st.ingText, { fontSize: size, color: "transparent" }]}>{ing}</T>
              </F>
            );
          }
          const info = L.watchInfo(ing);
          const looked = g.helped.has(i);
          return (
            <F key={i} id={`ing-${i}`} radius={12} scale={1.05} ringWidth={6} focusable={!overlay} onPress={A("help", i)}
              style={[st.ing, info && (info.level === "warn" ? st.ingWarn : st.ingUnknown), looked && st.ingLooked, S.flash === i && { backgroundColor: C.gold }]}>
              <T style={[st.ingText, { fontSize: size }, info && { color: info.level === "warn" ? C.warnInk : C.unknownInk }]}>{ing}</T>
              {info ? <View style={[st.key, { backgroundColor: info.level === "warn" ? C.warnInk : C.unknownInk }]}><T style={st.keyText}>{info.level === "warn" ? "!" : "?"}</T></View> : null}
            </F>
          );
        })}
      </View>
    </View>
  );
}

function HelpBox({ S }) {
  const h = S.help;
  let text;
  if (!h) {
    text = <T style={st.helpText}>Select an ingredient to see what it is <T style={[st.helpInline, { color: "#82817B" }]}>(free)</T></T>;
  } else if (h.stealNote) {
    text = <T style={st.helpText}>Steal round: ingredient help is free.</T>;
  } else {
    const col = h.info ? (h.info.level === "warn" ? C.warnInk : C.unknownInk) : C.labelInk;
    text = (
      <T style={[st.helpText, { color: C.labelInk }]}>
        <T style={[st.helpInline, { color: C.labelInk, fontWeight: "800" }]}>{h.ingredient}:</T> {h.what}
        {h.info ? <T style={[st.helpInline, { color: col, fontWeight: "800" }]}>{"  " + h.info.tag}</T> : null}
      </T>
    );
  }
  return (
    <View style={st.help}>
      <View style={st.legend}>
        <View style={[st.key, { backgroundColor: C.warnInk, marginLeft: 0 }]}><T style={st.keyText}>!</T></View>
        <T style={st.legendText}> worth knowing   </T>
        <View style={[st.key, { backgroundColor: C.unknownInk, marginLeft: 0 }]}><T style={st.keyText}>?</T></View>
        <T style={st.legendText}> not fully disclosed</T>
      </View>
      {text}
    </View>
  );
}

function RoundScreen({ S, A, overlay }) {
  const g = S.game, p = L.currentPuzzle(g);
  const tf = p.type === "tf";
  const wagerFirst = L.needsWager(g);
  const t = S.timer;
  const urgent = t && t.left <= 10000;
  const canExtend = L.canExtend(g, !!t);
  const answers = wagerFirst
    ? L.wagerChoices(g).map((w) => ({ label: w.label, action: "wager", value: w.value }))
    : g.options.map((o) => ({ label: o, action: "answer", value: o }));
  const tfLayout = tf && !wagerFirst;
  return (
    <View style={{ flex: 1 }}>
      <Hud S={S} />
      <View style={st.roundBody}>
        <View style={[st.labelCard, { flex: 1.12 }]}>
          <View style={[st.labelHead, t && { paddingRight: 96 }]}>
            <T style={st.labelHeadText}>{tf ? "TRUE OR FALSE?" : "INGREDIENTS:"}</T>
            <View style={st.worth}><T style={st.worthText}>{L.worthText(g)}</T></View>
            {t ? <View style={[st.timerBar, { width: `${Math.max(0, (t.left / t.total) * 100)}%` }, urgent && { backgroundColor: C.warnInk }]} /> : null}
          </View>
          {t ? (
            <View style={[st.clock, { borderColor: urgent ? C.warnInk : "#3F8F62" }]}>
              <T style={[st.clockNum, urgent && { color: C.warnInk }]}>{Math.max(0, Math.ceil(t.left / 1000))}</T>
            </View>
          ) : null}
          {tf ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <T serif style={st.statement}>{wagerFirst ? L.wagerPrompt(g) : p.statement}</T>
            </View>
          ) : (
            <>
              <Ingredients S={S} A={A} overlay={overlay} />
              <HelpBox S={S} />
            </>
          )}
          <View style={st.cardFoot}>
            {!tf ? <Btn id="reveal" small ghost label="Next ingredient" onPress={A("reveal")} focusable={!overlay && L.canReveal(g)}
              style={!L.canReveal(g) && { opacity: 0.35 }} /> : null}
            {canExtend ? <Btn id="extend" small ghost label={L.extendLabel(g)} onPress={A("extend")} focusable={!overlay} /> : null}
            <View style={{ flex: 1 }} />
            <Btn id="menu" small ghost label="Menu" onPress={A("menu")} focusable={!overlay} />
          </View>
        </View>
        <View style={[st.answers, { flex: 1 }]}>
          {answers.map((it, i) => {
            const struck = it.action === "answer" && L.isStruck(g, it.value);
            return (
              <F key={it.action + i} id={`answer-${i}`} radius={24} focusable={!overlay && !struck} onPress={A(it.action, it.value)}
                style={[st.answer, { backgroundColor: C.a[i % 4] }, tfLayout && { justifyContent: "center" }, struck && { opacity: 0.35 }]}>
                {!tfLayout ? <View style={st.answerN}><T style={st.answerNText}>{i + 1}</T></View> : null}
                <T style={[st.answerText, tfLayout && { fontSize: 72, flex: 0 }, struck && { textDecorationLine: "line-through" }]}>{it.label}</T>
              </F>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function StealModal({ S, A }) {
  const g = S.game, o = S.steal;
  return (
    <View style={st.modal}>
      <View style={[st.modalBox, { minWidth: 900 }]}>
        <T style={st.stealKicker}>{o.kicker.toUpperCase()}</T>
        <T serif style={[st.modalTitle, { fontSize: 110, marginTop: 6, marginBottom: 10 }]}>Steal it?</T>
        <T style={st.stealSub}>{o.sub}</T>
        <View style={st.menuList}>
          {o.teams.map((i) => (
            <Btn key={i} id={`stealer-${i}`} label={`${L.teamName(g, i)} yelled first`} onPress={A("stealer", i)}
              style={{ backgroundColor: L.teamHex(g, i), borderColor: L.teamHex(g, i) }} textStyle={{ color: "#1A1C1E", fontSize: 44 }} />
          ))}
          <Btn id="no-steal" label="No steal — show the answer" onPress={A("no-steal")} />
        </View>
      </View>
    </View>
  );
}

function QuitModal({ S, A }) {
  return (
    <View style={st.modal}>
      <View style={st.modalBox}>
        <T serif style={st.modalTitle}>Game paused</T>
        <View style={st.menuList}>
          <Btn id="quit-no" primary label="Resume game" onPress={A("quit-no")} />
          <View style={st.toggleGrid}>
            <Btn id="quit-sound" label={`Sound: ${onOff(S.soundOn)}`} onPress={A("sound")} style={st.toggleBtn} />
            <Btn id="quit-music" label={`Music: ${onOff(S.musicOn)}`} onPress={A("music")} style={st.toggleBtn} />
          </View>
          <View style={st.toggleGrid}>
            <Btn id="quit-timer" label={`Timer: ${onOff(S.settings.timer)}`} onPress={A("timer-toggle")} style={st.toggleBtn} />
            <Btn id="quit-steal" label={`Steals: ${onOff(S.settings.steal)}`} onPress={A("steal-toggle")} style={st.toggleBtn} />
          </View>
          <Btn id="quit-change" label="Change game or options" onPress={A("change-game")} />
          <Btn id="quit-yes" label="Quit to main menu" onPress={A("quit-yes")} />
        </View>
      </View>
    </View>
  );
}

/* ---------- answer screen ---------- */
function ResultScreen({ S, A, overlay }) {
  const r = S.result;
  const solo = !r.watch.length;
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 88 }}>
        <View style={{ flex: 1 }}>
          <T style={[st.verdict, { color: r.verdict.good ? C.good : C.bad }]}>{r.verdict.text}</T>
          <T serif style={st.rAnswer}>{r.answer}</T>
          <View style={st.spot}>
            <T style={st.spotTag}>{r.spotTag.toUpperCase()}</T>
            <T serif style={st.spotName}>{r.spotName}</T>
            <T style={st.spotNote}>{r.spotNote}</T>
          </View>
          <Row>
            <Btn id="next" primary onPress={A("next")} focusable={!overlay}>
              <T style={[st.btnText, { color: "#1A1C1E" }]}>{r.next.text}</T>
              {r.next.team !== undefined ? (
                <>
                  <View style={[st.nextDot, { backgroundColor: r.next.color }]} />
                  <T style={[st.btnText, { color: "#1A1C1E" }]}>{r.next.teamName}</T>
                </>
              ) : null}
            </Btn>
            <Btn id="result-menu" ghostDark label="Menu" onPress={A("menu")} focusable={!overlay} style={{ paddingVertical: 22, paddingHorizontal: 44 }} textStyle={{ fontSize: 34 }} />
          </Row>
        </View>
        <View style={{ width: 600, gap: 36 }}>
          {!solo ? (
            <View style={st.watch}>
              <T style={st.spotTag}>INGREDIENTS TO KNOW ABOUT</T>
              <View style={{ gap: 14, marginTop: 18 }}>
                {r.watch.map((w, i) => (
                  <View key={i} style={[st.watchItem, { borderLeftColor: w.level === "warn" ? "rgba(224,106,95,0.85)" : C.gold }]}>
                    <T style={st.watchName}>{w.names}</T>
                    <T style={[st.watchTag, { color: w.level === "warn" ? "#F3B3AB" : C.gold }]}>{w.tag}</T>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View style={[st.rBook, solo && { flexDirection: "column", alignItems: "center" }]}>
            <Image source={COVERS[r.book]} style={[st.rCover, solo && { width: 300, height: 480 }]} resizeMode="cover" />
            <T style={[st.rBookText, solo && { textAlign: "center" }]}>Learn more in{"\n"}<T style={{ fontSize: 30, lineHeight: 40, color: C.ink, fontWeight: "800" }}>{r.bookTitle}</T></T>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ---------- final scores ---------- */
function FinalScreen({ S, A }) {
  const f = S.final;
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 72 }}>
        <View style={{ flex: 1 }}>
          <T serif style={st.kicker}>Game over</T>
          <PopIn trigger={f}>
            <T serif style={[st.winner, f.winnerColor && { color: f.winnerColor }]}>{f.winner}</T>
          </PopIn>
          {f.list.length ? (
            <View style={{ marginBottom: 32 }}>
              {f.list.map((o) => (
                <View key={o.team} style={st.finalRow}>
                  <View style={[st.finalDot, { backgroundColor: o.color }]} />
                  <T style={st.finalText}>{o.text}</T>
                </View>
              ))}
            </View>
          ) : null}
          {f.dareWho ? (
            <View style={st.dare}>
              <View style={st.dareHead}>
                <T style={st.dareTag}>{f.dareWho.toUpperCase()}</T>
                <Btn id="new-dare" small label="New dare" onPress={A("new-dare")} />
              </View>
              <T style={st.dareText}>{S.dare}</T>
            </View>
          ) : null}
          <Row style={{ gap: 22, flexWrap: "nowrap" }}>
            <Btn id="final-start" primary label="Play again" onPress={A("start")} style={st.finalBtn} textStyle={{ fontSize: 34 }} />
            <Btn id="final-books" label="Change game" onPress={A("books")} style={st.finalBtn} textStyle={{ fontSize: 34 }} />
            <Btn id="final-title" label="Main menu" onPress={A("title")} style={st.finalBtn} textStyle={{ fontSize: 34 }} />
          </Row>
        </View>
        <View style={st.promo}>
          <T style={st.promoKicker}>What's really in your stuff?</T>
          <View style={st.qrWrap}>
            <Image source={f.promoBook ? QR[f.promoBook] : QR.all} style={{ width: 400, height: 400 }} resizeMode="contain" />
            <View style={[st.qrCoverBox, !f.promoBook && { width: 122, height: 122, marginLeft: -61, marginTop: -61 }]}>
              <Image source={f.promoBook ? COVERS[f.promoBook] : LOGO} style={f.promoBook ? { width: 78, height: 124 } : { width: 110, height: 110 }} resizeMode="cover" />
            </View>
          </View>
          <T style={st.promoTitle}>Scan to get{"\n"}<T style={{ fontSize: 32, lineHeight: 42, fontWeight: "800", color: C.labelInk }}>{f.promoTitle}</T></T>
          <View style={st.getBook}><T style={st.getBookText} numberOfLines={1}>{f.promoLink} →</T></View>
        </View>
      </View>
    </View>
  );
}

/* =================== styles =================== */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  stage: { position: "absolute", width: 1920, height: 1080, backgroundColor: C.bg, overflow: "hidden" },
  screen: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, paddingVertical: 64, paddingHorizontal: 112 },
  row: { flexDirection: "row", alignItems: "center", gap: 28, flexWrap: "wrap" },
  h2: { fontSize: 84, fontWeight: "900", marginTop: 24, marginBottom: 40 },
  kicker: { fontStyle: "italic", fontSize: 44, color: C.pop, marginBottom: 8 },
  series: { fontSize: 40, fontWeight: "800", letterSpacing: 11, color: C.gold, marginBottom: 18 },
  seriesSmall: { fontSize: 28, letterSpacing: 8, marginBottom: 0 },
  logo: { fontSize: 206, lineHeight: 190, fontWeight: "900", marginBottom: 56, letterSpacing: -4 },
  logoPop: { fontSize: 206, fontWeight: "900", color: C.pop, fontStyle: "italic", letterSpacing: -4 },
  hook: { fontStyle: "italic", fontWeight: "600", fontSize: 72, lineHeight: 80, color: C.gold, marginBottom: 18 },
  tag: { fontSize: 48, lineHeight: 65, color: C.inkSoft, marginBottom: 64 },
  credit: { position: "absolute", left: 0, bottom: -8 },
  creditText: { fontSize: 30, color: C.muted },
  btnText: { fontSize: 40, fontWeight: "800" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 11 },
  stepDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.pop, marginLeft: 8, marginRight: 26, marginTop: 17 },
  stepText: { fontSize: 36, lineHeight: 49, color: C.inkSoft },
  hint: { fontSize: 28, color: C.muted, marginBottom: 30 },
  hintB: { fontSize: 28, fontWeight: "800", color: C.inkSoft },
  books: { flexDirection: "row", gap: 24, marginBottom: 40 },
  book: { flex: 1, padding: 14, borderRadius: 20, alignItems: "center", gap: 18 },
  bookImg: { width: 192, height: 307, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: "#fff" },
  mix: { backgroundColor: C.bg2, padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mixImg: { width: 83, height: 91, borderRadius: 3 },
  bookName: { fontSize: 28, lineHeight: 34, fontWeight: "800", textAlign: "center" },
  bookCount: { fontSize: 24, color: C.muted, fontWeight: "700", marginTop: -10, textAlign: "center" },
  settingLabel: { fontSize: 34, color: C.inkSoft, marginBottom: 16, fontWeight: "700" },
  total: { fontSize: 34, fontWeight: "700", color: C.gold, marginTop: 8 },
  orderList: { marginTop: 30, marginBottom: 34, flexDirection: "row", gap: 28 },
  orderCard: { flex: 1, maxWidth: 380, minHeight: 210, borderRadius: 24, borderWidth: 6, paddingTop: 30, paddingHorizontal: 32, paddingBottom: 34, gap: 8 },
  orderN: { fontSize: 34, fontWeight: "800" },
  orderName: { fontWeight: "900", fontSize: 56, lineHeight: 60 },
  orderTip: { fontSize: 34, maxWidth: 1400, marginBottom: 40, color: C.muted },
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 32, marginBottom: 40 },
  turnWrap: { flexDirection: "row", alignItems: "center", gap: 22, flexShrink: 1 },
  turn: { fontWeight: "900", fontSize: 58, flexShrink: 1 },
  stakes: { borderRadius: 999, borderWidth: 2, borderColor: "rgba(242,196,107,0.5)", backgroundColor: "rgba(242,196,107,0.12)", paddingVertical: 4, paddingHorizontal: 18 },
  stakesFinal: { backgroundColor: C.gold, borderColor: C.gold },
  stakesSteal: { backgroundColor: C.pop, borderColor: C.pop },
  stakesText: { fontSize: 26, fontWeight: "800", letterSpacing: 1.5, color: C.gold },
  scores: { flexDirection: "row", gap: 20 },
  score: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.bg2, paddingVertical: 12, paddingHorizontal: 26, borderRadius: 999, borderWidth: 3, borderColor: "transparent" },
  scoreDot: { width: 20, height: 20, borderRadius: 10 },
  scoreText: { fontSize: 34, fontWeight: "800" },
  roundBook: { fontSize: 26, fontWeight: "800", letterSpacing: 3.5, color: C.gold, textAlign: "right" },
  progress: { fontSize: 30, color: C.muted, fontWeight: "700", textAlign: "right" },
  roundBody: { flex: 1, flexDirection: "row", gap: 64 },
  labelCard: { backgroundColor: C.label, borderRadius: 20, paddingVertical: 40, paddingHorizontal: 48 },
  labelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 8, borderBottomColor: C.labelInk, paddingBottom: 12, marginBottom: 18 },
  labelHeadText: { fontWeight: "800", fontSize: 40, letterSpacing: 1.6, color: C.labelInk },
  worth: { backgroundColor: C.labelInk, paddingVertical: 6, paddingHorizontal: 18, borderRadius: 999 },
  worthText: { fontSize: 30, color: C.label, fontWeight: "700" },
  timerBar: { position: "absolute", left: 0, bottom: -11, height: 14, borderRadius: 7, backgroundColor: "#3F8F62" },
  clock: { position: "absolute", top: -46, right: -52, width: 150, height: 150, borderRadius: 75, backgroundColor: C.label, borderWidth: 12, alignItems: "center", justifyContent: "center", zIndex: 3, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
  clockNum: { fontSize: 60, fontWeight: "800", color: C.labelInk, fontVariant: ["tabular-nums"] },
  ingBox: { flex: 1, overflow: "hidden", marginBottom: 24 },
  ingWrap: { flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start", gap: 12 },
  ing: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#D9D6CC", paddingVertical: 8, paddingHorizontal: 18, borderRadius: 12 },
  ingHidden: { backgroundColor: "#DCDAD2", borderColor: "#D6D4CC" },
  ingWarn: { borderWidth: 3, borderColor: "rgba(180,35,24,0.45)" },
  ingUnknown: { borderWidth: 3, borderColor: "rgba(138,90,0,0.45)" },
  ingLooked: { borderWidth: 3, borderColor: C.labelInk },
  ingText: { fontWeight: "700", color: C.labelInk },
  key: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  keyText: { fontSize: 20, lineHeight: 24, fontWeight: "900", color: "#fff" },
  help: { backgroundColor: C.helpBg, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 22, marginBottom: 20 },
  legend: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  legendText: { fontSize: 24, fontWeight: "700", color: "#4E5154" },
  helpText: { fontSize: 28, lineHeight: 38, color: "#4E5154", minHeight: 76 },
  helpInline: { fontSize: 28, lineHeight: 38 },
  statement: { fontWeight: "600", fontSize: 64, lineHeight: 77, color: C.labelInk },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 24 },
  answers: { gap: 24 },
  answer: { flex: 1, flexDirection: "row", alignItems: "center", gap: 30, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 36 },
  answerN: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  answerNText: { fontSize: 38, fontWeight: "800", color: "#fff" },
  answerText: { flex: 1, fontSize: 44, lineHeight: 51, fontWeight: "800", color: "#fff" },
  modal: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,15,12,0.8)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  modalBox: { backgroundColor: C.bg2, paddingVertical: 64, paddingHorizontal: 80, borderRadius: 28, alignItems: "center" },
  modalTitle: { fontSize: 72, fontWeight: "700", marginBottom: 44 },
  menuList: { gap: 22, minWidth: 700, alignSelf: "stretch" },
  toggleGrid: { flexDirection: "row", gap: 22 },
  toggleBtn: { flex: 1, paddingHorizontal: 20 },
  stealKicker: { fontSize: 32, fontWeight: "800", letterSpacing: 4.5, color: C.pop },
  stealSub: { fontSize: 34, color: C.inkSoft, marginBottom: 36, textAlign: "center", maxWidth: 1300 },
  verdict: { fontSize: 48, fontWeight: "800", marginBottom: 14 },
  rAnswer: { fontWeight: "900", fontSize: 92, lineHeight: 96, marginBottom: 26 },
  spot: { backgroundColor: C.bg2, borderLeftWidth: 10, borderLeftColor: C.gold, borderRadius: 16, paddingVertical: 34, paddingHorizontal: 44, marginBottom: 52 },
  spotTag: { fontSize: 26, fontWeight: "800", letterSpacing: 3, color: C.gold },
  spotName: { fontSize: 48, fontWeight: "700", marginTop: 10, marginBottom: 14 },
  spotNote: { fontSize: 36, lineHeight: 52, color: C.inkSoft },
  nextDot: { width: 32, height: 32, borderRadius: 16, marginLeft: 10, marginRight: 12, borderWidth: 3, borderColor: "rgba(0,0,0,0.35)" },
  watch: { backgroundColor: C.bg2, borderRadius: 20, paddingVertical: 30, paddingHorizontal: 34 },
  watchItem: { borderLeftWidth: 6, paddingVertical: 4, paddingLeft: 18 },
  watchName: { fontSize: 30, lineHeight: 38, fontWeight: "800" },
  watchTag: { fontSize: 24, fontWeight: "700", marginTop: 2 },
  rBook: { flexDirection: "row", alignItems: "center", gap: 32 },
  rCover: { width: 230, height: 368, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: "#fff" },
  rBookText: { fontSize: 30, lineHeight: 40, color: C.muted, flexShrink: 1 },
  winner: { fontWeight: "900", fontSize: 104, lineHeight: 110, marginBottom: 30 },
  finalRow: { flexDirection: "row", alignItems: "center", gap: 24, marginBottom: 12 },
  finalDot: { width: 28, height: 28, borderRadius: 14 },
  finalText: { fontSize: 48, fontWeight: "800" },
  dare: { backgroundColor: C.bg2, borderWidth: 4, borderStyle: "dashed", borderColor: C.pop, borderRadius: 20, paddingVertical: 24, paddingHorizontal: 36, marginBottom: 40, maxWidth: 1000 },
  dareHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24 },
  dareTag: { fontSize: 26, fontWeight: "800", letterSpacing: 3, color: C.pop, flexShrink: 1 },
  dareText: { fontSize: 40, lineHeight: 54, marginTop: 8, fontWeight: "700" },
  finalBtn: { paddingVertical: 22, paddingHorizontal: 40 },
  promo: { width: 600, backgroundColor: C.label, borderRadius: 28, paddingVertical: 40, paddingHorizontal: 44, alignItems: "center" },
  promoKicker: { fontSize: 30, fontWeight: "800", marginBottom: 20, color: C.labelInk },
  qrWrap: { width: 400, height: 400, marginBottom: 22 },
  qrCoverBox: { position: "absolute", left: "50%", top: "50%", marginLeft: -45, marginTop: -68, width: 90, height: 136, backgroundColor: C.label, borderRadius: 6, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  promoTitle: { fontSize: 32, lineHeight: 42, marginBottom: 22, color: C.labelInk, textAlign: "center" },
  getBook: { backgroundColor: "#3F5D4F", borderRadius: 999, paddingVertical: 16, paddingHorizontal: 34 },
  getBookText: { color: "#fff", fontWeight: "800", fontSize: 26 }
});
