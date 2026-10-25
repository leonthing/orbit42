import SwiftUI
import UIKit

/// APIClient(메인 액터 밖)에서 읽는 둘러보기 표시 — 켜져 있으면 서버로 아무것도 보내지 않는다.
enum BrowseGate {
    static var isOn = false
}

/// 가입 없이 둘러보기 (개선-47).
/// 로그인 화면의 '가입 없이 둘러보기'로 들어오면 앱 안의 예시 데이터(BrowseFixtures)로 탭을 돌아본다.
/// - 읽기: APIClient 가 예시 JSON 을 돌려준다(서버에 묻지 않음).
/// - 쓰기(저장·끌기·링크 만들기·팔로우·예약 등): 보내지 않고 "가입하면 내 캘린더에 저장돼요" 시트를 띄운다.
/// - 가입·로그인으로 나가면 예시 상태를 지우고 평소 흐름(온보딩)으로 간다.
/// 기록은 둘러보기 시작·둘러보기에서 가입 두 숫자만, 날짜별로 익명 집계한다.
@MainActor
@Observable
final class BrowseMode {
    static let shared = BrowseMode()

    private(set) var active = false
    /// 둘러보기에서 가입·로그인으로 나간 직후 — 새 계정이 생기면 한 번 센다
    private(set) var cameFromBrowse = false
    /// 나갈 때 고른 곳 — RootView 가 한 번 읽고 비운다 (true 가입 / false 로그인)
    private var exitIntent: Bool?

    func takeExitIntent() -> Bool? {
        defer { exitIntent = nil }
        return exitIntent
    }

    private weak var promptController: UIViewController?

    func start() {
        BrowseGate.isOn = true
        active = true
        Self.report("start")
    }

    /// 둘러보기를 끝낸다 — signup: 가입 폼(true)·로그인 폼(false), nil 이면 그냥 끝냄
    func end(toSignup: Bool?) {
        dismissPrompt(animated: false)
        BrowseGate.isOn = false
        active = false
        if let toSignup {
            exitIntent = toSignup
            cameFromBrowse = true
        }
        // 둘러보는 동안 기기에 남은 예시 계정 값(카드 상태 등)을 지운다
        let defaults = UserDefaults.standard
        for key in defaults.dictionaryRepresentation().keys where key.contains(BrowseFixtures.username) {
            defaults.removeObject(forKey: key)
        }
    }

    /// 새 계정이 만들어졌을 때(온보딩 시작) 한 번 — 둘러보기에서 넘어왔으면 '가입'을 센다
    func noteNewAccount() {
        guard cameFromBrowse else { return }
        cameFromBrowse = false
        Self.report("signup")
    }

    /// 저장하는 동작을 했을 때 — 맨 위 화면 위로 가입 안내 시트를 띄운다(열려 있는 시트 위에도 뜨게 UIKit 으로)
    func promptSignup() {
        guard active, promptController == nil,
              let root = UIApplication.shared.connectedScenes
                .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first
        else { return }
        var top = root
        while let presented = top.presentedViewController, !presented.isBeingDismissed { top = presented }
        let host = UIHostingController(rootView: BrowseSignupSheet(
            onSignup: { [weak self] in self?.leave(toSignup: true) },
            onLogin: { [weak self] in self?.leave(toSignup: false) },
            onKeepBrowsing: { [weak self] in self?.dismissPrompt(animated: true) }
        ))
        if let sheet = host.sheetPresentationController {
            sheet.detents = [.medium()]
            sheet.prefersGrabberVisible = true
        }
        promptController = host
        top.present(host, animated: true)
    }

    /// 가입하기·로그인 — 열린 화면을 모두 닫고 둘러보기를 끝낸다
    func leave(toSignup: Bool) {
        let finish = { [weak self] in
            guard let self else { return }
            self.end(toSignup: toSignup)
            NotificationCenter.default.post(name: Self.didLeave, object: nil)
        }
        if let root = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first,
           root.presentedViewController != nil {
            root.dismiss(animated: true) { finish() }
        } else {
            finish()
        }
    }

    static let didLeave = Notification.Name("orbit42.browse.didLeave")

    private func dismissPrompt(animated: Bool) {
        promptController?.dismiss(animated: animated)
        promptController = nil
    }

    /// 익명 집계 — 날짜·단계별 횟수만. APIClient 를 거치지 않고(둘러보기 차단 밖) 응답도 기다리지 않는다.
    private static func report(_ step: String) {
        var request = URLRequest(url: APIClient.shared.baseURL.appendingPathComponent("api/v1/browse-stat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["step": step])
        URLSession.shared.dataTask(with: request).resume()
    }
}

/// "가입하면 내 캘린더에 저장돼요"
struct BrowseSignupSheet: View {
    let onSignup: () -> Void
    let onLogin: () -> Void
    let onKeepBrowsing: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Theme.accent)
                .padding(.top, 28)
            Text("가입하면 내 캘린더에 저장돼요")
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.primaryText)
            Text("지금은 예시 화면이라 저장되지 않아요.\n가입하면 내 일정과 예약 링크로 바로 시작할 수 있어요.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
                .multilineTextAlignment(.center)
            Spacer(minLength: 8)
            Button(action: onSignup) {
                Text("가입하기")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(.white)
            }
            .accessibilityIdentifier("browseSignup")
            HStack(spacing: 20) {
                Button("이미 계정이 있어요", action: onLogin)
                Button("계속 둘러보기", action: onKeepBrowsing)
                    .foregroundStyle(Theme.secondaryText)
            }
            .font(.subheadline.weight(.medium))
            .padding(.bottom, 12)
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.ignoresSafeArea())
    }
}

/// 둘러보기에서 손님 화면을 보여 줄 때 위에 붙는 한 줄
struct GuestPreviewHint: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "person.crop.circle.badge.checkmark")
            Text("손님에게 이렇게 보여요 — 내 링크를 받은 사람이 보는 화면이에요")
                .lineLimit(2)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(Theme.accent)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Theme.accent.opacity(0.1))
        .accessibilityIdentifier("guestPreviewHint")
    }
}

/// 둘러보는 동안 화면 위에 늘 있는 띠
struct BrowseBanner: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "eye")
                .font(.footnote.weight(.semibold))
            Text("둘러보는 중")
                .font(.footnote.weight(.semibold))
            Text("· 예시 화면이에요")
                .font(.footnote)
                .opacity(0.85)
            Spacer()
            Button {
                BrowseMode.shared.leave(toSignup: true)
            } label: {
                Text("가입하기")
                    .font(.footnote.weight(.bold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(.white, in: Capsule())
                    .foregroundStyle(Theme.accent)
            }
            .accessibilityIdentifier("browseBannerSignup")
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Theme.accent)
    }
}
