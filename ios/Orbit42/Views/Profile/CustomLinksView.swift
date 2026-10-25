import SwiftUI

/// 공개 링크 페이지 직접 링크 (개선-46) — 웹사이트·오픈채팅·블로그 등 최대 5개, 순서대로 예약 링크 아래 버튼 줄로 보인다.
/// 서버: GET/PUT /api/v1/me/links. http/https 주소만, 제목 40자 (서버도 같은 규칙으로 다시 검사).
struct CustomLink: Codable, Equatable, Identifiable {
    var title: String
    var url: String
    var id: String { "\(title)|\(url)" }
}

enum CustomLinkRules {
    static let maxCount = 5
    static let titleMax = 40

    /// 앞부분 없이 적으면 https:// 를 붙이고, http/https 가 아니면 nil
    static func normalizedURL(_ raw: String) -> String? {
        var v = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !v.isEmpty, v.count <= 300 else { return nil }
        if !v.contains("://") { v = "https://" + v }
        guard let comps = URLComponents(string: v),
              let scheme = comps.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = comps.host, !host.isEmpty, host.contains("."),
              comps.user == nil, comps.password == nil else { return nil }
        return v
    }
}

private struct LinksResponse: Decodable { let links: [CustomLink] }
private struct LinksBody: Encodable { let links: [CustomLink] }

struct CustomLinksView: View {
    @State private var links: [CustomLink] = []
    @State private var loaded = false
    @State private var isSaving = false
    @State private var message: String?
    @State private var editing: EditTarget?

    struct EditTarget: Identifiable {
        let index: Int?   // nil = 새로 추가
        var id: String { index.map(String.init) ?? "new" }
    }

    var body: some View {
        List {
            Section {
                ForEach(Array(links.enumerated()), id: \.element.id) { index, link in
                    Button {
                        editing = EditTarget(index: index)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(link.title)
                                .foregroundStyle(Theme.primaryText)
                            Text(DisplayURL.short(link.url))
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                                .lineLimit(1)
                        }
                    }
                    .accessibilityIdentifier("customLink.\(index)")
                }
                .onDelete { offsets in
                    links.remove(atOffsets: offsets)
                    Task { await save() }
                }
                .onMove { from, to in
                    links.move(fromOffsets: from, toOffset: to)
                    Task { await save() }
                }
                if links.count < CustomLinkRules.maxCount {
                    Button {
                        editing = EditTarget(index: nil)
                    } label: {
                        Label("링크 추가", systemImage: "plus.circle.fill")
                            .foregroundStyle(Theme.accent)
                    }
                    .accessibilityIdentifier("customLinkAdd")
                }
            } header: {
                Text("링크 페이지 버튼 (\(links.count)/\(CustomLinkRules.maxCount))")
            } footer: {
                Text("웹사이트·카카오 오픈채팅·블로그처럼 직접 고른 링크를 공개 링크 페이지의 예약 링크 아래에 버튼으로 보여 줘요. 오른쪽 위 '편집'으로 순서를 바꾸고, 밀어서 지울 수 있어요.")
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("링크 페이지 버튼")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if isSaving { ProgressView().tint(Theme.accent) } else if !links.isEmpty { EditButton() }
            }
        }
        .task { await load() }
        .sheet(item: $editing) { target in
            CustomLinkEditor(
                initial: target.index.map { links[$0] },
                onSave: { link in
                    if let i = target.index { links[i] = link } else { links.append(link) }
                    Task { await save() }
                },
                onDelete: deleteAction(for: target.index)
            )
        }
        .alert("안내", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("확인", role: .cancel) {}
        } message: { Text(message ?? "") }
    }

    private func deleteAction(for index: Int?) -> (() -> Void)? {
        guard let index else { return nil }
        return {
            links.remove(at: index)
            Task { await save() }
        }
    }

    private func load() async {
        guard !loaded else { return }
        if let r: LinksResponse = try? await APIClient.shared.get("/api/v1/me/links") { links = r.links }
        loaded = true
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let r: LinksResponse = try await APIClient.shared.put("/api/v1/me/links", body: LinksBody(links: links))
            links = r.links
        } catch let apiError as APIError {
            if let text = apiError.errorDescription { message = text }
        } catch {
            message = "저장하지 못했어요. 네트워크를 확인해 주세요."
        }
    }
}

/// 링크 하나 추가·고치기
private struct CustomLinkEditor: View {
    let initial: CustomLink?
    let onSave: (CustomLink) -> Void
    var onDelete: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var url = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("제목 (예: 웹사이트, 카카오 오픈채팅)", text: $title)
                        .accessibilityIdentifier("customLinkTitle")
                    TextField("주소 (https://…)", text: $url)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("customLinkURL")
                } footer: {
                    if let error {
                        Text(error).foregroundStyle(.red)
                    } else {
                        Text("제목은 \(CustomLinkRules.titleMax)자까지, 주소는 http:// 또는 https:// 링크만 쓸 수 있어요.")
                    }
                }
                if let onDelete {
                    Section {
                        Button("이 링크 지우기", role: .destructive) {
                            onDelete()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(initial == nil ? "링크 추가" : "링크 고치기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { submit() }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || url.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("customLinkSave")
                }
            }
            .onAppear {
                title = initial?.title ?? ""
                url = initial?.url ?? ""
            }
        }
        .presentationDetents([.medium])
    }

    private func submit() {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard t.count <= CustomLinkRules.titleMax else { error = "제목은 \(CustomLinkRules.titleMax)자까지예요."; return }
        guard let u = CustomLinkRules.normalizedURL(url) else { error = "http:// 또는 https:// 로 시작하는 주소를 적어 주세요."; return }
        onSave(CustomLink(title: t, url: u))
        dismiss()
    }
}
