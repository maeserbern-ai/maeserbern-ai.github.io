package io.github.maeserbern.ingredientpartygame

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text

private const val TITLE = "Snack or Shampoo?"

// ---------------------------------------------------------------- Start

@Composable
fun StartScreen(game: GameState, onPlay: () -> Unit, onBooks: () -> Unit) {
    WatchScreen {
        item {
            Text(
                TITLE,
                fontFamily = Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = Palette.terracotta,
                textAlign = TextAlign.Center,
            )
        }
        item {
            Text(
                "From the Ingredient Dictionary books by Maeser",
                fontSize = 12.sp,
                color = Palette.soft,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            PillButton(
                "Play",
                fill = Palette.terracotta,
                textColor = Palette.labelInk,
                enabled = game.hasPuzzles,
                onClick = onPlay,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                Stat("Total score", game.totalScore, Modifier.weight(1f))
                Stat("Best streak", game.bestStreak, Modifier.weight(1f))
            }
        }
        item { PillButton("Books", onClick = onBooks) }
    }
}

@Composable
private fun Stat(title: String, value: Int, modifier: Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Palette.card)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("$value", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Palette.gold)
        Text(title, fontSize = 11.sp, color = Palette.soft, maxLines = 1)
    }
}

// ---------------------------------------------------------------- Clues

