import SwiftUI

/// 사람/열린 타임슬롯 검색 화면.
/// 예약 탭 툴바의 돋보기에서 push 된다.
struct SearchView: View {
    @State private var viewModel = SearchViewModel()
    /// 팔로우 추천 — 오르빗 아래 섹션 (온보딩과 같은 API·행 공용).
    @State private var suggestions = FollowSuggestionsViewModel()
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
        .task {
            async let orbit: Void = viewModel.loadOrbit()
            async let stream: Void = viewModel.loadStream()
            async let suggested: Void = suggestions.load()
            _ = await (orbit, stream, suggested)
        }
    }

    // MARK: - 검색바

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
            TextField("이름, @핸들, 슬롯 제목", text: $viewModel.query)
                .focused($isSearchFocused)
                .foregroundStyle(Theme.primaryText)
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
            let orbit = viewModel.orbit ?? []
            if orbit.isEmpty, suggestions.users?.isEmpty != false,
               viewModel.stream?.isEmpty != false {
                hintState(
                    icon: "sparkle.magnifyingglass",
                    title: "오르빗이 비어있어요",
                    message: "관심 있는 사람을 팔로우하면\n그 사람의 열리는 시간이 여기 모여요.\n친구를 초대하면 자동으로 맞팔로우돼요."
                )
            } else {
                orbitList(orbit)
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
                .foregroundStyle(Theme.primaryText)
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

    // List 대신 ScrollView — List의 NavigationLink 자동 chevron(들쭉날쭉한
    // 오른쪽 화살표)을 원천 제거하기 위함.
    private func orbitList(_ people: [OrbitPerson]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if !people.isEmpty {
                    sectionHeader("내 오르빗")
                        .padding(.top, 6)

                    ForEach(people) { person in
                        OrbitPersonCard(person: person)
                    }

                    Text("팔로우한 사람들의 열린 시간이에요. 친구를 초대하면 자동으로 맞팔로우돼요.")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .padding(.top, 4)
                } else {
                    sectionHeader("내 오르빗")
                        .padding(.top, 6)
                    Text("아직 비어있어요. 아래에서 관심 가는 사람을 팔로우해 보세요.")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }

                if let stream = viewModel.stream, !stream.isEmpty {
                    sectionHeader("최근 활동")
                        .padding(.top, 14)

                    ForEach(stream) { item in
                        streamCard(item)
                    }
                }

                if let suggested = suggestions.users, !suggested.isEmpty {
                    sectionHeader("추천")
                        .padding(.top, 14)

                    ForEach(suggested) { user in
                        suggestionRow(user)
                    }

                    Text("아직 팔로우하지 않은 사람들이에요. 관심사가 비슷한 사람부터 보여드려요.")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.immediately)
        .refreshable {
            await viewModel.loadOrbit(force: true)
            await viewModel.loadStream(force: true)
            await suggestions.load(force: true)
        }
    }

    /// 스트림 카드 — 시간 로그(사진) 또는 새 타임슬롯.
    @ViewBuilder
    private func streamCard(_ item: OrbitStreamItem) -> some View {
        if item.type == "slot", let slot = item.slot {
            NavigationLink {
                SlotBookingView(username: item.username, slug: slot.slug)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    streamHeader(item, action: "새 타임슬롯")
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(slot.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.primaryText)
                                .lineLimit(1)
                            Text("\(slot.durationMin)분 · \(slot.priceCents == 0 ? "무료" : DiscoverFormat.priceText(cents: slot.priceCents))")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        Spacer()
                        Text("예약")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Theme.accent, in: Capsule())
                    }
                }
                .padding(12)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
        }
    }

    private func streamHeader(_ item: OrbitStreamItem, action: String) -> some View {
        HStack(spacing: 8) {
            DiscoverAvatar(url: item.avatarURL, name: item.preferredName, size: 26)
            Text(item.preferredName)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
            Text(action)
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
            Spacer(minLength: 0)
        }
    }

    /// 추천 사용자 행 — 행 탭은 프로필로, 버튼은 팔로우로.
    /// 팔로우하면 오르빗 목록을 새로 고쳐 그 사람이 위 섹션에 나타난다.
    private func suggestionRow(_ user: RecommendedUser) -> some View {
        NavigationLink {
            PersonProfileView(username: user.username)
        } label: {
            SuggestedPersonRow(
                user: user,
                isFollowed: suggestions.followed.contains(user.username),
                isBusy: suggestions.busy.contains(user.username)
            ) {
                Task {
                    await suggestions.toggleFollow(user.username)
                    await viewModel.loadOrbit(force: true)
                }
            }
        }
        .buttonStyle(.plain)
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
                    .fill(Theme.fill(0.06))
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
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Text("@\(person.username)")
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                    .lineLimit(1)
                // 관심사 태그 (최대 3개) — "어떤 사람인지" 한눈에
                InterestTagStrip(interests: person.interests)
                    .padding(.top, 3)
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
                .foregroundStyle(Theme.primaryText)
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
                        .foregroundStyle(Theme.primaryText)
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
                InterestTagStrip(interests: user.interests)
                    .padding(.top, 2)
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
                .foregroundStyle(Theme.primaryText)
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
/// 관심사 태그 스트립 (최대 3개) — 사용자 리스트 공용.
struct InterestTagStrip: View {
    let interests: [String]?

    var body: some View {
        if let interests, !interests.isEmpty {
            HStack(spacing: 4) {
                ForEach(interests.prefix(3), id: \.self) { tag in
                    Text(tag)
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryText)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(Theme.fill(0.06), in: Capsule())
                        .lineLimit(1)
                }
            }
        }
    }
}

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
    .tint(Theme.accent)
}
