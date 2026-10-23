import SwiftUI

/// Screen 3: right or wrong, the answer, the weird-ingredient fact (or the real
/// story behind a true/false claim), and the book it comes from.
struct ResultView: View {
    @EnvironmentObject private var game: GameState

    var body: some View {
        if let puzzle = game.puzzle {
            ScrollView {
                VStack(spacing: 8) {
                    Text(game.wasCorrect ? "Correct! +\(game.lastPoints)" : "Not quite  +0")
                        .font(.system(.headline, weight: .bold))
                        .foregroundStyle(game.wasCorrect ? Theme.good : Theme.bad)

                    Text(puzzle.isTrueFalse ? "\(puzzle.answer)." : puzzle.answer)
                        .font(.system(.title3, design: .serif, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("watch-result-answer")

                    if !game.wasCorrect, let guess = game.lastGuess {
                        Text("You said \(guess)")
                            .font(.footnote)
                            .foregroundStyle(Theme.soft)
                            .multilineTextAlignment(.center)
                    }

                    if puzzle.isTrueFalse {
                        factCard(tag: "THE REAL STORY", title: puzzle.statement ?? "", note: puzzle.explain ?? "")
                    } else if let spotlight = puzzle.spotlight {
                        factCard(tag: "WEIRD INGREDIENT", title: spotlight.name, note: spotlight.note)
                    }

                    Button("Next puzzle") {
                        game.nextPuzzle()
                    }
                    .buttonStyle(PillButtonStyle(fill: Theme.terracotta, text: Theme.labelInk))
                    .accessibilityIdentifier("watch-next")

                    Text("Total \(game.totalScore)  ·  Streak \(game.streak)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.gold)

                    if let book = GameData.book(id: puzzle.book) {
                        BookCard(book: book)
                    }

                    Button {
                        game.goHome()
                    } label: {
                        Text("Home")
                            .font(.footnote)
                            .foregroundStyle(Theme.soft)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("watch-home")
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 2)
            }
        }
    }

    private func factCard(tag: String, title: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(tag)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.gold)
            Text(title)
                .font(.system(.headline, design: .serif, weight: .bold))
                .foregroundStyle(Theme.terracotta)
                .fixedSize(horizontal: false, vertical: true)
            Text(note)
                .font(.footnote)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("watch-result-note")
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.card))
    }
}

/// The book this puzzle comes from: cover, name, store link and the same QR code
/// the website shows, so it can be scanned with a phone (like the Wear OS app).
struct BookCard: View {
    let book: Book

    private var onAmazon: Bool { book.url.host == "www.amazon.com" }

    var body: some View {
        VStack(spacing: 6) {
            Text("FROM THE BOOK")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.gold)

            HStack(spacing: 8) {
                if let cover = book.coverAsset {
                    Image(cover)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40)
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                        .accessibilityLabel("\(book.name) book cover")
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ingredient Dictionary")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.soft)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(book.name)
                        .font(.system(.headline, design: .serif, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            Link(destination: book.url) {
                Text(onAmazon ? "Get it on Amazon" : "See the books")
            }
            .buttonStyle(PillButtonStyle(fill: Theme.terracotta, text: Theme.labelInk))
            .accessibilityIdentifier("watch-result-link")

            Image(book.qrAsset)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .frame(width: 104, height: 104)
                .padding(4)
                .background(.white)
                .accessibilityLabel("QR link for \(book.name)")
                .accessibilityIdentifier("watch-result-qr")

            Text(onAmazon ? "Scan to get it on Amazon" : "Scan to see the books")
                .font(.system(size: 11))
                .foregroundStyle(Theme.soft)
                .multilineTextAlignment(.center)
        }
        .padding(10)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.card))
    }
}
