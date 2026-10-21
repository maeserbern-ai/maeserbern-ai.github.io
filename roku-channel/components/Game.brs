' Game.brs - the game loop, ported from party-game/game.js: dealing puzzles,
' rounds, reveals, ingredient help, answers, steals, the toilet paper
' finale bets, the answer screen, final scores, the loser's dare and the
' book promo (QR code + "Get <book> on Amazon").

' ---------- small helpers ----------
function maxI(a as dynamic, b as dynamic) as dynamic
    if a > b then return a
    return b
end function

function minI(a as dynamic, b as dynamic) as dynamic
    if a < b then return a
    return b
end function

function ceilI(x as float) as integer
    return -Int(-x)
end function

function timerSeconds(level as integer) as integer
    if level = 3 then return 30
    if level = 2 then return 45
    return 60
end function

' Harder difficulty earns more: Medium +1, Hard +2 on ingredient questions.
function levelBonus(level as integer) as integer
    return level - 1
end function

function teamName(t as integer) as string
    return m.TEAM_NAMES[m.game.colors[t]]
end function

function teamHex(t as integer) as string
    return m.TEAM_HEX[m.game.colors[t]]
end function

' ---------- decks ----------
function deckFor(book as string) as object
    if book = "all" then return m.data.puzzles
    out = []
    for each p in m.data.puzzles
        if p.book = book then out.Push(p)
    end for
    return out
end function

' Every game except the toilet paper book itself ends with a What Is Toilet
' Paper? true-or-false finale (one question per team).
function hasFinale(book as string) as boolean
    return book <> "tp"
end function

function mainPool(book as string) as object
    if not hasFinale(book) then return deckFor(book)
    out = []
    for each p in deckFor(book)
        if p.type <> "tf" then out.Push(p)
    end for
    return out
end function

function bookLabel(book as string) as string
    if book = "all" then return "All the books, mixed"
    return m.data.books[book].title
end function

' Every team gets the same number of turns, capped by how many puzzles the book has.
function turnsPerTeam() as integer
    pool = mainPool(m.settings.book)
    return maxI(1, minI(m.settings.rounds, Int(pool.Count() / m.settings.teams)))
end function

' No repeats: the TV remembers which puzzles it has shown and deals unseen
' ones first. Once a book runs out, that book starts over.
function dealFresh(pool as object, n as integer) as object
    fresh = []
    for each p in pool
        if not m.seen.DoesExist(p.id) then fresh.Push(p)
    end for
    hand = takeFirst(shuffle(fresh), n)
    if hand.Count() < n
        inHand = {}
        for each p in hand
            inHand[p.id] = true
        end for
        rest = []
        for each p in pool
            m.seen.Delete(p.id)
            if not inHand.DoesExist(p.id) then rest.Push(p)
        end for
        hand.Append(takeFirst(shuffle(rest), n - hand.Count()))
        hand = shuffle(hand)
        saveSeen()
    end if
    return hand
end function

function takeFirst(a as object, n as integer) as object
    out = []
    for i = 0 to minI(n, a.Count()) - 1
        out.Push(a[i])
    end for
    return out
end function

' ---------- starting a game ----------
sub startGame()
    clearConfetti()
    pool = mainPool(m.settings.book)
    per = turnsPerTeam()
    deck = dealFresh(pool, per * m.settings.teams)
    if hasFinale(m.settings.book) then deck.Append(dealFresh(deckFor("tp"), m.settings.teams))
    scores = []
    order = []
    for i = 0 to m.settings.teams - 1
        scores.Push(0)
        order.Push(i)
    end for
    m.game = {
        book: m.settings.book, deck: deck, index: 0, scores: scores, teams: m.settings.teams,
        colors: keepColors(), turnOrder: order, shuffled: false, locked: false
    }
    if m.game.teams > 1 then showPick("") else startRound()
end sub

' Last game's colors carry over when the team count is the same.
function keepColors() as object
    c = []
    for each x in m.settings.colors
        if indexOf(c, x) < 0 and c.Count() < m.settings.teams then c.Push(x)
    end for
    i = 0
    while c.Count() < m.settings.teams
        if indexOf(c, i) < 0 then c.Push(i)
        i = i + 1
    end while
    return c
end function

' A single book keeps every answer choice in that book's world; "Mix all
' books" uses the puzzle's own cross-category decoys.
function choicesFor(p as object) as object
    if p.type = "tf" then return ["True", "False"]
    if m.game.book = "all" then return shuffle(copyArray(p.options))
    others = []
    for each q in deckFor(p.book)
        if q.type <> "tf" and q.answer <> p.answer then others.Push(q.answer)
    end for
    others = shuffle(others)
    out = [p.answer]
    out.Append(takeFirst(others, 3))
    return shuffle(out)
end function

' Which ingredients appear first. Labels list the biggest amounts first.
'   Easy: top of the label, revealing downward
'   Medium: middle of the label, spreading out
'   Hard: bottom of the label (the tiny-amount chemicals), revealing upward
function revealOrder(n as integer) as object
    idx = []
    for i = 0 to n - 1
        idx.Push(i)
    end for
    if m.settings.level = 3
        out = []
        for i = n - 1 to 0 step -1
            out.Push(i)
        end for
        return out
    end if
    if m.settings.level = 2
        mid = (n - 1) / 2
        ' insertion sort: closest to the middle first, ties -> the lower one on the label first
        for i = 1 to n - 1
            v = idx[i]
            j = i - 1
            while j >= 0 and orderBefore(v, idx[j], mid)
                idx[j + 1] = idx[j]
                j = j - 1
            end while
            idx[j + 1] = v
        end for
    end if
    return idx
end function

function orderBefore(a as integer, b as integer, mid as float) as boolean
    da = Abs(a - mid)
    db = Abs(b - mid)
    if da <> db then return da < db
    return a > b
end function

' ---------- a round ----------
function cur() as object
    return m.game.deck[m.game.index]
end function

sub startRound()
    g = m.game
    p = cur()
    m.seen[p.id] = true
    saveSeen()
    tf = p.type = "tf"
    g.shown = 0
    g.order = []
    g.open = {}
    if not tf
        g.shown = minI(3, p.ingredients.Count())
        g.order = revealOrder(p.ingredients.Count())
        for k = 0 to g.shown - 1
            g.open[g.order[k].ToStr()] = true
        end for
    end if
    g.options = choicesFor(p)
    g.team = g.turnOrder[g.index mod g.teams]
    g.helped = {}
    g.helpIng = -1
    g.extended = false
    g.wager = invalid
    g.steal = invalid
    g.chain = invalid
    g.locked = false
    g.removed = []
    show("round", "ans-0")
    startMusic("main")
    i = g.index
    if isFinal(i) and i mod g.teams = 0
        sfx("final")
        confetti(90, [m.C.gold, m.C.pop])
    end if
    if not isWager(i) then startTimer(0)
