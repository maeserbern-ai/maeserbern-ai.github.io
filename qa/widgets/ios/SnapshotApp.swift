import SwiftUI
import UIKit

// Test-only iOS app: renders the real widget views from ios-widgets/PartyGameWidgets
// (same Swift files, fonts, covers and daily.json) at each widget family's size,
// for each state, and saves PNGs to Documents/widget-snapshots. Never shipped.

@main
struct WidgetSnapshotApp: App {
    var body: some Scene {
        WindowGroup { SnapshotRunner() }
    }
}

struct SnapshotRunner: View {
    @State private var status = "Rendering widget snapshots"
    var body: some View {
        Text(status).padding().onAppear { status = Renderer.renderAll() }
    }
}

@MainActor
enum Renderer {
    // iPhone 16 Pro Max / 17 Pro Max widget sizes in points.
    static let small = CGSize(width: 170, height: 170)
    static let medium = CGSize(width: 364, height: 170)
    static let large = CGSize(width: 364, height: 382)
    static let rect = CGSize(width: 172, height: 76)
    static let circular = CGSize(width: 76, height: 76)
    static let inline = CGSize(width: 260, height: 26)

    static func renderAll() -> String {
        let fm = FileManager.default
        let dir = fm.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("widget-snapshots")
        try? fm.removeItem(at: dir)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        var report: [String] = []
        guard let deck = DailyDeck.shared else {
            try? "daily.json missing".write(to: dir.appendingPathComponent("FAILED.txt"), atomically: true, encoding: .utf8)
            return "daily.json missing"
        }
        report.append("puzzles=\(deck.puzzles.count) order=\(deck.order.count) books=\(deck.books.count)")
        // Same puzzle for everyone each day, every puzzle once per 105 days.
        let ids = Set((0..<deck.count).compactMap { deck.puzzle(forDay: $0)?.id })
        report.append("uniqueIn105Days=\(ids.count)")
        report.append("today=\(DailyClock.today()) puzzleToday=\(deck.puzzle(forDay: DailyClock.today())?.id ?? -1)")
        report.append("fontsRegistered=\(PGFonts.registered) " + PGFonts.names.map { "\($0):\(UIFont(name: $0, size: 12) != nil)" }.joined(separator: ","))

        // The exact links the widget's book row and QR hand to the app (CI opens each one).
        let links = deck.books.keys.sorted().compactMap { deck.books[$0]?.widgetLink.absoluteString }
        try? (links.joined(separator: "\n") + "\n").write(to: dir.appendingPathComponent("widget-links.txt"),
                                                          atomically: true, encoding: .utf8)

        func day(showing id: Int) -> Int { deck.order.firstIndex(of: id) ?? 0 }
        let tfID = deck.puzzles.first(where: { $0.isTrueFalse })?.id ?? 0
        for (name, d) in [("label", day(showing: 3)), ("truefalse", day(showing: tfID))] {
            guard let puzzle = deck.puzzle(forDay: d), let book = deck.book(for: puzzle) else { continue }
            for state in ["new", "correct", "wrong"] {
                let choice: Int? = state == "new" ? nil
                    : (state == "correct" ? puzzle.answer : (puzzle.answer + 1) % puzzle.options.count)
                let entry = LabelEntryData(date: Date(), day: d, puzzle: puzzle, book: book,
                                           choice: choice, streak: state == "new" ? 4 : 5)
                let base = "ios-\(name)-\(state)"
                save(SmallLabelView(entry: entry), small, "\(base)-small", dir)
                save(MediumLabelView(entry: entry), medium, "\(base)-medium", dir)
                save(LargeLabelView(entry: entry), large, "\(base)-large", dir)
                // StandBy shows the small widget full-screen on black, without its background.
                save(SmallLabelView(entry: entry), small, "\(base)-standby", dir, background: .black, radius: 0)
                // Lock Screen accessories: never show the answer.
                save(LockRectangularView(entry: entry), rect, "\(base)-lock-rectangular", dir,
                     background: Color(hex: 0x3C4D63), radius: 0)
                save(LockCircularView(entry: entry), circular, "\(base)-lock-circular", dir,
                     background: Color(hex: 0x3C4D63), radius: 0)
                save(LockInlineView(entry: entry), inline, "\(base)-lock-inline", dir,
                     background: Color(hex: 0x3C4D63), radius: 0)
            }
        }
        let files = (try? fm.contentsOfDirectory(atPath: dir.path)) ?? []
        report.append("images=\(files.filter { $0.hasSuffix(".png") }.count)")
        let text = report.joined(separator: "\n") + "\n"
        try? text.write(to: dir.appendingPathComponent("report.txt"), atomically: true, encoding: .utf8)
        try? "done".write(to: dir.appendingPathComponent("DONE.txt"), atomically: true, encoding: .utf8)
        return text
    }

    static func save<V: View>(_ view: V, _ size: CGSize, _ name: String, _ dir: URL,
                              background: Color = PG.bg, radius: CGFloat = 22) {
        let content = view
            .frame(width: size.width, height: size.height)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .environment(\.colorScheme, .dark)
        let renderer = ImageRenderer(content: content)
        renderer.scale = 3
        if let data = renderer.uiImage?.pngData() {
            try? data.write(to: dir.appendingPathComponent(name + ".png"))
        }
    }
}
