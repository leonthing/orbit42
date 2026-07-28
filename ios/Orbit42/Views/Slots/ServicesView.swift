import Observation
import SwiftUI

// MARK: - 모델

struct MenusResponse: Decodable, Sendable {
    let menus: [ServiceMenu]
}

/// 서비스(메뉴) — 프리랜서가 가격을 붙여 파는 항목. 타임슬롯에 붙여 함께 판매한다.
struct ServiceMenu: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let category: String?
    let description: String?
    let priceCents: Int
    let active: Bool
    let sortOrder: Int?

    var priceText: String {
        priceCents == 0 ? "무료" : DiscoverFormat.priceText(cents: priceCents)
    }
}

struct CreateMenuRequest: Encodable {
    let name: String
    let category: String?
    let description: String?
    let priceCents: Int
    let active: Bool
}

struct UpdateMenuRequest: Encodable {
    var name: String?
    var category: String?
    var description: String?
    var priceCents: Int?
    var active: Bool?
}

// MARK: - 뷰모델

@MainActor
@Observable
final class ServicesViewModel {
    private(set) var menus: [ServiceMenu]?
    private(set) var errorMessage: String?
    var actionMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load(force: Bool = false) async {
        if !force, menus != nil { return }
        do {
            let response: MenusResponse = try await api.get("/api/v1/menus")
            menus = response.menus
            errorMessage = nil
        } catch is CancellationError {
            return
        } catch {
            if menus == nil {
                errorMessage = "서비스를 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }

    func create(_ request: CreateMenuRequest) async throws {
        let response: MenusResponse = try await api.post("/api/v1/menus", body: request)
        menus = response.menus
    }

    func update(id: String, request: UpdateMenuRequest) async throws {
        let response: MenusResponse = try await api.patch("/api/v1/menus/\(id)", body: request)
        menus = response.menus
    }

    func delete(_ menu: ServiceMenu) async {
        do {
            let response: MenusResponse = try await api.delete("/api/v1/menus/\(menu.id)")
            menus = response.menus
        } catch {
            actionMessage = "삭제하지 못했어요."
        }
    }

    func toggleActive(_ menu: ServiceMenu) async {
        var request = UpdateMenuRequest()
        request.active = !menu.active
        try? await update(id: menu.id, request: request)
    }
}

// MARK: - 화면

/// 서비스 관리 — 커피챗·컨설팅처럼 시간과 함께 파는 항목에 가격을 붙인다.
struct ServicesView: View {
    @State private var viewModel = ServicesViewModel()
    @State private var editing: ServiceMenu?
    @State private var showingNew = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("서비스")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingNew = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("서비스 추가")
            }
        }
        .task { await viewModel.load() }
        .sheet(isPresented: $showingNew) {
            ServiceEditorSheet(viewModel: viewModel, menu: nil)
        }
        .sheet(item: $editing) { menu in
            ServiceEditorSheet(viewModel: viewModel, menu: menu)
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
    }

    @ViewBuilder
    private var content: some View {
        if let menus = viewModel.menus {
            if menus.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 32, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text("아직 서비스가 없어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                    Text("컨설팅·코칭·촬영처럼 시간과 함께 파는 항목에\n가격을 붙여 타임슬롯에 연결할 수 있어요.")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.secondaryText)
                    Button {
                        showingNew = true
                    } label: {
                        Text("첫 서비스 만들기")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Theme.accent, in: Capsule())
                    }
                    .padding(.top, 4)
                }
                .padding(32)
            } else {
                List {
                    Section {
                        ForEach(menus) { menu in
                            Button {
                                editing = menu
                            } label: {
                                row(menu)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task { await viewModel.delete(menu) }
                                } label: {
                                    Label("삭제", systemImage: "trash")
                                }
                                Button {
                                    Task { await viewModel.toggleActive(menu) }
                                } label: {
                                    Label(menu.active ? "숨기기" : "보이기",
                                          systemImage: menu.active ? "eye.slash" : "eye")
                                }
                                .tint(Theme.accent)
                            }
                        }
                    } footer: {
                        Text("타임슬롯 상세에서 이 서비스들을 연결하면, 예약할 때 함께 고를 수 있어요. 결제는 만나서 진행해요.")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)
                }
                .scrollContentBackground(.hidden)
                .refreshable { await viewModel.load(force: true) }
            }
        } else if let message = viewModel.errorMessage {
            VStack(spacing: 12) {
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
                Button("다시 시도") { Task { await viewModel.load(force: true) } }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
            }
            .padding(32)
        } else {
            ProgressView().tint(Theme.accent)
        }
    }

    private func row(_ menu: ServiceMenu) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(menu.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(menu.active ? Theme.primaryText : Theme.secondaryText)
                        .lineLimit(1)
                    if let category = menu.category, !category.isEmpty {
                        Text(category)
                            .font(.caption2)
                            .foregroundStyle(Theme.secondaryText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.fill(0.08), in: Capsule())
                    }
                    if !menu.active {
                        Text("숨김")
                            .font(.caption2)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                if let description = menu.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Text(menu.priceText)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.accent)
        }
    }
}

