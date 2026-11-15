import PhotosUI
import SwiftUI

// MARK: - 글·사진 (1.10.0 시험 — 내부 계정만, PostsStore.open 일 때만 보인다)

/// 프로필(내 것·남의 것)의 '글·사진' 행
struct PostsEntryRow: View {
    let username: String
    let isMe: Bool
    var displayName: String? = nil

    var body: some View {
        if PostsStore.shared.open && !BrowseMode.shared.active {
            NavigationLink {
                PostsListView(username: username, isMe: isMe, displayName: displayName)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.body)
                        .foregroundStyle(Theme.accent)
                        .frame(width: 26)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("글·사진")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.primaryText)
                        Text(isMe ? "작업 사진과 소식을 올려요" : "\(displayName ?? username)님의 글과 사진")
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }
                .padding(14)
                .frame(minHeight: 44)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("postsEntry")
        }
    }
}

// MARK: - 목록

struct PostsListView: View {
    let username: String
    let isMe: Bool
    var displayName: String? = nil

    @State private var posts: [Post] = []
    @State private var nextBefore: String?
    @State private var loading = false
    @State private var loaded = false
    @State private var errorMessage: String?
    @State private var composing = false
    @State private var pendingDelete: Post?
    @State private var openPost: Post?

    private let columns = [GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3)]

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle(isMe ? "내 글·사진" : "글·사진")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isMe {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        composing = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Theme.accent)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .accessibilityLabel("새 글")
                    .accessibilityIdentifier("newPost")
                }
            }
        }
        .sheet(isPresented: $composing) {
            PostComposeView(existing: nil) { _ in Task { await load(reset: true) } }
        }
        .navigationDestination(item: $openPost) { post in
            PostDetailView(postId: post.id) { Task { await load(reset: true) } }
        }
        .confirmationDialog("이 글을 지울까요? 사진도 함께 지워져요.", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
            Button("삭제", role: .destructive) {
                if let p = pendingDelete { Task { await delete(p) } }
            }
            Button("취소", role: .cancel) {}
        }
        .task { if !loaded { await load(reset: true) } }
        .refreshable { await load(reset: true) }
        .onChange(of: PostsStore.shared.revision) { Task { await load(reset: true) } }
    }

    @ViewBuilder
    private var content: some View {
        if !loaded && loading {
            ProgressView().tint(Theme.accent)
        } else if let errorMessage, posts.isEmpty {
            VStack(spacing: 10) {
                Text(errorMessage).font(.footnote).foregroundStyle(Theme.secondaryText).multilineTextAlignment(.center)
                Button("다시 시도") { Task { await load(reset: true) } }
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 44)
            }
            .padding(32)
        } else if posts.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Theme.secondaryText)
                Text(isMe ? "아직 올린 글이 없어요" : "아직 올린 글이 없어요")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                if isMe {
                    Text("작업 사진이나 소식을 올리면 프로필을 찾은 분들이 볼 수 있어요.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .multilineTextAlignment(.center)
                    Button {
                        composing = true
                    } label: {
                        Text("첫 글 쓰기")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 22)
                            .frame(minHeight: 44)
                            .background(Theme.accent, in: Capsule())
                    }
                }
            }
            .padding(32)
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 3) {
                    ForEach(posts) { post in
                        Button {
                            openPost = post
                        } label: {
                            PostTile(post: post)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("postTile")
                        .contextMenu {
                            if post.mine {
                                Button {
                                    Task { await setPublic(post, !post.isPublic) }
                                } label: {
                                    Label(post.isPublic ? "나만 보기로 바꾸기" : "전체 공개로 바꾸기", systemImage: post.isPublic ? "lock" : "globe")
                                }
                                if post.isPublic || post.isPinned {
                                    Button {
                                        Task { await setPinned(post, !post.isPinned) }
                                    } label: {
                                        Label(post.isPinned ? "링크 페이지 고정 풀기" : "링크 페이지 맨 위에 고정", systemImage: post.isPinned ? "pin.slash" : "pin")
                                    }
                                }
                                Button(role: .destructive) {
                                    pendingDelete = post
                                } label: {
                                    Label("삭제", systemImage: "trash")
                                }
                            }
                        }
                        .onAppear {
                            if post.id == posts.last?.id, nextBefore != nil { Task { await load(reset: false) } }
                        }
                    }
                }
                .padding(.top, 3)
                if isMe {
                    Text("길게 누르면 공개 범위·고정·삭제를 바꿀 수 있어요")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .padding(.top, 10)
                }
            }
        }
    }

    private func load(reset: Bool) async {
        guard !loading else { return }
        loading = true
        defer { loading = false; loaded = true }
        var path = "/api/v1/posts"
        var q: [String] = []
        if !isMe { q.append("user=\(username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? username)") }
        if !reset, let nextBefore { q.append("before=\(nextBefore.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? nextBefore)") }
        if !q.isEmpty { path += "?" + q.joined(separator: "&") }
        do {
            let r: PostsListResponse = try await APIClient.shared.get(path)
            posts = reset ? r.posts : posts + r.posts
            nextBefore = r.nextBefore
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setPublic(_ post: Post, _ on: Bool) async {
        do {
            let _: PostResponse = try await APIClient.shared.patch("/api/v1/posts/\(post.id)", body: PostPublicRequest(public: on))
            await load(reset: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setPinned(_ post: Post, _ on: Bool) async {
        do {
            let _: PostPinResponse = on
                ? try await APIClient.shared.put("/api/v1/posts/\(post.id)/pin", body: PostEmptyBody())
                : try await APIClient.shared.delete("/api/v1/posts/\(post.id)/pin")
            await load(reset: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ post: Post) async {
        do {
            let _: PostOkResponse = try await APIClient.shared.delete("/api/v1/posts/\(post.id)")
            posts.removeAll { $0.id == post.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// 목록의 정사각 칸 — 첫 사진, 사진이 없으면 글자 카드
private struct PostTile: View {
    let post: Post

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                if let url = post.photos.first?.url.flatMap(URL.init(string:)) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            // 채우기 그림이 칸 밖으로 커지지 않게(눌리는 영역이 옆 칸까지 번지던 것)
                            image.resizable().scaledToFill()
                                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                        } else {
                            Theme.surface
                        }
                    }
                } else {
                    ZStack {
                        Theme.surface
                        Text(post.title.isEmpty ? PostMarkdown.clean(post.body).replacingOccurrences(of: #"[#>*_~`]"#, with: "", options: .regularExpression) : post.title)
                            .font(.caption)
                            .foregroundStyle(Theme.primaryText)
                            .lineLimit(5)
                            .padding(8)
                    }
                }
            }
            .clipped()
            .contentShape(Rectangle())
            .overlay(alignment: .topTrailing) {
                HStack(spacing: 4) {
                    if post.isPinned { Image(systemName: "pin.fill") }
                    if post.photoCount > 1 { Image(systemName: "square.on.square") }
                    if post.isDraft {
                        Text("임시 저장").padding(.horizontal, 4).background(.black.opacity(0.55), in: Capsule())
                    } else if !post.isPublic { Image(systemName: "lock.fill") }
                    if post.hidden { Image(systemName: "eye.slash.fill") }
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white)
                .shadow(radius: 2)
                .padding(6)
            }
            .accessibilityLabel(([post.title.isEmpty ? "사진 글" : post.title]
                + (post.isPinned ? ["고정됨"] : [])
                + (post.isDraft ? ["임시 저장"] : (post.isPublic ? [] : ["나만 보기"]))
                + (post.hidden ? ["숨겨짐"] : [])).joined(separator: ", "))
    }
}

// MARK: - 쓰기·고치기

/// 쓰기 화면의 사진 한 칸 — 이미 올린 것(remote) 또는 고른 것(local)
private struct ComposePhoto: Identifiable, Equatable {
    let id: String
    var remote: PostPhoto?
    var jpeg: Data?
    var thumb: UIImage?
    /// 사진 설명(선택, 200자)
    var caption = ""
    /// 서버에 저장된 설명 — 바뀐 것만 보낸다
    var savedCaption = ""
    /// 올리다 실패
    var failed = false

    static func == (a: ComposePhoto, b: ComposePhoto) -> Bool { a.id == b.id && a.remote == b.remote && a.failed == b.failed && a.jpeg == b.jpeg && a.caption == b.caption }
}

struct PostComposeView: View {
    let existing: Post?
    var onSaved: (Post) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var photos: [ComposePhoto] = []
    @State private var removedRemoteIds: [String] = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var title = ""
    @State private var bodyText = ""
    @State private var isPublic = true
    @State private var postId: String?
    @State private var saving = false
    @State private var progress: (done: Int, total: Int)?
    @State private var errorMessage: String?
    @State private var importing = false
    @State private var confirmClose = false
    /// 임시 저장으로 닫는 중(공개 범위를 나만 보기로 두고 저장)
    @State private var savingDraft = false

    private let maxPhotos = 10

    init(existing: Post?, onSaved: @escaping (Post) -> Void) {
        self.existing = existing
        self.onSaved = onSaved
        _title = State(initialValue: existing?.title ?? "")
        _bodyText = State(initialValue: existing?.body ?? "")
        _isPublic = State(initialValue: existing?.isPublic ?? true)
        _postId = State(initialValue: existing?.id)
        _photos = State(initialValue: (existing?.photos ?? []).map {
            ComposePhoto(id: $0.id, remote: $0, caption: $0.caption ?? "", savedCaption: $0.caption ?? "")
        })
    }

    /// 처음 연 때와 달라진 게 있는지 — 닫을 때 물어볼지
    private var dirty: Bool {
        if title != (existing?.title ?? "") || bodyText != (existing?.body ?? "") { return true }
        if !removedRemoteIds.isEmpty || photos.contains(where: { $0.remote == nil || $0.caption != $0.savedCaption }) { return true }
        if let existing, photos.map(\.id) != existing.photos.map(\.id) { return true }
        return false
    }

    /// 이미 공개된 글을 고치는 중인지(임시 저장 대신 '저장하고 닫기')
    private var editingPublic: Bool { existing?.isPublic ?? false }

    private var isEmpty: Bool {
        photos.isEmpty && title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    photoStrip
                    PhotosPicker(selection: $pickerItems, maxSelectionCount: max(1, maxPhotos - photos.count), matching: .images) {
                        Label(photos.isEmpty ? "사진 고르기 (최대 10장)" : "사진 더 고르기 (\(photos.count)/10)", systemImage: "photo.badge.plus")
                            .frame(minHeight: 44)
                    }
                    .disabled(photos.count >= maxPhotos || saving)
                    .accessibilityIdentifier("pickPhotos")
                } header: {
                    Text("사진")
                } footer: {
                    Text("첫 사진이 대표 사진이에요 — 목록과 공유 미리보기에 보여요. 화살표로 순서를 바꿔요. 사진 속 촬영 위치 같은 정보는 올리기 전에 지워져요.")
                }

                Section {
                    TextField("제목", text: $title)
                        .accessibilityIdentifier("postTitle")
                    TextField("내용", text: $bodyText, axis: .vertical)
                        .lineLimit(4...12)
                        .accessibilityIdentifier("postBody")
                } header: {
                    Text("글 (선택)")
                } footer: {
                    Text(verbatim: "## 소제목 · **굵게** · - 목록 · > 인용 · [글자](주소). 주소는 그대로 붙여도 링크가 돼요.")
                }

                Section {
                    Picker("공개 범위", selection: $isPublic) {
                        Text("전체 공개").tag(true)
                        Text("나만 보기").tag(false)
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("postVisibility")
                } footer: {
                    Text(isPublic ? "프로필을 찾은 누구나 볼 수 있어요." : "나에게만 보여요. 나중에 공개로 바꿀 수 있어요.")
                }

                if let progress {
                    Section {
                        HStack(spacing: 10) {
                            ProgressView(value: Double(progress.done), total: Double(max(progress.total, 1)))
                                .tint(Theme.accent)
                            Text("사진 올리는 중 \(progress.done)/\(progress.total)")
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                                .monospacedDigit()
                        }
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                        if photos.contains(where: { $0.failed }) {
                            Button("다시 올리기") { Task { await save() } }
                                .frame(minHeight: 44)
                                .accessibilityIdentifier("retryUpload")
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(existing == nil ? "새 글" : "글 고치기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") {
                        if dirty && !isEmpty { confirmClose = true } else { dismiss() }
                    }
                    .disabled(saving)
                    .accessibilityIdentifier("closeCompose")
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button(existing == nil ? "올리기" : "저장") { Task { await save() } }
                            .disabled(isEmpty || importing)
                            .accessibilityIdentifier("savePost")
                    }
                }
            }
            // 쓴 게 있으면 쓸어내려 닫지 못하게 하고 '취소'에서 물어본다(쓴 글이 날아가지 않게)
            .interactiveDismissDisabled(saving || (dirty && !isEmpty))
            .confirmationDialog(editingPublic ? "고친 내용을 저장할까요?" : "임시 저장할까요?", isPresented: $confirmClose, titleVisibility: .visible) {
                if editingPublic {
                    Button("저장하고 닫기") { Task { await save() } }
                } else {
                    Button("나만 보기로 임시 저장") { Task { await save(asDraft: true) } }
                        .accessibilityIdentifier("saveDraft")
                }
                Button(editingPublic ? "고친 내용 버리기" : "버리기", role: .destructive) { dismiss() }
                Button("계속 쓰기", role: .cancel) {}
            } message: {
                Text(editingPublic ? "저장하지 않으면 고친 내용이 사라져요." : "나만 보기로 저장해 두면 내 목록에서 이어 쓸 수 있어요.")
            }
            .onChange(of: pickerItems) { _, items in
                guard !items.isEmpty else { return }
                Task { await importPicked(items) }
            }
            .task {
                #if DEBUG
                await debugInjectPhotos()
                #endif
            }
        }
    }

    @ViewBuilder
    private var photoStrip: some View {
        if !photos.isEmpty || importing {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                        VStack(spacing: 6) {
                            thumb(photo)
                                .frame(width: 132, height: 132)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(alignment: .topLeading) {
                                    Text(index == 0 ? "대표" : "\(index + 1)")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .background(index == 0 ? Theme.accent : .black.opacity(0.55), in: Capsule())
                                        .padding(5)
                                }
                                .overlay {
                                    if photo.failed {
                                        RoundedRectangle(cornerRadius: 10).stroke(.red, lineWidth: 2)
                                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                                    }
                                }
                            HStack(spacing: 0) {
                                Button { move(index, by: -1) } label: {
                                    Image(systemName: "chevron.left").frame(width: 44, height: 44)
                                }
                                .disabled(index == 0 || saving)
                                .accessibilityLabel("앞으로")
                                Button(role: .destructive) { remove(index) } label: {
                                    Image(systemName: "xmark.circle.fill").frame(width: 44, height: 44)
                                }
                                .disabled(saving)
                                .accessibilityLabel("사진 빼기")
                                Button { move(index, by: 1) } label: {
                                    Image(systemName: "chevron.right").frame(width: 44, height: 44)
                                }
                                .disabled(index == photos.count - 1 || saving)
                                .accessibilityLabel("뒤로")
                            }
                            .buttonStyle(.borderless)
                            .font(.footnote.weight(.semibold))
                            TextField("설명 (선택)", text: Binding(
                                get: { photos.indices.contains(index) ? photos[index].caption : "" },
                                set: { v in if photos.indices.contains(index) { photos[index].caption = String(v.prefix(200)) } }
                            ))
                            .font(.caption)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 132)
                            .frame(minHeight: 44)
                            .disabled(saving)
                            .accessibilityLabel("사진 \(index + 1) 설명")
                            .accessibilityIdentifier("photoCaption")
                        }
                    }
                    if importing {
                        ProgressView().frame(width: 132, height: 132)
                    }
                }
                .padding(.vertical, 4)
            }
            .accessibilityIdentifier("photoStrip")
        }
    }

    @ViewBuilder
    private func thumb(_ photo: ComposePhoto) -> some View {
        if let image = photo.thumb {
            Image(uiImage: image).resizable().scaledToFill()
        } else if let url = photo.remote?.url.flatMap(URL.init(string:)) {
            AsyncImage(url: url) { phase in
                if let image = phase.image { image.resizable().scaledToFill() } else { Theme.surface }
            }
        } else {
            Theme.surface
        }
    }

    private func move(_ index: Int, by delta: Int) {
        let to = index + delta
        guard photos.indices.contains(index), photos.indices.contains(to) else { return }
        photos.swapAt(index, to)
    }

    private func remove(_ index: Int) {
        guard photos.indices.contains(index) else { return }
        if let r = photos[index].remote { removedRemoteIds.append(r.id) }
        photos.remove(at: index)
    }

    private func importPicked(_ items: [PhotosPickerItem]) async {
        importing = true
        defer { importing = false; pickerItems = [] }
        for item in items {
            guard photos.count < maxPhotos else { break }
            guard let data = try? await item.loadTransferable(type: Data.self) else {
                errorMessage = "사진 한 장을 불러오지 못했어요."
                continue
            }
            let jpeg = await Task.detached(priority: .userInitiated) { PostImage.jpeg(from: data) }.value
            guard let jpeg else {
                errorMessage = "읽을 수 없는 사진이 있어 뺐어요."
                continue
            }
            photos.append(ComposePhoto(id: UUID().uuidString, jpeg: jpeg, thumb: UIImage(data: jpeg)?.preparingThumbnail(of: CGSize(width: 300, height: 300))))
        }
    }

    /// 저장: (새 글이면 나만 보기로 먼저 만들기) → 뺀 사진 지우기 → 새 사진 올리기 → 순서 → 글·공개 범위.
    /// 사진 하나라도 못 올리면 거기서 멈추고 '다시 올리기'로 이어서 한다(올라간 사진은 다시 안 올림).
    private func save(asDraft: Bool = false) async {
        guard !saving, !isEmpty else { return }
        if asDraft { isPublic = false }
        saving = true
        errorMessage = nil
        defer { saving = false; progress = nil }
        let api = APIClient.shared
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanBody = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            if postId == nil {
                let r: PostResponse = try await api.post("/api/v1/posts", body: PostWriteRequest(title: cleanTitle, body: cleanBody, public: false))
                postId = r.post.id
            }
            guard let id = postId else { return }
            for rid in removedRemoteIds {
                let _: PostOkResponse = try await api.delete("/api/v1/posts/\(id)/photos/\(rid)")
            }
            removedRemoteIds = []
            let pending = photos.indices.filter { photos[$0].remote == nil }
            if !pending.isEmpty {
                progress = (0, pending.count)
                var failures = 0
                for (n, i) in pending.enumerated() {
                    guard let jpeg = photos[i].jpeg else { continue }
                    do {
                        let r: PostPhotoResponse = try await api.upload("/api/v1/posts/\(id)/photos", fileData: jpeg, fieldName: "photo", fileName: "photo.jpg", mimeType: "image/jpeg")
                        photos[i].remote = r.photo
                        photos[i].failed = false
                    } catch {
                        photos[i].failed = true
                        failures += 1
                        errorMessage = error.localizedDescription
                    }
                    progress = (n + 1, pending.count)
                }
                if failures > 0 {
                    errorMessage = "사진 \(failures)장을 올리지 못했어요. 연결을 확인하고 다시 올려 주세요."
                    return
                }
            }
            for i in photos.indices {
                guard let rid = photos[i].remote?.id else { continue }
                let want = photos[i].caption.trimmingCharacters(in: .whitespacesAndNewlines)
                guard want != photos[i].savedCaption else { continue }
                let r: PostCaptionResponse = try await api.patch("/api/v1/posts/\(id)/photos/\(rid)", body: PostCaptionRequest(caption: want.isEmpty ? nil : want))
                photos[i].savedCaption = r.caption ?? ""
                photos[i].caption = r.caption ?? ""
            }
            let order = photos.compactMap { $0.remote?.id }
            if order.count > 1 {
                let _: PostResponse = try await api.put("/api/v1/posts/\(id)/photos", body: PostOrderRequest(order: order))
            }
            let r: PostResponse = try await api.patch("/api/v1/posts/\(id)", body: PostWriteRequest(title: cleanTitle, body: cleanBody, public: isPublic))
            PostsStore.shared.bump()
            onSaved(r.post)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    #if DEBUG
    /// 시뮬레이터 실측용: DEMO_POST_PHOTOS=3 이면 색 사진 n장을 고른 것처럼 넣는다(사진 앱 없이 쓰기 화면 시험)
    private func debugInjectPhotos() async {
        guard existing == nil, photos.isEmpty, let n = Int(ProcessInfo.processInfo.environment["DEMO_POST_PHOTOS"] ?? "") else { return }
        let colors: [UIColor] = [.systemIndigo, .systemTeal, .systemOrange, .systemPink, .systemGreen]
        for i in 0..<min(n, 10) {
            let size = CGSize(width: 1600, height: 1200)
            let f = UIGraphicsImageRendererFormat(); f.scale = 1
            let img = UIGraphicsImageRenderer(size: size, format: f).image { ctx in
                colors[i % colors.count].setFill(); ctx.fill(CGRect(origin: .zero, size: size))
                let s = "\(i + 1)" as NSString
                s.draw(at: CGPoint(x: 80, y: 60), withAttributes: [.font: UIFont.systemFont(ofSize: 320, weight: .bold), .foregroundColor: UIColor.white.withAlphaComponent(0.9)])
            }
            if let jpeg = PostImage.jpeg(from: img) {
                photos.append(ComposePhoto(id: UUID().uuidString, jpeg: jpeg, thumb: UIImage(data: jpeg)))
            }
        }
        if let t = ProcessInfo.processInfo.environment["DEMO_POST_TITLE"] { title = t }
        if let b = ProcessInfo.processInfo.environment["DEMO_POST_BODY"] { bodyText = b.replacingOccurrences(of: "\\n", with: "\n") }
        if let c = ProcessInfo.processInfo.environment["DEMO_POST_CAPTION"], !photos.isEmpty { photos[0].caption = c }
    }
    #endif
}

// MARK: - 상세

struct PostDetailView: View {
    let postId: String
    var onChanged: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @State private var post: Post?
    @State private var errorMessage: String?
    @State private var page = 0
    @State private var liking = false
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var reporting = false
    @State private var confirmBlock = false
    @State private var notice: String?
    @State private var bookingURL: IdentifiableURL?
    @State private var working = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if let post {
                loaded(post)
            } else if let errorMessage {
                VStack(spacing: 10) {
                    Text(errorMessage).font(.footnote).foregroundStyle(Theme.secondaryText).multilineTextAlignment(.center)
                    Button("다시 시도") { Task { await load() } }.frame(minHeight: 44)
                }
                .padding(32)
            } else {
                ProgressView().tint(Theme.accent)
            }
        }
        .navigationTitle(post.map { $0.mine ? "내 글" : $0.author.preferredName } ?? "글")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let post {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if post.mine {
                            Button { editing = true } label: { Label("고치기", systemImage: "pencil") }
                            if !post.hidden {
                                Button { Task { await setPublic(!post.isPublic) } } label: {
                                    Label(post.isPublic ? "나만 보기로 바꾸기" : "전체 공개로 바꾸기", systemImage: post.isPublic ? "lock" : "globe")
                                }
                                if post.isPublic || post.isPinned {
                                    Button { Task { await setPinned(!post.isPinned) } } label: {
                                        Label(post.isPinned ? "링크 페이지 고정 풀기" : "링크 페이지 맨 위에 고정", systemImage: post.isPinned ? "pin.slash" : "pin")
                                    }
                                }
                            }
                            Button(role: .destructive) { confirmDelete = true } label: { Label("삭제", systemImage: "trash") }
                        } else {
                            Button(role: .destructive) { reporting = true } label: { Label("신고하기", systemImage: "exclamationmark.bubble") }
                            Button(role: .destructive) { confirmBlock = true } label: { Label("\(post.author.preferredName)님 차단하기", systemImage: "hand.raised") }
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .foregroundStyle(Theme.primaryText)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .accessibilityLabel("더보기")
                    .accessibilityIdentifier("postMenu")
                }
            }
        }
        .sheet(isPresented: $editing) {
            if let post {
                PostComposeView(existing: post) { updated in
                    self.post = updated
                    Task { await load() }
                    onChanged()
                }
            }
        }
        .sheet(item: $bookingURL) { item in
            SafariView(url: item.url).ignoresSafeArea()
        }
        .confirmationDialog("이 글을 지울까요? 사진도 함께 지워져요.", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("삭제", role: .destructive) { Task { await delete() } }
            Button("취소", role: .cancel) {}
        }
        .confirmationDialog("신고 사유를 골라 주세요", isPresented: $reporting, titleVisibility: .visible) {
            ForEach(["스팸·광고", "불쾌하거나 부적절한 내용", "사칭·저작권 침해", "기타"], id: \.self) { reason in
                Button(reason) { Task { await report(reason) } }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("운영자가 24시간 안에 확인하고 조치해요.")
        }
        .confirmationDialog("차단하면 서로 팔로우가 해제되고, 서로의 글·대화·예약이 막혀요.", isPresented: $confirmBlock, titleVisibility: .visible) {
            Button("차단하기", role: .destructive) { Task { await block() } }
            Button("취소", role: .cancel) {}
        }
        .alert("안내", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(notice ?? "")
        }
        .task { if post == nil { await load() } }
    }

    private func loaded(_ post: Post) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if post.hidden {
                    Label("운영 정책으로 숨겨진 글이에요. 다른 사람에게는 보이지 않아요.", systemImage: "eye.slash")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                        .padding(.horizontal, 16)
                }
                if post.mine && post.isDraft && !post.hidden {
                    // 임시 저장 글 — 바로 올리기(전체 공개). 메뉴를 찾지 않아도 되게(PO 11/15)
                    HStack(spacing: 10) {
                        Label("임시 저장한 글이에요. 나에게만 보여요.", systemImage: "lock.fill")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                        Spacer(minLength: 0)
                        Button {
                            Task { await setPublic(true) }
                        } label: {
                            Text(working ? "올리는 중…" : "올리기")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .frame(minHeight: 40)
                                .background(Theme.accent, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(working)
                        .accessibilityIdentifier("publishDraft")
                    }
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 16)
                }
                if !post.photos.isEmpty {
                    photoPager(post)
                }
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text(post.author.preferredName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        Text("@\(post.author.username)")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                        if !post.isPublic {
                            Label("나만 보기", systemImage: "lock.fill")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.secondaryText)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Theme.surface, in: Capsule())
                        }
                        Spacer(minLength: 0)
                        Text(Self.dateText(post.publishedAt ?? post.createdAt) + (post.editedAt != nil ? " · 수정됨" : ""))
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                            .accessibilityIdentifier("postDate")
                    }
                    if post.isPinned {
                        // 방문자에게는 짧게 — '링크 페이지 맨 위'는 글쓴이용 설명(PO 11/15)
                        Label(post.mine ? "링크 페이지 맨 위에 고정한 글" : "고정한 글", systemImage: "pin.fill")
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    if !post.title.isEmpty {
                        Text(post.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(Theme.primaryText)
                    }
                    if !post.body.isEmpty {
                        PostBodyView(text: post.body)
                            .accessibilityIdentifier("postBodyView")
                    }
                    HStack(spacing: 12) {
                        Button {
                            Task { await toggleLike() }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: post.liked ? "heart.fill" : "heart")
                                    .foregroundStyle(post.liked ? Theme.satisfaction : Theme.primaryText)
                                Text("\(post.likeCount)")
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.primaryText)
                            }
                            .font(.body.weight(.medium))
                            .padding(.horizontal, 14)
                            .frame(minHeight: 44)
                            .background(Theme.surface, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(liking || (post.mine && !post.isPublic))
                        .accessibilityLabel(post.liked ? "하트 취소" : "하트")
                        .accessibilityIdentifier("postLike")
                        if post.isPublic && !post.hidden, let url = post.url.flatMap(URL.init(string:)) {
                            ShareLink(item: url, subject: Text(post.title.isEmpty ? "\(post.author.preferredName)님의 글" : post.title)) {
                                Label("공유", systemImage: "square.and.arrow.up")
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.primaryText)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 44)
                                    .background(Theme.surface, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("postShare")
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.top, 4)
                    // 날짜는 서버 상수(POSTS_PUBLIC_FROM) 한 곳에서 — 공개 스위치가 켜지면 서버가 null 을 보내 사라진다
                    if post.mine, post.isPublic, !post.hidden, post.shareable == false, let notice = post.publicNotice, !notice.isEmpty {
                        Text(notice)
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    if !post.mine, let url = post.bookingUrl.flatMap(URL.init(string:)) {
                        Button {
                            bookingURL = IdentifiableURL(url: url)
                        } label: {
                            Label("\(post.author.preferredName)님에게 예약하기", systemImage: "calendar.badge.plus")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 6)
                        .accessibilityIdentifier("postBook")
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 12)
            // 떠 있는 탭 막대 위로 하트·공유·예약하기가 다 보이게(PO 11/15)
            .padding(.bottom, 96)
            .readableWidth()
        }
        .refreshable { await load() }
    }

    private func photoPager(_ post: Post) -> some View {
        let ratio = post.photos.first.map { CGFloat($0.width) / CGFloat(max($0.height, 1)) } ?? 1
        // 첫 사진 비율을 따르되 너무 길거나 납작하지 않게(4:5 ~ 1.91:1)
        let clamped = min(max(ratio, 0.8), 1.91)
        return VStack(spacing: 8) {
            TabView(selection: $page) {
                ForEach(Array(post.photos.enumerated()), id: \.element.id) { index, photo in
                    AsyncImage(url: photo.url.flatMap(URL.init(string:))) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFit()
                        case .failure: Image(systemName: "photo").foregroundStyle(Theme.secondaryText)
                        default: ProgressView().tint(Theme.accent)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.04))
                    .tag(index)
                    .accessibilityLabel(photo.caption.flatMap { $0.isEmpty ? nil : $0 } ?? "사진 \(index + 1) / \(post.photos.count)")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .aspectRatio(clamped, contentMode: .fit)
            .accessibilityIdentifier("photoPager")
            if post.photos.indices.contains(page), let cap = post.photos[page].caption, !cap.isEmpty {
                Text(cap)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier("photoCaptionText")
            }
            if post.photos.count > 1 {
                HStack(spacing: 6) {
                    ForEach(0..<post.photos.count, id: \.self) { i in
                        Circle()
                            .fill(i == page ? Theme.accent : Theme.secondaryText.opacity(0.35))
                            .frame(width: 6, height: 6)
                    }
                }
                .accessibilityHidden(true)
            }
        }
    }

    private func load() async {
        do {
            let r: PostResponse = try await APIClient.shared.get("/api/v1/posts/\(postId)")
            post = r.post
            if page >= r.post.photos.count { page = 0 }
            errorMessage = nil
        } catch let e as APIError where e.isNotSupported {
            errorMessage = "글을 찾을 수 없어요. 지워졌거나 나만 보기로 바뀌었을 수 있어요."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setPublic(_ on: Bool) async {
        guard !working else { return }
        working = true
        defer { working = false }
        do {
            let _: PostResponse = try await APIClient.shared.patch("/api/v1/posts/\(postId)", body: PostPublicRequest(public: on))
            await load()
            PostsStore.shared.bump()
            onChanged()
        } catch {
            notice = error.localizedDescription
        }
    }

    private func setPinned(_ on: Bool) async {
        guard !working else { return }
        working = true
        defer { working = false }
        do {
            let _: PostPinResponse = on
                ? try await APIClient.shared.put("/api/v1/posts/\(postId)/pin", body: PostEmptyBody())
                : try await APIClient.shared.delete("/api/v1/posts/\(postId)/pin")
            await load()
            PostsStore.shared.bump()
            onChanged()
        } catch {
            notice = error.localizedDescription
        }
    }

    private func toggleLike() async {
        guard var p = post, !liking else { return }
        liking = true
        defer { liking = false }
        let want = !p.liked
        p.liked = want
        p.likeCount += want ? 1 : -1
        post = p // 먼저 바꿔 보여 준다
        do {
            let r: PostLikeResponse = want
                ? try await APIClient.shared.post("/api/v1/posts/\(postId)/like", body: PostEmptyBody())
                : try await APIClient.shared.delete("/api/v1/posts/\(postId)/like")
            post?.liked = r.liked
            post?.likeCount = r.likeCount
        } catch {
            await load()
            notice = error.localizedDescription
        }
    }

    private func delete() async {
        do {
            let _: PostOkResponse = try await APIClient.shared.delete("/api/v1/posts/\(postId)")
            PostsStore.shared.bump()
            onChanged()
            dismiss()
        } catch {
            notice = error.localizedDescription
        }
    }

    private func report(_ reason: String) async {
        do {
            let _: PostOkResponse = try await APIClient.shared.post("/api/v1/posts/\(postId)/report", body: PostReportRequest(reason: reason))
            notice = "신고가 접수됐어요. 운영자가 24시간 안에 확인할게요. 더 보고 싶지 않으면 차단할 수도 있어요."
        } catch {
            notice = error.localizedDescription
        }
    }

    private func block() async {
        guard let username = post?.author.username else { return }
        do {
            let _: BlockResponse = try await APIClient.shared.post("/api/v1/users/\(username)/block", body: BlockRequest(block: true))
            PostsStore.shared.bump()
            onChanged()
            dismiss()
        } catch {
            notice = error.localizedDescription
        }
    }

    static func dateText(_ iso: String) -> String {
        // Postgres 는 소수점 아래 6자리까지 줘서 ISO8601DateFormatter 가 못 읽는다 → 소수부를 뗀다
        let trimmed = iso.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        let date = ISO8601DateFormatter().date(from: trimmed)
        guard let date else { return "" }
        let out = DateFormatter()
        out.locale = Locale(identifier: "ko_KR")
        out.dateFormat = Calendar.current.isDate(date, equalTo: Date(), toGranularity: .year) ? "M월 d일" : "yyyy년 M월 d일"
        return out.string(from: date)
    }
}
