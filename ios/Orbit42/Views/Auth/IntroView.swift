import SwiftUI

/// 인트로에서 어느 인증 화면으로 넘어갈지 — 가입("시작하기") 또는 로그인(우상단).
enum AuthIntent {
    case signup
    case login
}

/// 비로그인 상태의 첫 화면 — 앱 주요 기능 소개.
/// "시작하기" → 가입 폼, 우상단 "로그인" → 로그인 폼으로 넘어간다.
struct IntroView: View {
    let onFinish: (AuthIntent) -> Void

    @State private var page = 0

    private struct IntroPage {
        let icon: String
        let iconColor: Color
        let title: String
        let message: String
    }

    private let pages: [IntroPage] = [
        IntroPage(
            icon: "wonsign.circle.fill",
            iconColor: Color(red: 0xF5 / 255, green: 0x9E / 255, blue: 0x0B / 255),
            title: "시간은 자산이니까",
            message: "매일 주어지는 24시간, 가장 공평한 자산이에요.\n시간을 어디에 쓰는지 돈으로 환산해 확인하고\n수입 · 투자 · 소비로 나눠 분석해요.\n시간을 더 잘 쓰는 것만으로 내일의 자산이 커져요."
        ),
        IntroPage(
            icon: "clock.badge.checkmark",
            iconColor: Theme.accent,
            title: "내 시간을 상품으로",
            message: "커피챗 30분, 멘토링 1시간 —\n시간을 타임슬롯으로 등록하고\n무료부터 유료, 경매까지 가격을 붙여요."
        ),
        IntroPage(
            icon: "link.badge.plus",
            iconColor: Color(red: 0x22 / 255, green: 0xC5 / 255, blue: 0x5E / 255),
            title: "링크 하나로 판매",
            message: "예약 페이지 링크를 공유하면 끝.\n비는 시간은 캘린더를 보고 자동 계산되고,\n예약이 들어오면 승인만 하면 돼요.\n상대는 가입 없이도 예약할 수 있어요."
        ),
        IntroPage(
            icon: "circle.dotted.circle",
            iconColor: Theme.accent,
            title: "팔로우하면 시간이 모여요",
            message: "관심 있는 사람을 팔로우하면\n열리는 시간이 오르빗 탭에 모여요.\n친구를 초대하면 자동으로 맞팔로우."
        ),
        IntroPage(
            icon: "calendar.badge.checkmark",
            iconColor: Color(red: 0x06 / 255, green: 0xB6 / 255, blue: 0xD4 / 255),
            title: "캘린더, 하나로",
            message: "구글 캘린더까지 한곳에 모아 보고,\n일정을 만들면 구글에도 함께 저장돼요."
        ),
    ]

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button {
                        onFinish(.login)
                    } label: {
                        Text("이미 계정이 있나요? ")
                            .foregroundStyle(Theme.secondaryText)
                        + Text("로그인")
                            .foregroundStyle(Theme.accent)
                            .fontWeight(.semibold)
                    }
                    .font(.subheadline)
                    .padding(20)
                }

                TabView(selection: $page) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, intro in
                        VStack(spacing: 20) {
                            Image(systemName: intro.icon)
                                .font(.system(size: 64, weight: .light))
                                .foregroundStyle(intro.iconColor)
                                .frame(height: 90)
                            Text(intro.title)
                                .font(.title.weight(.bold))
                                .foregroundStyle(Theme.primaryText)
                            Text(intro.message)
                                .font(.body)
                                .foregroundStyle(Theme.secondaryText)
                                .multilineTextAlignment(.center)
                                .lineSpacing(4)
                        }
                        .padding(.horizontal, 36)
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                // 페이지 인디케이터
                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { index in
                        Capsule()
                            .fill(index == page ? Theme.accent : Theme.fill(0.2))
                            .frame(width: index == page ? 22 : 8, height: 8)
                            .animation(.spring(duration: 0.3), value: page)
                    }
                }
                .padding(.bottom, 28)

                Button {
                    if page < pages.count - 1 {
                        withAnimation { page += 1 }
                    } else {
                        onFinish(.signup)
                    }
                } label: {
                    Text(page < pages.count - 1 ? "다음" : "시작하기")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .padding(.horizontal, 24)
                .padding(.bottom, 36)
            }
        }
    }
}

#Preview {
    IntroView(onFinish: { _ in })
}
