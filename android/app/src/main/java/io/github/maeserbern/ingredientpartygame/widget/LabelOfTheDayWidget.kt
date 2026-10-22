package io.github.maeserbern.ingredientpartygame.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontFamily
import androidx.glance.text.FontStyle
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import io.github.maeserbern.ingredientpartygame.MainActivity
import io.github.maeserbern.ingredientpartygame.R

// "Label of the Day" (approved design: watch-samples/pg.html). Colors from party-game/style.css.
private val BG = Color(0xFF16211C)
private val LABEL = Color(0xFFF4F3EE)
private val LABEL_INK = Color(0xFF1A1C1E)
private val INK_SOFT = Color(0xFFC9CDC6)
private val POP = Color(0xFFE07A55)
private val GOLD = Color(0xFFF2C46B)
private val GOOD = Color(0xFF5FBF8A)
private val BAD = Color(0xFFE06A5F)

private fun c(color: Color) = ColorProvider(color)

/** Bumped after every answer so open widget sessions recompose. */
internal val REVISION = intPreferencesKey("label_revision")
internal val DAY_KEY = ActionParameters.Key<Int>("day")
internal val CHOICE_KEY = ActionParameters.Key<Int>("choice")

class LabelOfTheDayWidget : GlanceAppWidget() {

    companion object {
        val SMALL = DpSize(110.dp, 110.dp)
        val MEDIUM = DpSize(245.dp, 115.dp)
        val LARGE = DpSize(245.dp, 250.dp)

        /** Re-renders every placed widget (after an answer). */
        suspend fun refreshAll(context: Context) {
            val manager = GlanceAppWidgetManager(context)
            manager.getGlanceIds(LabelOfTheDayWidget::class.java).forEach { id ->
                updateAppWidgetState(context, id) { prefs -> prefs[REVISION] = (prefs[REVISION] ?: 0) + 1 }
                LabelOfTheDayWidget().update(context, id)
            }
        }
    }

    override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            currentState(REVISION)
            Content(LabelData.make(context))
        }
    }

    @Composable
    private fun Content(data: LabelData) {
        val size = LocalSize.current
        when {
            data.puzzle == null || data.book == null -> Missing()
            size.height >= LARGE.height && size.width >= LARGE.width -> Large(data, data.puzzle, data.book)
            size.width >= MEDIUM.width -> Medium(data, data.puzzle, data.book)
            else -> Small(data, data.puzzle)
        }
    }
}

class LabelOfTheDayReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = LabelOfTheDayWidget()
}

/** An answer button was tapped: check it on the device and update every widget. */
class AnswerCallback : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val day = parameters[DAY_KEY] ?: return
        val choice = parameters[CHOICE_KEY] ?: return
        if (day == DailyClock.today()) DailyStateStore.answer(context, choice, day)
        LabelOfTheDayWidget.refreshAll(context)
    }
}

// ---------- pieces ----------

private fun openGame() = actionStartActivity<MainActivity>()

@Composable
private fun Kicker(size: TextUnit) {
    Text(
        "Label of the Day",
        style = TextStyle(color = c(POP), fontSize = size, fontStyle = FontStyle.Italic,
            fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif),
        maxLines = 1,
    )
}

@Composable
private fun Headline(text: String, size: TextUnit, lines: Int = 1) {
    Text(
        text,
        style = TextStyle(color = c(LABEL), fontSize = size, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif),
        maxLines = lines,
    )
}

@Composable
private fun LabelCard(header: String?, text: String, size: TextUnit, lines: Int, modifier: GlanceModifier = GlanceModifier) {
    Column(modifier = modifier.background(ImageProvider(R.drawable.widget_label_bg)).padding(horizontal = 9.dp, vertical = 7.dp)) {
        if (header != null) {
            Text(header, style = TextStyle(color = c(LABEL_INK), fontSize = 8.sp, fontWeight = FontWeight.Bold), maxLines = 1)
            Spacer(GlanceModifier.height(2.dp))
            Box(GlanceModifier.fillMaxWidth().height(2.dp).background(LABEL_INK)) {}
            Spacer(GlanceModifier.height(4.dp))
        }
        Text(text, style = TextStyle(color = c(LABEL_INK), fontSize = size), maxLines = lines)
    }
}

