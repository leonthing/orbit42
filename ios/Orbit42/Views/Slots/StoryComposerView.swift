import CoreImage
import CoreImage.CIFilterBuiltins
import PhotosUI
import SwiftUI
import UIKit

// MARK: - 템플릿

/// 인스타 스토리용 예약 링크 이미지의 배경 템플릿.
/// 공개 링크 페이지 테마와 같은 결의 색을 쓴다.
enum StoryTemplate: String, CaseIterable, Identifiable {
    case indigo, sunset, forest, paper, midnight, photo

    var id: String { rawValue }

    var title: String {
        switch self {
        case .indigo: "인디고"
        case .sunset: "노을"
        case .forest: "포레스트"
        case .paper: "페이퍼"
        case .midnight: "미드나잇"
        case .photo: "사진"
        }
    }

    /// 템플릿 선택 칩에 쓰는 대표 색 두 개
    var colors: [Color] {
        switch self {
        case .indigo: [Color(hex: 0x6366F1), Color(hex: 0x312E81)]
        case .sunset: [Color(hex: 0xF97316), Color(hex: 0xDB2777)]
        case .forest: [Color(hex: 0x10B981), Color(hex: 0x065F46)]
        case .paper: [Color(hex: 0xF5F3EE), Color(hex: 0xECE8DF)]
        case .midnight: [Color(hex: 0x1E293B), Color(hex: 0x0F172A)]
        case .photo: [Color(hex: 0x4B5563), Color(hex: 0x111827)]
        }
    }

    /// 밝은 배경이면 글자를 어둡게
    var isLight: Bool { self == .paper }
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

// MARK: - 주제 (예약 링크 하나 / 내 프로필)

/// 스토리 이미지로 만들 대상.
enum StorySubject: Identifiable {
    case slot(TimeSlot)
    case profile

    var id: String {
        switch self {
        case .slot(let slot): "slot-\(slot.id)"
        case .profile: "profile"
        }
    }
}

/// 카드에 그릴 내용 — 프로필은 소개·관심사·열어 둔 시간까지
enum StoryCardContent {
    case slot(TimeSlot)
    case profile(bio: String?, interests: [String], slots: [TimeSlot], url: String)

    var url: String {
        switch self {
        case .slot(let slot): slot.shareUrl
        case .profile(_, _, _, let url): url
        }
    }
}

// MARK: - 카드 (1080 x 1920)

/// 스토리 카드 본체. 1080x1920 포인트로 그리고 ImageRenderer(scale 1)로 그대로 내보낸다.
/// 인스타 스토리 UI 가 위 ~220px, 아래 ~340px 를 가리므로 핵심 내용은 그 사이에 둔다.
struct StoryCard: View {
    static let size = CGSize(width: 1080, height: 1920)

    let content: StoryCardContent
    let template: StoryTemplate
    let photo: UIImage?
    let avatar: UIImage?
    let displayName: String
    let username: String

    private var fg: Color { template.isLight ? Color(hex: 0x18181B) : .white }
    private var sub: Color { template.isLight ? Color(hex: 0x18181B).opacity(0.6) : .white.opacity(0.78) }
    private var accent: Color { template.isLight ? Color(hex: 0x6366F1) : .white }

