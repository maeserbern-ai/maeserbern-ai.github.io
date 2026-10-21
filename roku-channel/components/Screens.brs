' Screens.brs - title, how to play, book picker, game setup, team colors and
' turn order. Coordinates follow the web game's 1920x1080 stage, inside the
' TV safe area (content starts 120 px from the sides, 60 px from top/bottom).

' ---------- title ----------
sub buildTitle(p as object)
    x = 120
    y = 166
    tracked(p, "INGREDIENT DICTIONARY", "xbold", 40, m.C.gold, x, y, 0.28)
    y = y + 52 + 18
    ' "The Party Game" with "Party" in orange italic.
    size = 206
    ly = y + 185 / 2 - lineH(size) / 2
    w1 = measure("The ", "serif", size)
    w2 = measure("Party", "serifItalic", size)
    label(p, "The ", "serif", size, m.C.ink, x, ly)
    label(p, "Party", "serifItalic", size, m.C.pop, x + w1, ly)
    label(p, " Game", "serif", size, m.C.ink, x + w1 + w2 + size * 0.1, ly)
    y = y + 185 + 56
    label(p, "Snack or Shampoo?", "serifItalic", 72, m.C.gold, x, y + 40 - lineH(72) / 2)
    y = y + 79 + 18
    label(p, "Read the ingredient list. Guess the product.", "medium", 48, m.C.soft, x, y)
    label(p, "Fewer clues, more points.", "medium", 48, m.C.soft, x, y + 65)
    y = y + 130 + 64
    bx = x
    it = button(p, bx, y, "Play", "primary", "books")
    bx = bx + it.w + 28
    it = button(p, bx, y, "How to play", "default", "howto")
    bx = bx + it.w + 28
    it = button(p, bx, y, onOffText("Sound", m.soundOn), "default", "sound")
    bx = bx + it.w + 28
    button(p, bx, y, onOffText("Music", m.musicOn), "default", "music")
    rich(p, [
        { t: "From the ", k: "medium", c: m.C.muted },
        { t: "Ingredient Dictionary", k: "xbold", c: m.C.soft },
        { t: " book series by Maeser", k: "medium", c: m.C.muted }
    ], 30, x, 985, 1600)
end sub

' ---------- how to play ----------
sub buildHowto(p as object)
    x = 120
    label(p, "How to play", "serif", 84, m.C.ink, x, 56)
    b = "xbold"
    n = "medium"
    gi = "serifSemi"
    ink = m.C.ink
    soft = m.C.soft
    gold = m.C.gold
    steps = [
        [{ t: "Split into teams", k: b, c: ink }, { t: " and pick your colors. The TV shuffles who goes first. ", k: n, c: soft }, { t: "No arguing.", k: gi, c: gold }],
        [{ t: "Read the 3 ingredients", k: b, c: ink }, { t: " and guess the product. ", k: n, c: soft }, { t: "Snack or Shampoo?", k: gi, c: gold }],
        [{ t: "Look it up — free.", k: b, c: ink }, { t: " Select any ingredient to see its definition. It costs nothing.", k: n, c: soft }],
        [{ t: "Need another clue?", k: b, c: ink }, { t: " Press ", k: n, c: soft }, { t: "Next ingredient", k: b, c: ink }, { t: " or select a covered box to reveal one more (−1 point).", k: n, c: soft }],
        [{ t: "Right answer = points.", k: b, c: ink }, { t: " Wrong answer = zero. ", k: n, c: soft }, { t: "And a little shame.", k: gi, c: gold }],
        [{ t: "Steal!", k: b, c: ink }, { t: " Miss it and the first team to yell ", k: n, c: soft }, { t: "“STEAL!”", k: b, c: ink }, { t: " tries for half the points. Miss, lose them.", k: n, c: soft }],
        [{ t: "Red", k: b, c: "0xF08A80FF" }, { t: " ingredients are worth knowing about. ", k: n, c: soft }, { t: "Amber", k: b, c: gold }, { t: " ones are kept secret.", k: n, c: soft }],
        [{ t: "Points go up", k: b, c: ink }, { t: " every round, and your last round counts double. ", k: n, c: soft }, { t: "Comebacks happen.", k: gi, c: gold }],
        [{ t: "Hard mode", k: b, c: ink }, { t: " starts with the weird chemicals and pays more. ", k: n, c: soft }, { t: "Sweating optional.", k: gi, c: gold }],
        [{ t: "Timer", k: b, c: ink }, { t: " (optional): Easy 60 sec, Medium 45, Hard 30, steals 10. Buy +15 sec once.", k: n, c: soft }],
        [{ t: "Finale:", k: b, c: ink }, { t: " bet your points on toilet paper trivia. Lowest score does a dare. ", k: n, c: soft }, { t: "Yes, really.", k: gi, c: gold }]
    ]
    y = 182
    for each s in steps
        dot(p, x + 17, y + 22, 18, m.C.pop)
        r = rich(p, s, 33, x + 52, y, 1620)
        y = y + r.height + 9
    end for
    y = y + 12
    rich(p, [
        { t: "Remote: ", k: n, c: m.C.muted }, { t: "arrows", k: b, c: m.C.soft }, { t: " to move, the ", k: n, c: m.C.muted },
        { t: "OK button", k: b, c: m.C.soft }, { t: " to pick. Pass it to the team whose turn it is. ", k: n, c: m.C.muted },
        { t: "Back", k: b, c: m.C.soft }, { t: " pauses the game.", k: n, c: m.C.muted }
    ], 30, x, y, 1680)
    y = y + 70
    if y > 896 then y = 896
    it = button(p, x, y, "Let's play", "primary", "books")
    button(p, x + it.w + 28, y, "Back", "default", "title")
