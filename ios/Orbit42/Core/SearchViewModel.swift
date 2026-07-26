import Foundation
import Observation

/// 사람/열린 타임슬롯 검색 상태 관리 (`GET /api/v1/search?q=...`).
/// 쿼리 변경 시 300ms 디바운스 후 검색한다.
@MainActor
@Observable
final class SearchViewModel {
    var query = ""

    /// nil 이면 아직 검색 전 (안내 문구 표시).
    private(set) var results: SearchResponse?
    private(set) var isSearching = false
    private(set) var errorMessage: String?

    /// 내 오르빗 — 검색어가 없을 때 기본 콘텐츠로 보여준다. nil 이면 로딩 전.
    private(set) var orbit: [OrbitPerson]?

    /// 디바운스 중인 검색 작업 — 새 입력이 오면 취소한다.
    private var pendingSearch: Task<Void, Never>?
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// 쿼리가 바뀔 때마다 뷰에서 호출한다 (300ms 디바운스).
    func queryChanged() {
        pendingSearch?.cancel()
        let trimmed = trimmedQuery
        guard !trimmed.isEmpty else {
            results = nil
            errorMessage = nil
            isSearching = false
            return
        }
        pendingSearch = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await self?.search(trimmed)
        }
    }

    /// 검색 화면 진입 시 내 오르빗(팔로우한 사람들의 열린 슬롯)를 불러온다.
    func loadOrbit(force: Bool = false) async {
        if !force, orbit != nil { return }
        do {
            let response: OrbitResponse = try await api.get("/api/v1/orbit")
            orbit = response.people
        } catch {
            // 오르빗은 부가 콘텐츠 — 실패해도 검색 안내만 보여주면 된다.
            if orbit == nil { orbit = [] }
        }
    }

    /// 에러 상태에서 "다시 시도".
    func retry() async {
        let trimmed = trimmedQuery
        guard !trimmed.isEmpty else { return }
        await search(trimmed)
    }

    private func search(_ trimmed: String) async {
        isSearching = true
        errorMessage = nil

        do {
            let response: SearchResponse = try await api.get("/api/v1/search?q=\(Self.encodeQuery(trimmed))")
            // 응답 도착 시점에 쿼리가 이미 바뀌었으면 무시 (뒤늦은 응답이 최신 결과를 덮지 않도록)
            guard trimmedQuery == trimmed else { return }
            results = response
            isSearching = false
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            guard trimmedQuery == trimmed else { return }
            errorMessage = apiError.errorDescription
            isSearching = false
        } catch {
            guard trimmedQuery == trimmed else { return }
            errorMessage = "검색하지 못했어요. 네트워크를 확인해 주세요."
            isSearching = false
        }
    }

    /// APIClient 가 쿼리 문자열을 percentEncodedQuery 로 그대로 쓰므로 값은 미리 인코딩한다.
    private static func encodeQuery(_ raw: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=+?#")
        return raw.addingPercentEncoding(withAllowedCharacters: allowed) ?? raw
    }
}
