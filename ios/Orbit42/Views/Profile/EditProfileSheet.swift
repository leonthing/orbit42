import PhotosUI
import SwiftUI
import UIKit

/// 프로필 편집 시트 — 아바타 / 이름 / 소개(500자) / 생년월일 / 소셜 링크 / 관심사.
/// - 아바타: 선택 즉시 JPEG 리사이즈(긴 변 1024, 품질 0.85) 후
///   `POST /api/v1/me/avatar` 업로드, 제거는 `DELETE /api/v1/me/avatar`.
/// - 나머지: 저장 시 바뀐 필드만 `PATCH /api/v1/me` → 응답 user 로 AuthViewModel 갱신.
struct EditProfileSheet: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    let user: User

    @State private var displayName: String
    @State private var bio: String
    @State private var hasBirthDate: Bool
    @State private var birthDate: Date
    @State private var socialLinks: [String: String]
    @State private var interests: [String]
    @State private var newInterest = ""

    @State private var photoItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    /// 공유(OG) 헤더 이미지
    @State private var sharePhotoItem: PhotosPickerItem?
    @State private var isUploadingShareImage = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private static let bioLimit = 500
    private static let interestsLimit = 10

    private static let birthDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    init(user: User) {
        self.user = user
        _displayName = State(initialValue: user.displayName ?? "")
        _bio = State(initialValue: user.bio ?? "")
        let parsedBirth = user.birthDate.flatMap { Self.birthDateFormatter.date(from: $0) }
        _hasBirthDate = State(initialValue: parsedBirth != nil)
        _birthDate = State(
            initialValue: parsedBirth
                ?? Calendar.current.date(from: DateComponents(year: 1990, month: 1, day: 1))
                ?? Date()
        )
        _socialLinks = State(initialValue: user.socialLinks ?? [:])
        _interests = State(initialValue: user.interests ?? [])
    }

    /// 아바타 업로드/제거 후에는 auth.user 가 최신이므로 그쪽을 우선한다.
    private var currentUser: User { auth.user ?? user }

    private var isBusy: Bool { isSaving || isUploadingAvatar }

    private var canSave: Bool {
        !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isBusy
    }

    var body: some View {
        NavigationStack {
            Form {
                avatarSection
                shareHeaderSection
                nameSection
                bioSection
                birthDateSection
                socialLinksSection
                interestsSection

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("프로필 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Button("저장") { save() }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .onChange(of: bio) { _, newValue in
                if newValue.count > Self.bioLimit {
                    bio = String(newValue.prefix(Self.bioLimit))
                }
            }
            .onChange(of: photoItem) { _, newItem in
                if let newItem {
                    uploadAvatar(newItem)
                }
            }
            .interactiveDismissDisabled(isBusy)
        }
    }

    // MARK: - 아바타

    private var avatarSection: some View {
        Section("프로필 사진") {
            HStack(spacing: 16) {
                avatarImage
                VStack(alignment: .leading, spacing: 10) {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("사진 변경", systemImage: "photo")
                            .font(.subheadline)
                    }
                    .disabled(isBusy)

                    if currentUser.avatarURL != nil {
                        Button(role: .destructive) {
                            removeAvatar()
                        } label: {
                            Label("사진 제거", systemImage: "trash")
                                .font(.subheadline)
                        }
                        .disabled(isBusy)
                    }
                }
                Spacer()
                if isUploadingAvatar {
                    ProgressView()
                        .tint(Theme.accent)
                }
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(Theme.surface)
    }

    private var avatarImage: some View {
        AsyncImage(url: currentUser.avatarURL) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.accent.opacity(0.25)
                    Text(String(currentUser.preferredName.prefix(1)).uppercased())
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(Circle())
    }

    // MARK: - 공유 헤더 이미지 (OG)

    private var shareHeaderSection: some View {
        Section {
            if let urlString = currentUser.shareImageUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        ZStack {
                            Color.white.opacity(0.05)
                            ProgressView().tint(Theme.secondaryText)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .listRowSeparator(.hidden)
            }

            PhotosPicker(selection: $sharePhotoItem, matching: .images) {
                HStack {
                    Label(
                        currentUser.shareImageUrl == nil ? "이미지 선택" : "이미지 바꾸기",
                        systemImage: "photo.badge.plus"
                    )
                    .foregroundStyle(Theme.accent)
                    Spacer()
                    if isUploadingShareImage {
                        ProgressView().tint(Theme.secondaryText)
                    }
                }
            }
            .disabled(isUploadingShareImage)
            .onChange(of: sharePhotoItem) { _, newItem in
                if let newItem { uploadShareImage(newItem) }
            }

            if currentUser.shareImageUrl != nil {
                Button(role: .destructive) {
                    removeShareImage()
                } label: {
                    Label("기본 카드로 되돌리기", systemImage: "arrow.uturn.backward")
                }
                .disabled(isUploadingShareImage)
            }
        } header: {
            Text("공유 헤더 이미지")
        } footer: {
            Text("프로필 링크를 공유할 때(카톡·문자 미리보기) 나오는 이미지예요. 설정하지 않으면 자동 명함 카드가 나가요. 가로 1200×630 비율을 권장해요.")
        }
        .listRowBackground(Theme.surface)
    }

    private func uploadShareImage(_ item: PhotosPickerItem) {
        errorMessage = nil
        isUploadingShareImage = true
        Task {
            defer {
                isUploadingShareImage = false
                sharePhotoItem = nil
            }
            do {
                guard let rawData = try await item.loadTransferable(type: Data.self),
                      let jpegData = Self.resizedJPEG(from: rawData, maxDimension: 1600)
                else {
                    errorMessage = "이미지를 불러오지 못했어요. 다른 사진을 골라 주세요."
                    return
                }
                struct ShareImageResponse: Decodable { let ok: Bool?; let shareImageUrl: String? }
                let _: ShareImageResponse = try await APIClient.shared.upload(
                    "/api/v1/me/share-image",
                    fileData: jpegData,
                    fieldName: "file",
                    fileName: "share.jpg",
                    mimeType: "image/jpeg"
                )
                let response: MeResponse = try await APIClient.shared.get("/api/v1/me")
                auth.updateUser(response.user)
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    private func removeShareImage() {
        errorMessage = nil
        isUploadingShareImage = true
        Task {
            defer { isUploadingShareImage = false }
            do {
                let _: AckResponse = try await APIClient.shared.delete("/api/v1/me/share-image")
                let response: MeResponse = try await APIClient.shared.get("/api/v1/me")
                auth.updateUser(response.user)
            } catch {
                errorMessage = "이미지를 제거하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 이름 / 소개

    private var nameSection: some View {
        Section("이름") {
            TextField("이름", text: $displayName)
                .foregroundStyle(.white)
        }
        .listRowBackground(Theme.surface)
    }

    private var bioSection: some View {
        Section {
            TextEditor(text: $bio)
                .frame(minHeight: 120)
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
        } header: {
            Text("소개")
        } footer: {
            Text("\(bio.count)/\(Self.bioLimit)")
                .frame(maxWidth: .infinity, alignment: .trailing)
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - 생년월일

    private var birthDateSection: some View {
        Section {
            Toggle("생년월일 등록", isOn: $hasBirthDate)
                .tint(Theme.accent)
            if hasBirthDate {
                DatePicker("생년월일", selection: $birthDate, displayedComponents: .date)
                    .foregroundStyle(.white)
            }
        } header: {
            Text("생년월일")
        } footer: {
            Text("생년월일은 Life Calendar 기능에 쓰여요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - 소셜 링크

    private var socialLinksSection: some View {
        Section {
            ForEach(SocialLinkKind.allCases) { kind in
                HStack(spacing: 12) {
                    Text(kind.label)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: 72, alignment: .leading)
                    TextField(kind.placeholder, text: socialLinkBinding(kind))
                        .foregroundStyle(.white)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.subheadline)
                }
            }
        } header: {
            Text("소셜 링크")
        } footer: {
            Text("프로필에 표시되는 링크예요. 블로그 글 자동 공유(X·페이스북 등) 연결은 웹 설정에서 할 수 있어요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    private func socialLinkBinding(_ kind: SocialLinkKind) -> Binding<String> {
        Binding(
            get: { socialLinks[kind.rawValue] ?? "" },
            set: { socialLinks[kind.rawValue] = $0 }
        )
    }

    // MARK: - 관심사

    private var interestsSection: some View {
        Section {
            ForEach(interests, id: \.self) { interest in
                HStack {
                    Text(interest)
                        .foregroundStyle(.white)
                    Spacer()
                    Button {
                        interests.removeAll { $0 == interest }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .buttonStyle(.borderless)
                }
            }

            if interests.count < Self.interestsLimit {
                HStack(spacing: 12) {
                    TextField("관심사 추가 (예: 커피, 스타트업)", text: $newInterest)
                        .foregroundStyle(.white)
                        .onSubmit { addInterest() }
                    Button("추가") { addInterest() }
                        .disabled(
                            newInterest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        )
                        .buttonStyle(.borderless)
                        .fontWeight(.semibold)
                }
            }
        } header: {
            Text("관심사")
        } footer: {
            Text("\(interests.count)/\(Self.interestsLimit)")
                .frame(maxWidth: .infinity, alignment: .trailing)
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    private func addInterest() {
        let trimmed = newInterest.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              interests.count < Self.interestsLimit,
              !interests.contains(trimmed)
        else { return }
        interests.append(trimmed)
        newInterest = ""
    }

    // MARK: - 아바타 업로드/제거

    private func uploadAvatar(_ item: PhotosPickerItem) {
        errorMessage = nil
        isUploadingAvatar = true
        Task {
            defer {
                isUploadingAvatar = false
                photoItem = nil
            }
            do {
                guard let rawData = try await item.loadTransferable(type: Data.self),
                      let jpegData = Self.resizedJPEG(from: rawData)
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
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    private func removeAvatar() {
        errorMessage = nil
        isUploadingAvatar = true
        Task {
            defer { isUploadingAvatar = false }
            do {
                let _: AckResponse = try await APIClient.shared.delete("/api/v1/me/avatar")
                let response: MeResponse = try await APIClient.shared.get("/api/v1/me")
                auth.updateUser(response.user)
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "사진을 제거하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    /// JPEG 리사이즈 — 최대 긴 변 1024px, 품질 0.85. (서버 3MB 제한 대응)
    private static func resizedJPEG(
        from data: Data,
        maxDimension: CGFloat = 1024,
        quality: CGFloat = 0.85
    ) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        guard longest > 0 else { return nil }
        let scale = min(1, maxDimension / longest)
        let targetSize = CGSize(
            width: (image.size.width * scale).rounded(),
            height: (image.size.height * scale).rounded()
        )
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return resized.jpegData(compressionQuality: quality)
    }

    // MARK: - 저장 (바뀐 필드만 PATCH)

    private func save() {
        errorMessage = nil

        var request = UpdateProfileRequest()

        let trimmedName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedName != (user.displayName ?? "") {
            request.displayName = trimmedName
        }

        let trimmedBio = bio.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedBio != (user.bio ?? "") {
            request.bio = trimmedBio
        }

        let newBirthDate: String? = hasBirthDate
            ? Self.birthDateFormatter.string(from: birthDate)
            : nil
        if newBirthDate != user.birthDate {
            request.birthDate = newBirthDate.map { .value($0) } ?? .null
        }

        var cleanedLinks: [String: String] = [:]
        for kind in SocialLinkKind.allCases {
            let value = (socialLinks[kind.rawValue] ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty {
                cleanedLinks[kind.rawValue] = value
            }
        }
        if cleanedLinks != (user.socialLinks ?? [:]) {
            request.socialLinks = cleanedLinks
        }

        if interests != (user.interests ?? []) {
            request.interests = interests
        }

        guard !request.isEmpty else {
            dismiss()
            return
        }

        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let response: MeResponse = try await APIClient.shared.patch(
                    "/api/v1/me",
                    body: request
                )
                auth.updateUser(response.user)
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    EditProfileSheet(
        user: User(
            username: "leo",
            displayName: "Leo Kim",
            email: "leo@example.com",
            avatarUrl: nil,
            emailVerified: true,
            bio: "시간을 파는 사람",
            birthDate: "1990-01-01",
            socialLinks: ["instagram": "https://instagram.com/leo"],
            interests: ["커피", "스타트업"]
        )
    )
    .environment(AuthViewModel())
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
