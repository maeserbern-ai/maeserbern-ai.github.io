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

    /** Taps the book row and the QR code on the large widget; Amazon must open in the browser. */
    @Test fun bookLinkOpensAmazon() = runBlocking {
        val deck = DailyDeck.get(context)
        val day = dayShowing(deck, 3)
        DailyClock.dayOverride = day
        val book = deck.bookFor(deck.puzzleForDay(day)!!)!!
        val intent = bookIntent(book)
        assertEquals(book.url, intent.dataString)
        val handler = context.packageManager.resolveActivity(intent, 0)
        assertNotNull("a browser can open ${book.url}", handler)
        val views = LabelOfTheDayWidget().compose(context, size = sizes.getValue("large"))
        val log = StringBuilder("book=${book.url}\nhandler=${handler!!.activityInfo.packageName}\n")
        for (description in listOf(book.name, "QR code for ${book.name} on Amazon")) {
            instrumentation.uiAutomation.executeShellCommand("am force-stop ${handler.activityInfo.packageName}").close()
            Thread.sleep(1500)
            var clicked = false
            instrumentation.runOnMainSync {
                val parent = FrameLayout(context)
                val root = views.apply(context, parent)
                parent.addView(root)
                val target = findByDescription(root, description)
                var v: View? = target
                while (v != null && !v.hasOnClickListeners()) v = v.parent as? View
                clicked = v?.performClick() == true
            }
            assertTrue("tap target for '$description' has a click action", clicked)
            var found = false
            for (i in 0 until 20) {
                Thread.sleep(1000)
                val dump = shell("dumpsys activity activities")
                if (dump.contains(book.url.removePrefix("https://"))) { found = true; break }
            }
            log.append("tap '$description' -> browser shows ${book.url}: $found\n")
            assertTrue("tapping '$description' opened ${book.url}", found)
            shell("screencap -p /sdcard/Download/android-booklink-${if (description == book.name) "row" else "qr"}.png")
        }
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
            canvas.drawColor(Color.parseColor("#3C4D63"))
            parent.draw(canvas)
            bitmap = bmp
        }
        assertNotNull(bitmap)
        FileOutputStream(file).use { bitmap!!.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
