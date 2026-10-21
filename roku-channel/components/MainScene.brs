' MainScene.brs - start-up, remote keys, the action dispatcher, saved
' settings, sound + music, timers, confetti and the two pop-up menus.

sub init()
    m.clockTs = CreateObject("roTimespan")
    m.clockTs.Mark()
    kitInit()
    m.top.backgroundColor = "0x16211CFF"
    m.top.backgroundUri = ""

    m.data = ParseJson(ReadAsciiFile("pkg:/data/game.json"))
    m.settings = { teams: 2, rounds: 5, book: "all", dare: 1, level: 1, timer: 0, steal: 1, colors: [0, 1] }
    m.TEAM_NAMES = ["Team Orange", "Team Blue", "Team Purple", "Team Green"]
    m.game = invalid
    m.modal = invalid
    m.focused = invalid
    m.items = []
    m.building = []
    m.later = []
    m.timer = invalid
    m.bits = []
    m.scr = ""
    m.orderMode = "pick"
    m.r = invalid
    m.winColors = [m.C.gold]

    m.screenLayer = m.top.findNode("screenLayer")
    m.modalLayer = m.top.findNode("modalLayer")
    m.confLayer = m.top.findNode("confettiLayer")

    loadPrefs()
    audioInit()

    m.beat = m.top.findNode("beat")
    m.beat.observeField("fire", "onBeat")
    m.beat.control = "start"
    m.confTimer = m.top.findNode("confTimer")
    m.confTimer.observeField("fire", "onConfetti")

    show("title")
    m.top.setFocus(true)
    ' Tells Roku the channel finished launching (certification: launch time).
    m.top.signalBeacon("AppLaunchComplete")
end sub

sub onLaunchArgs()
    ' Nothing to deep link to in a party game: any contentId/mediaType is ignored
    ' and the game always opens on the title screen.
    args = m.top.launchArgs
    if args <> invalid and args.contentId <> invalid then print "[party-game] ignoring deep link contentId="; args.contentId
end sub

' ---------- saved settings (roRegistry) ----------
function regSection() as object
    return CreateObject("roRegistrySection", "IngredientPartyGame")
end function

sub loadPrefs()
    sec = regSection()
    m.soundOn = not (sec.Exists("sound") and sec.Read("sound") = "off")
    m.musicOn = not (sec.Exists("music") and sec.Read("music") = "off")
    m.seen = {}
    if sec.Exists("seen")
        arr = ParseJson(sec.Read("seen"))
        if type(arr) = "roArray"
            for each id in arr
                m.seen[id] = true
            end for
        end if
    end if
end sub

sub savePref(key as string, value as string)
    sec = regSection()
    sec.Write(key, value)
    sec.Flush()
end sub

sub saveSeen()
    ids = []
    for each id in m.seen
        ids.Push(id)
    end for
    savePref("seen", FormatJson(ids))
end sub

' ---------- sound effects + music ----------
sub audioInit()
    m.sfxNodes = {}
    names = ["move", "click", "reveal", "help", "correct", "wrong", "bet", "lose", "final", "win", "dare", "steal", "tick", "timeup"]
    for each n in names
        s = CreateObject("roSGNode", "SoundEffect")
        s.uri = "pkg:/sounds/" + n + ".wav"
        s.volume = 60
        m.top.appendChild(s)
        m.sfxNodes[n] = s
    end for
    m.music = CreateObject("roSGNode", "Audio")
    m.music.loop = true
    m.top.appendChild(m.music)
    m.musicMode = ""
end sub

sub sfx(name as string)
    if not m.soundOn then return
    s = m.sfxNodes[name]
    if s <> invalid then s.control = "play"
end sub

sub startMusic(mode = "main" as string)
    if m.musicMode = mode then return
    if m.musicMode <> "" then stopMusic()
    if not m.musicOn then return
    c = CreateObject("roSGNode", "ContentNode")
    if mode = "suspense" then c.url = "pkg:/sounds/suspense.mp3" else c.url = "pkg:/sounds/theme.mp3"
    c.streamFormat = "mp3"
    m.music.content = c
    m.music.control = "play"
    m.musicMode = mode
end sub