end sub

' Rebuilds the round screen, keeping the remote's place.
sub redrawRound(focusKey = "" as string)
    if m.scr <> "round" then return
    if focusKey = "" and m.focused <> invalid then focusKey = m.focused.key
    clearChildren(m.screenLayer)
    m.building = []
    buildRound(m.screenLayer)
    m.items = m.building
    if m.modal = invalid then focusKeyOrFirst(focusKey)
end sub

' ---------- rising stakes ----------
' Every full lap of turns adds +1 to what a question is worth, and each
' team's last turn counts double. Reveals and the +15 sec still subtract.
function lapOf(i as integer) as integer
    return Int(i / m.game.teams)
end function

function laps() as integer
    return Int(m.game.deck.Count() / m.game.teams)
end function

function isFinal(i as integer) as boolean
    return laps() > 1 and lapOf(i) = laps() - 1
end function

function isWager(i as integer) as boolean
    return isFinal(i) and m.game.deck[i].type = "tf"
end function

function basePoints(i as integer) as integer
    p = m.game.deck[i]
    if p.type = "tf" then return 3 + lapOf(i)
    return 5 + levelBonus(m.settings.level) + lapOf(i)
end function

function points() as integer
    g = m.game
    i = g.index
    p = cur()
    if isWager(i)
        if g.wager = invalid then return 0
        return g.wager
    end if
    reveals = 0
    if p.type <> "tf" then reveals = g.shown - minI(3, p.ingredients.Count())
    ext = 0
    if g.extended then ext = extendCost(i)
    pts = maxI(1, basePoints(i) - reveals - ext)
    if isFinal(i) then return pts * 2
    return pts
end function

' +15 seconds costs 1 point, then 2, 3... each lap (doubled on the final round).
function extendCost(i as integer) as integer
    return 1 + lapOf(i)
end function

function canExtend() as boolean
    g = m.game
    return m.settings.timer = 1 and m.timer <> invalid and not g.extended and g.steal = invalid and not isWager(g.index)
end function

sub extendTime()
    if not canExtend() then return
    m.game.extended = true
    m.timer.left = m.timer.left + 15000
    m.timer.total = maxI(m.timer.total, m.timer.left)
    m.timer.lastSec = -1
    sfx("bet")
    redrawRound("ans-0")
end sub

function maxPoints() as integer
    ' Bets don't count toward the maximum - they depend on the score so far.
    total = 0
    for i = 0 to m.game.deck.Count() - 1
        if not isWager(i)
            mult = 1
            if isFinal(i) then mult = 2
            total = total + basePoints(i) * mult
        end if
    end for
    return total
end function

' ---------- the answer timer ----------
sub startTimer(seconds as integer)
    stopTimer()
    if m.settings.timer = 0 or m.scr <> "round" then return
    if seconds = 0 then seconds = timerSeconds(m.settings.level)
    total = seconds * 1000
    m.timer = { total: total, left: total, last: nowMs(), running: true, lastSec: -1 }
    redrawRound()
    tickTimer()
end sub

sub pauseTimer()
    if m.timer <> invalid then m.timer.running = false
end sub

sub resumeTimer()
    if m.timer = invalid then return
    m.timer.last = nowMs()
    m.timer.running = true
end sub

sub stopTimer()
    m.timer = invalid
    if m.r <> invalid and m.scr = "round"
        if m.r.clock <> invalid then m.r.clock.visible = false
        if m.r.bar <> invalid then m.r.bar.visible = false
        if m.r.extend <> invalid then setHidden(m.r.extend, true)
    end if
end sub

sub tickTimer()
    t = m.timer
    now = nowMs()
    t.left = t.left - (now - t.last)
    t.last = now
    sec = maxI(0, ceilI(t.left / 1000))
    urgent = t.left <= 10000   ' last 10 seconds: red + ticking
    if m.r <> invalid and m.r.clockNum <> invalid
        m.r.clockNum.text = sec.ToStr()
        frac = maxI(0, t.left) / t.total
        m.r.bar.width = maxI(1, m.r.barW * frac)
        if urgent
            m.r.bar.color = m.C.warnInk
            m.r.clockRing.blendColor = m.C.warnInk
            m.r.clockNum.color = m.C.warnInk
        else
            m.r.bar.color = m.C.green
            m.r.clockRing.blendColor = m.C.green
            m.r.clockNum.color = m.C.labelInk
        end if
    end if
    if urgent and sec <> t.lastSec and sec > 0 then sfx("tick")
    t.lastSec = sec
    if t.left <= 0
        stopTimer()
        answer(invalid)
    end if
end sub

' Called when the pause menu closes during a round.
sub roundResumed()
    g = m.game
    if g.steal <> invalid then startMusic("suspense") else startMusic("main")
    ' Timer just switched on: start the clock now (after the bet on the finale).
    if m.settings.timer = 1 and m.timer = invalid and not g.locked and not (isWager(g.index) and g.wager = invalid)
        if g.steal <> invalid then startTimer(10) else startTimer(0)
    else
        resumeTimer()
        redrawRound()
    end if
end sub

