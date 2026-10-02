import SwiftUI

// MARK: - 사람 아바타

/// 회원은 프로필 사진(없으면 이니셜), 회원이 아니면 고유색 위 이니셜.
/// 색은 사람마다 고정이라 궤도·카드·시트에서 같은 사람을 같은 색으로 알아본다.
struct ContactAvatar: View {
    let person: Contact
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(person.isMember ? person.displayColor : person.displayColor.opacity(0.82))
            Text(person.initial)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundStyle(.white)
            if let url = person.avatarURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

/// 나 — 가운데에 놓이는 아바타.
struct MeAvatar: View {
    let user: User?
    let size: CGFloat

    var body: some View {
        DiscoverAvatar(
            url: user?.avatarUrl.flatMap(URL.init(string:)),
            name: user?.displayName ?? user?.username ?? "나",
            size: size
        )
    }
}

// MARK: - 카드

extension View {
    /// 관계 화면 공용 카드 — 흰 표면 + 은은한 테두리.
    func peopleCard(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Theme.fill(0.06), lineWidth: 1)
            )
    }
}

/// 작은 상태 알약 — "3일 전 만남", "다음 일정 10월 8일"
struct ContactPill: View {
    let symbol: String
    let text: String

    var body: some View {
        Label(text, systemImage: symbol)
            .font(.footnote)
            .foregroundStyle(Theme.secondaryText)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.fill(0.05), in: Capsule())
    }
}

/// 세로 지표 하나 — 카드의 "마지막 만남 | 함께한 시간 | …" 줄
struct ContactMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption2)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }
}

/// 원형 + 버튼 (점선 테두리)
struct DashedPlusButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
                .frame(width: 36, height: 36)
                .background(Theme.surface, in: Circle())
                .overlay(Circle().strokeBorder(Theme.fill(0.18), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// 액션 타일 — 퀵 시트의 "만났어요 / 일정 잡기 / 시간 요청 / 프로필"
struct ContactActionTile: View {
    let symbol: String
    let title: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(tint)
                Text(title)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Theme.fill(0.06), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
