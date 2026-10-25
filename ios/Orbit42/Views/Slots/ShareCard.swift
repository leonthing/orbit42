import Photos
import SwiftUI
import UIKit

// MARK: - 열린 시간 계산 (1.7.0 공유 카드)

/// 하루의 열린 구간 하나 — 예약 가능한 시각들 중 이어지는 것을 합친 것
struct ShareCardRange: Equatable {
    let start: Date
    let end: Date
}

/// 카드의 한 줄 — 날짜(한국 시간 0시)와 그날 열린 구간들
struct ShareCardDay: Equatable {
    let day: Date
    let ranges: [ShareCardRange]
}

/// 예약 가능한 시각(웹 예약 페이지와 같은 서버 계산) → 앞으로 N일 날짜별 열린 구간.
/// 카드에는 시각만 들어간다 — 일정 제목·상대 이름·장소·메모는 이 입력에 아예 없다(CEO 조건).
enum ShareCardPlanner {
    /// 웹 예약 페이지와 같은 한국 시간 기준
    static var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        c.locale = Locale(identifier: "ko_KR")
        return c
    }

    static func plan(
        _ options: [(start: Date, end: Date, closed: Bool)],
        now: Date = Date(),
        days: Int = 7
    ) -> [ShareCardDay] {
        let limit = now.addingTimeInterval(TimeInterval(days) * 86_400)
        let open = options
            .filter { !$0.closed && $0.start > now && $0.start < limit && $0.end > $0.start }
            .sorted { $0.start < $1.start }
        let cal = calendar
        var byDay: [Date: [ShareCardRange]] = [:]
        for o in open {
            let day = cal.startOfDay(for: o.start)
            var ranges = byDay[day] ?? []
            if let last = ranges.last, o.start <= last.end {
                ranges[ranges.count - 1] = ShareCardRange(start: last.start, end: max(last.end, o.end))
            } else {
                ranges.append(ShareCardRange(start: o.start, end: o.end))
            }
            byDay[day] = ranges
        }
        return byDay.keys.sorted().map { ShareCardDay(day: $0, ranges: byDay[$0] ?? []) }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E)"
        return f
    }()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f
    }()

    static func dayText(_ day: Date) -> String { dayFormatter.string(from: day) }

    static func rangeText(_ r: ShareCardRange) -> String {
        "\(timeFormatter.string(from: r.start))–\(timeFormatter.string(from: r.end))"
    }

    /// 한 줄에 다 못 넣으면 앞의 몇 개 + "외 n"
    static func rangesText(_ ranges: [ShareCardRange], max: Int) -> String {
        let shown = ranges.prefix(max).map(rangeText).joined(separator: " · ")
        return ranges.count > max ? "\(shown) 외 \(ranges.count - max)" : shown
    }

    /// 구간 단위 줄 나누기 — 줄마다 시각으로 시작, 넘치면 마지막 줄 끝에 "외 n"
    static func rangeLines(_ ranges: [ShareCardRange], perLine: Int, max: Int) -> [String] {
        let shown = Array(ranges.prefix(max))
        var lines: [String] = stride(from: 0, to: shown.count, by: perLine).map { i in
            shown[i..<min(i + perLine, shown.count)].map(rangeText).joined(separator: "  ")
        }
        if ranges.count > max, !lines.isEmpty {
            lines[lines.count - 1] += " 외 \(ranges.count - max)"
        }
        return lines
    }

    /// 카드 링크 — 방문 집계가 카드에서 온 것을 따로 센다
    static func cardURL(_ shareUrl: String) -> String {
        shareUrl + (shareUrl.contains("?") ? "&" : "?") + "via=card"
    }
}

// MARK: - 크기·테마

enum ShareCardSize: String, CaseIterable, Identifiable {
    case story, square
    var id: String { rawValue }
    var title: String { self == .story ? "스토리 9:16" : "정사각 1:1" }
    var pixels: CGSize { self == .story ? CGSize(width: 1080, height: 1920) : CGSize(width: 1080, height: 1080) }
}