@Composable
fun CluesScreen(game: GameState, onIngredient: (Int) -> Unit, onGuess: () -> Unit, onMissing: () -> Unit) {
    val puzzle = game.puzzle
    if (puzzle == null) {
        LaunchedEffect(Unit) { onMissing() }
        return
    }
    WatchScreen {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(
                    TITLE,
                    fontFamily = Serif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Palette.terracotta,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    if (game.currentPoints == 1) "1 pt" else "${game.currentPoints} pts",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Palette.gold,
                )
            }
        }
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Palette.label)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    "INGREDIENTS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Palette.labelInk.copy(alpha = 0.85f),
                )
                puzzle.ingredients.take(game.shown).forEachIndexed { index, name ->
                    Text(
                        name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (game.data.warning(name) != null) Palette.warn else Palette.labelInk,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(role = Role.Button) { onIngredient(index) },
                    )
                }
                if (game.canRevealMore) {
                    Box(
                        Modifier
                            .padding(top = 2.dp)
                            .size(width = 90.dp, height = 14.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Palette.hidden)
                            .semantics { contentDescription = "More ingredients hidden" },
                    )
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                PillButton(
                    "More",
                    enabled = game.canRevealMore,
                    onClick = { game.revealMore() },
                    modifier = Modifier.weight(1f),
                )
                PillButton(
                    "Guess",
                    fill = Palette.terracotta,
                    textColor = Palette.labelInk,
                    onClick = onGuess,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        item {
            Text(
                "Tap an ingredient to learn what it is",
                fontSize = 11.sp,
                color = Palette.soft,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun IngredientScreen(game: GameState, index: Int) {
    val name = game.puzzle?.ingredients?.getOrNull(index) ?: return
    WatchScreen {
        item {
            Text(
                name,
                fontFamily = Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                color = Palette.terracotta,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Text(game.data.explanation(name), fontSize = 14.sp, color = Palette.ink, modifier = Modifier.fillMaxWidth())
        }
        val warn = game.data.warning(name)
        val hidden = game.data.undisclosedNote(name)
        if (warn != null) {
            item { Tag(warn, Palette.bad) }
        } else if (hidden != null) {
            item { Tag(hidden, Palette.gold) }
        }
    }
}

// ---------------------------------------------------------------- Guess

@Composable
fun GuessScreen(game: GameState, onAnswered: () -> Unit, onBack: () -> Unit, onMissing: () -> Unit) {
    if (game.puzzle == null) {
        LaunchedEffect(Unit) { onMissing() }
        return
    }
    val view = LocalView.current
    WatchScreen {
        item {
            Text(
                "What is it?",
                fontFamily = Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp,
                color = Palette.ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        game.options.forEach { option ->
            item {
                PillButton(option) {
                    if (!game.answered) {
                        val right = game.guess(option)
                        view.performHapticFeedback(
                            if (right) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.REJECT,
                        )
                        onAnswered()
                    }
                }
            }
        }
        item { TextLink("Back to clues", onBack) }
    }
}

// ---------------------------------------------------------------- Result

@Composable
fun ResultScreen(
    game: GameState,
    onNext: () -> Unit,
    onQr: (String) -> Unit,
    onHome: () -> Unit,
    onMissing: () -> Unit,
) {
    // Snapshot this round so the screen doesn't change while "Next puzzle" animates away.
    val puzzle = remember { game.puzzle }
    val guess = remember { game.lastGuess }
    val correct = remember { game.wasCorrect }
    val points = remember { game.lastPoints }
    if (puzzle == null || guess == null) {
        LaunchedEffect(Unit) { onMissing() }
        return
    }
    val book = game.data.book(puzzle.book)
    WatchScreen {
        item {
            Text(
                if (correct) "Correct! +$points" else "Not quite  +0",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = if (correct) Palette.good else Palette.bad,
            )
        }
        item {
            Text(
                puzzle.answer,
                fontFamily = Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp,
                color = Palette.ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (!correct) {
            item {
                Text(
                    "You said $guess",
                    fontSize = 12.sp,
                    color = Palette.soft,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Palette.card)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text("WEIRD INGREDIENT", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Palette.gold)
                Text(
                    puzzle.spotlightName,
                    fontFamily = Serif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Palette.terracotta,
                )
                Text(puzzle.spotlightNote, fontSize = 13.sp, color = Palette.ink)
            }
        }
        item {
            PillButton("Next puzzle", fill = Palette.terracotta, textColor = Palette.labelInk, onClick = onNext)
        }
        item {
            Text(
                "Total ${game.totalScore}  ·  Streak ${game.streak}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Palette.gold,
            )
        }
        if (book != null) {
            item { BookCard(game, book, onQr) }
        }
        item { TextLink("Home", onHome) }
    }
}

/** The book this puzzle comes from: cover, store link (opens on phone) and QR code. */
@Composable
private fun BookCard(game: GameState, book: Book, onQr: (String) -> Unit) {
    val open = rememberPhoneOpener()
    var status by remember(book.id) { mutableStateOf<String?>(null) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Palette.card)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("FROM THE BOOK", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Palette.gold)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Cover(game, book, width = 44.dp)
            Text(
                book.name,
                fontFamily = Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = Palette.ink,
                modifier = Modifier.weight(1f, fill = false),
            )
        }
        PillButton(
            if (book.amazon) "Get ${book.name} on Amazon" else "See ${book.name}",
            fill = Palette.terracotta,
            textColor = Palette.labelInk,
        ) {
            status = "Opening on your phone…"
            open(book.url) { ok ->
                status = if (ok) "Check your phone" else "No phone nearby. Scan the code:"
            }
        }
        status?.let {
            Text(it, fontSize = 11.sp, color = Palette.soft, textAlign = TextAlign.Center)
        }
        QrCode(book.qr, side = 104.dp, modifier = Modifier.clickable(role = Role.Button) { onQr(book.id) })
        Text(
            if (book.amazon) "Scan to get it on Amazon" else "Scan to see the books",
            fontSize = 11.sp,
            color = Palette.soft,
            textAlign = TextAlign.Center,
        )
    }
}

// ---------------------------------------------------------------- Books

@Composable
fun BooksScreen(game: GameState, onBook: (String) -> Unit) {
    WatchScreen {
        item {
            Text("Books", fontFamily = Serif, fontWeight = FontWeight.Bold, fontSize = 19.sp, color = Palette.terracotta)
        }
        game.data.books.forEach { book ->
            item { PillButton(book.name) { onBook(book.id) } }
        }
    }
}

@Composable
fun BookScreen(game: GameState, id: String, onQr: (String) -> Unit) {
    val book = game.data.book(id) ?: return
    val open = rememberPhoneOpener()
    var status by remember(id) { mutableStateOf<String?>(null) }
    WatchScreen {
        item {
            Text(
                book.name,
                fontFamily = Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                color = Palette.ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (book.cover != null) {
            item { Cover(game, book, width = 84.dp) }
        }
        item {
            PillButton(
                if (book.amazon) "Get it on Amazon" else "See all the books",
                fill = Palette.terracotta,
                textColor = Palette.labelInk,
            ) {
                status = "Opening on your phone…"
                open(book.url) { ok ->
                    if (ok) status = "Check your phone" else { status = null; onQr(book.id) }
                }
            }
        }
        status?.let { s -> item { Text(s, fontSize = 11.sp, color = Palette.soft) } }
        item { PillButton("QR code") { onQr(book.id) } }
        item {
            Text("by Maeser", fontSize = 11.sp, color = Palette.soft)
        }
    }
}

@Composable
fun QrScreen(game: GameState, id: String) {
    val book = game.data.book(id) ?: return
    val config = LocalConfiguration.current
    // Fits inside the circle on round watches.
    val side = (minOf(config.screenWidthDp, config.screenHeightDp) * if (config.isScreenRound) 0.62f else 0.72f).dp
    Box(Modifier.fillMaxSize().background(Palette.bg), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            QrCode(book.qr, side = side)
            Spacer(Modifier.height(6.dp))
            Text(
                if (book.amazon) "${book.name} on Amazon" else book.name,
                fontSize = 11.sp,
                color = Palette.ink,
                textAlign = TextAlign.Center,
                maxLines = 2,
                modifier = Modifier.width(side + 20.dp),
            )
        }
    }
}

// ---------------------------------------------------------------- Pieces

@Composable
private fun Cover(game: GameState, book: Book, width: Dp) {
    val bitmap = remember(book.id) { game.data.cover(book) } ?: return
    Image(
        bitmap = bitmap.asImageBitmap(),
        contentDescription = "${book.name} book cover",
        contentScale = ContentScale.Fit,
        modifier = Modifier
            .width(width)
            .height(width * 1.6f)
            .clip(RoundedCornerShape(3.dp)),
    )
}

/** Draws a QR code from its module rows, on white with a quiet zone, pixel-crisp. */
@Composable
fun QrCode(rows: List<String>, side: Dp, modifier: Modifier = Modifier) {
    Canvas(
        modifier = modifier
            .size(side)
            .clip(RoundedCornerShape(6.dp))
            .background(Color.White)
            .semantics { contentDescription = "QR code" },
    ) {
        val n = rows.size
        if (n == 0) return@Canvas
        val cell = size.minDimension / n
        rows.forEachIndexed { y, row ->
            row.forEachIndexed { x, c ->
                if (c == '1') {
                    drawRect(
                        Color.Black,
                        topLeft = Offset(x * cell, y * cell),
                        size = Size(cell + 0.5f, cell + 0.5f),
                    )
                }
            }
        }
    }
}
