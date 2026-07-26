import SwiftUI

/// 로그인된 유저의 프로필 + 로그아웃.
struct ProfileView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        NavigationStack {
            List {
                if let user = auth.user {
                    Section {
                        HStack(spacing: 16) {
                            avatar(for: user)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.preferredName)
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                Text("@\(user.username)")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.accent)
                                if let email = user.email, !email.isEmpty {
                                    HStack(spacing: 4) {
                                        Text(email)
                                        if user.emailVerified {
                                            Image(systemName: "checkmark.seal.fill")
                                                .font(.caption2)
                                                .foregroundStyle(Theme.accent)
                                        }
                                    }
                                    .font(.footnote)
                                    .foregroundStyle(Theme.secondaryText)
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    Button(role: .destructive) {
                        auth.logout()
                    } label: {
                        Text("로그아웃")
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("프로필")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func avatar(for user: User) -> some View {
        AsyncImage(url: user.avatarURL) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.accent.opacity(0.25)
                    Text(String(user.preferredName.prefix(1)).uppercased())
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(Circle())
    }
}

#Preview {
    ProfileView()
        .environment(AuthViewModel())
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