end sub

' ---------- pick a book ----------
sub buildBooks(p as object)
    x = 120
    tracked(p, "INGREDIENT DICTIONARY", "xbold", 28, m.C.gold, x, 60, 0.28)
    label(p, "Pick your book", "serif", 84, m.C.ink, x, 92)
    keys = copyArray(m.data.bookOrder)
    keys.Push("all")
    cw = 219
    gap = (1680 - cw * 7) / 6
    cy = 250
    coverW = cw - 28
    coverH = Int(coverW * 900 / 563)
    for i = 0 to keys.Count() - 1
        k = keys[i]
        cx = x + i * (cw + gap)
        h = 14 + coverH + 18 + 34 * 2 + 40 + 14
        it = newItem(p, cx, cy, cw, h, 20, "book", "book-" + k)
        it.book = k
        it.onBlur = true
        it.focusBg = shape(it.node, 0, 0, cw, h, 20, m.C.bg2)
        it.focusBg.visible = false
        if k = "all"
            shape(it.node, 14, 14, coverW, coverH, 12, m.C.bg2)
            cellW = (coverW - 26) / 2
            cellH = (coverH - 32) / 3
            j = 0
            for each bk in m.data.bookOrder
                im = image(it.node, m.data.books[bk].cover, 14 + 10 + (j mod 2) * (cellW + 6), 14 + 10 + Int(j / 2) * (cellH + 6), cellW, cellH)
                im.loadDisplayMode = "scaleToZoom"
                j = j + 1
            end for
            name = "Mix all books"
            count = m.data.puzzles.Count().ToStr() + " puzzles"
        else
            bk = m.data.books[k]
            image(it.node, bk.cover, 14, 14, coverW, coverH)
            name = bk.name
            if bk.trueFalse then count = deckFor(k).Count().ToStr() + " true or false" else count = deckFor(k).Count().ToStr() + " puzzles"
        end if
        ny = 14 + coverH + 18
        r = para(it.node, name, "xbold", 28, m.C.ink, 8, ny, cw - 16, { align: "center", lh: 34 })
        label(it.node, count, "bold", 24, m.C.muted, cw / 2, ny + r.height + 4, { align: "center", w: cw })
        finishItem(it)
    end for
    button(p, x, 830, "Back", "default", "title")
end sub

' Custom focus looks (book cards, ingredient chips, team cards).
sub focusLook(it as object, onOff as boolean)
    if it.focusBg <> invalid then it.focusBg.visible = onOff
end sub