' ---------- the round screen ----------
sub buildRound(p as object)
    g = m.game
    q = cur()
    tf = q.type = "tf"
    m.r = {}
    crowded = g.teams >= 3

    ' HUD: whose turn, stakes, scores, round number.
    turnSize = 58
    if crowded then turnSize = 50
    who = g.team
    if g.steal <> invalid then who = g.steal.team
    if g.steal <> invalid
        turnText = teamName(who) + " — steal it!"
    else if g.teams = 1
        turnText = "Your turn"
    else
        turnText = teamName(who) + "'s turn"
    end if
    label(p, turnText, "serif", turnSize, teamHex(who), 120, 66)
    tx = 120 + measure(turnText, "serif", turnSize) + 22
    stakes = stakesInfo()
    if stakes <> invalid
        sw = trackedWidth(stakes.text, "xbold", 26, 0.06) + 40
        if stakes.style = "final"
            shape(p, tx, 82, sw, 46, 23, m.C.gold)
            ink = m.C.labelInk
        else if stakes.style = "steal"
            shape(p, tx, 82, sw, 46, 23, m.C.pop)
            ink = m.C.labelInk
        else
            panel(p, tx, 82, sw, 46, 23, "0x2D3528FF", "0x8C7A4FFF", 2)
            ink = m.C.gold
        end if
        tracked(p, stakes.text, "xbold", 26, ink, tx + 20, 88, 0.06)
    end if

    progSize = 30
    bookSize = 26
    if crowded
        progSize = 26
        bookSize = 22
    end if
    roundText = "Round " + (g.index + 1).ToStr() + " of " + g.deck.Count().ToStr()
    if tf and g.book <> "tp"
        bookName = m.data.books.tp.name
    else if g.book = "all"
        bookName = "All books"
    else
        bookName = m.data.books[g.book].name
    end if
    bookName = UCase(bookName)
    progW = maxI(measure(roundText, "bold", progSize), trackedWidth(bookName, "xbold", bookSize, 0.14))
    tracked(p, bookName, "xbold", bookSize, m.C.gold, 1800, 66, 0.14, "right")
    label(p, roundText, "bold", progSize, m.C.muted, 1800, 106, { align: "right", w: progW + 40 })
    drawScores(p, 1800 - progW - 36, crowded, who)

    ' The label card.
    cx = 120
    cy = 196
    cw = 853
    chh = 820
    shape(p, cx, cy, cw, chh, 20, m.C.label)
    timed = m.timer <> invalid
    head = "INGREDIENTS:"
    if tf then head = "TRUE OR FALSE?"
    tracked(p, head, "xbold", 40, m.C.labelInk, cx + 48, cy + 36, 0.04)
    worth = worthText()
    ww = measure(worth, "xbold", 30) + 36
    wr = cx + cw - 48
    if timed then wr = wr - 96
    shape(p, wr - ww, cy + 40, ww, 48, 24, m.C.labelInk)
    label(p, worth, "xbold", 30, m.C.label, wr - ww / 2, cy + 44, { align: "center", w: ww })
    rect(p, cx + 48, cy + 104, cw - 96, 8, m.C.labelInk)
    m.r.barW = cw - 96
    m.r.bar = rect(p, cx + 48, cy + 101, cw - 96, 14, m.C.green)
    m.r.bar.visible = timed
    ' The countdown clock in the card's top-right corner.
    m.r.clock = group(p, cx + cw - 98, cy - 46)
    dot(m.r.clock, 75, 75, 150, m.C.label)
    m.r.clockRing = dot(m.r.clock, 75, 75, 134, m.C.green)
    dot(m.r.clock, 75, 75, 110, m.C.label)
    m.r.clockNum = label(m.r.clock, "", "serif", 56, m.C.labelInk, 75, 75 - lineH(56) / 2, { align: "center", w: 150 })
    m.r.clock.visible = timed

    areaTop = cy + 132
    footY = cy + chh - 40 - 64
    if tf
        statement = q.statement
        if isWager(g.index) and g.wager = invalid
            sc = g.scores[g.team]
            statement = "Place your bet! You have " + plural(sc) + ". Get it right and win your bet. Get it wrong and lose it."
        end if
        lines = wrapText(statement, "serifSemi", 64, cw - 96)
        lh = 77
        sy = areaTop + ((footY - 20 - areaTop) - lines.Count() * lh) / 2
        for k = 0 to lines.Count() - 1
            label(p, lines[k], "serifSemi", 64, m.C.labelInk, cx + 48, sy + k * lh, { w: cw - 48 })
        end for
    else
        helpTop = footY - 20 - 178
        drawIngredients(p, cx + 48, areaTop, cw - 96, helpTop - 24 - areaTop)
        drawHelp(p, cx + 48, helpTop, cw - 96, 178)
    end if

    ' Card foot: Next ingredient, +15 sec, Menu.
    fx = cx + 48
    if not tf
        rev = button(p, fx, footY, "Next ingredient", "ghost", "reveal", { size: 26, padX: 24, h: 64 })
        if g.steal <> invalid or g.shown >= q.ingredients.Count() then setDisabled(rev, true)
        fx = fx + rev.w + 24
    end if
    menuB = button(p, 0, footY, "Menu", "ghost", "menu", { size: 26, padX: 24, h: 64 })
    mx = cx + cw - 48 - menuB.w
    menuB.x = mx
    menuB.node.translation = [mx, footY]
    if canExtend()
        cost = extendCost(g.index)
        if isFinal(g.index) then cost = cost * 2
        ptxt = " pts"
        if cost = 1 then ptxt = " pt"
        extText = "+15 sec −" + cost.ToStr() + ptxt
        if tf then fx = mx - 24 - (measure(extText, "xbold", 26) + 48)
        m.r.extend = button(p, fx, footY, extText, "ghost", "extend", { size: 26, padX: 24, h: 64 })
    else
        m.r.extend = invalid
    end if

    drawAnswers(p, 1037, cy, 763, chh)
end sub

function stakesInfo() as dynamic
    g = m.game
    i = g.index
    if g.steal <> invalid then return { style: "steal", text: "WIN " + g.steal.value.ToStr() + " · MISS = −" + g.steal.value.ToStr() }
    if isFinal(i)
        if isWager(i) then return { style: "final", text: "PLACE YOUR BET" }
        return { style: "final", text: "FINAL ROUND ×2" }
    end if
    if lapOf(i) > 0 then return { style: "up", text: "POINTS ARE UP +" + lapOf(i).ToStr() }
    return invalid
end function

function worthText() as string
    g = m.game
    if g.steal <> invalid then return "Steal: " + plural(g.steal.value)
    pts = points()
    if isWager(g.index)
        if g.wager = invalid then return "Bet first"
        return "Bet: " + plural(pts)
    end if
    return "Worth " + plural(pts)
end function

' Score pills, right-aligned so they end at xEnd.
sub drawScores(p as object, xEnd as float, crowded as boolean, active as integer)
    g = m.game
    size = 34
    padX = 26
    gap = 20
    if crowded
        size = 30
        padX = 16
        gap = 10
    end if
    h = 64
    pills = []
    if g.teams = 1
        pills.Push({ t: 0, text: g.scores[0].ToStr() + " pts", on: true })
    else
        for each t in g.turnOrder
            pills.Push({ t: t, text: g.scores[t].ToStr(), on: t = active })
        end for
    end if
    total = 0
    for each pl in pills
        pl.w = padX * 2 + 20 + 14 + measure(pl.text, "xbold", size)
        total = total + pl.w + gap
    end for
    x = xEnd - total + gap
    for each pl in pills
        col = teamHex(pl.t)
        if pl.on
            panel(p, x, 72, pl.w, h, 32, m.C.bg2, col, 3)
        else
            shape(p, x, 72, pl.w, h, 32, m.C.bg2)
        end if
        dot(p, x + padX + 10, 72 + h / 2, 20, col)
        label(p, pl.text, "xbold", size, m.C.ink, x + padX + 34, 72 + (h - lineH(size)) / 2)
        x = x + pl.w + gap
    end for
