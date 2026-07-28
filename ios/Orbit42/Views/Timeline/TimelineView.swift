import Observation
import SwiftUI

// MARK: - 모델

struct TimelineResponse: Decodable, Sendable {
    let items: [TimelineItem]
    let calendars: [TimelineCalendar]
}

struct TimelineCalendar: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let color: String
    let goalTitle: String?

    var displayColor: Color { Color(hexString: color) ?? Theme.accent }
}

/// 지나간 일정 하나 — 사진 기록이 있으면 함께 온다.
struct TimelineItem: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let startAt: String
    let endAt: String
    let allDay: Bool
    let hours: Double?
    let calendarId: String?
    let calendarName: String?
    let calendarColor: String?
    let goalTitle: String?
    let imageUrls: [String]
    let note: String?
    /// 팔로잉 스코프이거나 공유 캘린더에서 남이 만든 일정일 때
    let authorUsername: String?
    let authorName: String?
    let authorAvatarUrl: String?

    var authorAvatarURL: URL? { authorAvatarUrl.flatMap(URL.init(string:)) }

    var startDate: Date? { APIDateParser.parse(startAt) }
    var displayColor: Color { Color(hexString: calendarColor ?? "") ?? Theme.accent }
    var hasPhotos: Bool { !imageUrls.isEmpty }
}

// MARK: - 뷰모델

@MainActor
@Observable
final class TimelineViewModel {
    private(set) var items: [TimelineItem]?
    private(set) var calendars: [TimelineCalendar] = []
    private(set) var errorMessage: String?

