import SwiftUI

/// 관계 궤도 그림 — 가운데의 나를 중심으로, 최근에 만난 사람일수록 가까운 궤도에 놓인다.
/// (Clique 의 OrbitView 를 업무·사회 관계에 맞게 옮김: 궤도 기준 7일/30일/그 이상, 최대 12명)
struct ContactOrbitView: View {
    let people: [Contact]
    let me: User?
    let onTapPerson: (Contact) -> Void
    let onAdd: () -> Void

    @State private var appeared = false

    /// 위쪽 사람은 라벨이 아바타 위에 붙으므로, 바깥 궤도의 라벨까지 카드 안에 들어오도록
    /// 가운데를 조금 아래로 둔다.
    private let height: CGFloat = 424
    private let centerY: CGFloat = 214
    private let ringRadii: [CGFloat] = [82, 114, 144]
    /// 궤도마다 첫 사람의 각도 (겹치지 않게 조금씩 비튼다)
    private let ringOffsets: [Double] = [-90, -60, -120]

    private struct Placed: Identifiable {
        let person: Contact
        let ring: Int
        let angle: Double
        var id: String { person.id }
    }

    /// 서버가 가까운 순으로 정렬해 준다 — 앞에서 최대 12명을 궤도별로 고르게 둘러 놓는다.
    private var placed: (items: [Placed], hidden: Int) {
        let shown = Array(people.prefix(ContactFormat.orbitLimit))
        let byRing = Dictionary(grouping: shown) { min(max($0.ring, 0), 2) }
        var items: [Placed] = []
        for (ring, members) in byRing {
            let step = 360.0 / Double(members.count)
            for (i, member) in members.enumerated() {
                let deg = ringOffsets[ring] + step * Double(i)
                items.append(Placed(person: member, ring: ring, angle: deg * .pi / 180))
            }
        }
        return (items, max(0, people.count - shown.count))
    }

    /// 사람이 많을수록 아바타를 작게
    private var nodeSize: CGFloat {
        switch min(people.count, ContactFormat.orbitLimit) {
        case ...3: 54
        case ...6: 46
        case ...9: 40
        default: 36
        }
    }

    var body: some View {
        let layout = placed
        VStack(spacing: 10) {
            GeometryReader { geo in
                let center = CGPoint(x: geo.size.width / 2, y: centerY)
                ZStack {
                    ForEach(ringRadii.indices, id: \.self) { i in
                        Circle()
                            .strokeBorder(Theme.fill(0.09), style: StrokeStyle(lineWidth: 1, dash: i == 2 ? [3, 5] : []))
                            .frame(width: ringRadii[i] * 2, height: ringRadii[i] * 2)
                            .position(center)
                    }

                    meNode.position(center)

                    ForEach(layout.items) { item in
                        let r = appeared ? ringRadii[item.ring] : 0
                        node(item.person, labelAbove: sin(item.angle) < 0)
                            .position(x: center.x + r * cos(item.angle), y: center.y + r * sin(item.angle))
                            .opacity(appeared ? 1 : 0)
                    }
                }
            }
            .frame(height: height)
            .overlay(alignment: .topTrailing) {
                DashedPlusButton(label: "사람 추가", action: onAdd)
            }

            Text(caption(hidden: layout.hidden))
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
                .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 6)
        .peopleCard(padding: 12)
        // 위치가 정해진 그림이라 아주 큰 글씨에서는 라벨이 겹치지 않게 제한한다.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.75).delay(0.1)) { appeared = true }
        }
    }

    private func caption(hidden: Int) -> String {
        if people.isEmpty { return "오른쪽 위 +로 사람을 더하거나, 캘린더에서 찾아보세요" }
        if hidden > 0 { return "최근에 만났을수록 가까이 · 외 \(hidden)명은 아래 목록에서" }
        return "최근에 만났을수록 나와 가까이 있어요"
    }

    private var meNode: some View {
        MeAvatar(user: me, size: 60)
            .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 2.5))
            .padding(4)
            .overlay(Circle().strokeBorder(Theme.accent.opacity(0.35), lineWidth: 3))
            .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
            .accessibilityLabel("나")
    }

    /// 아바타 중심이 궤도 위에 오도록, 라벨 높이만큼 반대쪽을 비워둔다.
    /// 위쪽 사람은 라벨을 위에 두어 가운데의 ‘나’와 겹치지 않게 한다.
    private func node(_ person: Contact, labelAbove: Bool) -> some View {
        let label = VStack(spacing: 1) {
            Text(person.name)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
                .lineLimit(1)
                .frame(maxWidth: 76)
            Text(ContactFormat.metOrNext(person))
                .font(.caption2)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(height: 30)
        let avatar = ContactAvatar(person: person, size: nodeSize)
            .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 3))
            .shadow(color: person.displayColor.opacity(0.35), radius: 8, y: 3)

        return Button { onTapPerson(person) } label: {
            VStack(spacing: 4) {
                if labelAbove {
                    label
                    avatar
                } else {
                    avatar
                    label
                }
            }
            .padding(labelAbove ? .bottom : .top, 34 - (54 - nodeSize) / 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(person.name), \(ContactFormat.metOrNext(person))")
    }
}
