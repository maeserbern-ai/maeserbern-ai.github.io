package io.github.maeserbern.ingredientpartygame.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.view.View
import android.widget.FrameLayout
import android.widget.RemoteViews
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.compose
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import java.util.regex.Pattern
import java.io.File
import java.io.FileOutputStream

/**
 * Renders the real Glance widget (the same RemoteViews a launcher shows) for each
 * size and state, and checks the daily puzzle, answer and streak rules.
 * PNGs go to the app's files/widget-previews folder (pulled by the workflow).
 */
@RunWith(AndroidJUnit4::class)
class WidgetPreviewTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val out = File(context.filesDir, "widget-previews").apply { mkdirs() }

    private val sizes = linkedMapOf(
        "small" to DpSize(160.dp, 160.dp),
        "medium" to DpSize(330.dp, 150.dp),
        "large" to DpSize(330.dp, 340.dp),
    )

    @After fun reset() {
        DailyClock.dayOverride = null
        DailyStateStore.save(context, DailyState())
    }

    private fun dayShowing(deck: DailyDeck, puzzleId: Int): Int {
        val slot = deck.order.indexOf(puzzleId)
        assertTrue("puzzle $puzzleId is in the daily order", slot >= 0)
        return 400 * deck.order.size + slot // a day in 2027+, still the same slot
    }

    @Test fun everyPuzzleAppearsOnceIn105Days() {
        val deck = DailyDeck.get(context)
        assertEquals(105, deck.puzzles.size)
        val seen = (0 until 105).map { deck.puzzleForDay(it)!!.id }.toSet()
        assertEquals(105, seen.size)
        deck.books.values.forEach { assertTrue(it.url.startsWith("https://www.amazon.com/")) }
    }

    @Test fun answerAndStreakRules() {
        val deck = DailyDeck.get(context)
        val day = dayShowing(deck, 3)
        val puzzle = deck.puzzleForDay(day)!!
        DailyStateStore.save(context, DailyState(lastPlayedDay = day - 1, streak = 3))
        val after = DailyStateStore.answer(context, puzzle.answer, day)
        assertEquals(4, after.streak)
        assertEquals(puzzle.answer, after.choiceOn(day))
        // A second tap the same day changes nothing.
        val again = DailyStateStore.answer(context, (puzzle.answer + 1) % 4, day)
        assertEquals(after, again)
        // Skipping a day resets the streak.
        val later = DailyStateStore.answer(context, 0, day + 2)
        assertEquals(1, later.streak)
    }

    @Test fun renderPreviews() = runBlocking {
        val deck = DailyDeck.get(context)
        val label = dayShowing(deck, 3) // "Lip balm", as in the approved design
        val tf = dayShowing(deck, deck.puzzles.values.first { it.isTrueFalse }.id)
        for ((name, day) in listOf("label" to label, "truefalse" to tf)) {
            val puzzle = deck.puzzleForDay(day)!!
            for (state in listOf("new", "correct", "wrong")) {
                DailyClock.dayOverride = day
                if (state == "new") {
                    DailyStateStore.save(context, DailyState(lastPlayedDay = day - 1, streak = 4))
                } else {
                    DailyStateStore.save(context, DailyState(lastPlayedDay = day - 1, streak = 4))
                    val choice = if (state == "correct") puzzle.answer else (puzzle.answer + 1) % puzzle.options.size
                    DailyStateStore.answer(context, choice, day)
                }
                for ((sizeName, size) in sizes) {
                    val views = LabelOfTheDayWidget().compose(context, size = size)
                    render(views, size, File(out, "android-$name-$state-$sizeName.png"))
                }
            }
        }
    }

    /**
     * The real thing on the emulator's launcher: pins the widget to the home screen,
     * taps an answer on it, then taps the book row and the QR code. Each tap on the
     * book must bring up the browser (or Amazon app) that handles the Amazon link.
     */
    @Test fun homeScreenWidgetAnswersAndOpensAmazon() {
        val deck = DailyDeck.get(context)
        val day = dayShowing(deck, 3)
        DailyClock.dayOverride = day
        DailyStateStore.save(context, DailyState(lastPlayedDay = day - 1, streak = 4))
        val puzzle = deck.puzzleForDay(day)!!
        val book = deck.bookFor(puzzle)!!
        assertEquals(book.url, bookIntent(book).dataString)
        val device = UiDevice.getInstance(instrumentation)
        val log = StringBuilder("book=${book.url}\n")
        // Asked through the shell: the app needs no <queries>; the launcher starts the intent.
        val handlers = shell("cmd package query-activities --brief -a android.intent.action.VIEW " +
            "-c android.intent.category.BROWSABLE -d ${book.url}")
        val browsers = Regex("""([a-zA-Z0-9_.]+)/""").findAll(handlers).map { it.groupValues[1] }.toSet()
        log.append("handlers=${browsers.joinToString()}\n")
        assertTrue("a browser can open ${book.url}: $handlers", browsers.isNotEmpty())

        // Pinning needs the app in the foreground; the emulator's launcher is slow on first boot.
        val manager = AppWidgetManager.getInstance(context)
        assertTrue("launcher supports pinning", manager.isRequestPinAppWidgetSupported)
        val addButton = By.text(Pattern.compile("(?i)(add( to home screen| automatically)?)"))
        var add: androidx.test.uiautomator.UiObject2? = null
        device.pressHome()
        device.wait(Until.hasObject(By.pkg(device.launcherPackageName).depth(0)), 30000)
        Thread.sleep(5000)
        for (attempt in 0 until 3) {
            context.startActivity(Intent(Intent.ACTION_MAIN).setClassName(context, "${context.packageName}.MainActivity")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            Thread.sleep(5000)
            device.wait(Until.findObject(By.text("Got it")), 3000)?.click()
            instrumentation.runOnMainSync {
                manager.requestPinAppWidget(ComponentName(context, LabelOfTheDayReceiver::class.java), null, null)
            }
            add = device.wait(Until.findObject(addButton), 15000)
            if (add != null) break
            device.takeScreenshot(File(out, "android-pin-attempt-$attempt.png"))
            File(out, "android-pin-attempt-$attempt.xml").outputStream().use { device.dumpWindowHierarchy(it) }
            device.pressBack()
        }
        assertNotNull("pin dialog shown", add)
        add!!.click()
        Thread.sleep(2000)
        device.pressHome()
        val bookLine = device.wait(Until.findObject(By.textContains("on Amazon")), 20000)
        assertNotNull("widget with the book link is on the home screen", bookLine)
        Thread.sleep(1500)
        device.takeScreenshot(File(out, "android-home-widget-new.png"))

        // Answer right on the widget.
        val right = device.findObject(By.textStartsWith(puzzle.options[puzzle.answer]))
        assertNotNull("answer button '${puzzle.options[puzzle.answer]}' on the widget", right)
        right!!.click()
        assertNotNull("CORRECT! stamp after tapping the answer", device.wait(Until.findObject(By.text("CORRECT!")), 15000))
        assertEquals(puzzle.answer, DailyStateStore.load(context).choiceOn(day))
        log.append("tap answer '${puzzle.options[puzzle.answer]}' -> CORRECT! shown, streak ${DailyStateStore.load(context).streak}\n")
        Thread.sleep(1500)
        device.takeScreenshot(File(out, "android-home-widget-correct.png"))

        for ((label, selector) in listOf(
            "row" to By.desc(book.name),
            "qr" to By.desc("QR code for ${book.name} on Amazon"),
        )) {
            browsers.forEach { shell("am force-stop $it") }
            device.pressHome()
            var target = device.wait(Until.findObject(selector), 10000)
            // The launcher may have put the widget on another home-screen page.
            for (swipe in 0 until 3) {
                if (target != null) break
                device.swipe((device.displayWidth * 0.85).toInt(), device.displayHeight / 2,
                    (device.displayWidth * 0.15).toInt(), device.displayHeight / 2, 20)
                target = device.wait(Until.findObject(selector), 4000)
            }
            if (target == null) {
                device.takeScreenshot(File(out, "android-missing-$label.png"))
                File(out, "android-missing-$label.xml").outputStream().use { device.dumpWindowHierarchy(it) }
            }
            assertNotNull("book $label on the widget", target)
            target!!.click()
            var opened: String? = null
            for (i in 0 until 30) {
                Thread.sleep(1000)
                val front = device.currentPackageName
                if (front in browsers) { opened = front; break }
            }
            Thread.sleep(3000)
            // The intent the browser was started with (data = the Amazon link).
            val started = shell("dumpsys activity activities").lines()
                .filter { it.contains("act=android.intent.action.VIEW") || it.contains("dat=") }
                .filter { opened != null && (it.contains(opened!!) || it.contains("amazon")) }
                .joinToString(" | ") { it.trim() }
            log.append("tap book $label -> in front: ${opened ?: "none"}; started: $started\n")
            device.takeScreenshot(File(out, "android-booklink-$label.png"))
            assertNotNull("tapping the book $label opened the browser for ${book.url}", opened)
        }
        device.pressHome()
        File(out, "android-booklink.txt").writeText(log.toString())
    }

    private fun shell(cmd: String): String =
        android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(cmd))
            .bufferedReader().use { it.readText() }

    private fun findByDescription(view: View, description: String): View? {
        if (view.contentDescription?.toString() == description) return view
        if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) findByDescription(view.getChildAt(i), description)?.let { return it }
        }
        return null
    }

    private fun render(views: RemoteViews, size: DpSize, file: File) {
        val density = context.resources.displayMetrics.density
        val w = (size.width.value * density).toInt()
        val h = (size.height.value * density).toInt()
        var bitmap: Bitmap? = null
        instrumentation.runOnMainSync {
            val parent = FrameLayout(context)
            val view = views.apply(context, parent)
            parent.addView(view, FrameLayout.LayoutParams(w, h))
            parent.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY))
            parent.layout(0, 0, w, h)
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            canvas.drawColor(Color.TRANSPARENT)
            parent.draw(canvas)
            bitmap = bmp
        }
        assertNotNull(bitmap)
        FileOutputStream(file).use { bitmap!!.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
