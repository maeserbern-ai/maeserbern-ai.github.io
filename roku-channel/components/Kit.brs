' Kit.brs - drawing helpers for MainScene: colors, fonts, text measuring,
' shapes, rich text, focusable items and remote (D-pad) navigation.
' Everything is laid out in absolute 1920x1080 coordinates.

function kitInit()
    m.C = {
        bg: "0x16211CFF", bg2: "0x1F2E27FF", ink: "0xF4F3EEFF", soft: "0xC9CDC6FF", muted: "0x8E978FFF",
        label: "0xF4F3EEFF", labelInk: "0x1A1C1EFF", pop: "0xE07A55FF", gold: "0xF2C46BFF",
        good: "0x5FBF8AFF", bad: "0xE06A5FFF", warnInk: "0xB42318FF", unknownInk: "0x8A5A00FF",
        helpBg: "0xE6E3DAFF", white: "0xFFFFFFFF", chipLine: "0xD9D6CCFF", hidden: "0xDAD8D0FF",
        a1: "0xB5654AFF", a2: "0x3A5A80FF", a3: "0x6A5482FF", a4: "0x3F6B57FF",
        dim: "0x0A0F0CCC", outline: "0x47524BFF", amazon: "0x3F5D4FFF", green: "0x3F8F62FF"
    }
    m.TEAM_HEX = ["0xE07A55FF", "0x6FA3D9FF", "0xB392D6FF", "0x6CC596FF"]
    m.FONT_FILES = {
        serif: "Fraunces-Black.ttf", serifItalic: "Fraunces-BlackItalic.ttf", serifSemi: "Fraunces-SemiBold.ttf",
        medium: "Inter-Medium.ttf", bold: "Inter-Bold.ttf", xbold: "Inter-ExtraBold.ttf"
    }
    m.fontCache = {}
    ' Character widths (in em) for each bundled font, made by tools/make-assets.py.
    m.met = {}
    raw = ParseJson(ReadAsciiFile("pkg:/data/metrics.json"))
    if raw <> invalid
        for each key in raw
            tbl = CreateObject("roAssociativeArray")
            tbl.SetModeCaseSensitive()
            chars = raw[key].chars
            widths = raw[key].w
            n = Len(chars)
            for i = 0 to n - 1
                tbl[Mid(chars, i + 1, 1)] = widths[i]
            end for
            m.met[key] = tbl
        end for
    end if
end function

function font(key as string, size as integer) as object
    id = key + "_" + size.ToStr()
    f = m.fontCache[id]
    if f = invalid
        f = CreateObject("roSGNode", "Font")
        f.uri = "pkg:/fonts/" + m.FONT_FILES[key]
        f.size = size
        m.fontCache[id] = f
    end if
    return f
end function

' Width of a string in pixels, from the font's own advance widths.
function measure(text as string, key as string, size as integer) as float
    tbl = m.met[key]
    if tbl = invalid then return Len(text) * size * 0.55
    total = 0.0
    n = Len(text)
    for i = 1 to n
        w = tbl[Mid(text, i, 1)]
        if w = invalid then w = 0.55
        total = total + w
    end for
    return total * size
end function

' Splits text into lines that fit maxW.
function wrapText(text as string, key as string, size as integer, maxW as float) as object
    lines = []
    words = text.Split(" ")
    line = ""
    for each w in words
        trial = w
        if line <> "" then trial = line + " " + w
        if line <> "" and measure(trial, key, size) > maxW
            lines.Push(line)
            line = w
        else
            line = trial
        end if
    end for
    if line <> "" or lines.Count() = 0 then lines.Push(line)
    return lines
end function

function lineH(size as integer) as integer
    return Int(size * 1.3 + 0.5)
end function