enum ShareCardTheme: String, CaseIterable, Identifiable {
    case violet, paper, midnight
    var id: String { rawValue }
    var title: String {
        switch self {
        case .violet: "보라"
        case .paper: "페이퍼"
        case .midnight: "미드나잇"
        }
    }
    var background: LinearGradient {
        switch self {
        case .violet: LinearGradient(colors: [Color(cardHex: 0x6366F1), Color(cardHex: 0x312E81)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .paper: LinearGradient(colors: [Color(cardHex: 0xF7F5F0), Color(cardHex: 0xECE8DF)], startPoint: .top, endPoint: .bottom)
        case .midnight: LinearGradient(colors: [Color(cardHex: 0x1E293B), Color(cardHex: 0x0F172A)], startPoint: .top, endPoint: .bottom)
        }
    }
    var ink: Color { self == .paper ? Color(cardHex: 0x1C1917) : .white }
    var sub: Color { self == .paper ? Color(cardHex: 0x57534E) : Color.white.opacity(0.72) }
    var accent: Color {
        switch self {
        case .violet: Color(cardHex: 0xC7D2FE)
        case .paper: Color(cardHex: 0x4F46E5)
        case .midnight: Color(cardHex: 0xA5B4FC)
        }
    }
    var rowFill: Color { self == .paper ? Color.black.opacity(0.05) : Color.white.opacity(0.10) }
    var chip: [Color] {
        switch self {
        case .violet: [Color(cardHex: 0x6366F1), Color(cardHex: 0x312E81)]
        case .paper: [Color(cardHex: 0xF7F5F0), Color(cardHex: 0xD6D3CB)]
        case .midnight: [Color(cardHex: 0x1E293B), Color(cardHex: 0x0F172A)]
        }
    }
}

private extension Color {
    init(cardHex hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

// MARK: - 카드 이미지

/// 카드 본체 — 픽셀 크기 그대로(ImageRenderer scale 1).
/// 들어가는 것: 내 표시 이름, 예약 링크 이름, 날짜별 열린 시각, 짧은 주소, QR. 그 밖의 정보는 받지도 않는다.
/// 스토리(9:16)는 인스타·카톡이 위(프로필·진행 막대)와 아래(메시지 줄)를 가리므로
/// 위 250px·아래 340px 안에는 아무것도 두지 않고 내용을 가운데로 모은다.
struct ShareCardImage: View {
    let size: ShareCardSize
    let theme: ShareCardTheme
    let hostName: String
    let linkTitle: String
    let days: [ShareCardDay]
    let url: String
    let qr: UIImage?

    /// 스토리 가림 영역 (1080×1920 기준)
    static let storySafeTop: CGFloat = 250
    static let storySafeBottom: CGFloat = 340

    private var isStory: Bool { size == .story }
    /// 한 줄에 넣는 구간 수 / 하루에 보여 줄 구간 수(넘으면 '외 n')
    private var perLine: Int { 2 }
    /// 스토리는 하루 두 줄(4구간)까지 — 7일이 모두 두 줄이라 안전 영역을 넘을 만하면 하루 한 줄(2구간)로
    private var maxRanges: Int {
        guard isStory else { return 2 }
        let shownDays = days.prefix(7)
        let twoLineDays = shownDays.filter { $0.ranges.count > 2 }.count
        // 캡처로 잰 값: 한 줄 행 ≈ 77px, 두 줄 행 ≈ 131px(행 사이 포함) — 안전 영역 안에서 시간표에 쓸 수 있는 높이 ≈ 800px
        let height = shownDays.count * 77 + twoLineDays * 54
        return height <= 800 ? 4 : 2
    }
    private var timeFont: CGFloat { isStory ? 42 : 40 }
    private var dayFont: CGFloat { isStory ? 40 : 38 }

    var body: some View {
        ZStack {
            theme.background
            VStack(alignment: .leading, spacing: isStory ? 40 : 26) {
                header
                rows
                footer
            }
            .padding(.horizontal, isStory ? 84 : 64)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.top, isStory ? Self.storySafeTop : 56)
            .padding(.bottom, isStory ? Self.storySafeBottom : 56)
        }
        .frame(width: size.pixels.width, height: size.pixels.height)
        .environment(\.colorScheme, theme == .paper ? .light : .dark)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: isStory ? 10 : 6) {
            Text("이번 주 빈 시간")
                .font(.system(size: isStory ? 40 : 34, weight: .semibold))
                .foregroundStyle(theme.accent)
            Text(hostName)
                .font(.system(size: isStory ? 84 : 62, weight: .bold))
                .foregroundStyle(theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.45)
            Text(linkTitle)
                .font(.system(size: isStory ? 40 : 32, weight: .medium))
                .foregroundStyle(theme.sub)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private var rows: some View {
        VStack(alignment: .leading, spacing: isStory ? 12 : 9) {
            ForEach(days.prefix(7), id: \.day) { d in
                HStack(alignment: .firstTextBaseline, spacing: 22) {
                    Text(ShareCardPlanner.dayText(d.day))
                        .font(.system(size: dayFont, weight: .semibold))
                        .foregroundStyle(theme.ink)
                        .frame(width: isStory ? 268 : 256, alignment: .leading)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    // 구간 단위로 끊는다 — 줄마다 시각으로 시작
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(ShareCardPlanner.rangeLines(d.ranges, perLine: perLine, max: maxRanges).enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.system(size: timeFont, weight: .regular).monospacedDigit())
                                .foregroundStyle(theme.ink.opacity(0.95))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, isStory ? 11 : 7)
                .background(theme.rowFill, in: RoundedRectangle(cornerRadius: isStory ? 24 : 18))
            }
        }
    }

    private var footer: some View {
        HStack(alignment: .center, spacing: isStory ? 32 : 26) {
            if let qr {
                Image(uiImage: qr)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: isStory ? 176 : 138, height: isStory ? 176 : 138)
                    .padding(isStory ? 14 : 11)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: isStory ? 22 : 18))
            }
            VStack(alignment: .leading, spacing: isStory ? 8 : 6) {
                Text("예약하기")
                    .font(.system(size: isStory ? 46 : 38, weight: .bold))
                    .foregroundStyle(theme.ink)
                Text(DisplayURL.short(url).replacingOccurrences(of: "?via=card", with: ""))
                    .font(.system(size: isStory ? 32 : 28, weight: .medium))
                    .foregroundStyle(theme.sub)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text("Orbit42")
                    .font(.system(size: isStory ? 28 : 24, weight: .semibold))
                    .foregroundStyle(theme.accent)
            }
            Spacer(minLength: 0)
        }
    }

    @MainActor
    func render() -> UIImage? {
        let renderer = ImageRenderer(content: self)
        renderer.proposedSize = ProposedViewSize(size.pixels)
        renderer.scale = 1
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

// MARK: - 작성 화면

/// "이번 주 빈 시간" 공유 카드 — 링크·크기·테마를 고르고 공유하거나 사진에 저장한다.
struct ShareCardComposer: View {
    /// 고를 수 있는 내 예약 링크(받는 중인 것)
    let slots: [TimeSlot]
    let initial: TimeSlot
    /// 열린 시간이 없을 때 '편집'으로
    var onEdit: (TimeSlot) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var auth
    @State private var selectedId: String?
    @State private var size: ShareCardSize = .story
    @State private var theme: ShareCardTheme = .violet
    @State private var days: [ShareCardDay]?
    @State private var loadError: String?
    @State private var image: UIImage?
    @State private var sharing = false
    @State private var saveMessage: String?
    @State private var copiedNotice = false

    private var slot: TimeSlot { slots.first { $0.id == selectedId } ?? initial }

    private var hostName: String {
        #if DEBUG
        if ProcessInfo.processInfo.environment["SHARECARD_LONG_NAME"] == "1" {
            return "아주아주긴표시이름을가진호스트 김오르빗 Kim Orbit"
        }
        #endif
        let name = auth.user?.displayName?.trimmingCharacters(in: .whitespaces) ?? ""
        return name.isEmpty ? (auth.user?.username ?? "") : name
    }

    private var cardURL: String { ShareCardPlanner.cardURL(slot.shareUrl) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if slots.count > 1 {
                        Picker("예약 링크", selection: Binding(get: { selectedId ?? initial.id }, set: { selectedId = $0 })) {
                            ForEach(slots) { s in Text(s.title).tag(s.id) }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Picker("크기", selection: $size) {
                        ForEach(ShareCardSize.allCases) { s in Text(s.title).tag(s) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("shareCardSize")
                    HStack(spacing: 10) {
                        ForEach(ShareCardTheme.allCases) { t in
                            Button { theme = t } label: {
                                Text(t.title)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(t == .paper ? Color.black : Color.white)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(LinearGradient(colors: t.chip, startPoint: .topLeading, endPoint: .bottomTrailing), in: Capsule())
                                    .overlay(Capsule().stroke(theme == t ? Theme.accent : .clear, lineWidth: 2.5))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("shareCardTheme.\(t.rawValue)")
                        }
                        Spacer(minLength: 0)
                    }
                    content
                }
                .padding(16)
            }
            .background(Theme.background)
            .navigationTitle("이번 주 빈 시간 카드")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
            }
            .task(id: slot.id) { await load() }
            .onChange(of: size) { _, _ in rerender() }
            .onChange(of: theme) { _, _ in rerender() }
            .sheet(isPresented: $sharing) {
                if let image { ShareCardActivityView(items: [image, cardURL]) }
            }
            .alert("안내", isPresented: Binding(get: { saveMessage != nil }, set: { if !$0 { saveMessage = nil } })) {
                Button("확인", role: .cancel) {}
            } message: { Text(saveMessage ?? "") }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let loadError {
            Text(loadError).font(.subheadline).foregroundStyle(Theme.secondaryText).padding(.top, 40)
        } else if let days {
            if days.isEmpty {
                VStack(spacing: 14) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.system(size: 36))
                        .foregroundStyle(Theme.secondaryText)
                    Text("이번 주는 열린 시간이 없어요. 가능한 시간을 늘려 볼까요?")
                        .font(.subheadline)
                        .foregroundStyle(Theme.primaryText)
                        .multilineTextAlignment(.center)
                    Button("예약 링크 편집") { onEdit(slot) }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(.white)
                        .accessibilityIdentifier("shareCardEdit")
                }
                .padding(.top, 40)
            } else {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 460)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(color: .black.opacity(0.2), radius: 10, y: 4)
                        .accessibilityIdentifier("shareCardPreview")
                }
                HStack(spacing: 10) {
                    Button { Task { await save() } } label: {
                        Label("이미지 저장", systemImage: "square.and.arrow.down")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.surface, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    Button {
                        // 스토리 속 주소·QR은 같은 폰에선 못 누른다 — 링크를 복사해 링크 스티커에 붙이게 안내
                        UIPasteboard.general.string = cardURL
                        LinkShareRecorder.record(username: auth.user?.username)
                        withAnimation { copiedNotice = true }
                        Task {
                            try? await Task.sleep(for: .milliseconds(1600))
                            sharing = true
                        }
                    } label: {
                        Label("공유", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.accent, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("shareCardShare")
                }
                .disabled(image == nil)
                if copiedNotice {
                    Label("링크를 복사했어요. 인스타 스토리에서는 링크 스티커에 붙여 넣어 주세요", systemImage: "link")
                        .font(.footnote)
                        .foregroundStyle(Theme.primaryText)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.accent.opacity(0.18), in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityIdentifier("shareCardCopiedNotice")
                }
            }
        } else {
            ProgressView().tint(Theme.accent).padding(.top, 60)
        }
    }

    private func load() async {
        days = nil
        image = nil
        loadError = nil
        guard let username = auth.user?.username else { loadError = "로그인이 필요해요."; return }
        let user = username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username
        let slug = slot.slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? slot.slug
        do {
            let response: SlotBookingResponse = try await APIClient.shared.get("/api/v1/users/\(user)/slots/\(slug)?days=7")
            days = ShareCardPlanner.plan(response.options.map { ($0.startAt, $0.endAt, $0.closed) })
            #if DEBUG
            if ProcessInfo.processInfo.environment["SHARECARD_EMPTY"] == "1" { days = [] }   // 촬영·테스트용 빈 화면
            // 촬영·테스트용 꽉 찬 주 — 7일 모두 구간 6개
            if ProcessInfo.processInfo.environment["SHARECARD_DENSE"] == "1" {
                let cal = ShareCardPlanner.calendar
                let today = cal.startOfDay(for: Date())
                var dense: [(start: Date, end: Date, closed: Bool)] = []
                for day in 0..<7 {
                    for hour in [9, 11, 13, 15, 17, 19] {
                        let start = cal.date(byAdding: .hour, value: hour, to: cal.date(byAdding: .day, value: day + 1, to: today)!)!
                        dense.append((start, start.addingTimeInterval(3600), false))
                    }
                }
                days = ShareCardPlanner.plan(dense, now: today.addingTimeInterval(86_400 - 1))
            }
            #endif
            rerender()
        } catch is CancellationError {
            return
        } catch let apiError as APIError {
            loadError = apiError.errorDescription ?? "열린 시간을 불러오지 못했어요."
        } catch {
            loadError = "열린 시간을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    private func rerender() {
        guard let days, !days.isEmpty else { image = nil; return }
        let card = ShareCardImage(size: size, theme: theme, hostName: hostName, linkTitle: slot.title,
                                  days: days, url: cardURL, qr: StoryQR.image(for: cardURL))
        image = card.render()
        #if DEBUG
        // 검수용 — 실제 내보내는 이미지를 그대로 파일로 남긴다
        if let dir = ProcessInfo.processInfo.environment["SHARECARD_SHOT_DIR"], let png = image?.pngData() {
            try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("card-\(size.rawValue)-\(theme.rawValue).png"))
        }
        #endif
    }

    private func save() async {
        guard let image else { return }
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            saveMessage = "사진에 저장하려면 설정에서 사진 추가 권한을 허용해 주세요."
            return
        }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }
            saveMessage = "사진에 저장했어요."
        } catch {
            saveMessage = "저장하지 못했어요. 다시 시도해 주세요."
        }
    }
}

/// 시스템 공유 시트 — 이미지 + 링크 주소
private struct ShareCardActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