@Composable
private fun Stamp(correct: Boolean, size: TextUnit) {
    Box(
        modifier = GlanceModifier
            .background(ImageProvider(if (correct) R.drawable.widget_stamp_good else R.drawable.widget_stamp_bad))
            .padding(horizontal = 9.dp, vertical = 2.dp),
    ) {
        Text(
            if (correct) "CORRECT!" else "WRONG!",
            style = TextStyle(color = c(if (correct) GOOD else BAD), fontSize = size,
                fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif),
            maxLines = 1,
        )
    }
}

private fun streakText(data: LabelData, hint: String): String {
    val flame = "🔥"
    return when (data.correct) {
        true -> "$flame Correct! ${data.streak}-day streak"
        false -> "$flame Not this time. ${data.streak}-day streak"
        null -> if (data.streak > 0) "$flame ${data.streak}-day streak · $hint" else "$flame Start a streak · $hint"
    }
}

@Composable
private fun Streak(data: LabelData, size: TextUnit, hint: String = "tap to guess") {
    Text(
        streakText(data, hint),
        style = TextStyle(color = c(if (data.correct == false) BAD else if (data.correct == true) GOOD else INK_SOFT), fontSize = size),
        maxLines = 1,
    )
}

private val ANSWER_BG = intArrayOf(R.drawable.widget_answer_1, R.drawable.widget_answer_2, R.drawable.widget_answer_3, R.drawable.widget_answer_4)
private val ANSWER_RIGHT = intArrayOf(R.drawable.widget_answer_1_right, R.drawable.widget_answer_2_right, R.drawable.widget_answer_3_right, R.drawable.widget_answer_4_right)
private val ANSWER_WRONG = intArrayOf(R.drawable.widget_answer_1_wrong, R.drawable.widget_answer_2_wrong, R.drawable.widget_answer_3_wrong, R.drawable.widget_answer_4_wrong)
private val ANSWER_DIM = intArrayOf(R.drawable.widget_answer_1_dim, R.drawable.widget_answer_2_dim, R.drawable.widget_answer_3_dim, R.drawable.widget_answer_4_dim)

@Composable
private fun AnswerButton(data: LabelData, puzzle: DailyPuzzle, index: Int, height: Int, size: TextUnit, modifier: GlanceModifier) {
    val color = if (puzzle.isTrueFalse) (index + 1) % 4 else index % 4
    val isAnswer = index == puzzle.answer
    val isChoice = index == data.choice
    val bg = when {
        !data.answered -> ANSWER_BG[color]
        isAnswer -> ANSWER_RIGHT[color]
        isChoice -> ANSWER_WRONG[color]
        else -> ANSWER_DIM[color]
    }
    var m = modifier.height(height.dp).background(ImageProvider(bg)).padding(horizontal = 8.dp)
    if (!data.answered) {
        m = m.clickable(actionRunCallback<AnswerCallback>(actionParametersOf(DAY_KEY to data.day, CHOICE_KEY to index)))
    }
    val mark = when {
        data.answered && isAnswer -> "  ✓"
        data.answered && isChoice -> "  ✗"
        else -> ""
    }
    Row(modifier = m, verticalAlignment = Alignment.CenterVertically) {
        Box(GlanceModifier.background(ImageProvider(R.drawable.widget_answer_number)).padding(horizontal = 5.dp)) {
            Text("${index + 1}", style = TextStyle(color = c(Color.White), fontSize = size, fontWeight = FontWeight.Bold), maxLines = 1)
        }
        Spacer(GlanceModifier.width(6.dp))
        Text(
            puzzle.options[index] + mark,
            style = TextStyle(color = c(if (data.answered && !isAnswer && !isChoice) Color(0xB3FFFFFF) else Color.White),
                fontSize = size, fontWeight = FontWeight.Bold),
            maxLines = 2,
        )
    }
}

