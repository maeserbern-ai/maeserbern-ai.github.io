package io.github.maeserbern.ingredientpartygame

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.edit

/**
 * Solo game state, ported from the Apple Watch app. Scoring matches the web
 * game: a puzzle starts with [START_SHOWN] ingredients and is worth
 * [MAX_POINTS]; each extra ingredient revealed costs one point, but a right
 * answer is always worth at least 1. A true/false question is worth
 * [TF_POINTS]. Score, streaks, the chosen book and the no-repeat memory are
 * stored on the watch only.
 */
class GameState(context: Context, val data: GameData) {
    companion object {
        const val START_SHOWN = 3
        const val MAX_POINTS = 5
        /** A true/false question is worth the same as on the web (TF_POINTS). */
        const val TF_POINTS = 3
        private const val SEP = "\n"
    }

    private val prefs = context.getSharedPreferences("party-game", Context.MODE_PRIVATE)

    var puzzle by mutableStateOf<Puzzle?>(null)
        private set
    /** The puzzle's four options, shuffled for this round. */
    var options by mutableStateOf<List<String>>(emptyList())
        private set
    /** How many ingredients are visible on the label. */
    var shown by mutableIntStateOf(0)
        private set
    var lastGuess by mutableStateOf<String?>(null)
        private set
    var lastPoints by mutableIntStateOf(0)
        private set

    /** The book being played ("all" = Mix all books). */
    var bookId by mutableStateOf(prefs.getString("play.book", Deck.ALL) ?: Deck.ALL)
        private set

    var totalScore by mutableIntStateOf(prefs.getInt("score.total", 0))
        private set
    var streak by mutableIntStateOf(prefs.getInt("score.streak", 0))
        private set
    var bestStreak by mutableIntStateOf(prefs.getInt("score.bestStreak", 0))
        private set

    val hasPuzzles: Boolean get() = data.puzzles.isNotEmpty()

    val wasCorrect: Boolean
        get() {
            val p = puzzle ?: return false
            return lastGuess == p.answer
        }

    val answered: Boolean get() = lastGuess != null

    private val startingShown: Int get() = minOf(START_SHOWN, puzzle?.ingredients?.size ?: 0)

    val canRevealMore: Boolean get() = puzzle?.let { shown < it.ingredients.size } ?: false

    /** Points a right answer is worth right now. */
    val currentPoints: Int
        get() = if (puzzle?.trueFalse == true) TF_POINTS else maxOf(1, MAX_POINTS - (shown - startingShown))

    /** Picks which book to play ("all" mixes every book). */
    fun chooseBook(id: String) {
        bookId = if (id == Deck.ALL || data.puzzlesIn(id).isNotEmpty()) id else Deck.ALL
        prefs.edit { putString("play.book", bookId) }
    }

    /** Starts the next puzzle; returns false if there is nothing to play. */
    fun nextPuzzle(): Boolean {
        val next = drawFromDeck() ?: return false
        puzzle = next
        options = next.options.shuffled()
        shown = minOf(START_SHOWN, next.ingredients.size)
        lastGuess = null
        lastPoints = 0
        return true
    }

    /** Shows the next ingredient (costs a point, never below 1). */
    fun revealMore() {
        if (canRevealMore && !answered) shown += 1
    }

    /** Records a guess once per puzzle; returns true if it was right. */
    fun guess(option: String): Boolean {
        val p = puzzle ?: return false
        if (answered) return wasCorrect
        lastGuess = option
        if (option == p.answer) {
            lastPoints = currentPoints
            totalScore += lastPoints
            streak += 1
            bestStreak = maxOf(bestStreak, streak)
        } else {
            lastPoints = 0
            streak = 0
        }
        prefs.edit {
            putInt("score.total", totalScore)
            putInt("score.streak", streak)
            putInt("score.bestStreak", bestStreak)
        }
        return wasCorrect
    }

    /** Deals the next unseen puzzle from the chosen book (see [Deck]). */
    private fun drawFromDeck(): Puzzle? {
        val pool = data.puzzlesIn(bookId).map { it.key }
        val seen = (prefs.getString("deck.seen", "") ?: "")
            .split(SEP)
            .filter { it.isNotEmpty() && data.puzzlesByKey.containsKey(it) }
            .toSet()
        val (key, nextSeen) = Deck.draw(pool, seen, prefs.getString("deck.lastKey", null)) ?: return null
        prefs.edit {
            putString("deck.seen", nextSeen.joinToString(SEP))
            putString("deck.lastKey", key)
            // Version 1.0 kept one shuffled deck for every puzzle; it is replaced by deck.seen.
            remove("deck.remaining")
            remove("deck.lastAnswer")
        }
        return data.puzzlesByKey[key]
    }
}
