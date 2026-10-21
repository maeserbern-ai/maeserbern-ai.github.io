import AppIntents
import SwiftUI
import WidgetKit

// The approved "Label of the Day" design (watch-samples/pg.html):
// dark emerald card, terracotta italic kicker, Fraunces headline, cream label,
// four colored answer buttons, a CORRECT!/WRONG! stamp, the streak, and the
// book cover with its Amazon link (always shown on medium and large).

// MARK: - Shared pieces

struct Kicker: View {
    var size: CGFloat
    var body: some View {
        Text("Label of the Day").font(PG.kicker(size)).foregroundStyle(PG.pop).lineLimit(1)
    }
}

struct LabelCard: View {
    let header: String?
    let text: String
    var textSize: CGFloat
    var headerSize: CGFloat
    var lineLimit: Int
    var padding: CGFloat = 9

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let header {
                Text(header)
                    .font(PG.heavy(headerSize))
                    .tracking(headerSize * 0.08)
                    .foregroundStyle(PG.labelInk)
                    .padding(.bottom, 3)
                Rectangle().fill(PG.labelInk).frame(height: 2).padding(.bottom, 5)
            }
            Text(text)
                .font(PG.body(textSize))
                .foregroundStyle(PG.labelInk)
                .lineSpacing(textSize * 0.25)
                .lineLimit(lineLimit)
                .truncationMode(.tail)
                .minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, padding + 2)
        .padding(.vertical, padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(PG.label))
    }
}

struct Stamp: View {
    let correct: Bool
    var size: CGFloat

    var body: some View {
        let color = correct ? PG.good : PG.bad
        Text(correct ? "CORRECT!" : "WRONG!")
            .font(PG.title(size))
            .foregroundStyle(color)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, size * 0.4)
            .padding(.vertical, size * 0.06)
            .background(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(PG.bg.opacity(0.88)))
            .overlay(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).stroke(color, lineWidth: max(2, size * 0.11)))
            .rotationEffect(.degrees(-10))
            .accessibilityLabel(correct ? "Correct" : "Wrong")
    }
}

struct StreakLine: View {
    let entry: LabelEntryData
    var size: CGFloat
    var tapHint: String = "tap to guess"

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill").font(.system(size: size)).foregroundStyle(PG.pop)
            Group {
                if let correct = entry.correct {
                    Text(correct ? "Correct! " : "Not this time. ")
                        .foregroundColor(correct ? PG.good : PG.bad)
                        + Text("\(entry.streak)-day streak")
                } else if entry.streak > 0 {
                    Text("\(entry.streak)-day streak \u{00B7} \(tapHint)")
                } else {
                    Text("Start a streak \u{00B7} \(tapHint)")
                }
            }
            .font(PG.body(size))
            .foregroundStyle(PG.inkSoft)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
    }
}

struct AnswerButton: View {
    let entry: LabelEntryData
    let puzzle: DailyPuzzle
    let index: Int
    var height: CGFloat
    var fontSize: CGFloat

    private var color: Color {
        puzzle.isTrueFalse ? PG.answerColor(index + 1) : PG.answerColor(index)
    }

    var body: some View {
        if entry.answered {
            face.accessibilityAddTraits(index == puzzle.answer ? .isSelected : [])
        } else {
            Button(intent: AnswerLabelIntent(day: entry.day, choice: index)) { face }
                .buttonStyle(.plain)
        }
    }

    private var face: some View {
        let isAnswer = index == puzzle.answer
        let isChoice = index == entry.choice
        let dimmed = entry.answered && !isAnswer && !isChoice
        return HStack(spacing: fontSize * 0.5) {
            Text("\(index + 1)")
                .font(PG.bold(fontSize * 0.85))
                .padding(.horizontal, fontSize * 0.45)
                .padding(.vertical, 1)
                .background(RoundedRectangle(cornerRadius: 5, style: .continuous).fill(Color.black.opacity(0.25)))
            Text(puzzle.options[index])
                .font(PG.bold(fontSize))
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            if entry.answered && isAnswer {
                Image(systemName: "checkmark.circle.fill").font(.system(size: fontSize)).foregroundStyle(PG.good)
            } else if entry.answered && isChoice {
                Image(systemName: "xmark.circle.fill").font(.system(size: fontSize)).foregroundStyle(PG.bad)
            }
        }
        .foregroundStyle(Color.white)
        .padding(.horizontal, fontSize * 0.7)
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(color))
        .overlay {
            if entry.answered && (isAnswer || isChoice) {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isAnswer ? PG.good : PG.bad, lineWidth: 2.5)
            }
        }
        .opacity(dimmed ? 0.4 : 1)
    }
}

