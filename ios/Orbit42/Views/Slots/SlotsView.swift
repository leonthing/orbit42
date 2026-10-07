import SwiftUI

/// 타임슬롯 목록 콘텐츠 — 내가 열어둔 슬롯 목록 + 프리셋 빠른 생성.
/// 자체 NavigationStack 없이, 감싸는 쪽(캘린더 탭)의 스택 안에서 동작한다.
/// toolbar(+)·navigationDestination·alert 등은 모두 여기에 붙어 있어
/// 예약 탭의 "예약 링크" 구역에서 그대로 쓸 수 있다.
/// 행을 탭하면 상세 편집(`SlotDetailView`)으로 이동한다.
struct SlotsContent: View {
    /// 세그먼트 전환 시 캐시가 유지되도록 뷰모델은 감싸는 쪽에서 소유한다.
    let viewModel: SlotsViewModel
    /// 감싸는 NavigationStack 의 path — DEMO_SLOT_ID 자동 진입에 쓴다.
    @Binding var path: NavigationPath

    @State private var showingPresetDialog = false
    @State private var showingSimpleCreate = false
    @State private var didAutoPushDemo = false
    /// 인스타 스토리용 이미지 작성 화면
    @State private var storySubject: StorySubject?
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        ZStack {
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showingSimpleCreate = true
                    } label: {
                        Label("새 예약 링크", systemImage: "plus")
                    }
                    Button {
                        showingPresetDialog = true
                    } label: {
                        Label("템플릿으로 빠르게", systemImage: "square.grid.2x2")
                    }
                } label: {
                    Image(systemName: "plus")
                } primaryAction: {
                    showingSimpleCreate = true
                }
                .accessibilityLabel("예약 링크 추가")
                .disabled(viewModel.isCreatingPreset)
            }
        }
        .confirmationDialog("빠른 생성", isPresented: $showingPresetDialog, titleVisibility: .visible) {
            ForEach(SlotPreset.allCases) { preset in
                Button(preset.title) {
                    Task { await viewModel.createPreset(preset) }
                }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("자주 쓰는 타임슬롯을 프리셋으로 바로 만들어요")
        }
        .alert(
            "안내",
            isPresented: Binding(
                get: { viewModel.actionMessage != nil },
                set: { if !$0 { viewModel.actionMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.actionMessage ?? "")
        }
        .sheet(isPresented: $showingSimpleCreate, onDismiss: {
            if let slot = viewModel.pendingShare {
                viewModel.pendingShare = nil
                viewModel.justCreated = slot
            }
        }) {
            SimpleSlotSheet(viewModel: viewModel)
        }
        .sheet(item: Binding(
            get: { viewModel.justCreated },
            set: { viewModel.justCreated = $0 }
        )) { slot in
            SlotCreatedShareSheet(slot: slot) {
                // 시트를 닫은 뒤 전체 화면 작성기를 연다 (시트 위에 바로 올리면 안 뜬다)
                viewModel.justCreated = nil
                Task {
                    try? await Task.sleep(for: .milliseconds(450))
                    storySubject = .slot(slot)
                }
            }
            .presentationDetents([.medium, .large])
        }
        .fullScreenCover(item: $storySubject) { subject in
            StoryComposerView(subject: subject)
        }
        .navigationDestination(for: SlotRoute.self) { route in
            SlotDetailView(route: route, listViewModel: viewModel)
        }
        .navigationDestination(for: MySlotRoute.self) { route in
            MySlotView(route: route, listViewModel: viewModel)
        }
        .task {
            await viewModel.load()
            #if DEBUG
            // 데모/스크린샷용: DEMO_SLOT_ID 환경변수로 상세 화면 자동 진입.
            // `.task` 는 뒤로가기로 리스트가 다시 보일 때마다 재실행되므로
            // 반드시 앱 세션당 1회로 제한한다 (안 그러면 pop 즉시 재푸시됨).
            // 스크린샷용: DEMO_SHEET=newslot 이면 새 예약 링크 시트를 연다.
            if !didAutoPushDemo, ProcessInfo.processInfo.environment["DEMO_SHEET"] == "newslot" {
                didAutoPushDemo = true
                showingSimpleCreate = true
            }
            // 스크린샷용: DEMO_STORY_SLOT_ID 로 그 슬롯의 스토리 이미지 작성기를 연다.
            if !didAutoPushDemo,
               let storyId = ProcessInfo.processInfo.environment["DEMO_STORY_SLOT_ID"],
               let slot = viewModel.slots?.first(where: { $0.id == storyId }) {
                didAutoPushDemo = true
                storySubject = .slot(slot)
            }
            if !didAutoPushDemo,
               let demoId = ProcessInfo.processInfo.environment["DEMO_SLOT_ID"],
               path.isEmpty,
               let slot = viewModel.slots?.first(where: { $0.id == demoId }) {
                didAutoPushDemo = true
                path.append(MySlotRoute(id: slot.id, slug: slot.slug, title: slot.title))
            }
            #endif
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let slots = viewModel.slots {
            if slots.isEmpty {
                emptyState
            } else {
                slotList(slots)
            }
        } else if viewModel.isLoading {
            loadingState
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else {
            Color.clear
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.accent)
            Text("타임슬롯을 불러오는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
            Button {
                Task { await viewModel.load(force: true) }
            } label: {
                Text("다시 시도")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
    }

    // MARK: - 슬롯 목록

    private func slotList(_ slots: [TimeSlot]) -> some View {
        List {
            ForEach(slots) { slot in
                ZStack {
                    SlotRow(slot: slot) { storySubject = .slot(slot) }
                    // 카드 스타일을 유지하면서 행 전체 탭 → 상세 push (chevron 숨김용 투명 링크)
                    NavigationLink(value: MySlotRoute(id: slot.id, slug: slot.slug, title: slot.title)) {
                        EmptyView()
                    }
                    .opacity(0)
                }
                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            Task { await viewModel.toggleActive(slot) }
                        } label: {
                            Label(
                                slot.active ? "비활성" : "활성",
                                systemImage: slot.active ? "pause.circle" : "play.circle"
                            )
                        }
                        .tint(slot.active ? .orange : .green)
                    }
                    .contextMenu {
                        Button {
                            Task { await viewModel.toggleActive(slot) }
                        } label: {
                            Label(
                                slot.active ? "비활성으로 전환" : "활성으로 전환",
                                systemImage: slot.active ? "pause.circle" : "play.circle"
                            )
                        }
                        if let url = URL(string: slot.shareUrl) {
                            ShareLink(item: url) {
                                Label("공유", systemImage: "square.and.arrow.up")
                            }
                        }
                        Button {
                            storySubject = .slot(slot)
                        } label: {
                            Label("인스타 스토리용 이미지", systemImage: "photo.on.rectangle.angled")
                        }
                    }
            }

            footerNote
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 24, trailing: 16))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    // MARK: - empty state

    private var emptyState: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Image(systemName: "clock.badge.checkmark")
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(Theme.accent)
                    Text("아직 열어둔 시간이 없어요")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.primaryText)
                    Text("프리셋으로 첫 타임슬롯을 만들어 보세요")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                }
                .padding(.top, 60)

                VStack(spacing: 10) {
                    ForEach(SlotPreset.allCases) { preset in
                        Button {
                            Task { await viewModel.createPreset(preset) }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: preset.systemImage)
                                    .font(.body)
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 28)
                                Text(preset.title)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.primaryText)
                                Spacer()
                                Image(systemName: "plus.circle")
                                    .font(.body)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isCreatingPreset)
                    }
                }

                footerNote
            }
            .padding(.horizontal, 24)
        }
        .refreshable {
            await viewModel.load(force: true)
        }
        .overlay {
            if viewModel.isCreatingPreset {
                ProgressView()
                    .tint(Theme.accent)
                    .padding(20)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    // MARK: - 안내 푸터

    private var footerNote: some View {
        Text("탭하면 게스트에게 보이는 화면이 열려요. 시간을 눌러 열고 닫거나 '편집'으로 수정해요")
            .font(.caption)
            .foregroundStyle(Theme.secondaryText)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
    }
}


// MARK: - 슬롯 행

private struct SlotRow: View {
    let slot: TimeSlot
    /// 인스타 스토리용 이미지 만들기
    var onStory: () -> Void = {}

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(slot.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    SlotBadge(text: slot.typeBadgeText, color: Theme.accent)
                    if slot.isAuction {
                        SlotBadge(text: "경매", color: .orange)
                    }
                    SlotBadge(text: slot.modeBadgeText, color: Theme.secondaryText)
                    if !slot.active {
                        SlotBadge(text: "비활성", color: .red.opacity(0.8))
                    }
                }

                Text("\(slot.durationText) · \(slot.priceText)")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }

            Spacer(minLength: 0)

            if let url = URL(string: slot.shareUrl) {
                Menu {
                    ShareLink(item: url) {
                        Label("링크 공유", systemImage: "link")
                    }
                    Button {
                        onStory()
                    } label: {
                        Label("인스타 스토리용 이미지", systemImage: "photo.on.rectangle.angled")
                    }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.body)
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: 40, height: 40)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("\(slot.title) 공유")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .opacity(slot.active ? 1 : 0.55)
    }
}

