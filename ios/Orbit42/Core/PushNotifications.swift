import Foundation
import UIKit
import UserNotifications

/// 앱 푸시 (1.8.0 예약 대화).
/// - 권한은 앱을 켤 때 묻지 않는다. 대화 화면을 처음 열 때·예약을 처음 만들었을 때 `askIfNeeded()`로 묻는다.
/// - 허용되면 기기 토큰을 받아 `POST /api/v1/push/devices`에 등록하고, 로그아웃할 때 `DELETE`로 지운다.
/// - 알림 문구는 서버가 정한다("새 메시지가 있어요"). 누르면 그 예약의 대화로 간다(NotificationTapHandler).
/// - 서버에 APNs 키가 들어가기 전에는 등록만 되고 알림은 오지 않는다(메일로 알린다).
@MainActor
final class PushNotifications {
    static let shared = PushNotifications()

    private let tokenKey = "push.deviceToken"
    private let center = UNUserNotificationCenter.current()

    /// 마지막으로 서버에 등록한 토큰 (로그아웃 때 지우려고 기기에 둔다)
    private var savedToken: String? {
        get { UserDefaults.standard.string(forKey: tokenKey) }
        set { UserDefaults.standard.set(newValue, forKey: tokenKey) }
    }

    /// 아직 묻지 않았으면 묻고, 허용돼 있으면 토큰을 (다시) 받는다. 로그인·둘러보기 아님일 때만.
    func askIfNeeded() async {
        guard !BrowseGate.isOn, KeychainStore.loadToken() != nil else { return }
        let status = await center.notificationSettings().authorizationStatus
        switch status {
        case .notDetermined:
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            if granted { UIApplication.shared.registerForRemoteNotifications() }
        case .authorized, .provisional, .ephemeral:
            UIApplication.shared.registerForRemoteNotifications()
        default:
            break
        }
    }

    /// 앱을 켤 때: 이미 허용된 경우에만 토큰을 새로 받는다(묻지 않는다). 토큰은 바뀔 수 있어서.
    func refreshIfAuthorized() async {
        guard !BrowseGate.isOn, KeychainStore.loadToken() != nil else { return }
        let status = await center.notificationSettings().authorizationStatus
        if status == .authorized || status == .provisional || status == .ephemeral {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard KeychainStore.loadToken() != nil, !BrowseGate.isOn else { return }
        savedToken = token
        Task {
            let _: OkResponse? = try? await APIClient.shared.post(
                "/api/v1/push/devices",
                body: PushDeviceBody(token: token, env: Self.apnsEnv, appVersion: Self.appVersion)
            )
        }
    }

    /// 로그아웃 직전에 부른다 — 로그인 토큰을 지우기 전에 서버의 기기 토큰을 먼저 지운다.
    func unregisterBeforeLogout() {
        guard let token = savedToken else { return }
        savedToken = nil
        APIClient.shared.fireAndForgetDelete("/api/v1/push/devices", body: PushDeviceDeleteBody(token: token))
        UIApplication.shared.unregisterForRemoteNotifications()
    }

    /// Xcode 디버그 빌드는 sandbox, TestFlight·스토어 빌드는 production
    static var apnsEnv: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    static var appVersion: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
        let b = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"
        return "\(v)(\(b))"
    }
}

private struct PushDeviceBody: Encodable {
    let token: String
    let env: String
    let appVersion: String
}

private struct PushDeviceDeleteBody: Encodable {
    let token: String
}

/// 시스템이 기기 토큰을 돌려주는 곳
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        MainActor.assumeIsolated { PushNotifications.shared.didRegister(deviceToken: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // 엔타이틀먼트(aps-environment)가 없는 빌드·시뮬레이터에서는 여기로 온다 — 메일 알림은 그대로
        print("[push] register failed:", error.localizedDescription)
    }
}