sub stopMusic()
    if m.musicMode = "" then return
    m.music.control = "stop"
    m.musicMode = ""
end sub

function isMenuScreen(id as string) as boolean
    return id = "title" or id = "books" or id = "howto" or id = "setup" or id = "order"
end function

sub setSound(onOff as boolean)
    m.soundOn = onOff
    if onOff then savePref("sound", "on") else savePref("sound", "off")
    if onOff then sfx("click")
end sub

sub setMusic(onOff as boolean)
    m.musicOn = onOff
    if onOff then savePref("music", "on") else savePref("music", "off")
    if not onOff
        stopMusic()
    else if isMenuScreen(m.scr) and m.modal = invalid
        startMusic("main")
    end if
end sub

function onOffText(name as string, v as boolean) as string
    if v then return name + ": On"
    return name + ": Off"
end function

' ---------- screens ----------
sub show(id as string, focusKey = "" as string)
    closeModal()
    m.scr = id
    if id <> "round"
        stopTimer()
        if isMenuScreen(id) then startMusic("main") else stopMusic()
    end if
    clearChildren(m.screenLayer)
    m.building = []
    if id = "title"
        buildTitle(m.screenLayer)
    else if id = "howto"
        buildHowto(m.screenLayer)
    else if id = "books"
        buildBooks(m.screenLayer)
    else if id = "setup"
        buildSetup(m.screenLayer)
    else if id = "order"
        buildOrder(m.screenLayer)
    else if id = "round"
        buildRound(m.screenLayer)
    else if id = "result"
        buildResult(m.screenLayer)
    else if id = "final"
        buildFinal(m.screenLayer)
    end if
    m.items = m.building
    focusKeyOrFirst(focusKey)
end sub

sub focusKeyOrFirst(focusKey as string)
    target = invalid
    if focusKey <> "" then target = findItem(focusKey)
    if target = invalid
        list = focusables()
        if list.Count() > 0 then target = list[0]
    end if
    setFocus(target)
end sub

' ---------- pop-up menus (pause + steal) ----------
sub openModal(name as string)
    clearChildren(m.modalLayer)
    root = group(m.modalLayer)
    rect(root, 0, 0, 1920, 1080, m.C.dim)
    m.building = []
    m.modal = { name: name, root: root, items: m.building }
end sub

sub closeModal()
    if m.modal = invalid then return
    clearChildren(m.modalLayer)
    m.modal = invalid
end sub

' Centered dark box; returns its top-left.
function modalBox(root as object, w as float, h as float) as object
    x = (1920 - w) / 2
    y = (1080 - h) / 2
    shape(root, x, y, w, h, 28, m.C.bg2)
    return { x: x, y: y }
end function

sub openQuit(focusKey = "quit-no" as string)
    if m.modal = invalid or m.modal.name <> "quit"
        stopMusic()
        pauseTimer()
        if m.modal = invalid then m.focusBeforeModal = m.focused
    end if
    openModal("quit")
    w = 800
    h = 860
    b = modalBox(m.modal.root, w, h)
    root = m.modal.root
    label(root, "Game paused", "serif", 72, m.C.ink, 960, b.y + 56, { align: "center", w: w })
    bx = b.x + 80
    bw = w - 160
    y = b.y + 196
    button(root, bx, y, "Resume game", "primary", "quit-no", { w: bw })
    half = (bw - 22) / 2
    y = y + 122
    button(root, bx, y, onOffText("Sound", m.soundOn), "default", "sound", { w: half })
    button(root, bx + half + 22, y, onOffText("Music", m.musicOn), "default", "music", { w: half })
    y = y + 122
    button(root, bx, y, onOffText("Timer", m.settings.timer = 1), "default", "timer-toggle", { w: half })
    button(root, bx + half + 22, y, onOffText("Steals", m.settings.steal = 1), "default", "steal-toggle", { w: half })
    y = y + 122
    button(root, bx, y, "Change game or options", "default", "change-game", { w: bw })
    y = y + 122
    button(root, bx, y, "Quit to main menu", "default", "quit-yes", { w: bw })
    m.modal.items = m.building
    focusKeyOrFirst(focusKey)
end sub

