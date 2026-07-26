import SwiftUI

/// 타임슬롯 목록 콘텐츠 — 내가 열어둔 슬롯 목록 + 프리셋 빠른 생성.
/// 자체 NavigationStack 없이, 감싸는 쪽(캘린더 탭)의 스택 안에서 동작한다.
/// toolbar(+)·navigationDestination·alert 등은 모두 여기에 붙어 있어
/// 캘린더 탭의 "타임슬롯" 세그먼트에서 그대로 쓸 수 있다.
/// 행을 탭하면 상세 편집(`SlotDetailView`)으로 이동한다.
struct SlotsContent: View {
    /// 세그먼트 전환 시 캐시가 유지되도록 뷰모델은 감싸는 쪽에서 소유한다.
    let viewModel: SlotsViewModel
    /// 감싸는 NavigationStack 의 path — DEMO_SLOT_ID 자동 진입에 쓴다.
    @Binding var path: NavigationPath

    @State private var showingPresetDialog = false
    @State private var didAutoPushDemo = false

    var body: some View {
        ZStack {
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingPresetDialog = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("타임슬롯 추가")
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
        .navigationDestination(for: SlotRoute.self) { route in
            SlotDetailView(route: route, listViewModel: viewModel)
        }
        .task {
            await viewModel.load()
            #if DEBUG
            // 데모/스크린샷용: DEMO_SLOT_ID 환경변수로 상세 화면 자동 진입.
            // `.task` 는 뒤로가기로 리스트가 다시 보일 때마다 재실행되므로
            // 반드시 앱 세션당 1회로 제한한다 (안 그러면 pop 즉시 재푸시됨).
            if !didAutoPushDemo,
               let demoId = ProcessInfo.processInfo.environment["DEMO_SLOT_ID"],
               path.isEmpty,
               let slot = viewModel.slots?.first(where: { $0.id == demoId }) {
                didAutoPushDemo = true
                path.append(SlotRoute(id: slot.id, title: slot.title))
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
                    SlotRow(slot: slot)
                    // 카드 스타일을 유지하면서 행 전체 탭 → 상세 push (chevron 숨김용 투명 링크)
                    NavigationLink(value: SlotRoute(id: slot.id, title: slot.title)) {
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
                        .foregroundStyle(.white)
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
                                    .foregroundStyle(.white)
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
        Text("슬롯을 탭하면 가격·시간 등 상세 편집을 할 수 있어요")
            .font(.caption)
            .foregroundStyle(Theme.secondaryText)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
    }
}

// MARK: - 슬롯 행

private struct SlotRow: View {
    let slot: TimeSlot

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(slot.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white)
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
                ShareLink(item: url) {
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
            .background(Color.white.opacity(0.08), in: Capsule())
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
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
