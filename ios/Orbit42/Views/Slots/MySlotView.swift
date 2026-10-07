import SwiftUI

/// 내 예약 링크를 열면 먼저 게스트에게 보이는 화면을 보여주고,
/// 오른쪽 위 "편집"을 눌렀을 때만 수정 화면(SlotDetailView)으로 간다.
struct MySlotRoute: Hashable {
    let id: String
    let slug: String
    let title: String
}

struct MySlotView: View {
    let route: MySlotRoute
    let listViewModel: SlotsViewModel
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        Group {
            if let username = auth.user?.username {
                SlotBookingView(username: username, slug: route.slug, title: route.title)
            } else {
                ProgressView().tint(Theme.accent)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    SlotDetailView(route: SlotRoute(id: route.id, title: route.title), listViewModel: listViewModel)
                } label: {
                    Text("편집").fontWeight(.semibold)
                }
            }
        }
    }
}