struct AnswerGrid: View {
    let entry: LabelEntryData
    let puzzle: DailyPuzzle
    var height: CGFloat
    var fontSize: CGFloat
    var spacing: CGFloat = 8

    var body: some View {
        if puzzle.options.count == 2 {
            HStack(spacing: spacing) {
                AnswerButton(entry: entry, puzzle: puzzle, index: 0, height: height, fontSize: fontSize)
                AnswerButton(entry: entry, puzzle: puzzle, index: 1, height: height, fontSize: fontSize)
            }
        } else {
            VStack(spacing: spacing) {
                HStack(spacing: spacing) {
                    AnswerButton(entry: entry, puzzle: puzzle, index: 0, height: height, fontSize: fontSize)
                    AnswerButton(entry: entry, puzzle: puzzle, index: 1, height: height, fontSize: fontSize)
                }
                HStack(spacing: spacing) {
                    AnswerButton(entry: entry, puzzle: puzzle, index: 2, height: height, fontSize: fontSize)
                    AnswerButton(entry: entry, puzzle: puzzle, index: 3, height: height, fontSize: fontSize)
                }
            }
        }
    }
}

/// The book cover and its Amazon link. Never hidden on medium/large widgets.
/// `qrSize` > 0 adds the book's QR code (large widget), so the book can be opened
/// with a phone camera even on a screen without a browser (HomeView).
struct BookRow: View {
    let book: DailyBook
    var coverWidth: CGFloat
    var fontSize: CGFloat
    var padding: CGFloat = 8
    var qrSize: CGFloat = 0

    var body: some View {
        HStack(spacing: padding + 2) {
            Link(destination: book.widgetLink) {
                HStack(spacing: padding + 2) {
                    cover
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ingredient Dictionary")
                            .font(PG.body(fontSize * 0.8))
                            .foregroundStyle(PG.inkSoft)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        (Text("Get ") + Text(book.name).foregroundColor(PG.gold) + Text(" on Amazon \u{2192}"))
                            .font(PG.bold(fontSize))
                            .foregroundStyle(PG.label)
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
                        if qrSize > 0 {
                            Text("or scan with your phone camera")
                                .font(PG.body(fontSize * 0.75))
                                .foregroundStyle(PG.inkSoft)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .accessibilityLabel("Get \(book.name) on Amazon")
            if qrSize > 0 {
                Link(destination: book.widgetLink) {
                    Image(book.qr)
                        .resizable()
                        .interpolation(.none)
                        .frame(width: qrSize, height: qrSize)
                        .padding(2)
                        .background(RoundedRectangle(cornerRadius: 5, style: .continuous).fill(Color.white))
                }
                .accessibilityLabel("QR code for \(book.name) on Amazon")
            }
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(PG.bg2))
    }

    @ViewBuilder private var cover: some View {
        let image = Image(book.cover).resizable()
        Group {
            if #available(iOS 18.0, *) {
                image.widgetAccentedRenderingMode(.fullColor)
            } else {
                image
            }
        }
        .aspectRatio(563.0 / 900.0, contentMode: .fit)
        .frame(width: coverWidth)
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
    }
}

struct MissingDeckView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Kicker(size: 13)
            Text("Open the game to load today's label.").font(PG.body(12)).foregroundStyle(PG.label)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Home screen / HomeView / StandBy

/// Small: kicker, "Snack or Shampoo?", the first few ingredients, streak. Tap opens the game.
struct SmallLabelView: View {
    let entry: LabelEntryData

    var body: some View {
        if let puzzle = entry.puzzle {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(size: 12)
                Text(puzzle.isTrueFalse ? "True or false?" : "Snack or Shampoo?")
                    .font(PG.title(17))
                    .foregroundStyle(PG.label)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 1)
                    .padding(.bottom, 6)
                LabelCard(header: nil, text: puzzle.preview(count: 4), textSize: 10.5, headerSize: 7,
                          lineLimit: 3, padding: 6)
                Spacer(minLength: 4)
                StreakLine(entry: entry, size: 9.5, tapHint: "tap to play")
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            MissingDeckView()
        }
    }
}

/// Medium: label, 4 buttons, stamp, streak, book link.
struct MediumLabelView: View {
    let entry: LabelEntryData