    var body: some View {
        ZStack(alignment: .topLeading) {
            background

            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.top, 250)

                Spacer(minLength: 48)

                middle

                Spacer(minLength: 48)

                bottom
                    .padding(.bottom, isProfile ? 330 : 360)
            }
            .padding(.horizontal, 96)
            .frame(width: Self.size.width, height: Self.size.height, alignment: .topLeading)
        }
        .frame(width: Self.size.width, height: Self.size.height)
        .clipped()
    }

    // MARK: 가운데

    @ViewBuilder
    private var middle: some View {
        switch content {
        case .slot(let slot):
            VStack(alignment: .leading, spacing: 40) {
                Text(slot.title)
                    .font(.system(size: 112, weight: .heavy))
                    .foregroundStyle(fg)
                    .lineLimit(3)
                    .minimumScaleFactor(0.5)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 18) {
                    chip(slot.durationText)
                    chip(slot.priceText)
                }

                Text("DM 대신, 여기서 바로 예약하세요")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(sub)
            }
        case .profile(let bio, let interests, let slots, _):
            VStack(alignment: .leading, spacing: 30) {
                Text("DM 대신, 링크로\n시간을 예약하세요")
                    .font(.system(size: 82, weight: .heavy))
                    .foregroundStyle(fg)
                    .lineLimit(3)
                    .minimumScaleFactor(0.6)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)

                if let bio, !bio.isEmpty {
                    Text(bio)
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(sub)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if !interests.isEmpty {
                    HStack(spacing: 14) {
                        ForEach(Array(interests.prefix(3)), id: \.self) { tag in
                            smallChip("#\(tag)")
                        }
                    }
                }

                if !slots.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("열어 둔 시간")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundStyle(sub)
                            .padding(.bottom, 14)
                        ForEach(Array(slots.prefix(3).enumerated()), id: \.offset) { idx, slot in
                            HStack(spacing: 20) {
                                Text(slot.title)
                                    .font(.system(size: 42, weight: .bold))
                                    .foregroundStyle(fg)
                                    .lineLimit(1)
                                Spacer(minLength: 12)
                                Text("\(slot.durationText) · \(slot.priceText)")
                                    .font(.system(size: 36, weight: .semibold))
                                    .foregroundStyle(sub)
                                    .lineLimit(1)
                            }
                            .padding(.vertical, 16)
                            if idx < min(slots.count, 3) - 1 {
                                Rectangle()
                                    .fill(fg.opacity(0.14))
                                    .frame(height: 2)
                            }
                        }
                    }
                    .padding(.horizontal, 36)
                    .padding(.vertical, 20)
                    .background(
                        RoundedRectangle(cornerRadius: 40, style: .continuous)
                            .fill(template.isLight ? Color.white.opacity(0.75) : Color.white.opacity(0.12))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 40, style: .continuous)
                            .strokeBorder(template.isLight ? Color.clear : Color.white.opacity(0.18), lineWidth: 2)
                    )
                }
            }
        }
    }

    private var isProfile: Bool {
        if case .profile = content { return true }
        return false
    }

    // MARK: 배경

    @ViewBuilder
    private var background: some View {
        if template == .photo, let photo {
            ZStack {
                Image(uiImage: photo)
                    .resizable()
                    .scaledToFill()
                    .frame(width: Self.size.width, height: Self.size.height)
                    .clipped()
                // 아래 60% 를 어둡게 — 어떤 사진이든 글자가 읽히게
                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.35), location: 0),
                        .init(color: .black.opacity(0.05), location: 0.22),
                        .init(color: .black.opacity(0.15), location: 0.4),
                        .init(color: .black.opacity(0.78), location: 0.72),
                        .init(color: .black.opacity(0.9), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .frame(width: Self.size.width, height: Self.size.height)
        } else {
            ZStack {
                LinearGradient(
                    colors: template.colors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                // 은은한 광원 두 개 — 단색보다 깊이감
                Circle()
                    .fill(Color.white.opacity(template.isLight ? 0.55 : 0.14))
                    .frame(width: 900, height: 900)
                    .blur(radius: 160)
                    .offset(x: 420, y: -620)
                Circle()
                    .fill((template.isLight ? Color(hex: 0x6366F1) : Color.black).opacity(template.isLight ? 0.08 : 0.25))
                    .frame(width: 1000, height: 1000)
                    .blur(radius: 200)
                    .offset(x: -380, y: 760)
            }
            .frame(width: Self.size.width, height: Self.size.height)
        }
    }

    // MARK: 머리

    private var header: some View {
        HStack(spacing: 28) {
            avatarView
            VStack(alignment: .leading, spacing: 6) {
                Text(displayName)
                    .font(.system(size: isProfile ? 60 : 48, weight: .bold))
                    .foregroundStyle(fg)
                    .lineLimit(1)
                Text("@\(username)")
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(sub)
                    .lineLimit(1)
            }
        }
    }

    @ViewBuilder
    private var avatarView: some View {
        let ring = template.isLight ? Color.white : Color.white.opacity(0.9)
        Group {
            if let avatar {
                Image(uiImage: avatar)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    Circle().fill(template.isLight ? Color(hex: 0x6366F1) : Color.white.opacity(0.22))
                    Text(String((displayName.isEmpty ? username : displayName).prefix(1)))
                        .font(.system(size: isProfile ? 80 : 64, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
        }
        .frame(width: isProfile ? 168 : 132, height: isProfile ? 168 : 132)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(ring, lineWidth: 6))
        .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
    }

    private func smallChip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 34, weight: .semibold))
            .foregroundStyle(template.isLight ? Color(hex: 0x4338CA) : .white)
            .lineLimit(1)
            .padding(.horizontal, 26)
            .padding(.vertical, 12)
            .background(
                Capsule().fill(template.isLight ? Color(hex: 0x6366F1).opacity(0.12) : Color.white.opacity(0.16))
            )
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 44, weight: .bold))
            .foregroundStyle(template.isLight ? Color(hex: 0x4338CA) : .white)
            .padding(.horizontal, 34)
            .padding(.vertical, 18)
            .background(
                Capsule().fill(template.isLight ? Color(hex: 0x6366F1).opacity(0.12) : Color.white.opacity(0.2))
            )
            .overlay(
                Capsule().strokeBorder(template.isLight ? Color.clear : Color.white.opacity(0.28), lineWidth: 2)
            )
    }

    // MARK: 아래 — 예약하기 + 주소 + QR

    private var bottom: some View {
        HStack(alignment: .bottom, spacing: 36) {
            VStack(alignment: .leading, spacing: 26) {
                HStack(spacing: 14) {
                    Text(isProfile ? "시간 예약하기" : "예약하기")
                    Image(systemName: "arrow.right")
                }
                .font(.system(size: 50, weight: .heavy))
                .foregroundStyle(template.isLight ? .white : Color(hex: 0x18181B))
                .padding(.horizontal, 48)
                .padding(.vertical, 30)
                .background(
                    Capsule().fill(template.isLight ? Color(hex: 0x6366F1) : Color.white)
                )
                .shadow(color: .black.opacity(0.2), radius: 22, y: 10)

                Text(Self.shortURL(content.url))
                    .font(.system(size: 34, weight: .semibold, design: .monospaced))
                    .foregroundStyle(sub)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)

                Text("orbit42")
                    .font(.system(size: 34, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(fg.opacity(0.85))
            }

            Spacer(minLength: 0)

            if let qr = StoryQR.image(for: content.url) {
                Image(uiImage: qr)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: 236, height: 236)
                    .padding(22)
                    .background(
                        RoundedRectangle(cornerRadius: 36, style: .continuous).fill(Color.white)
                    )
                    .shadow(color: .black.opacity(0.18), radius: 20, y: 8)
            }
        }
    }

    /// "https://orbit42.org/u/s/slug" → "orbit42.org/u/s/slug"
    static func shortURL(_ raw: String) -> String {
        var s = raw
        for prefix in ["https://", "http://", "www."] where s.hasPrefix(prefix) {
            s.removeFirst(prefix.count)
        }
        return s.removingPercentEncoding ?? s
    }
}

