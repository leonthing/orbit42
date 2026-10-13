import AppIntents
import Foundation
import OSLog
import WidgetKit

private let log = Logger(subsystem: "org.orbit42.app.widget", category: "completion")

/// 위젯 체크박스 — 앱을 열지 않고 일정을 완료/해제한다.
/// 캐시에 먼저 반영하고 서버에 저장한다. perform 이 끝나면 WidgetKit 이 한 번 다시 그리는데,
/// 체크 직후 30초는 서버를 다시 받지 않고 캐시로 그려서 PUT 한 번만큼만 걸린다.
/// (직접 reload 를 더 부르지 않는다 — 다시 그리는 도중의 탭이 버려지지 않게)
/// 저장이 실패하면 캐시를 되돌려, 다시 그릴 때 체크가 풀린 채로 보인다.
/// `completed` 는 토글이 아니라 "이 값으로 설정"이라 같은 칸을 연타해도 상태가 엇갈리지 않는다.
struct ToggleCompletionIntent: AppIntent {
    static var title: LocalizedStringResource = "일정 완료 체크"
    static var isDiscoverable = false

    /// 서버 일정 id 그대로 (구글 일정은 "gcal_…", 자체 일정은 uuid) — 줄 위치가 아니라 일정 자체를 가리킨다.
    @Parameter(title: "일정 ID")
    var eventId: String

    @Parameter(title: "완료")
    var completed: Bool

    init() {}

    init(eventId: String, completed: Bool) {
        self.eventId = eventId
        self.completed = completed
    }

    func perform() async throws -> some IntentResult {
        // 키체인 읽기가 드물게 실패할 수 있어 한 번 더 시도
        guard let token = SharedKeychain.load() ?? SharedKeychain.load() else {
            log.error("토큰 없음 — 체크 저장 안 함 (\(eventId, privacy: .public))")
            return .result()
        }
        let previous = WidgetStore.isCompleted(eventId: eventId)
        WidgetStore.setCompleted(eventId: eventId, completed: completed)
        WidgetStore.markLocalChange()

        var components = URLComponents(url: SharedConfig.baseURL, resolvingAgainstBaseURL: false)!
        components.path = "/api/v1/calendar/events/\(eventId)/completion"
        var request = URLRequest(url: components.url!, timeoutInterval: 8)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONEncoder().encode(["completed": completed])
        let saved: Bool
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            saved = (200..<300).contains(status)
            if !saved { log.error("체크 저장 실패 HTTP \(status) (\(eventId, privacy: .public))") }
        } catch {
            saved = false
            log.error("체크 저장 실패 \(error.localizedDescription, privacy: .public)")
        }
        if !saved {
            WidgetStore.setCompleted(eventId: eventId, completed: previous ?? !completed)
            WidgetStore.clearLocalChange()
        }
        return .result()
    }
}