end sub

' Ingredient chips: white buttons for visible ones, striped boxes for covered
' ones. Long labels shrink so every ingredient fits (like fitIngredients()).
sub drawIngredients(p as object, x as float, y as float, w as float, h as float)
    g = m.game
    q = cur()
    ings = q.ingredients
    size = 34
    layout = invalid
    while layout = invalid
        layout = flowIngredients(ings, size, w, h)
        if layout = invalid
            if size <= 22
                layout = flowIngredients(ings, 22, w, 100000)
                size = 22
            else
                size = size - 2
            end if
        end if
    end while
    ch = Int(size * 1.2) + 16
    for k = 0 to ings.Count() - 1
        ing = ings[k]
        cp = layout[k]
        isOpen = g.open.DoesExist(k.ToStr())
        if isOpen
            it = newItem(p, x + cp.x, y + cp.y, cp.w, ch, 12, "help", "ing-" + k.ToStr())
            it.zoom = 1.05
            looked = g.helped.DoesExist(k.ToStr())
            lineC = m.C.chipLine
            lw = 2
            ink = m.C.labelInk
            if ing.lv = "warn"
                lineC = "0xD9A49FFF"
                lw = 3
                ink = m.C.warnInk
            else if ing.lv = "unknown"
                lineC = "0xCDB78FFF"
                lw = 3
                ink = m.C.unknownInk
            end if
            if looked
                lineC = m.C.labelInk
                lw = 3
            end if
            panel(it.node, 0, 0, cp.w, ch, 12, m.C.white, lineC, lw)
            label(it.node, ing.n, "bold", size, ink, 18, (ch - lineH(size)) / 2)
            if ing.lv <> invalid
                bd = Int(size * 0.88)
                bx = 18 + measure(ing.n, "bold", size) + 8 + bd / 2
                badgeC = m.C.warnInk
                mark = "!"
                if ing.lv = "unknown"
                    badgeC = m.C.unknownInk
                    mark = "?"
                end if
                dot(it.node, bx, ch / 2, bd, badgeC)
                label(it.node, mark, "xbold", Int(bd * 0.66), m.C.white, bx, ch / 2 - lineH(Int(bd * 0.66)) / 2, { align: "center", w: bd })
            end if
            it.index = k
            finishItem(it)
        else
            ' A covered ingredient is a button too: selecting it uncovers that one.
            it = newItem(p, x + cp.x, y + cp.y, cp.w, ch, 12, "reveal", "ing-" + k.ToStr())
            it.zoom = 1.05
            shape(it.node, 0, 0, cp.w, ch, 12, "0xD6D4CCFF")
            sx = 18
            while sx < cp.w - 12
                rect(it.node, sx, 3, minI(18, cp.w - 12 - sx), ch - 6, "0xE3E1DAFF")
                sx = sx + 36
            end while
            it.index = k
            finishItem(it)
            if g.steal <> invalid then it.disabled = true   ' no reveals on a steal
        end if
    end for
end sub

function chipWidth(ing as object, size as integer) as float
    w = measure(ing.n, "bold", size) + 36
    if ing.lv <> invalid then w = w + 8 + Int(size * 0.88)
    return w
end function

function flowIngredients(ings as object, size as integer, w as float, h as float) as dynamic
    ch = Int(size * 1.2) + 16
    gap = 12
    x = 0
    y = 0
    out = []
    for each ing in ings
        cw = minI(chipWidth(ing, size), w)
        if x > 0 and x + cw > w
            x = 0
            y = y + ch + gap
        end if
        out.Push({ x: x, y: y, w: cw })
        x = x + cw + gap
    end for
    if y + ch > h then return invalid
    return out
end function

sub drawHelp(p as object, x as float, y as float, w as float, h as float)
    g = m.game
    q = cur()
    shape(p, x, y, w, h, 14, m.C.helpBg)
    ix = x + 22
    iy = y + 16
    dot(p, ix + 15, iy + 15, 30, m.C.warnInk)
    label(p, "!", "xbold", 20, m.C.white, ix + 15, iy + 15 - lineH(20) / 2, { align: "center", w: 30 })
    t1 = " worth knowing"
    label(p, t1, "bold", 24, "0x4E5154FF", ix + 32, iy)
    ux = ix + 32 + measure(t1, "bold", 24) + 20
    dot(p, ux + 15, iy + 15, 30, m.C.unknownInk)
    label(p, "?", "xbold", 20, m.C.white, ux + 15, iy + 15 - lineH(20) / 2, { align: "center", w: 30 })
    label(p, " not fully disclosed", "bold", 24, "0x4E5154FF", ux + 32, iy)
    ty = iy + 42
    size = 28
    if g.helpIng >= 0
        ing = q.ingredients[g.helpIng]
        segs = [{ t: ing.n + ": ", k: "xbold", c: m.C.labelInk }, { t: ing.g, k: "medium", c: m.C.labelInk }]
        if ing.lv = "warn" then segs.Push({ t: "  " + ing.tag, k: "xbold", c: m.C.warnInk })
        if ing.lv = "unknown" then segs.Push({ t: "  " + ing.tag, k: "xbold", c: m.C.unknownInk })
        if richWidth(segs, size) > (w - 44) * 3 then size = 24
        rich(p, segs, size, ix, ty, w - 44, { lh: Int(size * 1.3) })
    else if g.steal <> invalid
        label(p, "Steal round: ingredient help is free.", "medium", size, "0x4E5154FF", ix, ty)
    else
        rich(p, [{ t: "Select an ingredient to see what it is ", k: "medium", c: "0x4E5154FF" }, { t: "(free)", k: "medium", c: "0x82817BFF" }], size, ix, ty, w - 44)
    end if
end sub

