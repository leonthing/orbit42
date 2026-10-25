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
    /// 마지막 장의 '가입 없이 둘러보기' (개선-47·48)
    var onBrowse: () -> Void = {}

    @State private var page = 0
    /// 작은 화면(iPhone SE 등) — 이미지를 줄여 글이 잘리지 않게
    @State private var compact = false

    /// 기능을 글이 아니라 실제 화면으로 보여준다 (스토어 스크린샷과 같은 화면, Assets 의 Intro*).
    private struct IntroPage {
        let image: String
        let title: String
        let message: String
    }

    /// 다섯 장 — 캘린더 · 위젯 · 내 링크 페이지 · 예약·시간 판매 · 오르빗 (개선-48).
    /// 이미지는 둘러보기 예시 데이터·임시 예시 계정으로 찍었다(실명·실계정 없음).
    private let pages: [IntroPage] = [
        IntroPage(
            image: "IntroCalendar",
            title: "할 일처럼 체크하는 캘린더",
            message: "구글 캘린더와 함께, 끝낸 일정은 체크.\n중요한 건 ☆, 끝난 뒤엔 만족도까지."
        ),
        IntroPage(
            image: "IntroWidget",
            title: "홈 화면에서 오늘을 한눈에",
            message: "오늘 일정과 답할 일을 위젯으로.\n앱을 열지 않아도 바로 보여요."
        ),
        IntroPage(
            image: "IntroLinkPage",
            title: "인스타·유튜브에 거는 내 페이지",
            message: "소개·SNS·예약 버튼을 한 페이지에.\n테마를 골라 바이오에 붙여요."
        ),
        IntroPage(
            image: "IntroBookings",
            title: "링크로 예약받고, 시간을 팔아요",
            message: "DM 대신 상대가 직접 시간을 골라요.\n유료는 입금 확인 후 확정돼요."
        ),
        IntroPage(
            image: "IntroOrbit",
            title: "가까운 사람이 가까이",
            message: "자주 만나는 사람이 궤도 가까이에.\n팔로우한 사람의 새 링크도 보여요."
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
                                .frame(width: compact ? 200 : 270, height: compact ? 304 : 400, alignment: .top)
                                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                                .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
                                .accessibilityHidden(true)
                            VStack(spacing: 8) {
                                Text(intro.title)
                                    .font(.title2.weight(.bold))
                                    .foregroundStyle(Theme.primaryText)
                                Text(intro.message)
                                    .font(compact ? .subheadline : .callout)
                                    .foregroundStyle(Theme.secondaryText)
                                    .multilineTextAlignment(.center)
                                    .lineSpacing(3)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 8)
                        .padding(.horizontal, compact ? 4 : 36)
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
                .padding(.bottom, compact ? 16 : 28)

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
                .padding(.bottom, page == pages.count - 1 ? 8 : (compact ? 20 : 36))

                // 마지막 장 — 가입 없이 둘러보기 (개선-47로 이어짐)
                if page == pages.count - 1 {
                    Button(action: onBrowse) {
                        HStack(spacing: 6) {
                            Image(systemName: "eye")
                            Text("가입 없이 둘러보기")
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.vertical, 8)
                    }
                    .accessibilityIdentifier("introBrowse")
                    .padding(.bottom, compact ? 8 : 20)
                }
            }
            .readableWidth()
        }
        .onGeometryChange(for: Bool.self) { $0.size.height < 700 } action: { compact = $0 }
    }
}

#Preview {
    IntroView(onFinish: { _ in })
}
