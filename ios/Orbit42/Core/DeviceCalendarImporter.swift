import EventKit
import Foundation

/// 기기 캘린더(iCloud·Exchange·Outlook 등 iOS 캘린더 앱에 연결된 모든 계정)에서
/// 일정 참석자를 읽어 관계 궤도로 보낸다. 구글 연동과 별개라 회사 캘린더도 잡힌다.
///
/// 서버는 보낸 범위 안의 기존 기기 만남을 지우고 다시 쓰므로, 범위 전체를
/// 한 번에 보낸다(최대 3000건).
enum DeviceCalendarImporter {
    private static let stampKey = "peopleDeviceImportAt"
    private static let interval: TimeInterval = 6 * 60 * 60
    private static let pastDays = 180
    private static let futureDays = 60
    private static let maxEvents = 3000

    static var isAuthorized: Bool {
        EKEventStore.authorizationStatus(for: .event) == .fullAccess
    }

    static var isStale: Bool {
        guard let last = UserDefaults.standard.object(forKey: stampKey) as? Date else { return true }
        return Date().timeIntervalSince(last) > interval
    }

    static func resetStamp() {
        UserDefaults.standard.removeObject(forKey: stampKey)
    }

    /// 아직 묻지 않았으면 권한을 묻는다. 이미 거절했으면 false.
    static func requestAccess() async -> Bool {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess:
            return true
        case .notDetermined:
            return (try? await EKEventStore().requestFullAccessToEvents()) ?? false
        default:
            return false
        }
    }

    /// 권한이 있을 때만 읽어서 보낸다. 6시간 안에 보낸 적 있으면 건너뛴다(force 제외).
    static func run(force: Bool = false) async throws {
        guard isAuthorized, force || isStale else { return }
        let now = Date()
        let start = now.addingTimeInterval(-Double(pastDays) * 86_400)
        let end = now.addingTimeInterval(Double(futureDays) * 86_400)
        let events = await Task.detached(priority: .utility) {
            collect(from: start, to: end)
        }.value

        let body = DeviceImportRequest(
            rangeStart: APIDateParser.encodeDateTime(start),
            rangeEnd: APIDateParser.encodeDateTime(end),
            events: events
        )
        let _: OkResponse = try await APIClient.shared.post("/api/v1/people/device-import", body: body)
        UserDefaults.standard.set(Date(), forKey: stampKey)
    }

    private static func collect(from start: Date, to end: Date) -> [DeviceImportRequest.Event] {
        let store = EKEventStore()
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        var out: [DeviceImportRequest.Event] = []
        for event in store.events(matching: predicate) {
            if out.count >= maxEvents { break }
            guard !event.isAllDay, event.status != .canceled else { continue }
            guard let attendees = event.attendees, !attendees.isEmpty else { continue }
            // 내가 거절한 일정은 만남이 아니다.
            if attendees.contains(where: { $0.isCurrentUser && $0.participantStatus == .declined }) {
                continue
            }

            var people: [DeviceImportRequest.Attendee] = []
            var seen = Set<String>()
            let everyone = attendees + (event.organizer.map { [$0] } ?? [])
            for p in everyone {
                guard !p.isCurrentUser, p.participantType != .room, p.participantType != .resource,
                      p.participantStatus != .declined,
                      let email = email(of: p), !seen.contains(email) else { continue }
                seen.insert(email)
                people.append(.init(email: email, name: p.name))
            }
            guard !people.isEmpty else { continue }

            // 반복 일정은 회차마다 식별자가 같아서 시작 시각을 붙인다.
            let id = event.calendarItemIdentifier
            out.append(.init(
                ref: "\(id)_\(Int(event.startDate.timeIntervalSince1970))",
                title: event.title,
                startAt: APIDateParser.encodeDateTime(event.startDate),
                endAt: event.endDate.map(APIDateParser.encodeDateTime),
                attendees: people
            ))
        }
        return out
    }

    /// EKParticipant.url 은 보통 "mailto:a@b.com". 그 외 형식은 버린다.
    private static func email(of participant: EKParticipant) -> String? {
        let raw = participant.url.absoluteString
        guard raw.lowercased().hasPrefix("mailto:") else { return nil }
        let address = String(raw.dropFirst("mailto:".count))
            .removingPercentEncoding?
            .trimmingCharacters(in: .whitespaces)
            .lowercased()
        guard let address, address.contains("@") else { return nil }
        return address
    }
}
