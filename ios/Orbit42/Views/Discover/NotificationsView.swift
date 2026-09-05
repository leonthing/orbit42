import SwiftUI

// MARK: - 모델 (GET /api/v1/notifications)

struct NotificationsResponse: Decodable, Sendable {
    let unreadCount: Int
    let notifications: [AppNotification]
}

struct AppNotification: Decodable, Identifiable, Sendable {
    struct Actor: Decodable, Sendable {
        let username: String
        let displayName: String?
        let avatarUrl: String?
    }

    let id: String
    let type: String
    let title: String
    let body: String?
    let link: String?
    let actor: Actor?
    let readAt: String?
    let createdAt: String

    var isUnread: Bool { readAt == nil }

    var systemImage: String {
        switch type {
        case "new_follower": return "person.badge.plus"
        case let t where t.hasPrefix("event_invite"): return "person.2"
        case "new_slot": return "clock.badge.checkmark"
        case "time_request": return "hand.raised"
        case let t where t.hasPrefix("booking"): return "calendar.badge.clock"
        default: return "bell"
        }
    }

    /// 웹 링크(path)를 앱 화면으로 해석한다.
    /// - "/calendar?event={id}&date=YYYY-MM-DD" → 캘린더 탭의 그 일정 상세
    /// - "/bookings", "/{username}/bookings" → 예약 목록
    /// - "/{username}" → 프로필, "/{username}/s/{slug}" → 타임슬롯 예약 화면
    var destination: Destination? {
        guard let link, link.hasPrefix("/"),
              let components = URLComponents(string: link) else { return nil }
        let parts = components.path.split(separator: "/").map(String.init)
        guard !parts.isEmpty else { return nil }

        if parts[0] == "calendar" {
            let query = components.queryItems ?? []
            guard let eventId = query.first(where: { $0.name == "event" })?.value,
                  let dateText = query.first(where: { $0.name == "date" })?.value,
                  let date = Self.dayFormatter.date(from: dateText)
            else { return nil }
            return .event(id: eventId, date: date)
        }
        if parts.last == "bookings", parts.count <= 2 {
            return .bookings
        }
        if parts.count == 1 {
            return .profile(username: parts[0])
        }
        if parts.count == 3, parts[1] == "s" {
            return .slot(username: parts[0], slug: parts[2])
        }
        return nil
    }

    enum Destination {
        case profile(username: String)
        case slot(username: String, slug: String)
        case event(id: String, date: Date)
        case bookings
    }

    /// 링크의 date 쿼리("2026-08-14")를 기기 시간대의 그날로 읽는다.
    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter
    }()

    var createdDate: Date? { APIDateParser.parse(createdAt) }
}

// MARK: - 알림함

/// 알림 목록 — 열면 전체 읽음 처리, 행 탭 → 관련 화면으로 이동.
struct NotificationsView: View {
    @Environment(TabRouter.self) private var router
    @State private var notifications: [AppNotification]?
    @State private var errorMessage: String?

    /// 목록의 뱃지 갱신을 위해 부모에 안 읽은 개수 리셋을 알린다.
    var onAllRead: (() -> Void)?

    private static let timeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.unitsStyle = .short
        return formatter
    }()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("알림")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if let notifications {
            if notifications.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "bell.slash")
                        .font(.system(size: 30, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text("아직 알림이 없어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(notifications) { notification in
                            row(notification)
                        }
                    }
                    .padding(16)
                }
                .refreshable { await load(force: true) }
            }
        } else if let errorMessage {
            VStack(spacing: 12) {
                Text(errorMessage)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
                Button("다시 시도") { Task { await load(force: true) } }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
            }
        } else {
            ProgressView().tint(Theme.accent)
        }
    }

    @ViewBuilder
    private func row(_ notification: AppNotification) -> some View {
        let card = HStack(alignment: .top, spacing: 10) {
            Image(systemName: notification.systemImage)
                .font(.subheadline)
                .foregroundStyle(notification.isUnread ? Theme.accent : Theme.secondaryText)
                .frame(width: 30, height: 30)
                .background(
                    notification.isUnread ? Theme.accent.opacity(0.15) : Theme.fill(0.05),
                    in: Circle()
                )
            VStack(alignment: .leading, spacing: 3) {
                Text(notification.title)
                    .font(.subheadline.weight(notification.isUnread ? .semibold : .regular))
                    .foregroundStyle(Theme.primaryText)
                    .multilineTextAlignment(.leading)
                if let body = notification.body, !body.isEmpty {
                    Text(body)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(2)
                }
                if let date = notification.createdDate {
                    Text(Self.timeFormatter.localizedString(for: date, relativeTo: Date()))
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            Spacer(minLength: 0)
            if notification.isUnread {
                Circle()
                    .fill(Theme.accent)
                    .frame(width: 7, height: 7)
                    .padding(.top, 6)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))

        switch notification.destination {
        case .profile(let username):
            NavigationLink { PersonProfileView(username: username) } label: { card }
                .buttonStyle(.plain)
        case .slot(let username, let slug):
            NavigationLink { SlotBookingView(username: username, slug: slug) } label: { card }
                .buttonStyle(.plain)
        case .bookings:
            NavigationLink { BookingsView(embedded: true) } label: { card }
                .buttonStyle(.plain)
        case .event(let id, let date):
            // 일정은 캘린더 탭에 있어서 push 가 아니라 탭 전환으로 보낸다.
            Button {
                router.calendarEventRequest = CalendarEventRequest(eventId: id, date: date)
                router.selection = .calendar
            } label: { card }
            .buttonStyle(.plain)
        case nil:
            card
        }
    }

    private func load(force: Bool = false) async {
        if !force, notifications != nil { return }
        do {
            let response: NotificationsResponse = try await APIClient.shared.get(
                "/api/v1/notifications"
            )
            notifications = response.notifications
            errorMessage = nil
            // 열어본 시점에 전체 읽음 처리 (뱃지 소거).
            if response.unreadCount > 0 {
                struct MarkReadRequest: Encodable {}
                let _: AckResponse? = try? await APIClient.shared.post(
                    "/api/v1/notifications",
                    body: MarkReadRequest()
                )
                onAllRead?()
            }
        } catch {
            if notifications == nil {
                errorMessage = "알림을 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}
