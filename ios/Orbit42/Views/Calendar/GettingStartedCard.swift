import SwiftUI

/// 가입 직후 빈 캘린더에 뜨는 "다음에 할 일" 카드 (개선-22).
/// ① 구글 캘린더 연결 ② 첫 일정 만들기 ③ 예약 링크 만들기 — 한 번 눌러 바로 시작한다.
/// 한 항목은 목록에서 빠지고, 셋 다 했거나 닫으면 사라진다(웹 OnboardingChecklist 와 같은 정신).
///
/// 대상: 가입 14일 안 + 세 단계 중 남은 것이 있을 때 (개선-35). 구글을 연결해 일정이 들어온 새 가입자도 본다.
/// 가입한 지 오래된 기존 사용자에게는 저절로 뜨지 않는다. 닫아도 예약 탭 빈 화면에서 다시 열 수 있다.
/// 가입일을 주지 않는 옛 서버에서는 예전 규칙(처음 볼 때 일정이 없던 계정만)을 쓴다.
@MainActor
@Observable
final class GettingStartedState {
    enum Step: String, CaseIterable, Identifiable {
        case google, event, link
        var id: String { rawValue }
        var title: String {
            switch self {
            case .google: return "구글 캘린더 연결하기"
            case .event: return "첫 일정 만들기"
            case .link: return "예약 링크 만들기"
            }
        }
        var subtitle: String {
            switch self {
            case .google: return "쓰던 일정을 그대로 불러와요"
            case .event: return "오늘 할 일을 하나 적어 보세요"
            case .link: return "링크를 보내면 상대가 시간을 골라 예약해요"
            }
        }
        var systemImage: String {
            switch self {
            case .google: return "arrow.triangle.2.circlepath"
            case .event: return "plus.circle"
            case .link: return "link"
            }
        }
    }

    /// nil = 아직 모름(불러오는 중)
    private(set) var googleConnected: Bool?
    private(set) var hasLink: Bool?
    let google = GoogleSettingsViewModel()

    private let api: APIClient
    private var username: String?
    private let defaults = UserDefaults.standard

    init(api: APIClient = .shared) { self.api = api }

    private func key(_ name: String) -> String { "gettingStarted.\(name).\(username ?? "-")" }

    /// (옛 서버용) "new" = 빈 계정으로 시작해 카드 대상 / "off" = 기존 사용자·끝냄·닫음 / nil = 아직 판단 전
    private(set) var phase: String?
    private(set) var hadEvent = false
    /// 가입 시각 — 있으면 '가입 14일 안'으로 대상을 정한다
    private var createdAt: Date?
    /// 사용자가 닫음 / 닫은 뒤 다시 엶(14일이 지나도 보인다)
    private(set) var dismissed = false
    private(set) var reopened = false

    static let eligibleDays: Double = 14

    func bind(username: String?, createdAt: String? = nil) {
        guard let username else { return }
        if let createdAt { self.createdAt = Self.parseDate(createdAt) }
        guard username != self.username else { reloadFlags(); return }
        self.username = username
        phase = defaults.string(forKey: key("phase"))
        hadEvent = defaults.bool(forKey: key("hadEvent"))
        reloadFlags()
    }

    /// 다른 화면(예약 탭)에서 다시 열었을 수 있으니 기기 값을 다시 읽는다
    func reloadFlags() {
        dismissed = defaults.bool(forKey: key("dismissed"))
        reopened = defaults.bool(forKey: key("reopened"))
    }

    /// 지금 카드를 보여 줄 대상인지 (남은 단계는 따로 본다)
    var eligible: Bool {
        if dismissed { return false }
        if reopened { return true }
        if let createdAt { return Date().timeIntervalSince(createdAt) < Self.eligibleDays * 86_400 }
        return phase == "new"
    }

    private static func parseDate(_ raw: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: raw) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: raw)
    }

    /// 닫은 카드를 다시 열기 (예약 탭 빈 화면 등) — 계정별 기기 값
    static func reopen(username: String) {
        let d = UserDefaults.standard
        d.set(false, forKey: "gettingStarted.dismissed.\(username)")
        d.set(true, forKey: "gettingStarted.reopened.\(username)")
    }

    /// 사용자가 닫은 적이 있고 아직 다시 열지 않았는지 — 다시 열기 버튼을 보일지
    static func wasDismissed(username: String?) -> Bool {
        guard let username else { return false }
        return UserDefaults.standard.bool(forKey: "gettingStarted.dismissed.\(username)")
    }

    /// 표시 중인 달(과 앞뒤 달)에 일정이 하나라도 있는지 — 처음이면 카드 대상인지도 여기서 정한다.
    func observeEvents(any: Bool) {
        guard username != nil else { return }
        if phase == nil {
            phase = any ? "off" : "new"
            defaults.set(phase, forKey: key("phase"))
        }
        if any && !hadEvent {
            hadEvent = true
            defaults.set(true, forKey: key("hadEvent"))
        }
        finishIfDone()
    }

    func refresh() async {
        guard eligible else { return }
        await google.load(force: true)
        if let status = google.status { googleConnected = status.connected }
        if let response: SlotsResponse = try? await api.get("/api/v1/slots") {
            hasLink = !response.slots.isEmpty
        }
        finishIfDone()
    }

    func connectGoogle() async {
        await google.connect()
        googleConnected = google.status?.connected ?? googleConnected
        finishIfDone()
    }

    func dismiss() {
        phase = "off"
        defaults.set("off", forKey: key("phase"))
        dismissed = true
        reopened = false
        defaults.set(true, forKey: key("dismissed"))
        defaults.set(false, forKey: key("reopened"))
    }

    func isDone(_ step: Step) -> Bool {
        switch step {
        case .google: return googleConnected == true
        case .event: return hadEvent
        case .link: return hasLink == true
        }
    }

    /// 남은 항목 — 구글·링크 상태를 아직 모르면 비워 둬서 깜빡이지 않게 한다.
    var pending: [Step] {
        guard eligible, googleConnected != nil, hasLink != nil else { return [] }
        return Step.allCases.filter { !isDone($0) }
    }

    var doneCount: Int { Step.allCases.filter(isDone).count }

    private func finishIfDone() {
        guard phase == "new", googleConnected == true, hasLink == true, hadEvent else { return }
        phase = "off"
        defaults.set("off", forKey: key("phase"))
    }
}

struct GettingStartedCard: View {
    let state: GettingStartedState
    let onAddEvent: () -> Void
    let onCreateLink: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("다음에 할 일")
                        .font(.headline)
                        .foregroundStyle(Theme.primaryText)
                    Text("\(state.doneCount)/3 완료 · 하나씩 눌러 바로 시작해요")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                Button {
                    withAnimation { state.dismiss() }
                } label: {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("다음에 할 일 닫기")
            }

            ForEach(state.pending) { step in
                Button {
                    switch step {
                    case .google: Task { await state.connectGoogle() }
                    case .event: onAddEvent()
                    case .link: onCreateLink()
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: step.systemImage)
                            .font(.body.weight(.medium))
                            .foregroundStyle(Theme.accent)
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.primaryText)
                            Text(step.subtitle)
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        Spacer(minLength: 8)
                        if step == .google && state.google.isConnecting {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Theme.background, in: RoundedRectangle(cornerRadius: 12))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(step == .google && state.google.isConnecting)
            }
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .alert("안내", isPresented: Binding(
            get: { state.google.actionMessage != nil },
            set: { if !$0 { state.google.actionMessage = nil } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(state.google.actionMessage ?? "")
        }
    }
}