// MARK: - 뱃지

private struct SlotBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.fill(0.08), in: Capsule())
    }
}

// MARK: - 단독 래퍼 (프리뷰용)

/// `SlotsContent` 를 자체 NavigationStack 으로 감싼 단독 화면.
/// 앱에서는 캘린더 탭이 콘텐츠를 직접 품으므로 프리뷰 용도로만 남겨둔다.
struct SlotsView: View {
    @State private var viewModel = SlotsViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Theme.background.ignoresSafeArea()
                SlotsContent(viewModel: viewModel, path: $path)
            }
            .navigationTitle("타임슬롯")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    SlotsView()
        .tint(Theme.accent)
}


// MARK: - 만든 직후 공유

/// 슬롯을 만들자마자 링크를 퍼뜨릴 수 있게 — 인스타 바이오·카톡 프로필에 붙이는 게 첫 행동이다.
private struct SlotCreatedShareSheet: View {
    let slot: TimeSlot
    /// 인스타 스토리용 이미지 만들기
    var onStory: () -> Void = {}
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(Theme.accent)
            VStack(spacing: 4) {
                Text("‘\(slot.title)’ 슬롯을 열었어요")
                    .font(.headline)
                    .foregroundStyle(Theme.primaryText)
                    .multilineTextAlignment(.center)
                Text("링크를 프로필이나 메시지에 붙이면 바로 예약을 받을 수 있어요")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
                    .multilineTextAlignment(.center)
            }
            if let url = URL(string: slot.shareUrl) {
                Text(url.absoluteString)
                    .font(.footnote.monospaced())
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(Theme.background, in: RoundedRectangle(cornerRadius: 10))
                HStack(spacing: 10) {
                    Button {
                        UIPasteboard.general.url = url
                        copied = true
                    } label: {
                        Label(copied ? "복사했어요" : "링크 복사", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.surface, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    ShareLink(item: url) {
                        Label("공유", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.accent, in: Capsule())
                    }
                }
            }
            Button {
                onStory()
            } label: {
                Label("인스타 스토리용 이미지 만들기", systemImage: "photo.on.rectangle.angled")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: [
                                Color(red: 0.96, green: 0.52, blue: 0.16),
                                Color(red: 0.87, green: 0.16, blue: 0.48),
                                Color(red: 0.51, green: 0.20, blue: 0.69),
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: Capsule()
                    )
            }
            .buttonStyle(.plain)
            Button("나중에") { dismiss() }
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}
