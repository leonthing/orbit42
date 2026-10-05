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

    /// 기능을 글이 아니라 실제 화면으로 보여준다 (스토어 스크린샷과 같은 화면, Assets 의 Intro*).
    private struct IntroPage {
        let image: String
        let title: String
        let message: String
    }

    private let pages: [IntroPage] = [
        IntroPage(
            image: "IntroBookings",
            title: "예약은 링크로",
            message: "카톡·DM으로 오가던 일정 조율 대신\n링크 하나로 상대가 직접 시간을 골라요."
        ),
        IntroPage(
            image: "IntroNewLink",
            title: "30초 만에 만들기",
            message: "무엇을 · 얼마나 · 언제만 정하면\n내 예약 링크가 열려요."
        ),
        IntroPage(
            image: "IntroPayment",
            title: "입금 확인 후 확정",
            message: "유료 세션은 계좌 안내가 자동으로 가고,\n입금을 확인하면 예약이 확정돼요."
        ),
        IntroPage(
            image: "IntroCalendar",
            title: "캘린더와 한 화면",
            message: "구글 캘린더와 예약을 한곳에서 —\n일정마다 내 시간의 가치(₩)도 보여줘요."
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
                        VStack(spacing: 18) {
                            Spacer(minLength: 0)
                            Image(intro.image)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 270, height: 400, alignment: .top)
                                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                                .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
                                .accessibilityHidden(true)
                            VStack(spacing: 8) {
                                Text(intro.title)
                                    .font(.title2.weight(.bold))
                                    .foregroundStyle(Theme.primaryText)
                                Text(intro.message)
                                    .font(.callout)
                                    .foregroundStyle(Theme.secondaryText)
                                    .multilineTextAlignment(.center)
                                    .lineSpacing(3)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 8)
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
            .readableWidth()
        }
    }
}

#Preview {
    IntroView(onFinish: { _ in })
}