' One line of text. y is the top of the line box (height = 1.3 x size).
function label(parent as object, text as string, key as string, size as integer, color as string, x as float, y as float, opts = invalid as dynamic) as object
    if opts = invalid then opts = {}
    l = CreateObject("roSGNode", "Label")
    l.font = font(key, size)
    l.text = text
    l.color = color
    w = opts.w
    if w = invalid then w = measure(text, key, size) + size
    h = opts.h
    if h = invalid then h = lineH(size)
    align = opts.align
    if align = invalid then align = "left"
    ' Labels are positioned by their box; centered/right text keeps its anchor.
    if align = "center" then x = x - w / 2
    if align = "right" then x = x - w
    l.width = w
    l.height = h
    l.horizAlign = align
    l.vertAlign = "center"
    l.translation = [x, y]
    if opts.opacity <> invalid then l.opacity = opts.opacity
    parent.appendChild(l)
    return l
end function

' Wrapped paragraph; returns {node, lines, height}.
function para(parent as object, text as string, key as string, size as integer, color as string, x as float, y as float, maxW as float, opts = invalid as dynamic) as object
    if opts = invalid then opts = {}
    g = CreateObject("roSGNode", "Group")
    parent.appendChild(g)
    lines = wrapText(text, key, size, maxW)
    lh = opts.lh
    if lh = invalid then lh = lineH(size)
    align = opts.align
    if align = invalid then align = "left"
    ax = x
    if align = "center" then ax = x + maxW / 2
    if align = "right" then ax = x + maxW
    for i = 0 to lines.Count() - 1
        label(g, lines[i], key, size, color, ax, y + i * lh + (lh - lineH(size)) / 2, { w: maxW + size, align: align })
    end for
    return { node: g, lines: lines.Count(), height: lines.Count() * lh }
end function

' Letter-spaced uppercase text (like the web's letter-spacing headings).
function tracked(parent as object, text as string, key as string, size as integer, color as string, x as float, y as float, spacing as float, align = "left" as string) as float
    total = trackedWidth(text, key, size, spacing)
    if align = "center" then x = x - total / 2
    if align = "right" then x = x - total
    n = Len(text)
    for i = 1 to n
        c = Mid(text, i, 1)
        if c <> " " then label(parent, c, key, size, color, x, y, { w: measure(c, key, size) + size })
        x = x + measure(c, key, size) + spacing * size
    end for
    return total
end function

function trackedWidth(text as string, key as string, size as integer, spacing as float) as float
    return measure(text, key, size) + spacing * size * (Len(text) - 1)
end function

' Rich text: segs = [{t, k (font key), c (color)}...]. Words wrap across
' segments; consecutive words of one segment on a line share one Label.
' Returns {height, width (widest line), rows}.
function rich(parent as object, segs as object, size as integer, x as float, y as float, maxW as float, opts = invalid as dynamic) as object
    if opts = invalid then opts = {}
    lh = opts.lh
    if lh = invalid then lh = lineH(size)
    st = { cx: 0.0, row: 0, widest: 0.0, run: "", runX: 0.0 }
    for each s in segs
        sz = size
        if s.size <> invalid then sz = s.size
        parts = s.t.Split(" ")
        for i = 0 to parts.Count() - 1
            word = parts[i]
            if i < parts.Count() - 1 then word = word + " "
            if word <> ""
                wTrim = measure(word.Trim(), s.k, sz)
                if st.cx > 0 and st.cx + wTrim > maxW
                    richFlush(parent, st, s, sz, size, x, y, lh)
                    st.row = st.row + 1
                    st.cx = 0
                    st.runX = 0
                end if
                if st.run = "" then st.runX = st.cx
                st.run = st.run + word
                st.cx = st.cx + measure(word, s.k, sz)
                if st.cx > st.widest then st.widest = st.cx
            end if
        end for
        richFlush(parent, st, s, sz, size, x, y, lh)
    end for
    return { height: (st.row + 1) * lh, width: st.widest, rows: st.row + 1 }
end function