sub closeQuit()
    closeModal()
    restore = m.focusBeforeModal
    m.focusBeforeModal = invalid
    if restore <> invalid and inScope(restore) then setFocus(restore) else focusKeyOrFirst("")
    if m.scr = "round" and m.game <> invalid then roundResumed()
end sub

' Rebuilds the pause menu after a toggle so the labels update.
sub refreshQuit(key as string)
    openQuit(key)
end sub

' ---------- the big stamp ----------
sub showPop(good as boolean, subText as string, thenTag as string)
    pop = m.top.findNode("pop")
    title = "WRONG!"
    size = 260
    boxColor = m.C.bad
    dimC = "0x3C08068C"
    if good
        title = "CORRECT!"
        size = 190
        boxColor = "0x2F8F5BFF"
        dimC = "0x06321C8C"
    end if
    t = m.top.findNode("popTitle")
    t.font.size = size
    t.text = title
    tw = measure(title, "serif", size)
    bw = tw + 170
    bh = size * 1.12 + 50
    t.width = bw
    t.height = bh
    t.translation = [-bw / 2, -bh / 2 - size * 0.04]
    boxN = m.top.findNode("popBox")
    boxN.width = bw
    boxN.height = bh
    boxN.translation = [-bw / 2, -bh / 2]
    boxN.blendColor = boxColor
    edge = m.top.findNode("popEdge")
    edge.width = bw + 32
    edge.height = bh + 32
    edge.translation = [-bw / 2 - 16, -bh / 2 - 16]
    m.top.findNode("popDim").color = dimC
    m.top.findNode("popSub").text = subText
    pop.visible = true
    m.top.findNode("popAnim").control = "start"
    m.game.locked = true   ' no keys while the stamp is on screen
    m.popThen = thenTag
    later(1600, "popDone")
end sub

sub popDone()
    m.top.findNode("pop").visible = false
    if m.game = invalid then return
    m.game.locked = false
    if m.scr = "round" then popThen(m.popThen)
end sub

' ---------- scheduling + the 0.1 s heartbeat ----------
sub later(ms as integer, tag as string)
    m.later.Push({ at: nowMs() + ms, tag: tag })
end sub

sub onBeat()
    if m.timer <> invalid and m.timer.running then tickTimer()
    if m.later.Count() = 0 then return
    now = nowMs()
    keep = []
    due = []
    for each l in m.later
        if l.at <= now then due.Push(l) else keep.Push(l)
    end for
    m.later = keep
    for each l in due
        runLater(l.tag)
    end for
end sub

sub runLater(tag as string)
    if tag = "popDone"
        popDone()
    else if tag = "dareSound"
        if m.scr = "final" then sfx("dare")
    else if tag = "confetti2"
        if m.scr = "final" then confetti(60, m.winColors)
    end if
end sub

' ---------- confetti (no library) ----------
sub confetti(count as integer, colors as object)
    room = 110 - m.bits.Count()
    if count > room then count = room
    if count <= 0 then return
    for i = 0 to count - 1
        r = CreateObject("roSGNode", "Rectangle")
        w = 14 + Rnd(0) * 14
        h = 8 + Rnd(0) * 10
        r.width = w
        r.height = h
        r.scaleRotateCenter = [w / 2, h / 2]
        r.color = colors[i mod colors.Count()]
        b = { node: r, x: 960 + (Rnd(0) - 0.5) * 900, y: -20 - Rnd(0) * 300, vx: (Rnd(0) - 0.5) * 9, vy: 4 + Rnd(0) * 7, r: Rnd(0) * 3.14, vr: (Rnd(0) - 0.5) * 0.3, life: 0 }
        r.translation = [b.x, b.y]
        m.confLayer.appendChild(r)
        m.bits.Push(b)
    end for
    m.confTimer.control = "start"
end sub

sub onConfetti()
    keep = []
    for each b in m.bits
        b.life = b.life + 1
        b.x = b.x + b.vx + Sin(b.life / 12) * 1.5
        b.y = b.y + b.vy
        b.vy = b.vy + 0.06
        b.r = b.r + b.vr
        if b.y < 1120 and b.life < 400
            b.node.translation = [b.x, b.y]
            b.node.rotation = b.r
            keep.Push(b)
        else
            m.confLayer.removeChild(b.node)
        end if
    end for
    m.bits = keep
    if m.bits.Count() = 0 then m.confTimer.control = "stop"