// MARK: - 편집 시트

private struct ServiceEditorSheet: View {
    let viewModel: ServicesViewModel
    let menu: ServiceMenu?

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var category: String
    @State private var description: String
    @State private var priceText: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(viewModel: ServicesViewModel, menu: ServiceMenu?) {
        self.viewModel = viewModel
        self.menu = menu
        _name = State(initialValue: menu?.name ?? "")
        _category = State(initialValue: menu?.category ?? "")
        _description = State(initialValue: menu?.description ?? "")
        _priceText = State(
            initialValue: menu.map { $0.priceCents > 0 ? String($0.priceCents / 100) : "" } ?? ""
        )
    }

    private var priceCents: Int {
        let digits = priceText.filter(\.isNumber)
        return (Int(digits) ?? 0) * 100
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Form {
                    Section {
                        TextField("이름 (예: 1:1 컨설팅)", text: $name)
                            .foregroundStyle(Theme.primaryText)
                        TextField("분류 (선택 · 예: 컨설팅)", text: $category)
                            .foregroundStyle(Theme.primaryText)
                        TextField("설명 (선택)", text: $description, axis: .vertical)
                            .lineLimit(2...4)
                            .foregroundStyle(Theme.primaryText)
                    }
                    .listRowBackground(Theme.surface)

                    Section {
                        HStack {
                            TextField("0", text: $priceText)
                                .keyboardType(.numberPad)
                                .foregroundStyle(Theme.primaryText)
                                .multilineTextAlignment(.trailing)
                            Text("원")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    } header: {
                        Text("가격")
                    } footer: {
                        Text("0원이면 무료로 표시돼요. 결제는 만나서 진행하고, 앱에서는 금액만 안내해요.")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)

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
            }
            .navigationTitle(menu == nil ? "새 서비스" : "서비스 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }.disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView().tint(Theme.accent)
                    } else {
                        Button("저장") { save() }
                            .fontWeight(.semibold)
                            .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                if let menu {
                    var request = UpdateMenuRequest()
                    request.name = trimmedName
                    request.category = category.trimmingCharacters(in: .whitespaces)
                    request.description = description.trimmingCharacters(in: .whitespaces)
                    request.priceCents = priceCents
                    try await viewModel.update(id: menu.id, request: request)
                } else {
                    try await viewModel.create(
                        CreateMenuRequest(
                            name: trimmedName,
                            category: category.trimmingCharacters(in: .whitespaces).isEmpty
                                ? nil : category.trimmingCharacters(in: .whitespaces),
                            description: description.trimmingCharacters(in: .whitespaces).isEmpty
                                ? nil : description.trimmingCharacters(in: .whitespaces),
                            priceCents: priceCents,
                            active: true
                        )
                    )
                }
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}
