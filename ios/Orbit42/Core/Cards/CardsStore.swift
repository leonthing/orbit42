import AuthenticationServices
import Foundation
import Observation
import UIKit

// 명함 → 구글 연락처(1차, 허용 계정만). 서버가 404 면 기능이 없는 것으로 보고 진입점도 숨긴다(fail closed).

struct CardsStatus: Decodable { let connected: Bool; let email: String? }
struct CardsConnectURL: Decodable { let url: String }

struct CardCandidate: Decodable, Identifiable, Hashable {
    let resourceName: String
    let name: String
    let company: String
    let title: String
    let phones: [String]
    let emails: [String]
    let reasons: [String]
    let nameDiffers: Bool
    var id: String { resourceName }
}

struct CardSuggested: Decodable { let kind: String; let resourceName: String? }
struct CardMatchResponse: Decodable { let candidates: [CardCandidate]; let suggested: CardSuggested }
struct CardSaveResponse: Decodable { let ok: Bool; let kind: String?; let resourceName: String?; let name: String? }
struct CardSaveConflict: Decodable { let error: String?; let reason: String?; let candidates: [CardCandidate]? }

private struct CardMatchBody: Encodable { let card: CardDraft; let recent: [String] }
private struct CardDisconnectBody: Encodable { let revokeAll: Bool }

enum CardSaveOutcome {
    case saved(kind: String, name: String)
    case recheck(message: String, candidates: [CardCandidate])
    case failed(String)
}

@MainActor
@Observable
final class CardsStore {
    static let shared = CardsStore()

    /// nil = 아직 모름, false = 이 계정에는 없음(404)
    private(set) var available: Bool?
    private(set) var status: CardsStatus?
    private(set) var busy = false
    var message: String?

    private let api: APIClient
    private let presentation = WebAuthPresentationContext()
    private var webSession: ASWebAuthenticationSession?

    init(api: APIClient = .shared) { self.api = api }

    /// 설정 화면이 열릴 때 — 허용 계정인지와 연결 상태(연결돼 있으면 서버가 검색 색인도 깨운다)
    func refresh() async {
        do {
            let s: CardsStatus = try await api.get("/api/v1/cards/status")
            status = s
            available = true
        } catch let APIError.server(_, code) where code == 404 {
            available = false
            status = nil
        } catch {
            // 네트워크 오류 등 — 모르는 상태로 두면 진입점이 안 보인다(닫힌 쪽)
            if available == nil { available = false }
        }
    }

    // MARK: 연결·해제

    func connect() async {
        guard !busy else { return }
        busy = true
        defer { busy = false; webSession = nil }
        do {
            let r: CardsConnectURL = try await api.get("/api/v1/cards/connect-url")
            guard let url = URL(string: r.url) else { throw APIError.invalidResponse }
            let cb = try await authenticate(url)
            if cb.host == "cards-connected" {
                await refresh()
            } else {
                let reason = URLComponents(url: cb, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "reason" }?.value ?? ""
                message = Self.connectError(reason)
            }
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch let e as APIError {
            message = e.errorDescription
        } catch {
            message = "연결하지 못했어요. 잠시 뒤 다시 해 주세요."
        }
    }

    static func connectError(_ reason: String) -> String {
        switch reason {
        case "missing_scopes": return "연락처·Drive 권한이 모두 허용되지 않아 연결하지 않았어요. 다시 연결하면서 Google 화면의 항목을 모두 체크해 주세요."
        case "access_denied": return "Google 화면에서 취소했어요."
        case "admin_policy_enforced": return "회사(Workspace) 관리자 설정 때문에 Google이 이 권한을 막았어요."
        default: return "연결하지 못했어요. 잠시 뒤 다시 해 주세요."
        }
    }

    func disconnect(revokeAll: Bool) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let _: AckResponse = try await api.post("/api/v1/cards/disconnect", body: CardDisconnectBody(revokeAll: revokeAll))
            await refresh()
        } catch let e as APIError {
            message = e.errorDescription
        } catch {
            message = "해제하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    private func authenticate(_ url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: "orbit42") { u, e in
                if let u { cont.resume(returning: u) } else { cont.resume(throwing: e ?? APIError.invalidResponse) }
            }
            s.presentationContextProvider = presentation
            webSession = s
            s.start()
        }
    }

    // MARK: 찾기·저장

    func match(_ d: CardDraft) async throws -> CardMatchResponse {
        try await api.post("/api/v1/cards/match", body: CardMatchBody(card: d, recent: CardsRecent.matching(d)))
    }

    func save(_ d: CardDraft, choice: CardSuggested, seen: [String], photos: [UIImage]) async -> CardSaveOutcome {
        let enc = JSONEncoder()
        func json<T: Encodable>(_ v: T) -> String { String(data: (try? enc.encode(v)) ?? Data("null".utf8), encoding: .utf8) ?? "null" }
        struct Choice: Encodable { let kind: String; let resourceName: String? }
        var files: [(name: String, fileName: String, mimeType: String, data: Data)] = []
        for (i, img) in photos.prefix(2).enumerated() {
            if let data = CardImage.jpeg(img) { files.append((i == 0 ? "front" : "back", "\(i).jpg", "image/jpeg", data)) }
        }
        do {
            let (status, data) = try await api.multipartRaw(
                "/api/v1/cards/save",
                fields: [
                    "card": json(d),
                    "choice": json(Choice(kind: choice.kind, resourceName: choice.resourceName)),
                    "seen": json(seen),
                    "recent": json(CardsRecent.matching(d)),
                ],
                files: files
            )
            if status == 200, let r = try? JSONDecoder().decode(CardSaveResponse.self, from: data), r.ok {
                if r.kind == "created", let rn = r.resourceName { CardsRecent.remember(rn, d) }
                return .saved(kind: r.kind ?? "", name: r.name ?? d.name)
            }
            let c = try? JSONDecoder().decode(CardSaveConflict.self, from: data)
            if status == 409, c?.reason == "new_candidates" {
                return .recheck(message: c?.error ?? "같은 사람으로 보이는 연락처가 새로 보여요. 다시 골라 주세요.", candidates: c?.candidates ?? [])
            }
            if status == 409, c?.reason == nil, String(data: data, encoding: .utf8)?.contains("not_connected") == true {
                await refresh()
            }
            return .failed(c?.error ?? "저장하지 못했어요. (오류 \(status))")
        } catch let e as APIError {
            return .failed(e.errorDescription ?? "저장하지 못했어요.")
        } catch {
            return .failed("저장하지 못했어요. 네트워크를 확인해 주세요.")
        }
    }
}

