package io.github.maeserbern.ingredientpartygame

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.random.Random

class DeckTest {
    private val food = (1..5).map { "food|$it" }
    private val tp = (1..4).map { "tp|$it" }

    @Test
    fun emptyPoolDealsNothing() {
        assertNull(Deck.draw(emptyList(), emptySet(), null))
    }

    @Test
    fun noRepeatUntilTheBookRunsOut() {
        var seen = emptySet<String>()
        var last: String? = null
        val dealt = mutableListOf<String>()
        repeat(food.size) {
            val (key, next) = Deck.draw(food, seen, last, Random(it))!!
            dealt += key; seen = next; last = key
        }
        assertEquals(food.toSet(), dealt.toSet())
        // The next round starts over but never repeats the puzzle just played.
        repeat(50) { seed ->
            val (key, next) = Deck.draw(food, seen, last, Random(seed))!!
            assertNotEquals(last, key)
            assertEquals(setOf(key), next)
        }
    }

    @Test
    fun startingOverOneBookKeepsTheOtherBooksMemory() {
        val seen = food.toSet() + tp.take(2)
        val (key, next) = Deck.draw(food, seen, food.last(), Random(1))!!
        assertTrue(key in food)
        assertTrue(next.containsAll(tp.take(2)))
        assertEquals(3, next.size)
    }

    @Test
    fun mixAllSkipsPuzzlesSeenInABook() {
        val seen = food.toSet()
        repeat(20) { seed ->
            val (key, _) = Deck.draw(food + tp, seen, food.last(), Random(seed))!!
            assertTrue(key in tp)
        }
    }

    /** The exported deck must include the website's 20 toilet paper true/false puzzles. */
    @Test
    fun exportedDeckHasTrueFalsePuzzles() {
        val json = File("src/main/assets/data/puzzles.json").readText()
        assertEquals(20, Regex("\"type\": \"tf\"").findAll(json).count())
        assertEquals(85, Regex("\"type\": \"pick\"").findAll(json).count())
        assertEquals(20, Regex("\"statement\": ").findAll(json).count())
        assertEquals(20, Regex("\"explain\": ").findAll(json).count())
    }
}