// MARK: - QR

enum StoryQR {
    /// 예약 링크 QR — 흰 카드 위에 진한 점으로 (어떤 템플릿에서도 잘 읽히게)
    static func image(for string: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let colored = output.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(red: 0.086, green: 0.086, blue: 0.11),
            "inputColor1": CIColor(red: 1, green: 1, blue: 1),
        ])
        let scaled = colored.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        let context = CIContext()
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

// MARK: - 렌더링

@MainActor
enum StoryRenderer {
    static func render(_ card: StoryCard) -> UIImage? {
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = ProposedViewSize(StoryCard.size)
        renderer.scale = 1
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

// MARK: - 작성 화면

/// 예약 링크·내 프로필 → 인스타 스토리용 이미지 만들기.
/// 템플릿 5종 또는 사진첩 사진을 배경으로 고르고, "스토리에 올리기"를 누르면
/// 링크를 복사한 뒤 공유 시트(Instagram → 스토리)를 연다.
struct StoryComposerView: View {
    let subject: StorySubject

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var auth

    @State private var template: StoryTemplate = .indigo
    @State private var photoItem: PhotosPickerItem?
    @State private var photo: UIImage?
    @State private var avatar: UIImage?
    @State private var shareImage: ShareImage?
    @State private var toast: String?
    /// 프로필 카드의 '열어 둔 시간' — 내 활성 예약 링크
    @State private var profileSlots: [TimeSlot] = []

    private var displayName: String { auth.user?.displayName ?? auth.user?.username ?? "" }
    private var username: String { auth.user?.username ?? "" }

    private var profileURL: String { "https://orbit42.org/\(username)" }

    private var content: StoryCardContent {
        switch subject {
        case .slot(let slot):
            return .slot(slot)
        case .profile:
            return .profile(
                bio: auth.user?.bio,
                interests: auth.user?.interests ?? [],
                slots: profileSlots,
                url: profileURL
            )
        }
    }

    private var card: StoryCard {
        StoryCard(
            content: content,
            template: template,
            photo: photo,
            avatar: avatar,
            displayName: displayName,
            username: username
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                preview
                templatePicker
                actions
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background)
            .navigationTitle("스토리 이미지")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("닫기") { dismiss() }
                }
            }
            .overlay(alignment: .top) {
                if let toast {
                    Text(toast)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 14))
                        .padding(.horizontal, 24)
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .sheet(item: $shareImage) { item in
                ActivityView(items: [item.image])
                    .ignoresSafeArea()
            }
        }
        .task { await loadAvatar() }
        .task { await loadProfileSlots() }
        .onChange(of: photoItem) { _, item in
            Task { await loadPhoto(item) }
        }
        #if DEBUG
        .task { await debugExportIfNeeded() }
        #endif
    }

    // MARK: 미리보기

    private var preview: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / StoryCard.size.width, geo.size.height / StoryCard.size.height)
            card
                .scaleEffect(scale, anchor: .topLeading)
                .frame(
                    width: StoryCard.size.width * scale,
                    height: StoryCard.size.height * scale,
                    alignment: .topLeading
                )
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 16, y: 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(.horizontal, 24)
    }

    // MARK: 템플릿 선택

    private var templatePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(StoryTemplate.allCases.filter { $0 != .photo }) { t in
                    Button {
                        withAnimation(.snappy) { template = t }
                    } label: {
                        templateChip(t)
                    }
                    .buttonStyle(.plain)
                }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    templateChip(.photo)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 2)
        }
    }

    private func templateChip(_ t: StoryTemplate) -> some View {
        let selected = template == t
        return VStack(spacing: 6) {
            ZStack {
                if t == .photo, let photo {
                    Image(uiImage: photo)
                        .resizable()
                        .scaledToFill()
                } else {
                    LinearGradient(colors: t.colors, startPoint: .topLeading, endPoint: .bottomTrailing)
                }
                if t == .photo, photo == nil {
                    Image(systemName: "photo")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
            }
            .frame(width: 52, height: 72)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(selected ? Theme.accent : Theme.fill(0.12), lineWidth: selected ? 3 : 1)
            )
            Text(t.title)
                .font(.caption2.weight(selected ? .bold : .regular))
                .foregroundStyle(selected ? Theme.primaryText : Theme.secondaryText)
        }
    }

    // MARK: 동작

    private var actions: some View {
        VStack(spacing: 10) {
            Button {
                shareToStory()
            } label: {
                Label("스토리에 올리기", systemImage: "camera.circle.fill")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(
                        LinearGradient(
                            colors: [Color(hex: 0xF58529), Color(hex: 0xDD2A7B), Color(hex: 0x8134AF)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: Capsule()
                    )
            }
            .buttonStyle(.plain)

            Button {
                saveToPhotos()
            } label: {
                Label("사진에 저장", systemImage: "square.and.arrow.down")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Theme.surface, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 24)
    }

    private func shareToStory() {
        guard let image = StoryRenderer.render(card) else { return }
        // 인스타는 외부 앱이 링크 스티커를 미리 붙이게 해 주지 않는다 — 링크를 복사해 두고
        // 스토리 편집 화면에서 링크 스티커에 붙여넣게 안내한다.
        if let url = URL(string: content.url) {
            UIPasteboard.general.url = url
        }
        showToast("링크를 복사했어요 — 인스타 스토리에서 링크 스티커에 붙여넣으세요")
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            shareImage = ShareImage(image: image)
        }
    }

    private func saveToPhotos() {
        guard let image = StoryRenderer.render(card) else { return }
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        showToast("사진에 저장했어요")
    }

    private func showToast(_ message: String) {
        withAnimation(.snappy) { toast = message }
        Task {
            try? await Task.sleep(for: .seconds(3))
            withAnimation(.snappy) {
                if toast == message { toast = nil }
            }
        }
    }

    // MARK: 이미지 불러오기

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item,
              let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }
        photo = image
        withAnimation(.snappy) { template = .photo }
    }

    private func loadProfileSlots() async {
        guard case .profile = subject else { return }
        if let response: SlotsResponse = try? await APIClient.shared.get("/api/v1/slots") {
            profileSlots = response.slots.filter { $0.active && !$0.isAuction }
        }
    }

    /// ImageRenderer 는 AsyncImage 를 기다려 주지 않으므로 아바타를 미리 UIImage 로 받아 둔다.
    private func loadAvatar() async {
        guard avatar == nil,
              let raw = auth.user?.avatarUrl, !raw.isEmpty else { return }
        let url: URL?
        if raw.hasPrefix("http") {
            url = URL(string: raw)
        } else {
            url = URL(string: raw, relativeTo: APIClient.shared.baseURL)
        }
        guard let url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let image = UIImage(data: data) else { return }
        avatar = image
    }

    #if DEBUG
    /// 스크린샷/검수용: DEMO_STORY_EXPORT=1 이면 템플릿 5종을 Documents/story-*.png 로 내보낸다.
    private func debugExportIfNeeded() async {
        let env = ProcessInfo.processInfo.environment
        if let raw = env["DEMO_STORY_TEMPLATE"], let t = StoryTemplate(rawValue: raw) {
            template = t
        }
        guard env["DEMO_STORY_EXPORT"] == "1" else { return }
        try? await Task.sleep(for: .seconds(2.5))
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        for t in StoryTemplate.allCases where t != .photo {
            let c = StoryCard(content: content, template: t, photo: nil, avatar: avatar,
                              displayName: displayName, username: username)
            let prefix = { if case .profile = subject { return "profile" } else { return "story" } }()
            if let img = StoryRenderer.render(c), let png = img.pngData() {
                try? png.write(to: dir.appendingPathComponent("\(prefix)-\(t.rawValue).png"))
            }
        }
    }
    #endif
}

private struct ShareImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// UIActivityViewController — 이미지를 넘기면 Instagram 의 '스토리' 공유 대상이 뜬다.
private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
