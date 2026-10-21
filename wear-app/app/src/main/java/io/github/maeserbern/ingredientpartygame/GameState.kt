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
 * answer is always worth at least 1. Score, streaks and the shuffled deck are
 * stored on the watch only.
 */
class GameState(context: Context, val data: GameData) {
    companion object {
        const val START_SHOWN = 3
        const val MAX_POINTS = 5
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
    val currentPoints: Int get() = maxOf(1, MAX_POINTS - (shown - startingShown))

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

    /**
     * Draws from a persisted shuffled deck so no puzzle repeats until every
     * puzzle has been played. A fresh shuffle never starts with the puzzle
     * that ended the previous deck.
     */
    private fun drawFromDeck(): Puzzle? {
        if (data.puzzles.isEmpty()) return null
        val lastAnswer = prefs.getString("deck.lastAnswer", "") ?: ""
        val remaining = (prefs.getString("deck.remaining", "") ?: "")
            .split("\n")
            .filter { it.isNotEmpty() && data.puzzlesByAnswer.containsKey(it) }
            .toMutableList()

        if (remaining.isEmpty()) {
            remaining += data.puzzles.map { it.answer }.shuffled()
            if (remaining.size > 1 && remaining.first() == lastAnswer) {
                java.util.Collections.swap(remaining, 0, remaining.size - 1)
            }
        }

        val answer = remaining.removeAt(0)
        prefs.edit {
            putString("deck.remaining", remaining.joinToString("\n"))
            putString("deck.lastAnswer", answer)
        }
        return data.puzzlesByAnswer[answer]
    }
}