@Composable
private fun AnswerGrid(data: LabelData, puzzle: DailyPuzzle, height: Int, size: TextUnit, gap: Int) {
    if (puzzle.options.size == 2) {
        Row(GlanceModifier.fillMaxWidth()) {
            AnswerButton(data, puzzle, 0, height, size, GlanceModifier.defaultWeight())
            Spacer(GlanceModifier.width(gap.dp))
            AnswerButton(data, puzzle, 1, height, size, GlanceModifier.defaultWeight())
        }
    } else {
        Column(GlanceModifier.fillMaxWidth()) {
            Row(GlanceModifier.fillMaxWidth()) {
                AnswerButton(data, puzzle, 0, height, size, GlanceModifier.defaultWeight())
                Spacer(GlanceModifier.width(gap.dp))
                AnswerButton(data, puzzle, 1, height, size, GlanceModifier.defaultWeight())
            }
            Spacer(GlanceModifier.height(gap.dp))
            Row(GlanceModifier.fillMaxWidth()) {
                AnswerButton(data, puzzle, 2, height, size, GlanceModifier.defaultWeight())
                Spacer(GlanceModifier.width(gap.dp))
                AnswerButton(data, puzzle, 3, height, size, GlanceModifier.defaultWeight())
            }
        }
    }
}

/** The book cover and its Amazon link (opens in the browser / Amazon app). Always shown on
 *  medium and large widgets; large adds the book's QR code for a phone camera. */
@Composable
private fun BookRow(book: DailyBook, coverWidth: Int, size: TextUnit, pad: Int, qr: Int = 0) {
    val open = actionStartActivity(bookIntent(book))
    Row(
        modifier = GlanceModifier.fillMaxWidth().background(ImageProvider(R.drawable.widget_book_bg))
            .padding(pad.dp).clickable(open),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            provider = ImageProvider(book.coverRes),
            contentDescription = book.name,
            contentScale = ContentScale.Fit,
            modifier = GlanceModifier.size(coverWidth.dp, (coverWidth * 1.6f).dp),
        )
        Spacer(GlanceModifier.width((pad + 2).dp))
        Column(GlanceModifier.defaultWeight()) {
            Text("Ingredient Dictionary", style = TextStyle(color = c(INK_SOFT), fontSize = (size.value * 0.8f).sp), maxLines = 1)
            Text("Get ${book.name} on Amazon →",
                style = TextStyle(color = c(GOLD), fontSize = size, fontWeight = FontWeight.Bold), maxLines = 2)
            if (qr > 0) {
                Text("or scan with your phone camera", style = TextStyle(color = c(INK_SOFT), fontSize = (size.value * 0.75f).sp), maxLines = 1)
            }
        }
        if (qr > 0) {
            Spacer(GlanceModifier.width(6.dp))
            Image(
                provider = ImageProvider(book.qrRes),
                contentDescription = "QR code for ${book.name} on Amazon",
                contentScale = ContentScale.Fit,
                modifier = GlanceModifier.size(qr.dp, qr.dp).background(Color.White).padding(2.dp).clickable(open),
            )
        }
    }
}

/** Opens the book's Amazon page in the browser or the Amazon app. */
internal fun bookIntent(book: DailyBook): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(book.url))
        .addCategory(Intent.CATEGORY_BROWSABLE)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

@Composable
private fun Missing() {
    Column(GlanceModifier.fillMaxSize().background(ImageProvider(R.drawable.widget_bg)).padding(12.dp).clickable(openGame())) {
        Kicker(13.sp)
        Text("Open the game to load today's label.", style = TextStyle(color = c(LABEL), fontSize = 12.sp))
    }
}

// ---------- sizes ----------

