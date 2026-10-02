import SwiftUI

/// 설정 > 사람 찾기 — 캘린더 참석자로 관계 궤도를 채우는 기능 켜기/끄기.
struct PeopleImportSettingsView: View {
    @Environment(PeopleStore.self) private var store
    @State private var confirmOff = false
    @State private var note: String?

    var body: some View {
        List {
            Section {
                Toggle(isOn: Binding(
                    get: { store.importEnabled },
                    set: { on in
                        if on {
                            Task { note = await store.enableImport() }
                        } else {
                            confirmOff = true
                        }
                    }
                )) {
                    Text("캘린더에서 사람 찾기")
                        .foregroundStyle(Theme.primaryText)
                }
                .tint(Theme.accent)
                .disabled(store.isEnabling || store.data == nil)
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("구글 캘린더와 이 기기의 캘린더(iCloud·회사 계정 등)에서 지난 180일, 앞으로 60일 일정의 참석자 이름과 이메일만 읽어 자주 만난 사람을 제안해요. 참석자가 8명 넘는 일정은 건너뛰고, 상대에게는 아무것도 보내지 않아요.")
                    Text("끄면 캘린더에서 가져온 만남과 고르지 않은 제안이 지워져요. 직접 궤도에 넣은 사람과 메모는 남아요.")
                    if let note {
                        Text(note).foregroundStyle(Theme.accent)
                    }
                }
            }
            .listRowBackground(Theme.surface)

            if store.importEnabled {
                Section {
                    LabeledContent("기기 캘린더", value: DeviceCalendarImporter.isAuthorized ? "허용됨" : "꺼짐")
                    LabeledContent("구글 캘린더", value: store.data?.googleConnected == true ? "연결됨" : "연결 안 됨")
                    if let synced = store.data?.syncedAt.flatMap(APIDateParser.parse) {
                        LabeledContent("마지막 동기화", value: ContactFormat.full(synced))
                    }
                } footer: {
                    if !DeviceCalendarImporter.isAuthorized {
                        Text("기기 캘린더는 설정 앱 > Orbit42 > 캘린더에서 '전체 접근'을 허용하면 함께 읽어요.")
                    }
                }
                .listRowBackground(Theme.surface)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("사람 찾기")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.reload() }
        .confirmationDialog("캘린더에서 사람 찾기를 끌까요?", isPresented: $confirmOff, titleVisibility: .visible) {
            Button("끄기", role: .destructive) {
                Task { await store.disableImport() }
            }
        } message: {
            Text("캘린더에서 가져온 만남과 고르지 않은 제안이 지워져요.")
        }
    }
}
