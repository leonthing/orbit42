import SwiftUI

/// 사람/열린 타임슬롯 검색 화면.
/// 예약 탭 툴바의 돋보기에서 push 된다.
struct SearchView: View {
    @State private var viewModel = SearchViewModel()
    @FocusState private var isSearchFocused: Bool

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                searchBar
                content
            }
        }
        .navigationTitle("오르빗")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.loadOrbit() }
    }

    // MARK: - 검색바

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
            TextField("이름, @핸들, 슬롯 제목", text: $viewModel.query)
                .focused($isSearchFocused)
                .foregroundStyle(.white)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !viewModel.query.isEmpty {
                Button {
                    viewModel.query = ""
                    viewModel.queryChanged()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .onChange(of: viewModel.query) {
            viewModel.queryChanged()
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if viewModel.trimmedQuery.isEmpty {
            if let orbit = viewModel.orbit, !orbit.isEmpty {
                orbitList(orbit)
            } else {
                hintState(
                    icon: "sparkle.magnifyingglass",
                    title: "오르빗이 비어있어요",
                    message: "관심 있는 사람을 팔로우하면\n그 사람의 열리는 시간이 여기 모여요.\n친구를 초대하면 자동으로 맞팔로우돼요."
                )
            }
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else if let results = viewModel.results {
            if results.isEmpty {
                hintState(
                    icon: "questionmark.circle",
                    title: "검색 결과가 없어요",
                    message: "다른 이름이나 키워드로 다시 찾아보세요"
                )
            } else {
                resultsList(results)
            }
        } else if viewModel.isSearching {
            loadingState
        } else {
            Color.clear
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.accent)
            Text("검색하는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
                Task { await viewModel.retry() }
            } label: {
                Text("다시 시도")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func hintState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.accent)
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.horizontal, 32)
    }

    // MARK: - 결과 목록

    private func resultsList(_ results: SearchResponse) -> some View {
        List {
            if !results.users.isEmpty {
                Section {
                    ForEach(results.users) { user in
                        NavigationLink {
                            PersonProfileView(username: user.username)
                        } label: {
                            PersonResultRow(user: user)
                        }
                        .searchRowChrome()
                    }
                } header: {
                    sectionHeader("사람")
                }
            }

            if !results.slots.isEmpty {
                Section {
                    ForEach(results.slots) { slot in
                        NavigationLink {
                            SlotBookingView(username: slot.hostUsername, slug: slot.slug)
                        } label: {
                            SlotResultRow(slot: slot)
                        }
                        .searchRowChrome()
                    }
                } header: {
                    sectionHeader("열린 타임슬롯")
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.immediately)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.secondaryText)
            .textCase(nil)
    }

    // MARK: - 내 오르빗 (검색어 없을 때 기본 콘텐츠)

    private func orbitList(_ people: [OrbitPerson]) -> some View {
        List {
            Section {
                ForEach(people) { person in
                    OrbitPersonCard(person: person)
                        .searchRowChrome()
                }
            } header: {
                sectionHeader("내 오르빗")
            } footer: {
                Text("팔로우한 사람들의 열린 시간이에요. 친구를 초대하면 자동으로 맞팔로우돼요.")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await viewModel.loadOrbit(force: true) }
    }
}

// MARK: - 행 공통 스타일

private extension View {
    func searchRowChrome() -> some View {
        self
            .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
    }
}

// MARK: - 내 오르빗 카드 (사람 + 열린 슬롯을 한 카드로)

private struct OrbitPersonCard: View {
    let person: OrbitPerson

    var body: some View {
        VStack(spacing: 0) {
            NavigationLink {
                PersonProfileView(username: person.username)
            } label: {
                personRow
            }
            .buttonStyle(.plain)

            if !person.slots.isEmpty {
                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
                    .padding(.horizontal, 12)

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(person.slots) { slot in
                        NavigationLink {
                            SlotBookingView(username: person.username, slug: slot.slug)
                        } label: {
                            slotPill(slot)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    /// 상단 행 — 행 전체 탭 = 프로필 (표준 관례라 별도 affordance 없이 충분).
    private var personRow: some View {
        HStack(spacing: 12) {
            DiscoverAvatar(
                url: person.avatarUrl.flatMap(URL.init(string:)),
                name: person.preferredName,
                size: 40
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(person.preferredName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("@\(person.username)")
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                    .lineLimit(1)
                if person.slots.isEmpty {
                    Text("아직 열린 시간이 없어요")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    /// 슬롯 알약 버튼 — 캡슐 배경이 버튼 affordance 를 주므로 chevron 불필요.
    private func slotPill(_ slot: TimeSlot) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.caption2)
                .foregroundStyle(Theme.accent)
            Text(slot.title)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white)
                .lineLimit(1)
            Text("· \(slot.durationMin)분 · \(DiscoverFormat.priceText(cents: slot.priceCents))")
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Theme.accent.opacity(0.12), in: Capsule())
        .contentShape(Capsule())
    }
}

// MARK: - 사람 행

private struct PersonResultRow: View {
    let user: SearchUser

    var body: some View {
        HStack(spacing: 12) {
            DiscoverAvatar(url: user.avatarURL, name: user.preferredName, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(user.preferredName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("@\(user.username)")
                        .font(.footnote)
                        .foregroundStyle(Theme.accent)
                        .lineLimit(1)
                }
                if let bio = user.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - 슬롯 행

private struct SlotResultRow: View {
    let slot: SearchSlot

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(slot.title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .lineLimit(1)
            HStack(spacing: 6) {
                Text(slot.hostDisplayName)
                Text("·")
                Text(slot.durationText)
                Text("·")
                Text(slot.isAuction ? "경매" : slot.priceText)
            }
            .font(.footnote)
            .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - 공용 아바타

/// 검색/프로필 화면 공용 아바타 — 이미지가 없으면 이니셜.
struct DiscoverAvatar: View {
    let url: URL?
    let name: String
    let size: CGFloat

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.accent.opacity(0.25)
                    Text(String(name.prefix(1)).uppercased())
                        .font(.system(size: size * 0.4, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

#Preview {
    NavigationStack {
        SearchView()
    }
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
