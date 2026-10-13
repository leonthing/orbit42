import AppIntents
import Foundation
import WidgetKit

/// 위젯 체크박스 — 앱을 열지 않고 일정을 완료/해제한다.
/// 서버에 저장된 경우에만 캐시를 바꾸므로, 실패하면 다시 그릴 때 체크가 원래대로 남는다.
struct ToggleCompletionIntent: AppIntent {
    static var title: LocalizedStringResource = "일정 완료 체크"
    static var isDiscoverable = false

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
        guard let token = SharedKeychain.load() else { return .result() }
        var components = URLComponents(url: SharedConfig.baseURL, resolvingAgainstBaseURL: false)!
        components.path = "/api/v1/calendar/events/\(eventId)/completion"
        var request = URLRequest(url: components.url!, timeoutInterval: 15)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONEncoder().encode(["completed": completed])
        if let (_, response) = try? await URLSession.shared.data(for: request),
           let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
            WidgetStore.setCompleted(eventId: eventId, completed: completed)
        }
        return .result()
    }
}
