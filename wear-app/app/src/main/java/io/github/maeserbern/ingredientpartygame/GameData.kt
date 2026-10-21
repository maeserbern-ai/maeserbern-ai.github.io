package io.github.maeserbern.ingredientpartygame

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONArray
import org.json.JSONObject
import java.util.regex.Pattern

/** A book from the Ingredient Dictionary series, with its store link and QR code. */
data class Book(
    val id: String,
    val name: String,
    val url: String,
    val amazon: Boolean,
    /** Asset path of the cover image, if the book has one. */
    val cover: String?,
    /** QR code modules, one string of '0'/'1' per row. */
    val qr: List<String>,
)

/** One "what is it?" puzzle, exported from party-game/puzzles.js. */
data class Puzzle(
    val answer: String,
    val options: List<String>,
    val kind: String,
    val book: String,
    val bookName: String,
    val ingredients: List<String>,
    val spotlightName: String,
    val spotlightNote: String,
)

/** Ordered JavaScript regex rules; the first rule that matches wins. */
class RuleMatcher(rules: JSONArray?) {
    private val rules: List<Pair<Pattern, String>> = buildList {
        if (rules == null) return@buildList
        for (i in 0 until rules.length()) {
            val rule = rules.getJSONObject(i)
            val flags = rule.optString("flags")
            var options = 0
            if ('i' in flags) options = options or Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
            if ('m' in flags) options = options or Pattern.MULTILINE
            if ('s' in flags) options = options or Pattern.DOTALL
            try {
                add(Pattern.compile(rule.getString("pattern"), options) to rule.getString("text"))
            } catch (_: Exception) {
                // A rule Java can't compile is skipped, like the Apple Watch app does.
            }
        }
    }

    fun firstMatch(text: String): String? = rules.firstOrNull { it.first.matcher(text).find() }?.second
}

/** Bundled game data, loaded once from assets/data (see scripts/export-data.mjs). */
class GameData(private val context: Context) {
    val books: List<Book>
    val puzzles: List<Puzzle>
    val puzzlesByAnswer: Map<String, Puzzle>
    private val glossary: RuleMatcher
    private val warnings: RuleMatcher
    private val undisclosed: RuleMatcher
    private val covers = HashMap<String, Bitmap?>()

    init {
        books = readArray("books.json").objects().map { b ->
            Book(
                id = b.getString("id"),
                name = b.getString("name"),
                url = b.getString("url"),
                amazon = b.optBoolean("amazon"),
                cover = if (b.isNull("cover")) null else b.getString("cover"),
                qr = b.getJSONArray("qr").strings(),
            )
        }
        puzzles = readArray("puzzles.json").objects().map { p ->
            val spot = p.getJSONObject("spotlight")
            Puzzle(
                answer = p.getString("answer"),
                options = p.getJSONArray("options").strings(),
                kind = p.optString("kind"),
                book = p.getString("book"),
                bookName = p.optString("bookName"),
                ingredients = p.getJSONArray("ingredients").strings(),
                spotlightName = spot.getString("name"),
                spotlightNote = spot.getString("note"),
            )
        }
        puzzlesByAnswer = puzzles.associateBy { it.answer }
        glossary = RuleMatcher(readArray("glossary.json"))
        val watch = JSONObject(readText("watch.json"))
        warnings = RuleMatcher(watch.optJSONArray("warn"))
        undisclosed = RuleMatcher(watch.optJSONArray("undisclosed"))
    }

    fun book(id: String): Book? = books.firstOrNull { it.id == id }

    /** Plain-words explanation of an ingredient (same fallback as the web game). */
    fun explanation(ingredient: String): String =
        glossary.firstMatch(ingredient) ?: "No extra details for this one."

    /** Short watch-list tag ("Synthetic dye"), if the ingredient is worth knowing about. */
    fun warning(ingredient: String): String? = warnings.firstMatch(ingredient)

    /** Short tag for ingredients whose real contents the label doesn't spell out. */
    fun undisclosedNote(ingredient: String): String? = undisclosed.firstMatch(ingredient)

    fun cover(book: Book): Bitmap? {
        val path = book.cover ?: return null
        return covers.getOrPut(path) {
            try {
                context.assets.open(path).use { stream ->
                    val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
                    BitmapFactory.decodeStream(stream, null, opts)
                }
            } catch (_: Exception) {
                null
            }
        }
    }

    private fun readText(name: String): String =
        context.assets.open("data/$name").bufferedReader().use { it.readText() }

    private fun readArray(name: String): JSONArray = JSONArray(readText(name))
}

private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }
