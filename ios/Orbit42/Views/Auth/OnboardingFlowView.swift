import PhotosUI
import SwiftUI
import UserNotifications
import UIKit

/// 가입 직후 온보딩 위저드.
/// 약관 동의 → 프로필(닉네임·사진) → 관심사 → 시급 → 캘린더 → 이메일 인증(이메일 가입만) → 팔로우 추천.
/// 필수는 동의뿐 — 나머지는 건너뛸 수 있고 설정·자산 탭에서 언제든 바꿀 수 있다.
struct OnboardingFlowView: View {
    @Environment(AuthViewModel.self) private var auth

    private enum Step: Int, CaseIterable {
        case consent, profile, interests, wage, calendar, notifications, verifyEmail, follow
    }

    @State private var steps: [Step] = []
    @State private var index = 0

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                progressBar
                currentStep
            }
            .readableWidth()
        }
        .onAppear {
            guard steps.isEmpty else { return }
            var all = Step.allCases
            // OAuth(구글·Apple) 가입은 이메일이 이미 인증돼 있다.
            if auth.user?.emailVerified != false {
                all.removeAll { $0 == .verifyEmail }
            }
            steps = all
        }
        .animation(.default, value: index)
    }

    private var progressBar: some View {
        HStack(spacing: 6) {
            ForEach(steps.indices, id: \.self) { i in
                Capsule()
                    .fill(i <= index ? Theme.accent : Theme.fill(0.12))
                    .frame(height: 4)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
    }

    @ViewBuilder
    private var currentStep: some View {
        if steps.isEmpty {
            ProgressView()
                .tint(Theme.accent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            switch steps[index] {
            case .consent: ConsentStep(onNext: advance)
            case .profile: ProfileStep(onNext: advance)
            case .interests: InterestsStep(onNext: advance)
            case .wage: WageStep(onNext: advance)
            case .calendar: CalendarStep(onNext: advance)
            case .notifications: NotificationPermissionStep(onNext: advance)
            case .verifyEmail: VerifyEmailStep(onNext: advance)
            case .follow: FollowStep()
            }
        }
    }

    private func advance() {
        if index + 1 < steps.count {
            index += 1
        } else {
            auth.finishOnboarding()
        }
    }
}

// MARK: - 공통 조각

/// 단계 상단 아이콘 + 제목 + 설명.
private func stepHeader(icon: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 8) {
        Image(systemName: icon)
            .font(.system(size: 34, weight: .light))
            .foregroundStyle(Theme.accent)
        Text(title)
            .font(.title3.weight(.semibold))
            .foregroundStyle(Theme.primaryText)
        Text(subtitle)
            .font(.subheadline)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.secondaryText)
    }
    .padding(.top, 28)
    .padding(.horizontal, 24)
    .padding(.bottom, 16)
    .frame(maxWidth: .infinity)
}

/// 하단 주 버튼.
private func primaryButton(
    _ title: String,
    disabled: Bool = false,
    busy: Bool = false,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        Group {
            if busy {
                ProgressView().tint(.white)
            } else {
                Text(title).font(.headline)
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
    }
    .disabled(disabled || busy)
    .opacity(disabled ? 0.5 : 1)
    .padding(.horizontal, 16)
}

/// 하단 "건너뛰기" 보조 버튼.
private func skipButton(_ title: String = "나중에 할게요", action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Text(title)
            .font(.subheadline)
            .foregroundStyle(Theme.secondaryText)
    }
    .padding(.top, 10)
    .padding(.bottom, 12)
}

// MARK: - 1. 약관 동의

private struct ConsentStep: View {
    let onNext: () -> Void
    @State private var agreed = false

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "checkmark.shield",
                title: "시작하기 전에",
                subtitle: "orbit42를 쓰려면 약관 동의가 필요해요."
            )

            VStack(alignment: .leading, spacing: 12) {
                policyRow(title: "이용약관", path: "terms")
                policyRow(title: "개인정보처리방침", path: "privacy")
            }
            .padding(.horizontal, 24)

            Spacer()

            Button {
                agreed.toggle()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: agreed ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(agreed ? Theme.accent : Theme.secondaryText)
                    Text("이용약관과 개인정보처리방침에 모두 동의합니다")
                        .font(.subheadline)
                        .foregroundStyle(Theme.primaryText)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                }
                .padding(14)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.bottom, 12)

            primaryButton("동의하고 계속", disabled: !agreed, action: onNext)
                .padding(.bottom, 20)
        }
    }

    private func policyRow(title: String, path: String) -> some View {
        Link(destination: URL(string: "https://orbit42.org/\(path)")!) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                Spacer()
                Text("보기")
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                Image(systemName: "arrow.up.right")
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

// MARK: - 2. 프로필 (닉네임 + 사진)

private struct ProfileStep: View {
    @Environment(AuthViewModel.self) private var auth
    let onNext: () -> Void

    @State private var displayName = ""
    @State private var didPrefill = false
    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "person.crop.circle",
                title: "프로필을 만들어 주세요",
                subtitle: "다른 사람에게 보이는 이름이에요.\n사진은 나중에 올려도 돼요."
            )

            PhotosPicker(selection: $photoItem, matching: .images) {
                ZStack(alignment: .bottomTrailing) {
                    avatarCircle
                    Image(systemName: "camera.fill")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(7)
                        .background(Theme.accent, in: Circle())
                }
            }
            .disabled(isUploading)
            .onChange(of: photoItem) { _, newItem in
                if let newItem { upload(newItem) }
            }
            .padding(.bottom, 20)

            TextField("표시 이름", text: $displayName)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .padding(14)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                .foregroundStyle(Theme.primaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)
                    .padding(.horizontal, 24)
            }

            Spacer()

            primaryButton(
                "다음",
                disabled: displayName.trimmingCharacters(in: .whitespaces).isEmpty,
                busy: isSaving || isUploading
            ) {
                save()
            }
            .padding(.bottom, 20)
        }
        .onAppear {
            guard !didPrefill else { return }
            displayName = auth.user?.displayName ?? ""
            didPrefill = true
        }
    }

    private var avatarCircle: some View {
        AsyncImage(url: (auth.user?.avatarUrl).flatMap { URL(string: $0) }) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Circle().fill(Theme.surface)
                    Image(systemName: "person.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.secondaryText)
                }
            }
        }
        .frame(width: 108, height: 108)
        .clipShape(Circle())
        .overlay {
            if isUploading {
                ZStack {
                    Circle().fill(.black.opacity(0.4))
                    ProgressView().tint(.white)
                }
            }
        }
    }

    private func upload(_ item: PhotosPickerItem) {
        errorMessage = nil
        isUploading = true
        Task {
            defer {
                isUploading = false
                photoItem = nil
            }
            do {
                guard let rawData = try await item.loadTransferable(type: Data.self),
                      let jpegData = resizedJPEG(from: rawData)
                else {
                    errorMessage = "이미지를 불러오지 못했어요. 다른 사진을 골라 주세요."
                    return
                }
                let _: AvatarUploadResponse = try await APIClient.shared.upload(
                    "/api/v1/me/avatar",
                    fileData: jpegData,
                    fieldName: "avatar",
                    fileName: "avatar.jpg",
                    mimeType: "image/jpeg"
                )
                let response: MeResponse = try await APIClient.shared.get("/api/v1/me")
                auth.updateUser(response.user)
            } catch {
                errorMessage = "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    private func save() {
        let trimmed = displayName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        if trimmed == auth.user?.displayName {
            onNext()
            return
        }
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                var request = UpdateProfileRequest()
                request.displayName = trimmed
                let response: MeResponse = try await APIClient.shared.patch("/api/v1/me", body: request)
                auth.updateUser(response.user)
                onNext()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "저장하지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }

    /// EditProfileSheet 와 같은 규격 — 긴 변 1024px, JPEG 85%.
    private func resizedJPEG(from data: Data, maxDimension: CGFloat = 1024) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        guard longest > maxDimension else { return image.jpegData(compressionQuality: 0.85) }
        let scale = maxDimension / longest
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        return resized.jpegData(compressionQuality: 0.85)
    }
}

// MARK: - 3. 관심사 선택

private struct InterestsStep: View {
    @Environment(AuthViewModel.self) private var auth
    let onNext: () -> Void

    private static let presets = [
        "개발", "디자인", "마케팅", "스타트업", "투자", "커리어",
        "멘토링", "커피챗", "외국어", "글쓰기", "운동", "여행",
        "음악", "독서", "사진", "요리",
    ]
    private static let limit = 10

    @State private var selected: [String] = []
    @State private var custom = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "tag",
                title: "관심사를 골라 주세요",
                subtitle: "프로필에 표시되고, 비슷한 사람을\n추천받는 기준이 돼요. (최대 \(Self.limit)개)"
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    FlowChips(
                        tags: Self.presets,
                        isSelected: { selected.contains($0) },
                        onTap: toggle
                    )

                    // 목록에 없는 관심사 직접 추가
                    HStack(spacing: 10) {
                        TextField("직접 입력 (예: 클라이밍)", text: $custom)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .foregroundStyle(Theme.primaryText)
                            .onSubmit { addCustom() }
                        Button("추가") { addCustom() }
                            .font(.subheadline.weight(.semibold))
                            .disabled(custom.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))

                    // 직접 추가한 태그 (프리셋에 없는 것)
                    let extras = selected.filter { !Self.presets.contains($0) }
                    if !extras.isEmpty {
                        FlowChips(tags: extras, isSelected: { _ in true }, onTap: toggle)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .padding(.horizontal, 20)
            }

            Text("\(selected.count)/\(Self.limit)")
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
                .padding(.bottom, 8)

            primaryButton("다음", disabled: selected.isEmpty, busy: isSaving) { save() }
            skipButton { onNext() }
        }
        .onAppear {
            if selected.isEmpty, let existing = auth.user?.interests {
                selected = existing
            }
        }
    }

    private func toggle(_ tag: String) {
        if let idx = selected.firstIndex(of: tag) {
            selected.remove(at: idx)
        } else if selected.count < Self.limit {
            selected.append(tag)
        }
    }

    private func addCustom() {
        let trimmed = custom.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !selected.contains(trimmed), selected.count < Self.limit else { return }
        selected.append(trimmed)
        custom = ""
    }

    private func save() {
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                var request = UpdateProfileRequest()
                request.interests = selected
                let response: MeResponse = try await APIClient.shared.patch("/api/v1/me", body: request)
                auth.updateUser(response.user)
                onNext()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "저장하지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}

/// 줄바꿈되는 칩 묶음 — 온보딩 관심사 선택용.
private struct FlowChips: View {
    let tags: [String]
    let isSelected: (String) -> Bool
    let onTap: (String) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                let on = isSelected(tag)
                Button {
                    onTap(tag)
                } label: {
                    Text(tag)
                        .font(.subheadline)
                        .foregroundStyle(on ? Theme.primaryText : Theme.secondaryText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(
                            on ? Theme.accent.opacity(0.85) : Theme.surface,
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - 4. 시급 설정

private struct WageStep: View {
    let onNext: () -> Void

    private enum WageType: String, CaseIterable, Identifiable {
        case hourly = "시급"
        case monthly = "월급"
        var id: String { rawValue }
    }

    @State private var wageType: WageType = .hourly
    @State private var amountText = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "wonsign.circle",
                title: "지금 내 1시간의 가치는?",
                subtitle: "시간을 자산으로 보는 출발점이에요.\n자산 탭의 모든 분석이 여기서 시작돼요."
            )

            Picker("급여 유형", selection: $wageType) {
                ForEach(WageType.allCases) { type in
                    Text(type.rawValue).tag(type)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 40)
            .padding(.bottom, 16)

            HStack(spacing: 8) {
                TextField(wageType == .hourly ? "예: 30000" : "예: 4000000", text: $amountText)
                    .keyboardType(.numberPad)
                    .foregroundStyle(Theme.primaryText)
                    .multilineTextAlignment(.trailing)
                Text("원")
                    .foregroundStyle(Theme.secondaryText)
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 40)

            if let hourlyText {
                Text(hourlyText)
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                    .padding(.top, 12)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)
                    .padding(.horizontal, 24)
            }

            Spacer()

            Text("프리랜서라 수입이 매달 다르면 건너뛰고,\n자산 탭에서 월 수입을 기록하면 실효 시급을 계산해 드려요.")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
                .padding(.horizontal, 24)
                .padding(.bottom, 12)

            primaryButton("저장하고 다음", disabled: amount == nil, busy: isSaving) { save() }
            skipButton { onNext() }
        }
    }

    private var amount: Double? {
        let cleaned = amountText.replacingOccurrences(of: ",", with: "")
        guard let value = Double(cleaned), value > 0 else { return nil }
        return value
    }

    /// 월급 입력 시 월 209시간 기준 환산 시급 미리보기.
    private var hourlyText: String? {
        guard wageType == .monthly, let amount else { return nil }
        let hourly = Int(amount / 209)
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        let text = formatter.string(from: NSNumber(value: hourly)) ?? "\(hourly)"
        return "시간당 약 ₩\(text) (월 209시간 기준)"
    }

    private func save() {
        guard let amount else { return }
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                struct SaveIncomeRequest: Encodable {
                    let incomeType: String
                    let amount: Double
                }
                struct SaveAck: Decodable {}
                let _: SaveAck = try await APIClient.shared.put(
                    "/api/v1/time-asset/settings",
                    body: SaveIncomeRequest(
                        incomeType: wageType == .hourly ? "hourly" : "monthly",
                        amount: amount
                    )
                )
                onNext()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "저장하지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}

// MARK: - 5. 캘린더 설정

private struct CalendarStep: View {
    let onNext: () -> Void
    @State private var google = GoogleSettingsViewModel()

    private var isConnected: Bool { google.status?.connected == true }

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "calendar.badge.plus",
                title: "캘린더를 연결해 주세요",
                subtitle: "기본 캘린더는 이미 만들어 뒀어요.\nGoogle 캘린더를 연결하면 기존 일정이 그대로 보여요."
            )

            if isConnected {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("Google 캘린더가 연결됐어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                }
                .padding(14)
                .frame(maxWidth: .infinity)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)
            }

            if let message = google.actionMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)
                    .padding(.horizontal, 24)
            }

            Spacer()

            if isConnected {
                primaryButton("다음", action: onNext)
                    .padding(.bottom, 20)
            } else {
                primaryButton("Google 캘린더 연결하기", busy: google.isConnecting) {
                    Task {
                        await google.connect()
                        if google.status?.connected == true {
                            onNext()
                        }
                    }
                }
                skipButton("기본 캘린더로 시작하기") { onNext() }
            }
        }
        .task { await google.load() }
    }
}

// MARK: - 5.5 알림 권한

private struct NotificationPermissionStep: View {
    let onNext: () -> Void
    @State private var isRequesting = false

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "bell.badge",
                title: "알림을 켜 주세요",
                subtitle: "예약 요청·일정 초대·팔로우한 사람의\n새 타임슬롯 소식을 놓치지 않게 알려드려요."
            )

            VStack(alignment: .leading, spacing: 10) {
                notificationExample(icon: "calendar.badge.clock", text: "새 예약 요청이 도착했어요")
                notificationExample(icon: "person.2", text: "OO님이 일정에 초대했어요")
                notificationExample(icon: "clock.badge.checkmark", text: "OO님이 커피챗 타임슬롯을 열었어요")
            }
            .padding(.horizontal, 24)

            Spacer()

            primaryButton("알림 허용", busy: isRequesting) {
                requestPermission()
            }
            skipButton { onNext() }
        }
    }

    private func notificationExample(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(Theme.accent)
                .frame(width: 26)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.primaryText)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private func requestPermission() {
        isRequesting = true
        Task {
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            isRequesting = false
            onNext()
        }
    }
}

// MARK: - 6. 이메일 인증 (이메일 가입만)

private struct VerifyEmailStep: View {
    @Environment(AuthViewModel.self) private var auth
    let onNext: () -> Void

    @State private var isChecking = false
    @State private var isResending = false
    @State private var infoMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "envelope.badge",
                title: "이메일을 인증해 주세요",
                subtitle: subtitle
            )

            if let infoMessage {
                Text(infoMessage)
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Spacer()

            Button {
                resend()
            } label: {
                Group {
                    if isResending {
                        ProgressView().tint(.white)
                    } else {
                        Text("인증 메일 다시 보내기")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .foregroundStyle(Theme.primaryText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isResending)
            .padding(.horizontal, 16)
            .padding(.bottom, 10)

            primaryButton("인증 완료했어요", busy: isChecking) { check() }
            skipButton("나중에 하기") { onNext() }
        }
    }

    private var subtitle: String {
        if let email = auth.user?.email, !email.isEmpty {
            return "\(email) 로 인증 메일을 보냈어요.\n메일 속 링크를 누르면 인증이 끝나요."
        }
        return "가입한 이메일로 인증 메일을 보냈어요.\n메일 속 링크를 누르면 인증이 끝나요."
    }

    private func check() {
        errorMessage = nil
        infoMessage = nil
        isChecking = true
        Task {
            defer { isChecking = false }
            do {
                let response: MeResponse = try await APIClient.shared.get("/api/v1/me")
                auth.updateUser(response.user)
                if response.user.emailVerified {
                    onNext()
                } else {
                    errorMessage = "아직 인증이 확인되지 않았어요. 메일함(스팸함 포함)을 확인해 주세요."
                }
            } catch {
                errorMessage = "확인하지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }

    private func resend() {
        errorMessage = nil
        infoMessage = nil
        isResending = true
        Task {
            defer { isResending = false }
            do {
                let _: AckResponse = try await APIClient.shared.post(
                    "/api/v1/me/resend-verification",
                    body: EmptyRequestBody()
                )
                infoMessage = "인증 메일을 다시 보냈어요."
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

// MARK: - 7. 팔로우 추천 (마지막)

private struct FollowStep: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var viewModel = FollowSuggestionsViewModel()

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                icon: "circle.dotted.circle",
                title: "함께할 사람을 팔로우해 보세요",
                subtitle: "팔로우한 사람들의 열리는 시간이\n오르빗 탭에 모여요. 나중에 바꿀 수 있어요."
            )

            content

            primaryButton(
                viewModel.followedCount > 0
                    ? "\(viewModel.followedCount)명 팔로우하고 시작하기"
                    : "시작하기"
            ) {
                auth.finishOnboarding()
            }
            .padding(.bottom, 20)
            .padding(.top, 8)
        }
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if let users = viewModel.users {
            if users.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "person.2")
                        .font(.system(size: 30, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text("아직 추천할 사람이 없어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                    Text("오르빗 탭에서 언제든 찾아볼 수 있어요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(users) { user in
                            SuggestedPersonRow(
                                user: user,
                                isFollowed: viewModel.followed.contains(user.username),
                                isBusy: viewModel.busy.contains(user.username)
                            ) {
                                Task { await viewModel.toggleFollow(user.username) }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                }
            }
        } else {
            ProgressView()
                .tint(Theme.accent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

#Preview {
    OnboardingFlowView()
        .environment(AuthViewModel())
        .tint(Theme.accent)
}