end sub

sub clearConfetti()
    clearChildren(m.confLayer)
    m.bits = []
    m.confTimer.control = "stop"
end sub

' ---------- remote keys ----------
function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if key = "up" or key = "down" or key = "left" or key = "right"
        moveFocus(key)
        return true
    end if
    if key = "OK"
        if m.focused <> invalid and not m.focused.disabled then act(m.focused)
        return true
    end if
    if key = "back"
        return back()
    end if
    if key = "options"
        ' The * button opens the pause menu during a game, like Back.
        if (m.scr = "round" or m.scr = "result") and m.modal = invalid and not (m.game <> invalid and m.game.locked) then openQuit()
        return true
    end if
    return false
end function

function back() as boolean
    if m.game <> invalid and m.game.locked then return true
    if m.modal <> invalid
        if m.modal.name = "quit" then closeQuit()
        return true   ' the steal menu needs a team or "No steal"
    end if
    if m.scr = "round" or m.scr = "result"
        openQuit()
    else if m.scr = "setup"
        actName("books")
    else if m.scr = "order"
        if m.orderMode = "shuffled" then actName("pick-colors") else actName("setup")
    else if m.scr <> "title"
        show("title")
    else
        ' Back on the title screen closes the channel.
        stopMusic()
        m.top.exitRequested = true
    end if
    return true
end function

sub actName(action as string)
    act({ action: action, key: action })
end sub

' ---------- actions ----------
sub act(it as object)
    a = it.action
    if m.game <> invalid and m.game.locked
        if a = "answer" or a = "reveal" or a = "help" or a = "menu" or a = "extend" then return
    end if
    quiet = (a = "answer" or a = "reveal" or a = "help" or a = "wager" or a = "sound" or a = "music")
    if not quiet then sfx("click")
    if a = "pick"
        pickSetting(it)
    else if a = "book"
        chooseBook(it.book)
    else if a = "books"
        show("books", "book-" + m.settings.book)
    else if a = "howto"
        show("howto")
    else if a = "title"
        show("title")
    else if a = "start"
        startGame()
    else if a = "go"
        startRound()
    else if a = "shuffle-order"
        shuffleOrder()
    else if a = "pick-colors"
        showPick("")
    else if a = "color"
        toggleColor(it.color)
    else if a = "setup"
        show("setup", "start")
    else if a = "reveal"
        if it.index <> invalid then reveal(it.index) else reveal(-1)
    else if a = "extend"
        extendTime()
    else if a = "answer"
        answer(it.choice)
    else if a = "next"
        nextRound()
    else if a = "new-dare"
        showDare()
    else if a = "help"
        help(it.index)
    else if a = "stealer"
        startSteal(it.team)
    else if a = "no-steal"
        nobodyGotIt()
    else if a = "wager"
        placeWager(it.amount)
    else if a = "quit-yes"
        closeModal()
        show("title")
    else if a = "menu"
        openQuit()
    else if a = "sound"
        setSound(not m.soundOn)
        afterToggle("sound")
    else if a = "music"
        setMusic(not m.musicOn)
        afterToggle("music")
    else if a = "timer-toggle"
        toggleTimer()
        refreshQuit("timer-toggle")
    else if a = "steal-toggle"
        if m.settings.steal = 1 then m.settings.steal = 0 else m.settings.steal = 1
        refreshQuit("steal-toggle")
    else if a = "change-game"
        closeModal()
        show("books", "book-" + m.settings.book)
    else if a = "quit-no"
        closeQuit()
    end if
end sub

' Sound/Music buttons live on the title screen, the setup screen and the pause menu.
sub afterToggle(key as string)
    if m.modal <> invalid and m.modal.name = "quit"
        refreshQuit(key)
    else if m.scr = "title"
        show("title", key)
    end if
end sub

sub toggleTimer()
    if m.settings.timer = 1 then m.settings.timer = 0 else m.settings.timer = 1
    if m.settings.timer = 0 then stopTimer()
end sub