@Composable
private fun Small(data: LabelData, puzzle: DailyPuzzle) {
    Column(GlanceModifier.fillMaxSize().background(ImageProvider(R.drawable.widget_bg)).padding(12.dp).clickable(openGame())) {
        Kicker(12.sp)
        Headline(if (puzzle.isTrueFalse) "True or false?" else "Snack or Shampoo?", 17.sp, lines = 2)
        Spacer(GlanceModifier.height(6.dp))
        LabelCard(null, puzzle.preview(4), 11.sp, 3, GlanceModifier.fillMaxWidth())
        Spacer(GlanceModifier.defaultWeight())
        Streak(data, 10.sp, "tap to play")
    }
}

@Composable
private fun Medium(data: LabelData, puzzle: DailyPuzzle, book: DailyBook) {
    Column(GlanceModifier.fillMaxSize().background(ImageProvider(R.drawable.widget_bg)).padding(10.dp)) {
        Row(GlanceModifier.fillMaxWidth().clickable(openGame()), verticalAlignment = Alignment.CenterVertically) {
            Kicker(12.sp)
            Spacer(GlanceModifier.width(6.dp))
            Headline(if (puzzle.isTrueFalse) "True or false?" else "Which product is it?", 12.sp)
            Spacer(GlanceModifier.defaultWeight())
            Text("🔥 ${data.streak}", style = TextStyle(color = c(INK_SOFT), fontSize = 11.sp, fontWeight = FontWeight.Bold), maxLines = 1)
        }
        Spacer(GlanceModifier.height(5.dp))
        Row(GlanceModifier.fillMaxWidth().height(62.dp)) {
            Box(GlanceModifier.width(118.dp).height(62.dp), contentAlignment = Alignment.TopEnd) {
                LabelCard(if (puzzle.isTrueFalse) "THE CLAIM" else "INGREDIENTS", puzzle.fullLabel, 9.sp, 2,
                    GlanceModifier.fillMaxSize())
                data.correct?.let { Box(GlanceModifier.padding(top = 20.dp, end = 2.dp)) { Stamp(it, 12.sp) } }
            }
            Spacer(GlanceModifier.width(7.dp))
            Column(GlanceModifier.defaultWeight()) {
                AnswerGrid(data, puzzle, if (puzzle.isTrueFalse) 62 else 28, 10.sp, 6)
            }
        }
        Spacer(GlanceModifier.height(6.dp))
        BookRow(book, 17, 10.sp, 4)
    }
}

@Composable
private fun Large(data: LabelData, puzzle: DailyPuzzle, book: DailyBook) {
    Column(GlanceModifier.fillMaxSize().background(ImageProvider(R.drawable.widget_bg)).padding(14.dp)) {
        Column(GlanceModifier.fillMaxWidth().clickable(openGame())) {
            Kicker(15.sp)
            Headline(if (puzzle.isTrueFalse) "True or false?" else "Which product is it?", 21.sp)
        }
        Spacer(GlanceModifier.height(8.dp))
        Box(GlanceModifier.fillMaxWidth(), contentAlignment = Alignment.TopEnd) {
            LabelCard(if (puzzle.isTrueFalse) "THE CLAIM" else "INGREDIENTS", puzzle.fullLabel,
                if (puzzle.isTrueFalse) 13.sp else 11.sp, 4, GlanceModifier.fillMaxWidth())
            data.correct?.let { Box(GlanceModifier.padding(top = 18.dp, end = 6.dp)) { Stamp(it, 22.sp) } }
        }
        Spacer(GlanceModifier.defaultWeight())
        AnswerGrid(data, puzzle, if (puzzle.isTrueFalse) 48 else 38, 12.sp, 8)
        Spacer(GlanceModifier.height(10.dp))
        BookRow(book, 26, 11.sp, 7, qr = 50)
        Spacer(GlanceModifier.height(7.dp))
        Streak(data, 11.sp)
    }
}
