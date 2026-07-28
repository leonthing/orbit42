import SwiftUI

/// 프로필의 "시간 로그" 섹션 — 사진이 붙은 완료 일정들을 3열 그리드로.
/// 내 프로필과 타인 프로필이 공유한다 (서버가 공개 범위를 이미 거른 상태).
struct TimelogSectionView: View {
    let posts: [TimelogPost]
    /// 내 프로필일 때만 빈 상태 안내를 보여준다.
    let showsEmptyHint: Bool

    @State private var selectedPost: TimelogPost?

    var body: some View {
        if posts.isEmpty && !showsEmptyHint {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("시간 로그")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)

                if posts.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 26, weight: .light))
                            .foregroundStyle(Theme.secondaryText)
                        Text("아직 기록이 없어요")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.primaryText)
                        Text("캘린더의 일정에 사진을 붙이면 시간 로그가 쌓여요")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                } else {
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3),
                        spacing: 4
                    ) {
                        ForEach(posts) { post in
                            Button {
                                selectedPost = post
                            } label: {
                                tile(post)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .sheet(item: $selectedPost) { post in
                TimelogViewerSheet(post: post)
            }
        }
    }

    private func tile(_ post: TimelogPost) -> some View {
        GeometryReader { proxy in
            AsyncImage(url: post.coverURL) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    ZStack {
                        Theme.surface
                        Image(systemName: "photo")
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.width)
            .clipped()
            .overlay(alignment: .topTrailing) {
                if post.imageUrls.count > 1 {
                    Image(systemName: "square.on.square")
                        .font(.caption2)
                        .foregroundStyle(Theme.primaryText)
                        .padding(5)
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

// MARK: - 뷰어

/// 시간 로그 상세 — 사진 페이지 + 제목·날짜.
struct TimelogViewerSheet: View {
    let post: TimelogPost
    @Environment(\.dismiss) private var dismiss

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월 d일 (E)"
        return formatter
    }()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 14) {
                    TabView {
                        ForEach(post.imageUrls, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFit()
                                } else {
                                    ProgressView().tint(Theme.accent)
                                }
                            }
                        }
                    }
                    .tabViewStyle(.page)
                    .frame(maxHeight: 420)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(post.title)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        if let date = post.startDate {
                            Text(Self.dayFormatter.string(from: date))
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        if let note = post.note, !note.isEmpty {
                            Text(note)
                                .font(.subheadline)
                                .foregroundStyle(Theme.primaryText.opacity(0.85))
                        }
                    }
                    .padding(.horizontal, 20)

                    Spacer()
                }
                .padding(.top, 8)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
            }
        }
    }
}
