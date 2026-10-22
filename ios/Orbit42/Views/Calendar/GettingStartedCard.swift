import SwiftUI

/// 가입 직후 빈 캘린더에 뜨는 "다음에 할 일" 카드 (개선-22).
/// ① 구글 캘린더 연결 ② 첫 일정 만들기 ③ 예약 링크 만들기 — 한 번 눌러 바로 시작한다.
/// 한 항목은 목록에서 빠지고, 셋 다 했거나 닫으면 사라진다(웹 OnboardingChecklist 와 같은 정신).
///
/// 처음 판단할 때 이미 일정이 있던 계정(기존 사용자)에게는 뜨지 않는다 — 그 판단은
/// 계정별로 기기에 한 번 기록해 두고 다시 묻지 않는다.
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

    /// "new" = 빈 계정으로 시작해 카드 대상 / "off" = 기존 사용자·끝냄·닫음 / nil = 아직 판단 전
    private(set) var phase: String?
    private(set) var hadEvent = false

    func bind(username: String?) {
        guard let username, username != self.username else { return }
        self.username = username
        phase = defaults.string(forKey: key("phase"))
        hadEvent = defaults.bool(forKey: key("hadEvent"))
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
        guard phase == "new" else { return }
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
        guard phase == "new", googleConnected != nil, hasLink != nil else { return [] }
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