sub richFlush(parent as object, st as object, s as object, sz as integer, size as integer, x as float, y as float, lh as integer)
    if st.run = "" then return
    label(parent, st.run, s.k, sz, s.c, x + st.runX, y + st.row * lh + (lh - lineH(sz)) / 2 + (size - sz) * 0.25, { w: measure(st.run, s.k, sz) + sz })
    st.run = ""
end sub

function richWidth(segs as object, size as integer) as float
    w = 0.0
    for each s in segs
        sz = size
        if s.size <> invalid then sz = s.size
        w = w + measure(s.t, s.k, sz)
    end for
    return w
end function

function rect(parent as object, x as float, y as float, w as float, h as float, color as string, opacity = 1.0 as float) as object
    r = CreateObject("roSGNode", "Rectangle")
    r.translation = [x, y]
    r.width = w
    r.height = h
    r.color = color
    if opacity < 1 then r.opacity = opacity
    parent.appendChild(r)
    return r
end function

' The 9-patch with the largest corner radius that still fits this height.
function shapeName(radius as integer, h as float) as string
    r = radius
    if r * 2 + 4 > h then r = Int((h - 4) / 2)
    if r >= 40 then return "pill"
    if r >= 28 then return "r28"
    if r >= 20 then return "r20"
    return "r12"
end function

function ringName(radius as integer, h as float) as string
    r = radius
    if r * 2 + 4 > h then r = Int((h - 4) / 2)
    if r >= 40 then return "pillring"
    if r >= 28 then return "ring28"
    if r >= 20 then return "ring20"
    return "ring12"
end function

' Rounded rectangle tinted with color.
function shape(parent as object, x as float, y as float, w as float, h as float, radius as integer, color as string, opacity = 1.0 as float) as object
    p = CreateObject("roSGNode", "Poster")
    p.uri = "pkg:/images/ui/" + shapeName(radius, h) + ".9.png"
    ' Whole pixels keep 9-patch edges seamless.
    p.translation = [Int(x + 0.5), Int(y + 0.5)]
    p.width = Int(w + 0.5)
    p.height = Int(h + 0.5)
    p.blendColor = color
    if opacity < 1 then p.opacity = opacity
    parent.appendChild(p)
    return p
end function

' Rounded box with an inset border.
function panel(parent as object, x as float, y as float, w as float, h as float, radius as integer, fill as string, line as string, lw as integer) as object
    g = CreateObject("roSGNode", "Group")
    parent.appendChild(g)
    if lw > 0
        shape(g, x, y, w, h, radius, line)
        shape(g, x + lw, y + lw, w - lw * 2, h - lw * 2, radius - lw, fill)
    else
        shape(g, x, y, w, h, radius, fill)
    end if
    return g
end function

function ring(parent as object, x as float, y as float, w as float, h as float, radius as integer, color as string) as object
    p = CreateObject("roSGNode", "Poster")
    p.uri = "pkg:/images/ui/" + ringName(radius, h) + ".9.png"
    p.translation = [Int(x + 0.5), Int(y + 0.5)]
    p.width = Int(w + 0.5)
    p.height = Int(h + 0.5)
    p.blendColor = color
    parent.appendChild(p)
    return p
end function

function dot(parent as object, cx as float, cy as float, d as float, color as string, opacity = 1.0 as float) as object
    p = CreateObject("roSGNode", "Poster")
    p.uri = "pkg:/images/ui/dot.png"
    p.translation = [cx - d / 2, cy - d / 2]
    p.width = d
    p.height = d
    p.blendColor = color
    if opacity < 1 then p.opacity = opacity
    parent.appendChild(p)
    return p
end function

function image(parent as object, uri as string, x as float, y as float, w as float, h as float) as object
    p = CreateObject("roSGNode", "Poster")
    p.uri = uri
    p.translation = [x, y]
    p.width = w
    p.height = h
    p.loadDisplayMode = "scaleToFill"
    parent.appendChild(p)
    return p
end function

function group(parent as object, x = 0 as float, y = 0 as float) as object
    g = CreateObject("roSGNode", "Group")
    g.translation = [x, y]
    parent.appendChild(g)
    return g
