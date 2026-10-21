import AppIntents
import WidgetKit

/// Runs when an answer button on the widget is tapped (iOS 17 interactive widgets).
/// The answer is checked on the device; nothing leaves the phone.
struct AnswerLabelIntent: AppIntent {
    static let title: LocalizedStringResource = "Answer the Label of the Day"
    static let description = IntentDescription("Picks an answer for today's ingredient label.")

    @Parameter(title: "Day")
    var day: Int

    @Parameter(title: "Answer")
    var choice: Int

    init() {}

    init(day: Int, choice: Int) {
        self.day = day
        self.choice = choice
    }

    func perform() async throws -> some IntentResult {
        // A tap on yesterday's puzzle (widget not refreshed yet) is ignored.
        if day == DailyClock.today() {
            DailyStateStore.answer(choice: choice, day: day)
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