sub drawAnswers(p as object, x as float, y as float, w as float, h as float)
    g = m.game
    q = cur()
    items = []
    tfMode = q.type = "tf"
    if isWager(g.index) and g.wager = invalid
        tfMode = false
        sc = g.scores[g.team]
        for each a in wagerOptions(sc)
            if a = 0
                lbl = "Play it safe — bet 0"
            else if a = sc
                lbl = "All in — bet " + a.ToStr()
            else
                lbl = "Bet " + a.ToStr()
            end if
            items.Push({ label: lbl, action: "wager", amount: a })
        end for
    else
        for each o in g.options
            items.Push({ label: o, action: "answer", choice: o })
        end for
    end if
    rows = 4
    if tfMode then rows = 2
    gap = 24
    rh = (h - gap * (rows - 1)) / rows
    fills = [m.C.a1, m.C.a2, m.C.a3, m.C.a4]
    for k = 0 to items.Count() - 1
        a = items[k]
        ay = y + k * (rh + gap)
        it = newItem(p, x, ay, w, rh, 24, a.action, "ans-" + k.ToStr())
        shape(it.node, 0, 0, w, rh, 24, fills[k])
        size = 44
        if tfMode then size = 72
        if tfMode
            tw = measure(a.label, "xbold", size)
            bx = (w - 72 - 30 - tw) / 2
            textX = bx + 102
            lines = [a.label]
        else
            bx = 36
            textX = 36 + 72 + 30
            lines = wrapText(a.label, "xbold", size, w - textX - 36)
            if lines.Count() > 3
                size = 36
                lines = wrapText(a.label, "xbold", size, w - textX - 36)
            end if
        end if
        dot(it.node, bx + 36, rh / 2, 72, "0x00000040")
        label(it.node, (k + 1).ToStr(), "xbold", 38, m.C.white, bx + 36, rh / 2 - lineH(38) / 2, { align: "center", w: 72 })
        lh = Int(size * 1.15)
        ty = (rh - lines.Count() * lh) / 2
        struck = false
        if a.action = "answer" and g.chain <> invalid then struck = indexOf(g.chain.removed, a.choice) >= 0
        for li = 0 to lines.Count() - 1
            label(it.node, lines[li], "xbold", size, m.C.white, textX, ty + li * lh + (lh - lineH(size)) / 2)
            if struck then rect(it.node, textX - 4, ty + li * lh + lh / 2 - 2, measure(lines[li], "xbold", size) + 8, 5, m.C.white)
        end for
        it.choice = a.choice
        it.amount = a.amount
        finishItem(it)
        if struck then setDisabled(it, true)
    end for
end sub

' ---------- toilet paper finale: bet before you see the question ----------
' A right answer wins the bet, a wrong answer loses it (scores never go
' below zero). Teams with few points can still bet up to 10.
function wagerOptions(score as integer) as object
    base = maxI(score, 10)
    amounts = [0, ceilI(base / 4), ceilI(base / 2), base]
    out = []
    for each a in amounts
        if indexOf(out, a) < 0 then out.Push(a)
    end for
    return out
end function

sub placeWager(amount as integer)
    m.game.wager = amount
    sfx("bet")
    redrawRound("ans-0")
    startTimer(0)   ' the bet isn't timed; the question is
end sub

' ---------- ingredient help + reveals ----------
sub help(i as integer)
    g = m.game
    if g.steal = invalid
        if not g.helped.DoesExist(i.ToStr()) then sfx("help")
        g.helped[i.ToStr()] = true
    end if
    g.helpIng = i
    redrawRound("ing-" + i.ToStr())
end sub

' Uncover a chosen ingredient, or the next one in difficulty order.
sub reveal(pick as integer)
    g = m.game
    if g.steal <> invalid then return
    q = cur()
    if q.type = "tf" or g.shown >= q.ingredients.Count() then return
    idx = pick
    if idx < 0 or g.open.DoesExist(idx.ToStr())
        idx = -1
        for each o in g.order
            if idx < 0 and not g.open.DoesExist(o.ToStr()) then idx = o
        end for
    end if
    g.open[idx.ToStr()] = true
    g.shown = g.shown + 1
    sfx("reveal")
    key = ""
    if m.focused <> invalid then key = m.focused.key
    if g.shown >= q.ingredients.Count() then key = "ans-0"
    redrawRound(key)
end sub

' ---------- answering ----------
function correctAnswer(q as object) as string
    if q.type = "tf"
        if q.truth then return "True"
        return "False"
    end if
    return q.answer
end function

sub answer(choice as dynamic)
    g = m.game
    if g.locked then return
    stopMusic()
    stopTimer()
    timedOut = choice = invalid
    q = cur()
    correct = correctAnswer(q)
    right = false
    if not timedOut then right = choice = correct
    if g.steal <> invalid
        finishSteal(choice, right, timedOut)
        return
    end if
    if not right and not isWager(g.index) and canSteal(q)
        firstMiss(choice, timedOut)
        return
    end if
    wager = isWager(g.index)
    pts = 0
    if right then pts = points()
    lost = 0
    if wager and not right then lost = minI(g.wager, g.scores[g.team])
    g.scores[g.team] = g.scores[g.team] + pts - lost
    if right
        sfx("correct")
        confetti(70, [teamHex(g.team)])
    else if lost > 0
        sfx("lose")
    else if timedOut
        sfx("timeup")
    else
        sfx("wrong")
    end if

    if right and wager and pts = 0
        v = "Correct! You bet 0, so your score stays the same."
    else if right
        v = "Correct! +" + plural(pts)
    else if timedOut
        v = "Time's up!"
        if lost > 0 then v = "Time's up! You lose " + plural(lost) + "."
    else
        v = "Nope — you said " + choice + "."
        if lost > 0 then v = "Nope — you said " + choice + ". You lose " + plural(lost) + "."
    end if
    g.verdict = { good: right, text: v }
    who = teamName(g.team)
    if g.teams = 1 then who = "You"
    if right
        if pts > 0
            s = who + " +" + plural(pts)
        else if g.teams = 1
            s = "You kept your points"
        else
            s = who + " kept their points"
        end if
    else if timedOut
        s = who + " ran out of time"
        if lost > 0 then s = s + " — loses " + plural(lost)
    else
        s = who + " said " + choice
        if lost > 0 then s = s + " — loses " + plural(lost)
    end if
    redrawScoresOnly()
    showPop(right, s, "result")
end sub

sub redrawScoresOnly()
    if m.scr = "round" then redrawRound()
end sub

sub popThen(tag as string)
    if tag = "result"
        showResult()
    else if tag = "steal"
        if m.game.chain <> invalid then offerSteal()
    end if
end sub

' ---------- steals ----------
' A miss shows a big WRONG!, then "Steal it?". Whoever shouts first gets
' picked on the remote. Each team gets one try per question; every steal is
' worth half the last one, a missed steal loses that much, and the chain
' runs until someone gets it or nobody's left. 10 seconds per steal if the
' timer is on.
function canSteal(q as object) as boolean
    return m.settings.steal = 1 and m.game.teams > 1 and q.type <> "tf"
end function

