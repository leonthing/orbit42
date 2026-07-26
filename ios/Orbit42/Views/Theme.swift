import SwiftUI

/// orbit42 다크 테마 팔레트.
enum Theme {
    /// 배경 차콜 (#1a1a1f)
    static let background = Color(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1F / 255)
    /// 카드/입력 필드 표면 (#25252c)
    static let surface = Color(red: 0x25 / 255, green: 0x25 / 255, blue: 0x2C / 255)
    /// 액센트 인디고 (#6366f1)
    static let accent = Color(red: 0x63 / 255, green: 0x66 / 255, blue: 0xF1 / 255)
    /// 보조 텍스트
    static let secondaryText = Color.white.opacity(0.55)
}