' ---------- game setup ----------
function totalText() as string
    per = turnsPerTeam()
    total = per * m.settings.teams
    finale = ""
    if hasFinale(m.settings.book) then finale = " + a toilet paper true-or-false finale"
    if m.settings.timer = 1 then finale = finale + " · " + timerSeconds(m.settings.level).ToStr() + " seconds per question"
    if m.settings.teams = 1 then return total.ToStr() + " rounds" + finale
    t = total.ToStr() + " rounds — " + per.ToStr() + " for each team"
    if per < m.settings.rounds then t = t + " (every puzzle in this book)"
    return t + finale
end function

sub buildSetup(p as object)
    x = 120
    tracked(p, UCase(bookLabel(m.settings.book)), "xbold", 28, m.C.gold, x, 56, 0.2)
    label(p, "Game setup", "serif", 72, m.C.ink, x, 88)
    soundV = 0
    if m.soundOn then soundV = 1
    musicV = 0
    if m.musicOn then musicV = 1
    groups = [
        { g: "teams", t: "Teams", v: m.settings.teams, opts: [[1, "Solo"], [2, "2"], [3, "3"], [4, "4"]] },
        { g: "rounds", t: "Rounds per team", v: m.settings.rounds, opts: [[3, "3"], [5, "5"], [8, "8"]] },
        { g: "level", t: "Difficulty — which ingredients show first", v: m.settings.level, opts: [[1, "Easy"], [2, "Medium"], [3, "Hard"]] },
        { g: "timer", t: "Answer timer", v: m.settings.timer, opts: [[1, "On"], [0, "Off"]] },
        { g: "steal", t: "Steals", v: m.settings.steal, opts: [[1, "On"], [0, "Off"]] },
        { g: "dare", t: "Loser's dare", v: m.settings.dare, opts: [[1, "On"], [0, "Off"]] },
        { g: "sfx", t: "Sound", v: soundV, opts: [[1, "On"], [0, "Off"]] },
        { g: "tune", t: "Music", v: musicV, opts: [[1, "On"], [0, "Off"]] }
    ]
    colX = [x, x + 840]
    y0 = 214
    rowH = 150
    for i = 0 to groups.Count() - 1
        gr = groups[i]
        gx = colX[i mod 2]
        gy = y0 + Int(i / 2) * rowH
        label(p, gr.t, "bold", 32, m.C.soft, gx, gy)
        cx = gx
        for each o in gr.opts
            style = "chip"
            if o[0] = gr.v then style = "chipOn"
            it = button(p, cx, gy + 52, o[1], style, "pick", { key: gr.g + "-" + o[0].ToStr(), size: 38, h: 84, minW: 124 })
            it.group = gr.g
            it.value = o[0]
            cx = cx + it.w + 24
        end for
    end for
    label(p, totalText(), "bold", 32, m.C.gold, x, y0 + 4 * rowH + 6, { w: 1680 })
    by = y0 + 4 * rowH + 76
    it = button(p, x, by, "Start game", "primary", "start")
    button(p, x + it.w + 28, by, "Back", "default", "books")
end sub

sub pickSetting(it as object)
    g = it.group
    v = it.value
    nextKey = { teams: "rounds", rounds: "level", level: "timer", timer: "steal", steal: "dare", dare: "start" }
    if g = "sfx"
        setSound(v = 1)
        show("setup", it.key)
        return
    end if
    if g = "tune"
        setMusic(v = 1)
        show("setup", it.key)
        return
    end if
    m.settings[g] = v
    if g = "timer" and v = 0 then stopTimer()
    nk = nextKey[g]
    if nk <> "start" then nk = nk + "-" + m.settings[nk].ToStr()
    show("setup", nk)
end sub

sub chooseBook(book as string)
    m.settings.book = book
    show("setup", "teams-" + m.settings.teams.ToStr())
end sub

' ---------- team colors + turn order ----------
sub showPick(focusKey as string)
    m.orderMode = "pick"
    if focusKey = "" then focusKey = "shuffle-order"
    show("order", focusKey)
end sub