/// 앱이 최근에 만든 연락처(최근 50건) — 구글 검색 색인이 새 연락처를 늦게 잡는 것을 메운다.
/// 기기에만 둔다: resourceName 과 정규화한 휴대폰·메일만(이름 없음).
enum CardsRecent {
    private static let key = "cards.recent.v1"
    private struct Item: Codable { let rn: String; let keys: [String]; let at: Date }

    static func keys(_ d: CardDraft) -> [String] {
        var k: [String] = []
        var m = d.mobile.filter(\.isNumber)
        if m.hasPrefix("82") { m = "0" + m.dropFirst(2) }
        if m.hasPrefix("01"), m.count >= 10 { k.append("m:" + m) }
        k += d.emails.map { "e:" + $0.lowercased() }
        return k
    }

    private static func load() -> [Item] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([Item].self, from: data)) ?? []
    }

    static func remember(_ rn: String, _ d: CardDraft) {
        var items = load().filter { $0.rn != rn }
        items.insert(Item(rn: rn, keys: keys(d), at: Date()), at: 0)
        if let data = try? JSONEncoder().encode(Array(items.prefix(50))) { UserDefaults.standard.set(data, forKey: key) }
    }

    static func matching(_ d: CardDraft) -> [String] {
        let k = Set(keys(d))
        guard !k.isEmpty else { return [] }
        return load().filter { !k.isDisjoint(with: $0.keys) }.map(\.rn)
    }
}

/// 실명함 정확도(PO 11/15): 저장할 때 인식값과 달라진 칸 이름만 센다 — 내용은 남기지 않는다. 기기 안에만.
enum CardFixCounter {
    private static let key = "cards.fixCounts.v1"
    static let fields: [(String, String)] = [
        ("name", "이름"), ("company", "회사"), ("department", "부서"), ("title", "직함"), ("mobile", "휴대폰"),
        ("workPhone", "회사전화"), ("fax", "팩스"), ("emails", "이메일"), ("address", "주소"), ("website", "웹"),
    ]

    static var counts: [String: Int] {
        (UserDefaults.standard.dictionary(forKey: key) as? [String: Int]) ?? [:]
    }

    static func record(parsed: CardDraft, saved: CardDraft) {
        var c = counts
        c["_cards", default: 0] += 1
        func diff(_ a: String, _ b: String) -> Bool {
            a.trimmingCharacters(in: .whitespaces) != b.trimmingCharacters(in: .whitespaces)
        }
        let pairs: [(String, Bool)] = [
            ("name", diff(parsed.name, saved.name)), ("company", diff(parsed.company, saved.company)),
            ("department", diff(parsed.department, saved.department)), ("title", diff(parsed.title, saved.title)),
            ("mobile", diff(parsed.mobile, saved.mobile)), ("workPhone", diff(parsed.workPhone, saved.workPhone)),
            ("fax", diff(parsed.fax, saved.fax)), ("emails", parsed.emails != saved.emails),
            ("address", diff(parsed.address, saved.address)), ("website", diff(parsed.website, saved.website)),
        ]
        for (k, changed) in pairs where changed { c[k, default: 0] += 1 }
        UserDefaults.standard.set(c, forKey: key)
    }

    static func reset() { UserDefaults.standard.removeObject(forKey: key) }
}

enum CardImage {
    /// 긴 변 1600px, JPEG 0.7 — 보통 300~600KB(서버 한도 2MB)
    static func jpeg(_ img: UIImage) -> Data? {
        let maxSide: CGFloat = 1600
        let s = img.size
        let scale = min(1, maxSide / max(s.width, s.height))
        let size = CGSize(width: floor(s.width * scale), height: floor(s.height * scale))
        let fmt = UIGraphicsImageRendererFormat.default()
        fmt.scale = 1
        let out = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        var q: CGFloat = 0.7
        var data = out.jpegData(compressionQuality: q)
        while let d = data, d.count > 1_800_000, q > 0.3 { q -= 0.15; data = out.jpegData(compressionQuality: q) }
        return data
    }
}
