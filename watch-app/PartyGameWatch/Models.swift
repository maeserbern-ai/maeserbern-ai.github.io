import Foundation

struct Book: Decodable, Identifiable {
    let id: String
    let name: String
    let url: URL
    let coverAsset: String?
    let qrAsset: String
}

/// One "what is it?" puzzle. Generated from party-game/puzzles.js by
/// scripts/export-data.mjs (true/false toilet-paper puzzles are left out).
struct Puzzle: Codable, Hashable, Identifiable {
    struct Spotlight: Codable, Hashable {
        let name: String
        let note: String
    }

    let answer: String
    let options: [String]
    let kind: String
    let book: String
    let bookName: String
    let ingredients: [String]
    let spotlight: Spotlight

    var id: String { answer }
}

/// A JavaScript regular expression exported as source + flags, with its text.
struct RegexRule: Decodable {
    let pattern: String
    let flags: String
    let text: String
}

/// The web game's watch list: ingredients worth knowing about.
struct WatchRules: Decodable {
    let warn: [RegexRule]
    let undisclosed: [RegexRule]
}

/// Ordered list of regex rules; the first rule that matches wins.
struct RuleMatcher {
    private let rules: [(regex: NSRegularExpression, text: String)]

    init(_ rules: [RegexRule]) {
        self.rules = rules.compactMap { rule -> (regex: NSRegularExpression, text: String)? in
            var options: NSRegularExpression.Options = []
            if rule.flags.contains("i") { options.insert(.caseInsensitive) }
            if rule.flags.contains("m") { options.insert(.anchorsMatchLines) }
            if rule.flags.contains("s") { options.insert(.dotMatchesLineSeparators) }
            guard let regex = try? NSRegularExpression(pattern: rule.pattern, options: options) else {
                return nil
            }
            return (regex: regex, text: rule.text)
        }
    }

    func firstMatch(in string: String) -> String? {
        let range = NSRange(string.startIndex..<string.endIndex, in: string)
        for rule in rules where rule.regex.firstMatch(in: string, options: [], range: range) != nil {
            return rule.text
        }
        return nil
    }
}

/// Bundled game data, loaded once.
enum GameData {
    static let books: [Book] = load("books", as: [Book].self) ?? []
    static let puzzles: [Puzzle] = load("puzzles", as: [Puzzle].self) ?? []

    static let puzzlesByAnswer: [String: Puzzle] = Dictionary(
        puzzles.map { ($0.answer, $0) },
        uniquingKeysWith: { first, _ in first }
    )

    private static let glossary = RuleMatcher(load("glossary", as: [RegexRule].self) ?? [])
    private static let watchRules = load("watch", as: WatchRules.self)
    private static let warnings = RuleMatcher(watchRules?.warn ?? [])
    private static let undisclosed = RuleMatcher(watchRules?.undisclosed ?? [])

    /// Plain-words explanation of an ingredient (same fallback as the web game).
    static func explanation(for ingredient: String) -> String {
        glossary.firstMatch(in: ingredient) ?? "No extra details for this one."
    }

    /// Short watch-list tag ("Synthetic dye"), if the ingredient is worth knowing about.
    static func warning(for ingredient: String) -> String? {
        warnings.firstMatch(in: ingredient)
    }

    /// Short tag for ingredients whose real contents the label doesn't spell out.
    static func undisclosedNote(for ingredient: String) -> String? {
        undisclosed.firstMatch(in: ingredient)
    }

    private static func load<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        return try? JSONDecoder().decode(type, from: data)
    }
}