    var body: some View {
        if let puzzle = entry.puzzle, let book = entry.book {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Kicker(size: 12)
                    Text(puzzle.isTrueFalse ? "True or false?" : "Which product is it?")
                        .font(PG.title(12))
                        .foregroundStyle(PG.label)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    HStack(spacing: 2) {
                        Image(systemName: "flame.fill").font(.system(size: 10)).foregroundStyle(PG.pop)
                        Text("\(entry.streak)").font(PG.bold(11)).foregroundStyle(PG.inkSoft)
                    }
                    .accessibilityLabel("\(entry.streak)-day streak")
                }
                HStack(alignment: .top, spacing: 8) {
                    LabelCard(header: puzzle.isTrueFalse ? "THE CLAIM" : "INGREDIENTS", text: puzzle.fullLabel,
                              textSize: 9, headerSize: 6.5, lineLimit: 3, padding: 6)
                        .frame(width: 128)
                        .frame(maxHeight: 72, alignment: .top)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(alignment: .topTrailing) {
                            if let correct = entry.correct {
                                Stamp(correct: correct, size: 14).offset(x: 10, y: 18)
                            }
                        }
                    AnswerGrid(entry: entry, puzzle: puzzle,
                               height: puzzle.isTrueFalse ? 72 : 32, fontSize: 10, spacing: 6)
                }
                .frame(height: 72)
                BookRow(book: book, coverWidth: 18, fontSize: 10, padding: 5)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            MissingDeckView()
        }
    }
}

/// Large (and HomeView): the full approved layout.
struct LargeLabelView: View {
    let entry: LabelEntryData

    var body: some View {
        if let puzzle = entry.puzzle, let book = entry.book {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(size: 15)
                Text(puzzle.isTrueFalse ? "True or false?" : "Which product is it?")
                    .font(PG.title(21))
                    .foregroundStyle(PG.label)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 1)
                    .padding(.bottom, 9)
                LabelCard(header: puzzle.isTrueFalse ? "THE CLAIM" : "INGREDIENTS", text: puzzle.fullLabel,
                          textSize: puzzle.isTrueFalse ? 13 : 11, headerSize: 8.5, lineLimit: 4)
                    .overlay(alignment: .topTrailing) {
                        if let correct = entry.correct {
                            Stamp(correct: correct, size: 26).offset(x: 4, y: 22)
                        }
                    }
                Spacer(minLength: 8)
                AnswerGrid(entry: entry, puzzle: puzzle, height: puzzle.isTrueFalse ? 44 : 34, fontSize: 12.5)
                Spacer(minLength: 8)
                BookRow(book: book, coverWidth: 30, fontSize: 11.5, padding: 7, qrSize: 50)
                StreakLine(entry: entry, size: 10.5)
                    .padding(.top, 7)
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            MissingDeckView()
        }
    }
}

// MARK: - Lock Screen (never shows the answer)

struct LockRectangularView: View {
    let entry: LabelEntryData
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Label of the Day").font(PG.title(15)).lineLimit(1).widgetAccentable()
            Text(entry.answered ? "played today" : "tap to play").font(.system(size: 13, weight: .semibold))
            HStack(spacing: 3) {
                Image(systemName: "flame.fill")
                Text("\(entry.streak)-day streak")
            }
            .font(.system(size: 13))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LockInlineView: View {
    let entry: LabelEntryData
    var body: some View {
        Text("Label of the Day \u{00B7} \(entry.answered ? "played" : "tap to play") \u{00B7} \u{1F525}\(entry.streak)")
    }
}

struct LockCircularView: View {
    let entry: LabelEntryData
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: "flame.fill").font(.system(size: 16)).widgetAccentable()
                Text("\(entry.streak)").font(.system(size: 18, weight: .bold, design: .rounded))
            }
        }
        .accessibilityLabel("Label of the Day, \(entry.streak)-day streak")
    }
}
