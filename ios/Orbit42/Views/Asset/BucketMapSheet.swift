import SwiftUI

/// 시간 분류 설정 — 캘린더 용도(9종)를 수입/투자/소비/생활 중 어디로 볼지
/// 사용자가 직접 지정한다. (예: "건강은 투자가 아니라 생활로 볼래")
struct BucketMapSheet: View {
    let viewModel: AssetViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var map: [String: String] = [:]

    private var purposes: [PurposeMeta] {
        viewModel.settings?.purposes ?? []
    }

    private var bucketOptions: [BucketOptionMeta] {
        viewModel.settings?.bucketOptions ?? []
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Form {
                    Section {
                        ForEach(purposes) { purpose in
                            HStack {
                                Text(purpose.label)
                                    .foregroundStyle(.white)
                                Spacer()
                                Picker("", selection: binding(for: purpose)) {
                                    ForEach(bucketOptions) { option in
                                        HStack(spacing: 6) {
                                            Circle()
                                                .fill(option.swiftUIColor)
                                                .frame(width: 8, height: 8)
                                            Text(option.label)
                                        }
                                        .tag(option.key)
                                    }
                                }
                                .labelsHidden()
                                .tint(colorFor(map[purpose.key] ?? purpose.defaultBucket))
                            }
                        }
                    } header: {
                        Text("캘린더 용도별 분류")
                    } footer: {
                        Text("일정은 자기가 속한 캘린더의 용도를 따라요. 캘린더별 용도는 프로필 > 내 캘린더에서 바꿀 수 있어요.")
                    }
                    .listRowBackground(Theme.surface)

                    Section {
                        Button("기본값으로 되돌리기") {
                            map = Dictionary(
                                uniqueKeysWithValues: purposes.map {
                                    ($0.key, $0.defaultBucket)
                                }
                            )
                        }
                        .foregroundStyle(Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("시간 분류 설정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.isSaving {
                        ProgressView().tint(Theme.accent)
                    } else {
                        Button("저장") {
                            Task {
                                if await viewModel.saveBucketMap(map) {
                                    dismiss()
                                }
                            }
                        }
                        .fontWeight(.semibold)
                        .disabled(purposes.isEmpty)
                    }
                }
            }
            .onAppear {
                let effective = viewModel.settings?.bucketMap ?? [:]
                map = Dictionary(
                    uniqueKeysWithValues: purposes.map {
                        ($0.key, effective[$0.key] ?? $0.defaultBucket)
                    }
                )
            }
        }
        .preferredColorScheme(.dark)
    }

    private func binding(for purpose: PurposeMeta) -> Binding<String> {
        Binding(
            get: { map[purpose.key] ?? purpose.defaultBucket },
            set: { map[purpose.key] = $0 }
        )
    }

    private func colorFor(_ bucketKey: String) -> Color {
        bucketOptions.first(where: { $0.key == bucketKey })?.swiftUIColor
            ?? Theme.accent
    }
}
