import Foundation

/// 예약 링크·링크 페이지 주소를 처음 공유/복사했을 때 서버에 한 번 알린다 (1.6.0 ① — 지표 '가입 7일 안 링크 공유 비율').
/// 서버는 비어 있을 때만 시각을 적고(덮어쓰지 않음), 기기는 계정별로 한 번 보낸 뒤 다시 보내지 않는다.
/// 둘러보기 중에는 APIClient 가 보내지 않는다.
enum LinkShareRecorder {
    private struct Empty: Encodable {}

    @MainActor
    static func record(username: String?) {
        guard let username, !BrowseGate.isOn else { return }
        let key = "linkShared.recorded.\(username)"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        APIClient.shared.fireAndForget("/api/v1/me/link-shared", body: Empty())
    }
}

import UIKit

/// 시스템 공유 시트를 맨 위 화면에서 연다 — 메뉴 안에서도 누른 순간을 알 수 있게 ShareLink 대신 쓴다
@MainActor
enum ShareSheet {
    static func present(_ items: [Any]) {
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first else { return }
        var top = root
        while let presented = top.presentedViewController, !presented.isBeingDismissed { top = presented }
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        vc.popoverPresentationController?.sourceView = top.view
        vc.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
        top.present(vc, animated: true)
    }

    /// 내 예약 링크·링크 페이지 공유 — 처음이면 기록하고 공유 시트
    static func shareMyLink(_ url: URL, username: String?) {
        LinkShareRecorder.record(username: username)
        present([url])
    }
}
