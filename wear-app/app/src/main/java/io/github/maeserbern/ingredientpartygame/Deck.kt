package io.github.maeserbern.ingredientpartygame

import kotlin.random.Random

/**
 * No-repeat dealing, same rule as the web game: the watch remembers which
 * puzzles it has shown (one shared "seen" set) and deals unseen puzzles from
 * the chosen book first. Once that book runs out, only that book's puzzles are
 * forgotten and it starts over; the new round never opens with the puzzle that
 * was just played.
 */
object Deck {
    /** Book id for "Mix all books". */
    const val ALL = "all"

    /**
     * Picks the next key from [pool]. Returns the key and the updated seen set,
     * or null if the pool is empty.
     */
    fun draw(pool: List<String>, seen: Set<String>, lastKey: String?, random: Random = Random.Default): Pair<String, Set<String>>? {
        if (pool.isEmpty()) return null
        var nextSeen = seen
        var fresh = pool.filter { it !in seen }
        if (fresh.isEmpty()) {
            nextSeen = seen - pool.toSet()
            fresh = pool.filter { it != lastKey }.ifEmpty { pool }
        }
        val pick = fresh[random.nextInt(fresh.size)]
        return pick to (nextSeen + pick)
    }
}
