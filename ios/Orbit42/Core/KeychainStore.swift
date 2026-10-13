import Foundation
import Security

/// 인증 토큰(opaque 문자열)을 Keychain 에 저장/로드/삭제한다.
/// 원래 위치(앱 전용)가 기준이고, 홈 화면 위젯용으로 공유 그룹에 사본을 둔다(`SharedKeychain`).
/// 사본 쓰기가 실패해도 앱 로그인은 원래 위치로 그대로 동작한다 — 위젯만 '앱에서 로그인' 상태가 된다.
enum KeychainStore {
    private static let service = "org.orbit42.app"
    private static let account = "auth-token"

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    @discardableResult
    static func saveToken(_ token: String) -> Bool {
        guard let data = token.data(using: .utf8) else { return false }
        // 기존 항목이 있으면 갱신, 없으면 추가
        let updateAttributes: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(baseQuery as CFDictionary, updateAttributes as CFDictionary)
        SharedKeychain.save(token)
        if updateStatus == errSecSuccess { return true }

        var addQuery = baseQuery
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }

    static func loadToken() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func deleteToken() {
        SecItemDelete(baseQuery as CFDictionary)
        SharedKeychain.delete()
    }

    /// 업데이트 전부터 로그인해 있던 사용자 — 원래 토큰을 공유 사본으로 한 번 옮긴다.
    /// 원래 항목은 지우지 않는다(되돌림 경로). 결과는 위젯 진단용으로만 쓴다.
    @discardableResult
    static func syncSharedCopy() -> Bool {
        guard let token = loadToken() else { return false }
        if SharedKeychain.load() == token { return true }
        return SharedKeychain.save(token)
    }
}
