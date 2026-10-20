# Firestore Security Specification & Invariants

## 1. Data Invariants
1. **User Scoping & Isolation:** A user can only access, query, create, update, and delete their own folders, files, and playback settings (`ownerId == request.auth.uid`).
2. **Identity Integrity:** On creation and update, `ownerId` must equal `request.auth.uid`. Cross-user identity spoofing is forbidden.
3. **Immutability of Key Fields:** Once created, `id`, `ownerId`, and `createdAt` cannot be modified by any update operation.
4. **Valid IDs:** Document IDs and referenced keys must match alphanumeric/dash/underscore format `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
5. **Payload Bounds:** File content size must not exceed 1MB (`<= 1000000` chars), titles and names must not exceed their respective maximum lengths, and file types must be strictly constrained to allowed enum values.
6. **Query Boundaries:** `allow list` queries must explicitly enforce `resource.data.ownerId == request.auth.uid` so non-owners cannot perform query scraping.

---

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Read:** Unauthenticated `get /files/file123` -> PERMISSION_DENIED.
2. **Cross-User File Access:** Authenticated User A attempting `get /files/userB_file` -> PERMISSION_DENIED.
3. **Identity Spoofing on Create:** Authenticated User A sending `ownerId: "userB"` on `/files/file456` -> PERMISSION_DENIED.
4. **Ghost Field / Shadow Injection:** User A adding unexpected field `{ adminOverride: true }` -> PERMISSION_DENIED.
5. **Owner ID Tampering on Update:** User A attempting to transfer document ownership by mutating `ownerId` -> PERMISSION_DENIED.
6. **Immutability Violation (createdAt):** User A attempting to modify `createdAt` on an existing folder -> PERMISSION_DENIED.
7. **Path Variable Poisoning:** Injecting 1KB string or SQL/special chars as document ID (`{folderId}`) -> PERMISSION_DENIED.
8. **Invalid Enum Type Poisoning:** Setting `type: "executable_binary"` in file document -> PERMISSION_DENIED.
9. **Oversized String Bomb:** Attempting to write a 5MB payload into `content` beyond allowed length -> PERMISSION_DENIED.
10. **Global Blanket Read:** Querying `collection('files')` without filtering by `ownerId == auth.uid` -> PERMISSION_DENIED.
11. **Negative Value / Type Injection:** Setting `speed: -5` or `speed: "superfast"` in `PlaybackSettings` -> PERMISSION_DENIED.
12. **Cross-User Delete:** Authenticated User A attempting `delete /folders/userB_folder` -> PERMISSION_DENIED.

---

## 3. Test Runner Design
Any test harness running against the rules verifies that all 12 malicious payloads are blocked while authorized requests by the legitimate document owner succeed.