sub firstMiss(choice as dynamic, timedOut as boolean)
    g = m.game
    tried = {}
    tried[g.team.ToStr()] = true
    removed = []
    missText = "Time's up!"
    if not timedOut
        removed.Push(choice)
        missText = "Nope — you said " + choice + "."
    end if
    g.chain = { value: maxI(1, ceilI(points() / 2)), tried: tried, removed: removed, missText: missText, steals: 0 }
    if timedOut then sfx("timeup") else sfx("wrong")
    if timedOut then s = teamName(g.team) + " ran out of time" else s = teamName(g.team) + " said " + choice
    redrawRound()
    showPop(false, s, "steal")
end sub

sub offerSteal()
    g = m.game
    ch = g.chain
    left = 0
    for each o in g.options
        if indexOf(ch.removed, o) < 0 then left = left + 1
    end for
    teams = []
    for i = 0 to g.teams - 1
        if not ch.tried.DoesExist(i.ToStr()) then teams.Push(i)
    end for
    if teams.Count() = 0 or left <= 1
        nobodyGotIt()
        return
    end if
    openModal("steal")
    root = m.modal.root
    w = 1000
    bw = 840
    sub1 = "First team to yell “STEAL!” gets it — worth " + plural(ch.value) + ". Miss it and lose " + ch.value.ToStr() + "."
    subLines = wrapText(sub1, "medium", 34, bw)
    h = 64 + 42 + 140 + subLines.Count() * 44 + 36 + (teams.Count() + 1) * 100 + teams.Count() * 22 + 64
    b = modalBox(root, w, h)
    y = b.y + 64
    kicker = "UP FOR GRABS!"
    if ch.steals > 0 then kicker = "STILL UP FOR GRABS!"
    tracked(root, kicker, "xbold", 32, m.C.pop, 960, y, 0.14, "center")
    y = y + 42
    label(root, "Steal it?", "serif", 110, m.C.ink, 960, y, { align: "center", w: w })
    y = y + 140
    para(root, sub1, "medium", 34, m.C.soft, b.x + 80, y, bw, { align: "center", lh: 44 })
    y = y + subLines.Count() * 44 + 36
    for each t in teams
        it = button(root, b.x + 80, y, teamName(t) + " yelled first", "team", "stealer", { w: bw, size: 44, fill: teamHex(t), key: "stealer-" + t.ToStr() })
        it.team = t
        y = y + 122
    end for
    button(root, b.x + 80, y, "No steal — show the answer", "default", "no-steal", { w: bw })
    m.modal.items = m.building
    focusKeyOrFirst("")
    startMusic("suspense")
    sfx("steal")
end sub

sub startSteal(team as integer)
    g = m.game
    ch = g.chain
    closeModal()
    g.steal = { team: team, value: ch.value }
    ch.tried[team.ToStr()] = true
    ch.steals = ch.steals + 1
    g.helpIng = -1
    redrawRound("")
    ' Focus the first answer that's still in play.
    for each it in focusables()
        if Left(it.key, 4) = "ans-"
            setFocus(it)
            exit for
        end if
    end for
    startMusic("suspense")
    startTimer(10)
end sub

sub finishSteal(choice as dynamic, right as boolean, timedOut as boolean)
    g = m.game
    s = g.steal
    ch = g.chain
    name = teamName(s.team)
    if right
        g.scores[s.team] = g.scores[s.team] + s.value
        sfx("correct")
        confetti(110, [teamHex(s.team)])
        g.verdict = { good: true, text: name + " steals it! +" + plural(s.value) }
        redrawRound()
        showPop(true, name + " steals it! +" + plural(s.value), "result")
        return
    end if
    lost = minI(s.value, g.scores[s.team])
    g.scores[s.team] = g.scores[s.team] - lost
    if lost > 0
        sfx("lose")
    else if timedOut
        sfx("timeup")
    else
        sfx("wrong")
    end if
    if not timedOut then ch.removed.Push(choice)
    g.steal = invalid
    ch.value = maxI(1, ceilI(ch.value / 2))
    if timedOut then t = name + " ran out of time" else t = name + " said " + choice
    if lost > 0 then t = t + " — loses " + plural(lost)
    redrawRound()
    showPop(false, t, "steal")
end sub

sub nobodyGotIt()
    g = m.game
    closeModal()
    v = "Nobody got it!"
    if g.chain <> invalid and g.chain.steals = 0 then v = g.chain.missText
    g.verdict = { good: false, text: v }
    showResult()
end sub

' ---------- the answer screen ----------
sub showResult()
    m.game.steal = invalid
    m.game.chain = invalid
    show("result", "next")
end sub

