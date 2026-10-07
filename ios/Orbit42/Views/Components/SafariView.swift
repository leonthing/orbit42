import SafariServices
import SwiftUI

/// 앱 안에서 웹 페이지를 여는 Safari 뷰 — 내 공개 페이지처럼 웹과 똑같이 보여야 하는 화면에 쓴다.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let vc = SFSafariViewController(url: url)
        vc.preferredControlTintColor = UIColor(Theme.accent)
        return vc
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// `.sheet(item:)` 로 URL 을 바로 띄우기 위해
struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
