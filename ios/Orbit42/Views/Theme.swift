import SwiftUI
import UIKit

/// orbit42 팔레트 — 라이트/다크 적응형.
/// 다크가 기본 디자인이고, 라이트는 같은 위계(배경 < 표면 < 텍스트)를 뒤집어 얻는다.
enum Theme {
    private static func dynamic(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? dark : light
        })
    }

    /// 배경 — 다크 #1a1a1f / 라이트 systemGroupedBackground 톤
    static let background = dynamic(
        light: UIColor(red: 0.95, green: 0.95, blue: 0.97, alpha: 1),
        dark: UIColor(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1F / 255, alpha: 1)
    )
    /// 카드/입력 필드 표면 — 다크 #25252c / 라이트 흰색
    static let surface = dynamic(
        light: .white,
        dark: UIColor(red: 0x25 / 255, green: 0x25 / 255, blue: 0x2C / 255, alpha: 1)
    )
    /// 액센트 인디고 (#6366f1) — 양쪽 공통
    static let accent = Color(red: 0x63 / 255, green: 0x66 / 255, blue: 0xF1 / 255)
    /// 본문 텍스트 — 다크 흰색 / 라이트 진회색
    static let primaryText = dynamic(
        light: UIColor(red: 0.09, green: 0.09, blue: 0.11, alpha: 1),
        dark: .white
    )
    /// 보조 텍스트
    static let secondaryText = dynamic(
        light: UIColor.black.withAlphaComponent(0.5),
        dark: UIColor.white.withAlphaComponent(0.55)
    )

    /// 기존 `Color.white.opacity(x)` 자리 — 은은한 채움/구분선.
    /// 다크에서는 흰색 기반, 라이트에서는 검정 기반으로 뒤집는다.
    static func fill(_ opacity: Double) -> Color {
        dynamic(
            light: UIColor.black.withAlphaComponent(opacity),
            dark: UIColor.white.withAlphaComponent(opacity)
        )
    }
}