end function

' ---------- focusable items ----------
' An item is an AA: {node, x, y, w, h, action, key, ...}. node is a Group
' placed at [x, y]; its children are drawn relative to it. The gold focus
' ring and the 1.07x zoom are added here.
function newItem(parent as object, x as float, y as float, w as float, h as float, radius as integer, action as string, key = "" as string) as object
    g = CreateObject("roSGNode", "Group")
    g.translation = [x, y]
    g.scaleRotateCenter = [w / 2, h / 2]
    parent.appendChild(g)
    if key = "" then key = action
    item = { node: g, x: x, y: y, w: w, h: h, radius: radius, action: action, key: key, disabled: false, hidden: false, zoom: 1.07 }
    return item
end function

function finishItem(item as object) as object
    pad = 8
    item.ring = ring(item.node, -pad, -pad, item.w + pad * 2, item.h + pad * 2, item.radius + pad, m.C.gold)
    item.ring.visible = false
    m.building.Push(item)
    return item
end function

' Button styles: primary, default, dark (on the label card), ghost (outline
' on the label card), ghostDark, chip, chipOn, team (fill passed in opts.fill).
function button(parent as object, x as float, y as float, text as string, style as string, action as string, opts = invalid as dynamic) as object
    if opts = invalid then opts = {}
    size = 40
    padX = 56
    h = 100
    radius = 50
    fill = m.C.bg2
    ink = m.C.ink
    line = m.C.outline
    lw = 3
    k = "xbold"
    if opts.size <> invalid then size = opts.size
    if style = "primary"
        fill = m.C.pop
        ink = m.C.labelInk
        lw = 0
    else if style = "chip" or style = "chipOn"
        radius = 24
        padX = 32
        if style = "chipOn"
            fill = m.C.ink
            ink = m.C.labelInk
            lw = 0
        end if
    else if style = "dark"
        fill = m.C.labelInk
        ink = m.C.label
        lw = 0
    else if style = "ghost"
        fill = m.C.label
        ink = m.C.labelInk
        line = "0xA3A4A2FF"
    else if style = "ghostDark"
        fill = m.C.bg
        line = "0x5A635DFF"
    else if style = "team"
        fill = opts.fill
        ink = "0x1A1C1EFF"
        lw = 0
    end if
    if opts.h <> invalid then h = opts.h
    if opts.padX <> invalid then padX = opts.padX
    tw = measure(text, k, size)
    extra = 0
    if opts.dotColor <> invalid then extra = size * 0.8 + size * 0.5
    w = tw + extra + padX * 2
    if opts.w <> invalid then w = opts.w
    if opts.minW <> invalid and w < opts.minW then w = opts.minW
    key = ""
    if opts.key <> invalid then key = opts.key
    item = newItem(parent, x, y, w, h, radius, action, key)
    panel(item.node, 0, 0, w, h, radius, fill, line, lw)
    tx = (w - tw - extra) / 2
    if opts.dotLabel <> invalid
        ' "Up next: [dot] Team Blue"
        pre = opts.dotLabel
        pw = measure(pre, k, size)
        label(item.node, pre, k, size, ink, tx, (h - lineH(size)) / 2)
        dot(item.node, tx + pw + size * 0.55, h / 2, size * 0.8 + 6, "0x00000059")
        dot(item.node, tx + pw + size * 0.55, h / 2, size * 0.8, opts.dotColor)
        label(item.node, Mid(text, Len(pre) + 1), k, size, ink, tx + pw + extra, (h - lineH(size)) / 2)
    else
        item.text = label(item.node, text, k, size, ink, w / 2, (h - lineH(size)) / 2, { w: w, align: "center" })
    end if
    item.style = style
    for each f in opts
        if item[f] = invalid then item[f] = opts[f]
    end for
    return finishItem(item)
end function

function setDisabled(item as object, off as boolean)
    item.disabled = off
    if off then item.node.opacity = 0.35 else item.node.opacity = 1.0