sub buildOrder(p as object)
    x = 120
    g = m.game
    n = g.teams
    if m.orderMode = "pick"
        kicker = "BEFORE WE START"
        title = "Pick your team colors"
        if g.colors.Count() = n
            tip = "Every team has a color. Now shuffle to see who goes first!"
        else
            tip = "Pick " + n.ToStr() + " colors — one for each team. " + g.colors.Count().ToStr() + " of " + n.ToStr() + " picked."
        end if
        if m.orderTip <> invalid then tip = m.orderTip
    else
        kicker = "THE TV SHUFFLED THE TEAMS"
        title = "Here's who goes first"
        tip = "Pass the remote to whoever's turn it is — or let one person be the host."
    end if
    m.orderTip = invalid
    tracked(p, kicker, "xbold", 28, m.C.gold, x, 60, 0.2)
    label(p, title, "serif", 84, m.C.ink, x, 92)
    cw = 380
    ch = 220
    cy = 290
    gap = 28
    if m.orderMode = "pick"
        for c = 0 to 3
            isOn = indexOf(g.colors, c) >= 0
            cx = x + c * (cw + gap)
            it = newItem(p, cx, cy, cw, ch, 24, "color", "color-" + c.ToStr())
            it.color = c
            it.zoom = 1.04
            if isOn
                shape(it.node, 0, 0, cw, ch, 24, m.TEAM_HEX[c])
                ink = "0x16181AFF"
                status = "✓ Playing"
            else
                panel(it.node, 0, 0, cw, ch, 24, m.C.bg, m.TEAM_HEX[c], 6)
                ink = m.TEAM_HEX[c]
                status = "Not playing"
            end if
            label(it.node, status, "xbold", 34, ink, 32, 30, { opacity: 0.85 })
            para(it.node, m.TEAM_NAMES[c], "serif", 56, ink, 32, 84, cw - 64, { lh: 60 })
            finishItem(it)
        end for
        by = 680
        it = button(p, x, by, "Shuffle the order", "primary", "shuffle-order")
        bx = x + it.w + 28
        it = button(p, bx, by, "Back", "default", "setup")
        button(p, bx + it.w + 28, by, "Menu", "default", "title")
    else
        names = ["1st", "2nd", "3rd", "4th"]
        for k = 0 to g.turnOrder.Count() - 1
            t = g.turnOrder[k]
            cx = x + k * (cw + gap)
            cg = group(p, cx, cy)
            cg.scaleRotateCenter = [cw / 2, ch / 2]
            if k = 0 then cg.scale = [1.06, 1.06]
            shape(cg, 0, 0, cw, ch, 24, teamHex(t))
            label(cg, names[k], "xbold", 34, "0x16181AFF", 32, 30, { opacity: 0.75 })
            para(cg, teamName(t), "serif", 56, "0x16181AFF", 32, 84, cw - 64, { lh: 60 })
        end for
        by = 680
        it = button(p, x, by, "Let's go", "primary", "go")
        bx = x + it.w + 28
        it = button(p, bx, by, "Shuffle again", "default", "shuffle-order")
        bx = bx + it.w + 28
        it = button(p, bx, by, "Back", "default", "pick-colors")
        button(p, bx + it.w + 28, by, "Menu", "default", "title")
    end if
    para(p, tip, "medium", 34, m.C.muted, x, 560, 1400)
end sub

sub toggleColor(c as integer)
    picked = m.game.colors
    i = indexOf(picked, c)
    if i >= 0
        picked.Delete(i)
    else
        picked.Push(c)
        if picked.Count() > m.game.teams then picked.Shift()   ' swap out the oldest pick
    end if
    sfx("move")
    showPick("color-" + c.ToStr())
end sub

sub shuffleOrder()
    g = m.game
    if g.colors.Count() <> g.teams
        sfx("wrong")
        m.orderTip = "Pick " + g.teams.ToStr() + " colors first — " + g.colors.Count().ToStr() + " of " + g.teams.ToStr() + " picked."
        showPick("shuffle-order")
        return
    end if
    m.settings.colors = copyArray(g.colors)
    nxt = shuffle(copyArray(g.turnOrder))
    if g.shuffled = true and joinInts(nxt) = joinInts(g.turnOrder)
        first = nxt.Shift()
        nxt.Push(first)
    end if
    g.turnOrder = nxt
    g.shuffled = true
    m.orderMode = "shuffled"
    show("order", "go")
    sfx("steal")
end sub

function joinInts(a as object) as string
    s = ""
    for each v in a
        s = s + v.ToStr() + ","
    end for
    return s
end function