sub buildResult(p as object)
    g = m.game
    q = cur()
    tf = q.type = "tf"
    leftX = 120
    leftW = 1680 - 600 - 88
    rightX = 1800 - 600

    ' Left column, measured first so it can be centered.
    answerText = correctAnswer(q)
    if tf then answerText = answerText + "."
    spotTag = "WEIRD INGREDIENT SPOTLIGHT"
    spotName = ""
    spotNote = ""
    if tf
        spotTag = "THE REAL STORY"
        spotName = q.statement
        spotNote = q.explain
    else
        spotName = q.spotlight.name
        spotNote = q.spotlight.note
    end if
    aLines = wrapText(answerText, "serif", 92, leftW)
    innerW = leftW - 10 - 88
    nameSize = 48
    nLines = wrapText(spotName, "serif", nameSize, innerW)
    if nLines.Count() > 2
        nameSize = 40
        nLines = wrapText(spotName, "serif", nameSize, innerW)
    end if
    noteSize = 40
    noteLines = wrapText(spotNote, "medium", noteSize, innerW)
    if noteLines.Count() > 4
        noteSize = 34
        noteLines = wrapText(spotNote, "medium", noteSize, innerW)
    end if
    noteLh = Int(noteSize * 1.45)
    nameLh = Int(nameSize * 1.15)
    spotH = 34 + 34 + 10 + nLines.Count() * nameLh + 14 + noteLines.Count() * noteLh + 34
    vColor = m.C.bad
    vText = ""
    if g.verdict <> invalid
        vText = g.verdict.text
        if g.verdict.good then vColor = m.C.good
    end if
    vLines = wrapText(vText, "xbold", 48, leftW)
    total = vLines.Count() * 62 + 14 + aLines.Count() * 96 + 26 + spotH + 52 + 100
    y = maxI(60, (1080 - total) / 2)
    for each l in vLines
        label(p, l, "xbold", 48, vColor, leftX, y, { w: leftW + 48 })
        y = y + 62
    end for
    y = y + 14
    for each l in aLines
        label(p, l, "serif", 92, m.C.ink, leftX, y + (96 - lineH(92)) / 2, { w: leftW + 92 })
        y = y + 96
    end for
    y = y + 26
    shape(p, leftX, y, leftW, spotH, 16, m.C.bg2)
    rect(p, leftX, y + 8, 10, spotH - 16, m.C.gold)
    shape(p, leftX, y, 20, spotH, 12, m.C.gold)
    rect(p, leftX + 10, y, 12, spotH, m.C.bg2)
    sx = leftX + 10 + 44
    sy = y + 34
    tracked(p, spotTag, "xbold", 26, m.C.gold, sx, sy, 0.12)
    sy = sy + 34 + 10
    for each l in nLines
        label(p, l, "serif", nameSize, m.C.ink, sx, sy + (nameLh - lineH(nameSize)) / 2, { w: innerW + nameSize })
        sy = sy + nameLh
    end for
    sy = sy + 14
    for each l in noteLines
        label(p, l, "medium", noteSize, m.C.soft, sx, sy + (noteLh - lineH(noteSize)) / 2, { w: innerW + noteSize })
        sy = sy + noteLh
    end for
    y = y + spotH + 52

    last = g.index + 1 >= g.deck.Count()
    if last
        nb = button(p, leftX, y, "See final scores", "primary", "next")
    else if g.teams = 1
        nb = button(p, leftX, y, "Next round", "primary", "next")
    else
        up = g.turnOrder[(g.index + 1) mod g.teams]
        nb = button(p, leftX, y, "Up next: " + teamName(up), "primary", "next", { dotLabel: "Up next: ", dotColor: teamHex(up) })
    end if
    button(p, leftX + nb.w + 28, y, "Menu", "ghostDark", "menu")

    ' Right column: ingredients to know about + the book.
    groups = watchGroups(q)
    watchH = 0
    blocks = []
    if groups.Count() > 0
        watchH = 30 + 34 + 18
        for each gr in groups
            nl = wrapText(gr.names, "xbold", 30, 600 - 68 - 24)
            blocks.Push({ lines: nl, tag: gr.tag, lv: gr.lv })
            watchH = watchH + nl.Count() * 38 + 32 + 14
        end for
        watchH = watchH - 14 + 30
    end if
    bk = m.data.books[q.book]
    titleLines = wrapText(bk.title, "xbold", 30, 338)
    if groups.Count() > 0
        coverW = 230
        if watchH + 36 + 368 > 960 then coverW = 180
        coverH = Int(coverW * 1.6)
        sideH = watchH + 36 + coverH
    else
        coverW = 300
        coverH = 480
        sideH = coverH + 22 + 40 + titleLines.Count() * 40
    end if
    ry = maxI(60, (1080 - sideH) / 2)
    if groups.Count() > 0
        shape(p, rightX, ry, 600, watchH, 20, m.C.bg2)
        tracked(p, "INGREDIENTS TO KNOW ABOUT", "xbold", 26, m.C.gold, rightX + 34, ry + 30, 0.12)
        wy = ry + 30 + 34 + 18
        for each bl in blocks
            bh = bl.lines.Count() * 38 + 32
            lineC = "0xE06A5FD9"
            tagC = "0xF3B3ABFF"
            if bl.lv = "unknown"
                lineC = m.C.gold
                tagC = m.C.gold
            end if
            rect(p, rightX + 34, wy, 6, bh, lineC)
            for li = 0 to bl.lines.Count() - 1
                label(p, bl.lines[li], "xbold", 30, m.C.ink, rightX + 34 + 24, wy + li * 38)
            end for
            label(p, bl.tag, "bold", 24, tagC, rightX + 34 + 24, wy + bl.lines.Count() * 38)
            wy = wy + bh + 14
        end for
        by = ry + watchH + 36
        image(p, bk.cover, rightX, by, coverW, coverH)
        tx = rightX + coverW + 32
        tw = 600 - coverW - 32
        titleLines = wrapText(bk.title, "xbold", 30, tw)
        th = 40 + titleLines.Count() * 40
        ty = by + (coverH - th) / 2
        label(p, "Learn more in", "medium", 30, m.C.muted, tx, ty)
        for li = 0 to titleLines.Count() - 1
            label(p, titleLines[li], "xbold", 30, m.C.ink, tx, ty + 40 + li * 40)
        end for
    else
        image(p, bk.cover, rightX + 150, ry, coverW, coverH)
        ty = ry + coverH + 22
        label(p, "Learn more in", "medium", 30, m.C.muted, rightX + 300, ty, { align: "center", w: 600 })
        titleLines = wrapText(bk.title, "xbold", 30, 560)
        for li = 0 to titleLines.Count() - 1
            label(p, titleLines[li], "xbold", 30, m.C.ink, rightX + 300, ty + 40 + li * 40, { align: "center", w: 600 })
        end for
    end if
end sub

' Groups ingredients that share a tag ("Red 40, Yellow 5, Blue 1 - Synthetic dye").
function watchGroups(q as object) as object
    out = []
    if q.ingredients = invalid then return out
    index = {}
    for each ing in q.ingredients
        if ing.lv <> invalid
            key = ing.lv + "|" + ing.tag
            if not index.DoesExist(key)
                index[key] = out.Count()
                out.Push({ lv: ing.lv, tag: ing.tag, list: [] })
            end if
            gr = out[index[key]]
            if indexOf(gr.list, ing.n) < 0 then gr.list.Push(ing.n)
        end if
    end for
    for each gr in out
        s = ""
        for each n in gr.list
            if s <> "" then s = s + ", "
            s = s + n
        end for
        gr.names = s
    end for
    return out
end function

sub nextRound()
    m.game.index = m.game.index + 1
    m.game.verdict = invalid
    if m.game.index >= m.game.deck.Count() then finish() else startRound()
end sub