    /// 캘린더 필터 (nil = 전체)
    var selectedCalendarId: String?
    /// 사진이 있는 기록만 보기
    var onlyPhotos = false
    /// "me" | "following"
    var scope = "me"

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load(force: Bool = false) async {
        if !force, items != nil { return }
        var path = "/api/v1/timeline?months=6&scope=\(scope)"
        if scope == "me", let selectedCalendarId {
            path += "&calendarId=\(selectedCalendarId)"
        }
        if onlyPhotos { path += "&onlyPhotos=1" }
        do {
            let response: TimelineResponse = try await api.get(path)
            items = response.items
            calendars = response.calendars
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            if items == nil {
                errorMessage = "타임라인을 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}

// MARK: - 화면

/// 타임라인 탭 — 내 시간의 기록. 지나간 일정을 최신순으로 보여주고,
/// 사진을 붙인 일정은 카드로 크게 나온다. 목표 캘린더로 좁히면 그 목표의 여정이 된다.
struct TimelineView: View {
    @State private var viewModel = TimelineViewModel()
    @State private var selectedItem: TimelineItem?

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E)"
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                content
            }
            .navigationTitle("타임라인")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .top) {
                Picker("보기", selection: scopeBinding) {
                    Text("내 기록").tag("me")
                    Text("팔로잉").tag("following")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(Theme.background)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.scope == "me" {
                        filterMenu
                    }
                }
            }
            .task { await viewModel.load() }
            .sheet(item: $selectedItem) { item in
                TimelinePhotoViewer(item: item)
            }
        }
    }

    private var scopeBinding: Binding<String> {
        Binding(
            get: { viewModel.scope },
            set: { newValue in
                guard newValue != viewModel.scope else { return }
                viewModel.scope = newValue
                Task { await viewModel.load(force: true) }
            }
        )
    }

    private var filterMenu: some View {
        Menu {
            Button {
                viewModel.selectedCalendarId = nil
                Task { await viewModel.load(force: true) }
            } label: {
                if viewModel.selectedCalendarId == nil {
                    Label("전체 캘린더", systemImage: "checkmark")
                } else {
                    Text("전체 캘린더")
                }
            }
            ForEach(viewModel.calendars) { calendar in
                Button {
                    viewModel.selectedCalendarId = calendar.id
                    Task { await viewModel.load(force: true) }
                } label: {
                    let label = calendar.goalTitle.map { "\(calendar.name) · \($0)" } ?? calendar.name
                    if viewModel.selectedCalendarId == calendar.id {
                        Label(label, systemImage: "checkmark")
                    } else {
                        Text(label)
                    }
                }
            }
            Divider()
            Button {
                viewModel.onlyPhotos.toggle()
                Task { await viewModel.load(force: true) }
            } label: {
                if viewModel.onlyPhotos {
                    Label("사진 있는 기록만", systemImage: "checkmark")
                } else {
                    Text("사진 있는 기록만")
                }
            }
        } label: {
            Image(systemName: viewModel.selectedCalendarId == nil && !viewModel.onlyPhotos
                  ? "line.3.horizontal.decrease.circle"
                  : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel("타임라인 필터")
    }

    @ViewBuilder
    private var content: some View {
        if let items = viewModel.items {
            if items.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        ForEach(groupedByDay(items), id: \.key) { group in
                            Text(group.key)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.secondaryText)
                                .padding(.top, 4)
                            ForEach(group.items) { item in
                                card(item)
                            }
                        }
                    }
                    .padding(16)
                }
                .refreshable { await viewModel.load(force: true) }
            }
        } else if let message = viewModel.errorMessage {
            VStack(spacing: 12) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(Theme.secondaryText)
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
                Button("다시 시도") { Task { await viewModel.load(force: true) } }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
            }
            .padding(32)
        } else {
            ProgressView().tint(Theme.accent)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("아직 기록이 없어요")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.primaryText)
            Text(viewModel.scope == "following"
                 ? "팔로우한 사람들의 공개 캘린더 일정이 여기에 보여요.\n오르빗 탭에서 관심 가는 사람을 팔로우해 보세요."
                 : "지나간 일정이 여기에 쌓여요.\n일정에 사진을 붙이면 기록이 더 선명해져요.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(32)
    }

    // MARK: - 카드

    @ViewBuilder
    private func card(_ item: TimelineItem) -> some View {
        let inner = VStack(alignment: .leading, spacing: 8) {
            if item.hasPhotos {
                photoStrip(item)
            }
            if let authorName = item.authorName {
                HStack(spacing: 6) {
                    DiscoverAvatar(url: item.authorAvatarURL, name: authorName, size: 22)
                    Text(authorName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.primaryText)
                    Spacer(minLength: 0)
                }
            }
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(item.displayColor)
                    .frame(width: 3, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        Text(timeText(item))
                        if let name = item.calendarName {
                            Text("·")
                            Text(name).lineLimit(1)
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                if let goal = item.goalTitle {
                    Text(goal)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(item.displayColor)
                        .lineLimit(1)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(item.displayColor.opacity(0.15), in: Capsule())
                }
            }
            if let note = item.note, !note.isEmpty {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(item.hasPhotos ? 10 : 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))

        if item.hasPhotos {
            Button { selectedItem = item } label: { inner }
                .buttonStyle(.plain)
        } else {
            inner
        }
    }

    private func photoStrip(_ item: TimelineItem) -> some View {
        Group {
            if item.imageUrls.count == 1 {
                AsyncImage(url: URL(string: item.imageUrls[0])) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Theme.fill(0.05)
                    }
                }
                .frame(height: 200)
                .frame(maxWidth: .infinity)
                .clipped()
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(item.imageUrls, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFill()
                                } else {
                                    Theme.fill(0.05)
                                }
                            }
                            .frame(width: 160, height: 160)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .frame(height: 160)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func timeText(_ item: TimelineItem) -> String {
        guard let date = item.startDate else { return "" }
        if item.allDay { return "종일" }
        let time = Self.timeFormatter.string(from: date)
        if let hours = item.hours, hours > 0 {
            return "\(time) · \(AssetFormat.hours(hours))시간"
        }
        return time
    }

    private struct DayGroup {
        let key: String
        let items: [TimelineItem]
    }

    private func groupedByDay(_ items: [TimelineItem]) -> [DayGroup] {
        var order: [String] = []
        var map: [String: [TimelineItem]] = [:]
        for item in items {
            let key = item.startDate.map(Self.dayFormatter.string(from:)) ?? "기타"
            if map[key] == nil {
                map[key] = []
                order.append(key)
            }
            map[key]?.append(item)
        }
        return order.map { DayGroup(key: $0, items: map[$0] ?? []) }
    }
}

// MARK: - 사진 뷰어

private struct TimelinePhotoViewer: View {
    let item: TimelineItem
    @Environment(\.dismiss) private var dismiss

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월 d일 (E)"
        return formatter
    }()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 14) {
                    TabView {
                        ForEach(item.imageUrls, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFit()
                                } else {
                                    ProgressView().tint(Theme.accent)
                                }
                            }
                        }
                    }
                    .tabViewStyle(.page)
                    .frame(maxHeight: 420)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        if let date = item.startDate {
                            Text(Self.dayFormatter.string(from: date))
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        if let note = item.note, !note.isEmpty {
                            Text(note)
                                .font(.subheadline)
                                .foregroundStyle(Theme.primaryText.opacity(0.85))
                        }
                    }
                    .padding(.horizontal, 20)
                    Spacer()
                }
                .padding(.top, 8)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
            }
        }
    }
}
