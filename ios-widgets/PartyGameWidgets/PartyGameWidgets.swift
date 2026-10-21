import SwiftUI
import WidgetKit

struct LabelEntry: TimelineEntry {
    let date: Date
    let data: LabelEntryData
}

struct LabelProvider: TimelineProvider {
    func placeholder(in context: Context) -> LabelEntry {
        LabelEntry(date: Date(), data: .make(date: Date(), state: DailyState()))
    }

    func getSnapshot(in context: Context, completion: @escaping (LabelEntry) -> Void) {
        let now = Date()
        // The widget gallery shows today's label, unanswered.
        let state = context.isPreview ? DailyState() : DailyStateStore.load()
        completion(LabelEntry(date: now, data: .make(date: now, state: state)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LabelEntry>) -> Void) {
        let now = Date()
        let midnight = DailyClock.nextMidnight(after: now)
        let state = DailyStateStore.load()
        // A new label every local midnight; answers reload the timeline right away.
        let entries = [
            LabelEntry(date: now, data: .make(date: now, state: state)),
            LabelEntry(date: midnight, data: .make(date: midnight, state: state)),
        ]
        completion(Timeline(entries: entries, policy: .after(DailyClock.nextMidnight(after: midnight))))
    }
}

struct LabelOfTheDayView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LabelEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallLabelView(entry: entry.data).containerBackground(PG.bg, for: .widget)
        case .systemMedium:
            MediumLabelView(entry: entry.data).containerBackground(PG.bg, for: .widget)
        case .accessoryRectangular:
            LockRectangularView(entry: entry.data).containerBackground(Color.clear, for: .widget)
        case .accessoryInline:
            LockInlineView(entry: entry.data).containerBackground(Color.clear, for: .widget)
        case .accessoryCircular:
            LockCircularView(entry: entry.data).containerBackground(Color.clear, for: .widget)
        default:
            LargeLabelView(entry: entry.data).containerBackground(PG.bg, for: .widget)
        }
    }
}

/// Home Screen, Apple HomeView, StandBy and iPad. Interactive on medium and large.
struct LabelOfTheDayWidget: Widget {
    let kind = "LabelOfTheDay"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LabelProvider()) { entry in
            LabelOfTheDayView(entry: entry)
        }
        .configurationDisplayName("Label of the Day")
        .description("Snack or Shampoo? Read today's label and tap your answer.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

/// Lock Screen: "Label of the Day · tap to play · streak". Never shows the answer.
struct LabelOfTheDayLockWidget: Widget {
    let kind = "LabelOfTheDayLock"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LabelProvider()) { entry in
            LabelOfTheDayView(entry: entry)
        }
        .configurationDisplayName("Label of the Day")
        .description("Your streak and a reminder to play. Tap to open the game.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

@main
struct PartyGameWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LabelOfTheDayWidget()
        LabelOfTheDayLockWidget()
    }
}
