import SwiftUI

/// SNS 브랜드 아이콘 — SF Symbols 에는 브랜드 로고가 없어 직접 그린다.
/// 웹 공개 프로필(PublicLinkProfile)과 같은 24×24 형태를 맞춘다.
struct SocialIcon: View {
    let kind: SocialLinkKind
    var size: CGFloat = 20

    var body: some View {
        Group {
            switch kind {
            case .instagram: InstagramGlyph()
            case .x: XGlyph()
            case .youtube: YouTubeGlyph()
            case .facebook: FacebookGlyph()
            case .linkedin: LinkedInGlyph()
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - 개별 글리프 (24×24 기준을 GeometryReader 로 스케일)

private struct InstagramGlyph: View {
    var body: some View {
        GeometryReader { proxy in
            let s = proxy.size.width / 24
            ZStack {
                RoundedRectangle(cornerRadius: 5 * s)
                    .strokeBorder(Color.primary, lineWidth: 1.9 * s)
                    .frame(width: 18 * s, height: 18 * s)
                Circle()
                    .strokeBorder(Color.primary, lineWidth: 1.9 * s)
                    .frame(width: 8 * s, height: 8 * s)
                Circle()
                    .fill(Color.primary)
                    .frame(width: 2.4 * s, height: 2.4 * s)
                    .offset(x: 5.5 * s, y: -5.5 * s)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }
}

/// X (구 트위터) 로고 — 원본 SVG path 를 직선으로 옮겨 그린다.
private struct XGlyph: View {
    var body: some View {
        GeometryReader { proxy in
            let s = proxy.size.width / 24
            Path { path in
                // 바깥 획
                path.move(to: CGPoint(x: 18.9 * s, y: 2 * s))
                path.addLine(to: CGPoint(x: 22 * s, y: 2 * s))
                path.addLine(to: CGPoint(x: 14.7 * s, y: 10.3 * s))
                path.addLine(to: CGPoint(x: 23 * s, y: 22 * s))
                path.addLine(to: CGPoint(x: 16.2 * s, y: 22 * s))
                path.addLine(to: CGPoint(x: 10.9 * s, y: 15.1 * s))
                path.addLine(to: CGPoint(x: 4.8 * s, y: 22 * s))
                path.addLine(to: CGPoint(x: 1.7 * s, y: 22 * s))
                path.addLine(to: CGPoint(x: 9.5 * s, y: 13.1 * s))
                path.addLine(to: CGPoint(x: 1 * s, y: 2 * s))
                path.addLine(to: CGPoint(x: 8 * s, y: 2 * s))
                path.addLine(to: CGPoint(x: 12.8 * s, y: 8.3 * s))
                path.closeSubpath()
                // 안쪽 빈 공간 (even-odd 로 뚫린다)
                path.move(to: CGPoint(x: 17.7 * s, y: 20 * s))
                path.addLine(to: CGPoint(x: 19.6 * s, y: 20 * s))
                path.addLine(to: CGPoint(x: 7.4 * s, y: 3.9 * s))
                path.addLine(to: CGPoint(x: 5.4 * s, y: 3.9 * s))
                path.closeSubpath()
            }
            .fill(Color.primary, style: FillStyle(eoFill: true))
        }
    }
}

private struct YouTubeGlyph: View {
    var body: some View {
        GeometryReader { proxy in
            let s = proxy.size.width / 24
            ZStack {
                RoundedRectangle(cornerRadius: 5 * s)
                    .fill(Color.primary)
                    .frame(width: 20 * s, height: 14 * s)
                Path { path in
                    path.move(to: CGPoint(x: 10 * s, y: 9 * s))
                    path.addLine(to: CGPoint(x: 15.2 * s, y: 12 * s))
                    path.addLine(to: CGPoint(x: 10 * s, y: 15 * s))
                    path.closeSubpath()
                }
                .fill(Color(UIColor.systemBackground))
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }
}

private struct FacebookGlyph: View {
    var body: some View {
        GeometryReader { proxy in
            let s = proxy.size.width / 24
            ZStack {
                Circle()
                    .fill(Color.primary)
                    .frame(width: 20 * s, height: 20 * s)
                // "f" — 세로 획 + 가로 획
                Path { path in
                    path.addRect(CGRect(x: 11.6 * s, y: 9.5 * s, width: 2.6 * s, height: 10 * s))
                    path.addRect(CGRect(x: 9.4 * s, y: 11.6 * s, width: 6 * s, height: 2.4 * s))
                    // 위쪽 갈고리
                    path.addRect(CGRect(x: 11.6 * s, y: 7.4 * s, width: 4.4 * s, height: 2.4 * s))
                }
                .fill(Color(UIColor.systemBackground))
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }
}

private struct LinkedInGlyph: View {
    var body: some View {
        GeometryReader { proxy in
            let s = proxy.size.width / 24
            ZStack {
                RoundedRectangle(cornerRadius: 4 * s)
                    .fill(Color.primary)
                    .frame(width: 20 * s, height: 20 * s)
                Path { path in
                    // i
                    path.addEllipse(in: CGRect(x: 6.6 * s, y: 6.4 * s, width: 3 * s, height: 3 * s))
                    path.addRect(CGRect(x: 6.7 * s, y: 10.6 * s, width: 2.8 * s, height: 7 * s))
                    // n
                    path.addRect(CGRect(x: 11.2 * s, y: 10.6 * s, width: 2.8 * s, height: 7 * s))
                    path.addRoundedRect(
                        in: CGRect(x: 13.4 * s, y: 10.6 * s, width: 4 * s, height: 7 * s),
                        cornerSize: CGSize(width: 2 * s, height: 2 * s)
                    )
                    path.addRect(CGRect(x: 13.4 * s, y: 13.4 * s, width: 4 * s, height: 4.2 * s))
                }
                .fill(Color(UIColor.systemBackground))
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }
}
