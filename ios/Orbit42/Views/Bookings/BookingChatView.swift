import SwiftUI

/// 예약 대화 (1.8.0) — 그 예약의 호스트·게스트만. 글자만.
/// 상대 글은 길게 눌러 신고, 호스트는 오른쪽 위 메뉴에서 대화 닫기·다시 열기.
/// 앱 푸시가 붙기 전에는 화면을 보고 있는 동안 20초마다 새 글을 확인한다.
struct BookingChatView: View {
    let bookingId: String
    /// 화면 제목 아래에 보일 상대 이름(목록에서 이미 아는 값)
    let otherName: String

    @State private var data: BookingChatResponse?
    @State private var text = ""
    @State private var sending = false
    @State private var errorText: String?
    @State private var reportTarget: BookingChatMessage?
    @State private var reportedToast = false
    @FocusState private var focused: Bool

    private var path: String { "/api/v1/bookings/\(bookingId)/messages" }
    private var isHost: Bool { data?.role == "host" }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    if let data, data.messages.isEmpty {
                        Text(isHost ? "\(otherName)님과 이 예약에 대해 이야기할 수 있어요." : "호스트에게 궁금한 점을 남길 수 있어요.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                            .padding(.top, 8)
                    }
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
        .navigationTitle("대화")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isHost, let state = data?.state, state.canWrite || state.closed {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(state.closed ? "대화 다시 열기" : "대화 닫기", systemImage: state.closed ? "bubble.left.and.bubble.right" : "xmark.circle") {
                            Task { await setClosed(!state.closed) }
                        }
                    } label: { Image(systemName: "ellipsis.circle") }
                    .accessibilityIdentifier("chatMenu")
                }
            }
        }
        .confirmationDialog("이 메시지를 신고할까요?", isPresented: Binding(get: { reportTarget != nil }, set: { if !$0 { reportTarget = nil } }), titleVisibility: .visible) {
            Button("신고하기", role: .destructive) { if let m = reportTarget { Task { await report(m) } } }
        } message: {
            Text("운영팀이 확인하고 조치해요.")
        }
        .alert("신고했어요", isPresented: $reportedToast) { Button("확인", role: .cancel) {} } message: { Text("확인 후 조치할게요.") }
        .task {
            // 보고 있는 동안 20초마다 새 글 확인 (푸시 전)
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    private func bubble(_ m: BookingChatMessage) -> some View {
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
                if data.state.canWrite {
                    if data.suggestFirstNote == true && text.isEmpty {
                        Button {
                            text = "만나서 반가워요. 장소는 "
                            focused = true
                        } label: {
                            Text("장소·준비물을 알려 주세요")
                                .font(.footnote.weight(.medium))
                                .padding(.horizontal, 12).padding(.vertical, 6)
                                .overlay(Capsule().stroke(Theme.accent.opacity(0.5)))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Theme.accent)
                        .accessibilityIdentifier("chatFirstNote")
                    }
                    HStack(alignment: .bottom, spacing: 8) {
                        TextField("\(otherName)님에게 메시지", text: $text, axis: .vertical)
                            .lineLimit(1...5)
                            .focused($focused)
                            .padding(.horizontal, 12).padding(.vertical, 9)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                            .accessibilityIdentifier("chatInput")
                        Button {
                            Task { await send() }
                        } label: {
                            Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                        }
                        .disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityLabel("보내기")
                        .accessibilityIdentifier("chatSend")
                    }
                } else if let reason = data.state.reason {
                    Text(reason).font(.footnote).foregroundStyle(Theme.secondaryText)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.bar)
        }
    }

    private func load() async {
        do {
            let r: BookingChatResponse = try await APIClient.shared.get(path)
            data = r
            BookingChatUnread.shared.markRead(bookingId)
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
            let _: SendChatResponse = try await APIClient.shared.post(path, body: SendChatRequest(body: String(body.prefix(2000))))
            text = ""
            errorText = nil
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func report(_ m: BookingChatMessage) async {
        do {
            let _: OkResponse = try await APIClient.shared.patch(path, body: ChatActionRequest(action: "report", messageId: m.id))
            reportedToast = true
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func setClosed(_ closed: Bool) async {
        do {
            let _: OkResponse = try await APIClient.shared.patch(path, body: ChatActionRequest(action: closed ? "close" : "reopen"))
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
