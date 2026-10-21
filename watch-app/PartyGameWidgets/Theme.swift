import CoreText
import SwiftUI

/// Colors and type from party-game/style.css.
enum PG {
    static let bg = Color(hex: 0x16211C)
    static let bg2 = Color(hex: 0x1F2E27)
    static let label = Color(hex: 0xF4F3EE)
    static let labelInk = Color(hex: 0x1A1C1E)
    static let inkSoft = Color(hex: 0xC9CDC6)
    static let pop = Color(hex: 0xE07A55)
    static let gold = Color(hex: 0xF2C46B)
    static let good = Color(hex: 0x5FBF8A)
    static let bad = Color(hex: 0xE06A5F)
    static let answers: [Color] = [
        Color(hex: 0xB5654A), Color(hex: 0x3A5A80), Color(hex: 0x6A5482), Color(hex: 0x3F6B57),
    ]

    static func answerColor(_ index: Int) -> Color { answers[index % answers.count] }

    /// Fraunces Black: headings and the CORRECT!/WRONG! stamp.
    static func title(_ size: CGFloat) -> Font { PGFonts.font("Fraunces-Black", size) }
    /// Fraunces Black Italic: the "Label of the Day" kicker.
    static func kicker(_ size: CGFloat) -> Font { PGFonts.font("Fraunces-BlackItalic", size) }
    /// Inter: label text, buttons and the book line.
    static func body(_ size: CGFloat) -> Font { PGFonts.font("Inter-Medium", size) }
    static func bold(_ size: CGFloat) -> Font { PGFonts.font("Inter-Bold", size) }
    static func heavy(_ size: CGFloat) -> Font { PGFonts.font("Inter-ExtraBold", size) }
}

/// Fraunces and Inter (SIL Open Font License) ship inside the widget extension.
/// They are listed in Info.plist (UIAppFonts) and also registered here so the
/// same views render correctly in the snapshot harness.
enum PGFonts {
    static let names = ["Fraunces-Black", "Fraunces-BlackItalic", "Inter-Medium", "Inter-Bold", "Inter-ExtraBold"]

    static let registered: Bool = {
        for name in names {
            let url = Bundle.main.url(forResource: name, withExtension: "ttf")
                ?? Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts")
            if let url {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
        return true
    }()

    static func font(_ name: String, _ size: CGFloat) -> Font {
        _ = registered
        return .custom(name, fixedSize: size)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