' ---------- final scores, the loser's dare and the book ----------
sub finish()
    g = m.game
    order = []
    for i = 0 to g.scores.Count() - 1
        e = { s: g.scores[i], i: i }
        k = order.Count()
        ' stable insertion: highest score first
        while k > 0 and order[k - 1].s < e.s
            k = k - 1
        end while
        order.Push(invalid)
        j = order.Count() - 1
        while j > k
            order[j] = order[j - 1]
            j = j - 1
        end while
        order[k] = e
    end for
    top = order[0].s
    winners = []
    for each o in order
        if o.s = top then winners.Push(o)
    end for
    g.finalOrder = order
    g.winners = winners
    ' Loser's dare: last place (all tied for last) does it. Solo players get
    ' one if they scored under half the possible points.
    low = order[order.Count() - 1].s
    losers = []
    for each o in order
        if o.s = low then losers.Push(o.i)
    end for
    who = invalid
    if m.settings.dare = 1
        if g.teams = 1
            if top < maxPoints() / 2 then who = "YOUR DARE"
        else if losers.Count() = g.teams
            who = "EVERYBODY'S DARE"
        else
            s = ""
            for each t in losers
                if s <> "" then s = s + " & "
                s = s + teamName(t)
            end for
            who = UCase(s + "'s dare")
        end if
    end if
    g.dareWho = who
    g.dareText = ""
    if who <> invalid then pickDare()

    sfx("win")
    if who <> invalid then later(2600, "dareSound")
    show("final", "start")
    cols = []
    if g.teams = 1 or winners.Count() > 1
        for each c in g.colors
            cols.Push(m.TEAM_HEX[c])
        end for
    else
        cols.Push(teamHex(winners[0].i))
    end if
    m.winColors = copyArray(cols)
    m.winColors.Push(m.C.gold)
    cols.Push(m.C.gold)
    cols.Push(m.C.ink)
    confetti(100, cols)
    later(900, "confetti2")
end sub

sub pickDare()
    dares = m.data.dares
    prev = m.game.dareText
    d = prev
    tries = 0
    while (d = prev or d = "") and tries < 20
        d = dares[Rnd(dares.Count()) - 1]
        tries = tries + 1
    end while
    m.game.dareText = d
end sub

sub showDare()
    pickDare()
    show("final", "new-dare")
end sub

sub buildFinal(p as object)
    g = m.game
    order = g.finalOrder
    winners = g.winners
    top = order[0].s
    leftX = 120
    leftW = 1680 - 600 - 72
    rightX = 1200

    if g.teams = 1
        wText = "You scored " + plural(top) + "!"
        wColor = m.C.ink
    else if winners.Count() > 1
        wText = "It's a tie!"
        wColor = m.C.ink
    else
        wText = teamName(winners[0].i) + " wins!"
        wColor = teamHex(winners[0].i)
    end if
    wLines = wrapText(wText, "serif", 104, leftW)
    dareLines = []
    if g.dareWho <> invalid then dareLines = wrapText(g.dareText, "bold", 40, 1000 - 72)
    total = 58 + 8 + wLines.Count() * 106 + 30
    if g.teams > 1 then total = total + g.teams * 64 + 32
    if g.dareWho <> invalid then total = total + 24 + 64 + 8 + dareLines.Count() * 54 + 24 + 40
    total = total + 84
    y = maxI(60, (1080 - total) / 2)

    label(p, "Game over", "serifItalic", 44, m.C.pop, leftX, y)
    y = y + 58 + 8
    for each l in wLines
        label(p, l, "serif", 104, wColor, leftX, y + (106 - lineH(104)) / 2, { w: leftW + 104 })
        y = y + 106
    end for
    y = y + 30
    if g.teams > 1
        for each o in order
            dot(p, leftX + 14, y + 30, 28, teamHex(o.i))
            label(p, teamName(o.i) + " — " + o.s.ToStr(), "xbold", 48, m.C.ink, leftX + 52, y + (60 - lineH(48)) / 2)
            y = y + 64
        end for
        y = y + 32
    end if
    if g.dareWho <> invalid
        dh = 24 + 64 + 8 + dareLines.Count() * 54 + 24
        dw = 1000
        panel(p, leftX, y, dw, dh, 20, m.C.bg2, m.C.pop, 4)
        tracked(p, g.dareWho, "xbold", 26, m.C.pop, leftX + 36, y + 24 + (64 - 34) / 2, 0.12)
        nd = button(p, 0, y + 24, "New dare", "default", "new-dare", { size: 26, padX: 28, h: 64 })
        nd.x = leftX + dw - 36 - nd.w
        nd.node.translation = [nd.x, nd.y]
        ty = y + 24 + 64 + 8
        for each l in dareLines
            label(p, l, "bold", 40, m.C.ink, leftX + 36, ty + (54 - lineH(40)) / 2, { w: dw - 40 })
            ty = ty + 54
        end for
        y = y + dh + 40
    end if
    bx = leftX
    it = button(p, bx, y, "Play again", "primary", "start", { size: 34, padX: 40, h: 84 })
    bx = bx + it.w + 22
    it = button(p, bx, y, "Change game", "default", "books", { size: 34, padX: 40, h: 84 })
    button(p, bx + it.w + 22, y, "Main menu", "default", "title", { size: 34, padX: 40, h: 84 })

    ' The book promo: QR code with the cover in the middle, and the Amazon line.
    ' (The book QR codes and promotion always stay - they're the point.)
    if g.book = "all"
        bk = invalid
        qr = m.data.series.qr
        ptitle = "the Ingredient Dictionary books"
        getText = "See all the books →"
    else
        bk = m.data.books[g.book]
        qr = bk.qr
        ptitle = bk.title
        getText = "Get " + bk.name + " on Amazon →"
    end if
    pw = 600
    tLines = wrapText(ptitle, "xbold", 32, pw - 88)
    getW = measure(getText, "xbold", 26) + 68
    ph = 40 + 39 + 20 + 400 + 22 + 42 + tLines.Count() * 42 + 22 + 62 + 40
    py = (1080 - ph) / 2
    shape(p, rightX, py, pw, ph, 28, m.C.label)
    cxm = rightX + pw / 2
    y = py + 40
    label(p, "What's really in your stuff?", "xbold", 30, m.C.labelInk, cxm, y, { align: "center", w: pw })
    y = y + 39 + 20
    image(p, qr, cxm - 200, y, 400, 400)
    if bk <> invalid
        rect(p, cxm - 45, y + 200 - 68, 90, 136, m.C.label)
        image(p, bk.cover, cxm - 39, y + 200 - 62, 78, 124)
    else
        rect(p, cxm - 61, y + 200 - 61, 122, 122, m.C.label)
        image(p, "pkg:/images/ui/logo_square.png", cxm - 55, y + 200 - 55, 110, 110)
    end if
    y = y + 400 + 22
    label(p, "Scan to get", "medium", 32, m.C.labelInk, cxm, y, { align: "center", w: pw })
    y = y + 42
    for each l in tLines
        label(p, l, "xbold", 32, m.C.labelInk, cxm, y, { align: "center", w: pw })
        y = y + 42
    end for
    y = y + 22
    shape(p, cxm - getW / 2, y, getW, 62, 31, m.C.amazon)
    label(p, getText, "xbold", 26, m.C.white, cxm, y + (62 - lineH(26)) / 2, { align: "center", w: getW })
end sub
