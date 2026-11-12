import SwiftUI

// MARK: - 1:1 대화 목록 (1.9.0) — 예약 탭의 '대화' 구역

/// 받은 요청 묶음이 위, 대화 목록이 아래. 예약 대화는 각 예약 화면에 있어 위에 바로가기 한 줄만 둔다.
struct DmListView: View {
    @Environment(TabRouter.self) private var router
    @State private var data: DmListResponse?
    @State private var errorText: String?

    var body: some View {
        List {
            if BookingChatUnread.shared.threadCount > 0 {
                Section {
                    Button {
                        router.bookingsSectionRequest = "received"
                    } label: {
                        Label("안 읽은 예약 대화 \(BookingChatUnread.shared.threadCount)건 — 예약에서 보기", systemImage: "calendar.badge.clock")
                            .font(.subheadline)
                    }
                }
            }
            if let requests = data?.requests, !requests.isEmpty {
                Section("대화 요청 \(requests.count)") {
                    ForEach(requests) { s in
                        NavigationLink { DmChatView(conversationId: s.id, peer: s.peer) } label: { DmRow(s: s) }
                    }
                }
            }
            Section {
                if let items = data?.items {
                    if items.isEmpty && (data?.requests.isEmpty ?? true) {
                        VStack(spacing: 8) {
                            Image(systemName: "bubble.left.and.bubble.right")
                                .font(.system(size: 28, weight: .light))
                                .foregroundStyle(Theme.secondaryText)
                            Text("아직 1:1 대화가 없어요")
                                .font(.subheadline.weight(.medium))
                            Text("다른 사람 프로필에서 '대화'를 눌러 보세요. 서로 팔로우하거나 예약한 적이 있으면 바로, 아니면 대화 요청으로 시작해요.")
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .listRowBackground(Color.clear)
                    } else {
                        ForEach(items) { s in
                            NavigationLink { DmChatView(conversationId: s.id, peer: s.peer) } label: { DmRow(s: s) }
                        }
                    }
                } else if let errorText {
                    Text(errorText).font(.footnote).foregroundStyle(.red)
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .refreshable { await load() }
        .task { await load() }
        .onAppear { Task { await load() } }
        .onReturnToForeground { await load() }
        .accessibilityIdentifier("dmList")
    }

    private func load() async {
        do {
            data = try await APIClient.shared.get("/api/v1/dm")
            errorText = nil
            await DmStore.shared.refresh()
        } catch {
            if data == nil { errorText = error.localizedDescription }
        }
    }
}

private struct DmRow: View {
    let s: DmSummary

    var body: some View {
        HStack(spacing: 12) {
            DiscoverAvatar(url: s.peer.avatar_url.flatMap(URL.init(string:)), name: s.peer.name, size: 40)
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(s.peer.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                    Spacer()
                    if let d = s.lastDate {
                        Text(d.formatted(Calendar.current.isDateInToday(d) ? .dateTime.hour().minute() : .dateTime.month().day()))
                            .font(.caption2)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                HStack(spacing: 6) {
                    Text(subtitle)
                        .font(.footnote.weight(s.unread ? .semibold : .regular))
                        .foregroundStyle(s.unread ? Theme.primaryText : Theme.secondaryText)
                        .lineLimit(1)
                    if s.unread {
                        Circle().fill(Theme.accent).frame(width: 8, height: 8)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var subtitle: String {
        switch s.view {
        case "pending": return "요청을 보냈어요 · 아직 답이 없어요"
        case "incoming": return "대화 요청 · \(s.preview ?? "")"
        default: return (s.lastSenderIsMe ? "나: " : "") + (s.preview ?? "")
        }
    }
}

// MARK: - 1:1 대화창

/// 위에 상대 예약 링크 바로가기, 메뉴(신고는 글을 길게 눌러서)·차단·나가기, 받은 요청이면 수락·거절·신고·차단.
struct DmChatView: View {
    let conversationId: String
    let peer: DmPeer

    @Environment(\.dismiss) private var dismiss
    @State private var data: DmThread?
    @State private var text = ""
    @State private var sending = false
    @State private var errorText: String?
    @State private var reportTarget: DmMessage?
    @State private var notice: String?
    @State private var confirmBlock = false
    @State private var confirmLeave = false

    private var path: String { "/api/v1/dm/\(conversationId)" }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    NavigationLink {
                        PersonProfileView(username: peer.username, funnelRef: "dm")
                    } label: {
                        Label("\(peer.name)님의 예약 링크 보기", systemImage: "calendar.badge.plus")
                            .font(.footnote.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(Theme.accent.opacity(0.12), in: Capsule())
                    }
                    .accessibilityIdentifier("dmPeerLinks")

                    if data?.view == "incoming" { requestCard }

                    ForEach(data?.messages ?? []) { m in
                        bubble(m).id(m.id)
                    }
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: data?.messages.count) {
                if let last = data?.messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) { composer }
        .navigationTitle(peer.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("나가기", systemImage: "rectangle.portrait.and.arrow.right") { confirmLeave = true }
                    Button("차단", systemImage: "hand.raised", role: .destructive) { confirmBlock = true }
                } label: { Image(systemName: "ellipsis.circle") }
                .accessibilityIdentifier("dmMenu")
            }
        }
        .confirmationDialog("이 메시지를 신고할까요?", isPresented: Binding(get: { reportTarget != nil }, set: { if !$0 { reportTarget = nil } }), titleVisibility: .visible) {
            Button("신고하기", role: .destructive) { if let m = reportTarget { Task { await act("report", messageId: m.id, done: "신고했어요. 확인 후 조치할게요.") } } }
        } message: { Text("운영팀이 확인하고 조치해요.") }
        .confirmationDialog("\(peer.name)님을 차단할까요?", isPresented: $confirmBlock, titleVisibility: .visible) {
            Button("차단하기", role: .destructive) { Task { await act("block", done: nil, leave: true) } }
        } message: { Text("서로 대화할 수 없고 팔로우도 풀려요.") }
        .confirmationDialog("대화에서 나갈까요?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("나가기", role: .destructive) { Task { await act("leave", done: nil, leave: true) } }
        } message: { Text("지금까지의 글이 내 화면에서 사라져요. 상대가 새 글을 보내면 다시 보여요.") }
        .alert("안내", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) {
            Button("확인", role: .cancel) {}
        } message: { Text(notice ?? "") }
        .task { await PushNotifications.shared.askIfNeeded() }
        .onAppear { Funnel.ref = nil } // 대화방으로 돌아오면 출처를 지운다
        .onReturnToForeground { await load() } // 20초 주기를 기다리지 않고 바로
        .task {
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    private var requestCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\(peer.name)님이 대화를 요청했어요. 답장하거나 수락하면 대화가 열려요.")
                .font(.footnote)
            HStack(spacing: 8) {
                Button("수락") { Task { await act("accept", done: nil) } }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("dmAccept")
                Button("거절") { Task { await act("decline", done: "거절했어요. 상대에게는 알리지 않아요.", leave: true) } }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("dmDecline")
                Button("신고") {
                    if let first = data?.messages.first(where: { !$0.mine }) { reportTarget = first }
                }
                .buttonStyle(.bordered)
                Button("차단") { confirmBlock = true }
                    .buttonStyle(.bordered)
            }
            .font(.footnote)
        }
        .padding(12)
        .background(Theme.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }

    private func bubble(_ m: DmMessage) -> some View {
        VStack(alignment: m.mine ? .trailing : .leading, spacing: 3) {
            Text(m.body)
                .font(.body)
                .foregroundStyle(m.mine ? .white : Theme.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(m.mine ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .textSelection(.enabled)
                .contextMenu {
                    if !m.mine {
                        Button("신고", systemImage: "exclamationmark.bubble") { reportTarget = m }
                    }
                }
            if let d = m.createdDate {
                Text(d.formatted(.dateTime.month(.defaultDigits).day().hour().minute()))
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: m.mine ? .trailing : .leading)
        .padding(m.mine ? .leading : .trailing, 48)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var composer: some View {
        if let data {
            VStack(alignment: .leading, spacing: 8) {
                if let errorText {
                    Text(errorText).font(.caption).foregroundStyle(.red)
                }
                if data.canWrite {
                    HStack(alignment: .bottom, spacing: 8) {
                        TextField("\(peer.name)님에게 메시지", text: $text, axis: .vertical)
                            .lineLimit(1...5)
                            .padding(.horizontal, 12).padding(.vertical, 9)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                            .accessibilityIdentifier("dmInput")
                        Button {
                            Task { await send() }
                        } label: {
                            Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                        }
                        .disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityLabel("보내기")
                        .accessibilityIdentifier("dmSend")
                    }
                } else if let reason = data.reason {
                    Text(reason).font(.footnote).foregroundStyle(Theme.secondaryText)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("dmReason")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.bar)
        }
    }

    private func load() async {
        do {
            let r: DmThread = try await APIClient.shared.get(path)
            data = r
            await DmStore.shared.refresh()
        } catch {
            if data == nil { errorText = error.localizedDescription }
        }
    }

    private func send() async {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        sending = true
        defer { sending = false }
        do {
            let _: DmSendResponse = try await APIClient.shared.post(path, body: DmSendRequest(body: String(body.prefix(DmLimits.maxLength))))
            text = ""
            errorText = nil
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func act(_ action: String, messageId: String? = nil, done: String?, leave: Bool = false) async {
        do {
            let _: OkResponse = try await APIClient.shared.patch(path, body: DmActionRequest(action: action, messageId: messageId))
            await DmStore.shared.refresh()
            if leave {
                dismiss()
            } else {
                if let done { notice = done }
                await load()
            }
        } catch {
            errorText = error.localizedDescription
        }
    }
}

// MARK: - 프로필의 '대화' 버튼 + 요청 시트

/// 바로 대화 조건이면 '대화' → 방, 아니면 '대화 요청' → 첫 글 시트, 보냈으면 '요청 보냄'.
struct DmProfileButton: View {
    let username: String
    let displayName: String

    @State private var state: String?
    @State private var loaded = false
    @State private var opening = false
    @State private var target: DmTarget?
    @State private var showingRequest = false
    @State private var errorText: String?

    struct DmTarget: Hashable, Identifiable {
        let id: String
        let peer: DmPeer
    }

    var body: some View {
        Group {
            if loaded, let state {
                Button {
                    Task { await tap(state) }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: state == "pending" ? "paperplane" : "bubble.left.and.bubble.right")
                            .font(.footnote)
                        Text(label(state))
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(state == "pending" ? Theme.secondaryText : Theme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.accent.opacity(state == "pending" ? 0.06 : 0.15), in: Capsule())
                }
                .disabled(opening || state == "pending")
                .accessibilityIdentifier("dmProfileButton")
            } else {
                // 빈 Group 에는 .task 가 붙지 않는다 — 자리만 잡는 0 높이 뷰
                Color.clear.frame(height: 0)
            }
        }
        .task { await loadState() }
        .navigationDestination(item: $target) { t in
            DmChatView(conversationId: t.id, peer: t.peer)
        }
        .sheet(isPresented: $showingRequest) {
            DmRequestSheet(username: username, displayName: displayName) { _ in
                state = "pending"
            }
        }
        .alert("안내", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("확인", role: .cancel) {}
        } message: { Text(errorText ?? "") }
    }

    private func label(_ s: String) -> String {
        switch s {
        case "request": return "대화 요청"
        case "pending": return "요청 보냄"
        case "incoming": return "받은 요청"
        default: return "대화"
        }
    }

    private func loadState() async {
        guard !BrowseMode.shared.active else { loaded = true; state = nil; return }
        await DmStore.shared.refresh()
        guard DmStore.shared.open else { loaded = true; state = nil; return }
        let r: DmStateResponse? = try? await APIClient.shared.get("/api/v1/dm/state?username=\(username)")
        state = r?.state
        loaded = true
    }

    private func tap(_ s: String) async {
        if s == "request" {
            showingRequest = true
            return
        }
        opening = true
        defer { opening = false }
        do {
            let r: DmStartResponse = try await APIClient.shared.post("/api/v1/dm", body: DmStartRequest(username: username))
            target = DmTarget(id: r.id, peer: DmPeer(id: "", username: username, display_name: displayName, avatar_url: nil))
        } catch {
            if case APIError.server(_, let code) = error, code == 409 {
                showingRequest = true
            } else {
                errorText = error.localizedDescription
            }
        }
    }
}

/// 대화 요청 — 첫 글과 함께. 하루 5명까지.
struct DmRequestSheet: View {
    let username: String
    let displayName: String
    let onSent: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var sending = false
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("어떤 일로 연락하는지 적어 주세요", text: $text, axis: .vertical)
                        .lineLimit(4...10)
                        .accessibilityIdentifier("dmRequestInput")
                } footer: {
                    Text("첫 메시지와 함께 요청해요. \(displayName)님이 수락하면 대화가 열려요. 하루 5명까지 요청할 수 있어요.")
                }
                if let errorText {
                    Text(errorText).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("대화 요청")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "보내는 중…" : "보내기") { Task { await send() } }
                        .disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("dmRequestSend")
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func send() async {
        let body = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(DmLimits.maxLength))
        sending = true
        defer { sending = false }
        do {
            let r: DmStartResponse = try await APIClient.shared.post("/api/v1/dm", body: DmStartRequest(username: username, body: body))
            onSent(r.id)
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
