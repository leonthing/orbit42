import Foundation
import Observation

/// 관계 궤도 상태 — 오르빗 탭(궤도·카드)과 캘린더 탭(가로 줄·안부 넛지)이 함께 쓴다.
/// MainTabView 가 하나를 만들어 environment 로 내려준다.
///
/// 흐름: `refresh()` = POST /people/sync(서버가 6시간 간격으로 구글을 다시 읽는다)
/// → GET /people. 켜져 있고 권한이 이미 있으면 기기 캘린더도 6시간마다 다시 보낸다.
@MainActor
@Observable
final class PeopleStore {
    private(set) var data: PeopleOrbitResponse?
    private(set) var isLoading = false
    private(set) var isEnabling = false
    var errorMessage: String?
    /// 액션 실패 안내 (alert)
    var actionMessage: String?

    private let api: APIClient
    private var lastRefresh: Date?

    init(api: APIClient = .shared) {
        self.api = api
    }

    var people: [Contact] { data?.people ?? [] }
    var suggestions: [Contact] { data?.suggestions ?? [] }
    var archived: [Contact] { data?.archived ?? [] }
    var importEnabled: Bool { data?.importEnabled ?? false }

    /// 안부 넛지와 그 사람을 짝지어 돌려준다.
    var nudges: [(nudge: PeopleNudge, person: Contact)] {
        guard let data else { return [] }
        return data.nudges.compactMap { nudge in
            data.people.first(where: { $0.id == nudge.personId }).map { (nudge, $0) }
        }
    }

    func person(id: String) -> Contact? {
        guard let data else { return nil }
        return (data.people + data.suggestions + data.archived).first { $0.id == id }
    }

    // MARK: - 불러오기

    /// 탭을 열 때. 30초 안에 다시 부르면 건너뛴다(force 제외).
    func refresh(force: Bool = false) async {
        if !force, let lastRefresh, Date().timeIntervalSince(lastRefresh) < 30, data != nil { return }
        if isLoading { return }
        isLoading = true
        defer { isLoading = false }
        lastRefresh = Date()

        // 동기화가 실패해도 이전에 쌓인 궤도는 보여줄 수 있으니 무시하고 진행한다.
        let _: OkResponse? = try? await api.post("/api/v1/people/sync", body: PeopleSyncRequest(force: false))
        await reload()

        if importEnabled, DeviceCalendarImporter.isAuthorized, DeviceCalendarImporter.isStale {
            if (try? await DeviceCalendarImporter.run()) != nil {
                await reload()
            }
        }
    }

    /// 동기화 없이 목록만 다시 받는다 (변경 직후).
    func reload() async {
        do {
            let response: PeopleOrbitResponse = try await api.get("/api/v1/people")
            data = response
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch {
            if data == nil {
                errorMessage = (error as? APIError)?.errorDescription
                    ?? "사람들을 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }

    // MARK: - 캘린더에서 사람 찾기

    /// 켜기: 서버가 구글 참석자를 바로 읽고, 기기 캘린더 권한을 물어 함께 보낸다.
    /// 반환값은 기기 캘린더 권한 결과 안내(없으면 nil).
    @discardableResult
    func enableImport() async -> String? {
        isEnabling = true
        defer { isEnabling = false }
        do {
            let _: OkResponse = try await api.put(
                "/api/v1/people/settings", body: PeopleSettingsRequest(importEnabled: true)
            )
        } catch {
            actionMessage = (error as? APIError)?.errorDescription ?? "설정을 바꾸지 못했어요."
            return nil
        }
        var note: String?
        let granted = await DeviceCalendarImporter.requestAccess()
        if granted {
            do {
                try await DeviceCalendarImporter.run(force: true)
            } catch {
                note = (error as? APIError)?.errorDescription ?? "기기 캘린더를 읽지 못했어요."
            }
        } else if data?.googleConnected != true {
            note = "기기 캘린더 접근이 꺼져 있어요. 설정 앱 > Orbit42 > 캘린더에서 켜면 함께 찾아드려요."
        }
        await reload()
        return note
    }

    func disableImport() async {
        isEnabling = true
        defer { isEnabling = false }
        do {
            let _: OkResponse = try await api.put(
                "/api/v1/people/settings", body: PeopleSettingsRequest(importEnabled: false)
            )
            DeviceCalendarImporter.resetStamp()
            await reload()
        } catch {
            actionMessage = (error as? APIError)?.errorDescription ?? "설정을 바꾸지 못했어요."
        }
    }

    // MARK: - 변경

    func resolve(_ ids: [String], accept: Bool) async {
        guard !ids.isEmpty else { return }
        await perform {
            let _: OkResponse = try await self.api.post(
                "/api/v1/people/suggestions",
                body: ResolveSuggestionsRequest(ids: ids, action: accept ? "accept" : "dismiss")
            )
        }
    }

    func update(_ id: String, _ patch: ContactPatch) async -> Bool {
        await perform {
            let _: OkResponse = try await self.api.patch("/api/v1/people/\(id)", body: patch)
        }
    }

    func add(_ request: AddContactRequest) async -> Bool {
        await perform {
            let _: ContactIdResponse = try await self.api.post("/api/v1/people", body: request)
        }
    }

    func logMeeting(_ id: String, title: String?, at: Date, minutes: Int) async -> Bool {
        await perform {
            let _: OkResponse = try await self.api.post(
                "/api/v1/people/\(id)/meetings",
                body: LogMeetingRequest(
                    title: title,
                    at: APIDateParser.encodeDateTime(at),
                    minutes: minutes
                )
            )
        }
    }

    func deleteMeeting(_ meetingId: String) async -> Bool {
        await perform {
            let _: OkResponse = try await self.api.delete("/api/v1/people/meetings/\(meetingId)")
        }
    }

    func detail(_ id: String) async throws -> ContactDetailResponse {
        try await api.get("/api/v1/people/\(id)")
    }

    /// 새 일정·예약이 생긴 뒤 — 서버가 참석자를 다시 읽게 하고 목록을 갱신한다.
    func resync() async {
        let _: OkResponse? = try? await api.post("/api/v1/people/sync", body: PeopleSyncRequest(force: false))
        await reload()
    }

    @discardableResult
    private func perform(_ work: @escaping () async throws -> Void) async -> Bool {
        do {
            try await work()
            await reload()
            return true
        } catch {
            actionMessage = (error as? APIError)?.errorDescription ?? "저장하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }
}