end function

function setHidden(item as object, off as boolean)
    item.hidden = off
    item.node.visible = not off
end function

' ---------- focus + navigation ----------
function setFocus(item as dynamic)
    if m.focused <> invalid and m.focused.node <> invalid
        m.focused.node.scale = [1.0, 1.0]
        if m.focused.ring <> invalid then m.focused.ring.visible = false
        if m.focused.onBlur <> invalid then focusLook(m.focused, false)
    end if
    m.focused = item
    if item <> invalid
        item.node.scale = [item.zoom, item.zoom]
        if item.ring <> invalid then item.ring.visible = true
        if item.onBlur <> invalid then focusLook(item, true)
    end if
end function

' The items the remote can reach right now: the open modal's, or the screen's.
function scopeItems() as object
    if m.modal <> invalid then return m.modal.items
    return m.items
end function

function focusables() as object
    out = []
    for each it in scopeItems()
        if not it.disabled and not it.hidden then out.Push(it)
    end for
    return out
end function

function findItem(key as string) as dynamic
    for each it in focusables()
        if it.key = key then return it
    end for
    return invalid
end function

function inScope(item as dynamic) as boolean
    if item = invalid then return false
    for each it in focusables()
        if it.node.isSameNode(item.node) then return true
    end for
    return false
end function

' Move to the nearest focusable element in the pressed direction (same rules
' as the web game: left/right stay on the row, up/down may fall back).
sub moveFocus(dir as string)
    items = focusables()
    if items.Count() = 0 then return
    if not inScope(m.focused)
        setFocus(items[0])
        return
    end if
    best = pickBest(items, dir, true)
    if best = invalid and (dir = "up" or dir = "down") then best = pickBest(items, dir, false)
    ' Moving down off the ingredients lands on Next ingredient, never straight on Menu.
    if dir = "down" and best <> invalid and best.action = "menu" and m.scr = "round"
        rev = findItem("reveal")
        if rev <> invalid and not m.focused.node.isSameNode(rev.node) then best = rev
    end if
    if best <> invalid
        setFocus(best)
        sfx("move")
    end if
end sub

function pickBest(items as object, dir as string, strict as boolean) as dynamic
    a = m.focused
    ax = a.x + a.w / 2
    ay = a.y + a.h / 2
    best = invalid
    bestScore = 1.0e9
    for each b in items
        if not b.node.isSameNode(a.node)
            bx = b.x + b.w / 2
            by = b.y + b.h / 2
            dx = bx - ax
            dy = by - ay
            main = 0
            cross = 0
            if dir = "left" then main = -dx
            if dir = "right" then main = dx
            if dir = "up" then main = -dy
            if dir = "down" then main = dy
            ok = main > 1
            if ok
                if dir = "left" or dir = "right"
                    cross = Abs(dy)
                    if b.y + b.h <= a.y or b.y >= a.y + a.h then ok = false
                else
                    cross = Abs(dx)
                    if strict and cross > main * 2 then ok = false
                end if
            end if
            if ok
                score = main + cross * 2
                if score < bestScore
                    bestScore = score
                    best = b
                end if
            end if
        end if
    end for
    return best
end function

function clearChildren(node as object)
    while node.getChildCount() > 0
        node.removeChildIndex(0)
    end while
end function

function plural(n as integer) as string
    if n = 1 then return "1 point"
    return n.ToStr() + " points"
end function

function shuffle(a as object) as object
    for i = a.Count() - 1 to 1 step -1
        j = Rnd(i + 1) - 1
        t = a[i]
        a[i] = a[j]
        a[j] = t
    end for
    return a
end function

function copyArray(a as object) as object
    out = []
    for each x in a
        out.Push(x)
    end for
    return out
end function

function indexOf(a as object, v as dynamic) as integer
    for i = 0 to a.Count() - 1
        if a[i] = v then return i
    end for
    return -1
end function

function nowMs() as integer
    return m.clockTs.TotalMilliseconds()
end function
