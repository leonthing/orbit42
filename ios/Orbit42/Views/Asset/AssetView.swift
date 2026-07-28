import SwiftUI

/// 자산 탭 — "시간 = 돈"을 금융앱처럼 보여준다.
/// 시급 기준(월급/시급 입력)으로 내 1시간의 가치를 환산하고,
/// 이번 주 시간 사용을 수입/투자/소비/생활 버킷으로 분석한다.
struct AssetView: View {
    @Environment(TabRouter.self) private var router
    @State private var viewModel = AssetViewModel()
    @State private var showingSettingsSheet = false
    @State private var showingGoalsSheet = false
    @State private var showingBucketMapSheet = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                content
            }
            .navigationTitle("자산")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingSettingsSheet) {
                AssetSettingsSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $showingBucketMapSheet) {
                BucketMapSheet(viewModel: viewModel)
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
            // 탭에 들어올 때마다 조용히 새로 계산 — 캘린더 용도·이벤트 분류를
            // 바꾼 뒤 자산 탭이 예전 숫자를 보여주는 혼란을 막는다.
            // (이미 요약이 있으면 그대로 보여주며 뒤에서 갱신)
            .task { await viewModel.load(force: viewModel.summary != nil) }
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let summary = viewModel.summary {
            // freelance 는 실효 시급이 아직 없어도(수입 시간 부족) 본문을 보여주고
            // 헤더에서만 안내한다 — 온보딩은 급여 유형 자체가 미설정일 때만.
            if summary.hourlyValueKrw == nil, summary.incomeType != "freelance" {
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
                .foregroundStyle(Theme.primaryText)
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
                if summary.incomeType == "freelance" {
                    freelanceHeader(summary)
                } else if let hourly = summary.hourlyValueKrw {
                    headerCard(
                        title: "내 1시간",
                        hourly: hourly,
                        caption: nil,
                        conversions: summary.conversions
                    )
                }
                if let lifetime = summary.lifetime {
                    lifetimeCard(lifetime)
                }
                if let report = summary.report {
                    reportCard(report)
                }
                goalsCard(summary.goals)
                weekUsageCard(summary)
                if let actions = summary.actions, !actions.isEmpty {
                    actionsCard(actions)
                }
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

    // MARK: 1. 헤더 — 내 1시간 / 내 실효 시급

    /// 프리랜서 헤더 — 실효 시급이 계산됐으면 근거 캡션과 함께, 아직이면 안내 카드.
    @ViewBuilder
    private func freelanceHeader(_ summary: TimeAssetSummary) -> some View {
        if let hourly = summary.hourlyValueKrw {
            headerCard(
                title: "내 실효 시급",
                hourly: hourly,
                caption: freelanceCaption(summary.freelance),
                conversions: summary.conversions
            )
        } else {
            freelanceEmptyHeaderCard
        }
    }

    /// "최근 3개월 수입 ₩18,000,000 ÷ 수입 120시간"
    private func freelanceCaption(_ freelance: TimeAssetFreelance?) -> String? {
        guard let freelance else { return nil }
        return "최근 \(freelance.months.count)개월 수입 \(AssetFormat.won(freelance.totalKrw))"
            + " ÷ 수입 \(AssetFormat.hours(freelance.earnHours))시간"
    }

    /// 프리랜서 전환은 됐지만 수입 시간이 부족해 아직 실효 시급이 없는 상태.
    private var freelanceEmptyHeaderCard: some View {
        card {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("내 실효 시급")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                    Text("아직 계산할 수 없어요")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.primaryText)
                    Text("월 수입과 수입 시간을 기록하면 실효 시급이 나와요")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                settingsButton
            }
        }
    }

    private var settingsButton: some View {
        Button {
            showingSettingsSheet = true
        } label: {
            Image(systemName: "pencil")
                .foregroundStyle(Theme.secondaryText)
                .padding(8)
                .background(Theme.background.opacity(0.6))
                .clipShape(Circle())
        }
        .accessibilityLabel("자산 설정")
    }

    private func headerCard(
        title: String,
        hourly: Int,
        caption: String?,
        conversions: TimeAssetConversions?
    ) -> some View {
        card {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                    Text(AssetFormat.won(hourly))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Theme.primaryText)
                    if let caption {
                        Text(caption)
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(Theme.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer()
                settingsButton
            }

            if let conv = conversions {
                Divider().overlay(Theme.fill(0.08))
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
                .foregroundStyle(Theme.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: 2. 이번 주 시간 사용

    private func weekUsageCard(_ summary: TimeAssetSummary) -> some View {
        card {
            HStack {
                Text("이번 주 시간 사용")
                    .font(.headline)
                    .foregroundStyle(Theme.primaryText)
                Spacer()
                Button {
                    showingBucketMapSheet = true
                } label: {
                    Label("분류 설정", systemImage: "slider.horizontal.3")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.secondaryText)
                }
                .accessibilityLabel("시간 분류 설정")
            }

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
                                .foregroundStyle(Theme.primaryText)
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
                                    .foregroundStyle(Theme.primaryText)
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

            Text(weekUsageCaption(summary))
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
    }

    /// 수면 시간이 내려오면 "기록 · 수면(설정) · 그 외 미기록", 구 응답이면 기존 문구.
    private func weekUsageCaption(_ summary: TimeAssetSummary) -> String {
        let recorded = AssetFormat.hours(summary.scheduledHours)
        let unrecorded = AssetFormat.hours(summary.unrecordedHours)
        guard let sleepWeek = summary.sleepHoursPerWeek else {
            return "기록 \(recorded)시간 · 미기록(수면 등) \(unrecorded)시간"
        }
        let sleepPerDay = AssetFormat.hours(summary.sleepHoursPerDay ?? sleepWeek / 7)
        return "기록 \(recorded)시간 · 수면(설정 \(sleepPerDay)시간/일) \(AssetFormat.hours(sleepWeek))시간 · 그 외 미기록 \(unrecorded)시간"
    }

    // MARK: 1.5 남은 시간 자산

    /// 큰 금액 축약 — 1억 이상은 "₩9.7억", 1만 이상은 "₩3,200만".
    private func compactWon(_ value: Int) -> String {
        if value >= 100_000_000 {
            let eok = Double(value) / 100_000_000
            return eok >= 100 ? "₩\(Int(eok.rounded()))억" : "₩\(String(format: "%.1f", eok))억"
        }
        if value >= 10_000_000 {
            return "₩\(AssetFormat.grouped(value / 10_000))만"
        }
        return AssetFormat.won(value)
    }

    private func lifetimeCard(_ lifetime: TimeAssetLifetime) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("남은 시간 자산")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("약 \(AssetFormat.grouped(lifetime.remainingAwakeHours))시간")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.primaryText)
                    .monospacedDigit()
                if let value = lifetime.remainingValueKrw {
                    Text("≈ \(compactWon(value))")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
            Text("만 \(lifetime.assumedLifespanYears)세까지, 수면을 뺀 깨어있는 시간 기준 — 지금 이 순간에도 줄고 있어요.")
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: 1.6 지난주 리포트

    private func reportCard(_ report: TimeAssetWeeklyReport) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("지난주 리포트")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                Spacer()
                Text(AssetFormat.weekLabel(report.weekStart))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }

            if let earned = report.earnedKrw {
                reportRow(
                    label: "수입",
                    value: AssetFormat.won(earned),
                    delta: report.deltaEarnedKrw.map { d in
                        (text: "\(d >= 0 ? "+" : "−")\(AssetFormat.won(abs(d)))", positiveIsGood: true, raw: d)
                    }
                )
            }
            reportRow(
                label: "투자 시간",
                value: "\(AssetFormat.hours(report.investHours))시간",
                delta: (
                    text: "\(report.deltaInvestHours >= 0 ? "+" : "−")\(AssetFormat.hours(abs(report.deltaInvestHours)))시간",
                    positiveIsGood: true,
                    raw: report.deltaInvestHours == 0 ? 0 : (report.deltaInvestHours > 0 ? 1 : -1)
                )
            )
            reportRow(
                label: "잃어버린 시간",
                value: "\(AssetFormat.hours(report.lostHours))시간",
                delta: (
                    text: "\(report.deltaLostHours >= 0 ? "+" : "−")\(AssetFormat.hours(abs(report.deltaLostHours)))시간",
                    positiveIsGood: false,
                    raw: report.deltaLostHours == 0 ? 0 : (report.deltaLostHours > 0 ? 1 : -1)
                )
            )
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func reportRow(
        label: String,
        value: String,
        delta: (text: String, positiveIsGood: Bool, raw: Int)?
    ) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
                .monospacedDigit()
            if let delta, delta.raw != 0 {
                let improved = (delta.raw > 0) == delta.positiveIsGood
                Text(delta.text)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(improved ? .green : .orange)
                    .monospacedDigit()
            }
        }
    }

    // MARK: 1.7 주간 목표

    @ViewBuilder
    private func goalsCard(_ goals: TimeAssetGoals?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("주간 목표")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                Spacer()
                Button {
                    showingGoalsSheet = true
                } label: {
                    Text(goals == nil ? "목표 설정" : "수정")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }

            if let goals {
                if let target = goals.earnKrw, target > 0 {
                    goalGauge(
                        label: "수입",
                        progressText: "\(AssetFormat.won(goals.progressEarnKrw)) / \(AssetFormat.won(target))",
                        ratio: min(1, Double(goals.progressEarnKrw) / Double(target))
                    )
                }
                if let target = goals.investHours, target > 0 {
                    goalGauge(
                        label: "투자 시간",
                        progressText: "\(AssetFormat.hours(goals.progressInvestHours)) / \(AssetFormat.hours(target))시간",
                        ratio: min(1, goals.progressInvestHours / target)
                    )
                }
            } else {
                Text("이번 주 수입·투자 시간 목표를 정하면 진행률이 여기 표시돼요.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showingGoalsSheet) {
            WeeklyGoalsSheet(viewModel: viewModel)
        }
    }

    private func goalGauge(label: String, progressText: String, ratio: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(label)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                Spacer()
                Text(progressText)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                    .monospacedDigit()
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.fill(0.08))
                    Capsule()
                        .fill(ratio >= 1 ? Color.green : Theme.accent)
                        .frame(width: max(4, proxy.size.width * ratio))
                }
            }
            .frame(height: 6)
        }
    }

    // MARK: 2.5 행동 추천 — 진단을 다음 행동으로

    private func actionsCard(_ actions: [TimeAssetAction]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("이렇게 활용해 보세요")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)

            ForEach(actions) { action in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: action.systemImage)
                            .font(.subheadline)
                            .foregroundStyle(Theme.accent)
                        Text(action.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                    }
                    Text(action.body)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        perform(action)
                    } label: {
                        Text(action.ctaLabel)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Theme.accent.opacity(0.15), in: Capsule())
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.fill(0.04), in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    /// 추천 카드 CTA — 대상 탭/시트로 이동.
    private func perform(_ action: TimeAssetAction) {
        switch action.target {
        case "slots":
            router.calendarModeRequest = "slots"
            router.selection = .calendar
        case "calendar":
            router.calendarModeRequest = "schedule"
            router.selection = .calendar
        case "profile":
            router.selection = .profile
        case "asset-settings":
            showingSettingsSheet = true
        default:
            break
        }
    }

    // MARK: 3. 4주 추이

    private func trendCard(_ trend: [TimeAssetTrendWeek]) -> some View {
        card {
            Text("4주 추이")
                .font(.headline)
                .foregroundStyle(Theme.primaryText)

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
                .foregroundStyle(Theme.primaryText)
            HStack(spacing: 0) {
                tradedCell("판매된 시간", "\(AssetFormat.hours(traded.totalHours))시간")
                tradedCell("누적 거래액", AssetFormat.won(traded.totalKrw))
                tradedCell("예약", "\(traded.totalBookings)건")
            }
            if let implied = traded.impliedHourlyKrw {
                Divider().overlay(Theme.fill(0.08))
                HStack {
                    Text("판매 단가")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                    Spacer()
                    Text("\(AssetFormat.won(implied))/시간")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.primaryText)
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
                .foregroundStyle(Theme.primaryText)
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
                .foregroundStyle(Theme.primaryText)
            ForEach(messages, id: \.self) { message in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lightbulb.fill")
                        .font(.footnote)
                        .foregroundStyle(Color(red: 0xF5 / 255, green: 0x9E / 255, blue: 0x0B / 255))
                        .padding(.top, 2)
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(Theme.primaryText.opacity(0.9))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

#Preview {
    AssetView()
        .tint(Theme.accent)
}
