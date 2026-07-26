import SwiftUI

/// 자산 탭 — "시간 = 돈"을 금융앱처럼 보여준다.
/// 시급 기준(월급/시급 입력)으로 내 1시간의 가치를 환산하고,
/// 이번 주 시간 사용을 수입/투자/소비/생활 버킷으로 분석한다.
struct AssetView: View {
    @State private var viewModel = AssetViewModel()
    @State private var showingSettingsSheet = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                content
            }
            .navigationTitle("자산")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingSettingsSheet) {
                IncomeSettingsSheet(viewModel: viewModel)
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
            .task { await viewModel.load() }
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let summary = viewModel.summary {
            if summary.hourlyValueKrw == nil {
                onboarding
            } else {
                loaded(summary)
            }
        } else if viewModel.isLoading {
            ProgressView().tint(Theme.accent)
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else {
            Color.clear
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 36))
                .foregroundStyle(Theme.secondaryText)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
                .multilineTextAlignment(.center)
            Button("다시 시도") {
                Task { await viewModel.load(force: true) }
            }
            .buttonStyle(.bordered)
            .tint(Theme.accent)
        }
        .padding(32)
    }

    // MARK: - 온보딩 (시급 미설정)

    private var onboarding: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "wonsign.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(Theme.accent)
            Text("내 시간의 가치를 알아보세요")
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)
            Text("월급이나 시급을 입력하면 내 1시간이 얼마인지,\n시간을 어디에 쓰는지 돈으로 환산해 보여드려요.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
                .multilineTextAlignment(.center)
            Button {
                showingSettingsSheet = true
            } label: {
                Text("시작하기")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            .padding(.horizontal, 32)
            Spacer()
            Spacer()
        }
        .padding(24)
    }

    // MARK: - 본문

    private func loaded(_ summary: TimeAssetSummary) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                if let hourly = summary.hourlyValueKrw {
                    headerCard(hourly: hourly, conversions: summary.conversions)
                }
                weekUsageCard(summary)
                if summary.trend.count > 1 {
                    trendCard(summary.trend)
                }
                tradedCard(summary.traded)
                if !summary.messages.isEmpty {
                    insightsCard(summary.messages)
                }
            }
            .padding(16)
        }
        .refreshable { await viewModel.load(force: true) }
    }

    private func card<Content: View>(
        @ViewBuilder _ content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: 1. 헤더 — 내 1시간

    private func headerCard(hourly: Int, conversions: TimeAssetConversions?) -> some View {
        card {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("내 1시간")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                    Text(AssetFormat.won(hourly))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                }
                Spacer()
                Button {
                    showingSettingsSheet = true
                } label: {
                    Image(systemName: "pencil")
                        .foregroundStyle(Theme.secondaryText)
                        .padding(8)
                        .background(Theme.background.opacity(0.6))
                        .clipShape(Circle())
                }
                .accessibilityLabel("급여 기준 수정")
            }

            if let conv = conversions {
                Divider().overlay(Color.white.opacity(0.08))
                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    spacing: 12
                ) {
                    conversionCell("하루 (8시간)", conv.day)
                    conversionCell("주 (40시간)", conv.week)
                    conversionCell("월 (209시간)", conv.month)
                    conversionCell("연", conv.year)
                }
            }
        }
    }

    private func conversionCell(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
            Text(AssetFormat.won(value))
                .font(.callout.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: 2. 이번 주 시간 사용

    private func weekUsageCard(_ summary: TimeAssetSummary) -> some View {
        card {
            Text("이번 주 시간 사용")
                .font(.headline)
                .foregroundStyle(.white)

            // 버킷 비율 가로 스택 바
            if summary.scheduledHours > 0 {
                GeometryReader { geo in
                    HStack(spacing: 2) {
                        ForEach(summary.buckets.filter { $0.hours > 0 }) { bucket in
                            bucket.swiftUIColor
                                .frame(width: max(4, geo.size.width * bucket.ratio))
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                }
                .frame(height: 10)
            }

            VStack(spacing: 10) {
                ForEach(summary.buckets) { bucket in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(bucket.swiftUIColor)
                            .frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(bucket.label)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.white)
                            Text(bucket.description)
                                .font(.caption2)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            HStack(spacing: 6) {
                                Text("\(AssetFormat.hours(bucket.hours))시간")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(.white)
                                Text(AssetFormat.percent(bucket.ratio))
                                    .font(.caption)
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.secondaryText)
                            }
                            if let value = bucket.valueKrw, bucket.hours > 0 {
                                Text(AssetFormat.won(value))
                                    .font(.caption)
                                    .monospacedDigit()
                                    .foregroundStyle(bucket.swiftUIColor)
                            }
                        }
                    }
                    .opacity(bucket.hours > 0 ? 1 : 0.45)
                }
            }

            Text("기록 \(AssetFormat.hours(summary.scheduledHours))시간 · 미기록(수면 등) \(AssetFormat.hours(summary.unrecordedHours))시간")
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
    }

    // MARK: 3. 4주 추이

    private func trendCard(_ trend: [TimeAssetTrendWeek]) -> some View {
        card {
            Text("4주 추이")
                .font(.headline)
                .foregroundStyle(.white)

            let maxTotal = max(trend.map(\.totalHours).max() ?? 1, 1)
            HStack(alignment: .bottom, spacing: 16) {
                ForEach(trend) { week in
                    VStack(spacing: 6) {
                        VStack(spacing: 0) {
                            Spacer(minLength: 0)
                            // 서버 버킷 순서(수입→투자→소비→생활)를 색으로 누적
                            ForEach(bucketOrder, id: \.key) { meta in
                                let hours = week.hoursByBucket[meta.key] ?? 0
                                if hours > 0 {
                                    meta.color
                                        .frame(height: max(2, 110 * hours / maxTotal))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 110, alignment: .bottom)
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                        Text(AssetFormat.weekLabel(week.weekStart))
                            .font(.caption2)
                            .monospacedDigit()
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
        }
    }

    private var bucketOrder: [(key: String, color: Color)] {
        let colors = Dictionary(
            uniqueKeysWithValues: (viewModel.summary?.buckets ?? []).map {
                ($0.key, $0.swiftUIColor)
            }
        )
        return ["earn", "invest", "spend", "life"].map {
            ($0, colors[$0] ?? Theme.accent)
        }
    }

    // MARK: 4. 시간 거래

    private func tradedCard(_ traded: TimeAssetTraded) -> some View {
        card {
            Text("시간 거래")
                .font(.headline)
                .foregroundStyle(.white)
            HStack(spacing: 0) {
                tradedCell("판매된 시간", "\(AssetFormat.hours(traded.totalHours))시간")
                tradedCell("누적 거래액", AssetFormat.won(traded.totalKrw))
                tradedCell("예약", "\(traded.totalBookings)건")
            }
            if let implied = traded.impliedHourlyKrw {
                Divider().overlay(Color.white.opacity(0.08))
                HStack {
                    Text("판매 단가")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                    Spacer()
                    Text("\(AssetFormat.won(implied))/시간")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                    if let ratio = traded.vsIncomeRatio {
                        Text("내 시급의 \(String(format: "%.1f", ratio))배")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
        }
    }

    private func tradedCell(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
            Text(value)
                .font(.callout.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: 5. 인사이트

    private func insightsCard(_ messages: [String]) -> some View {
        card {
            Text("인사이트")
                .font(.headline)
                .foregroundStyle(.white)
            ForEach(messages, id: \.self) { message in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lightbulb.fill")
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0xF5 / 255, green: 0x9E / 255, blue: 0x0B / 255))
                        .padding(.top, 2)
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.9))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

#Preview {
    AssetView()
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
