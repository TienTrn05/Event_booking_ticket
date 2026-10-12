# Feedback

A shared feedback table distinguishes ORGANIZATION reviews from SYSTEM app feedback. Organization reviews require a verified paid purchase after session end or cancellation, one per author/event, editable for seven days. Members cannot review their own organization. Author, scoped Organizer and Admin can read; Organizer replies, Admin moderates with reason. No public catalog endpoint or automatic reputation score.

App feedback can be submitted by any authenticated user. Only author/Admin can read; Admin responds and changes OPEN/IN_REVIEW/RESOLVED. App feedback never affects organization averages or report privileges.

Controllers validate strict schemas, services enforce scope/state and transaction, repositories query with parameters. Mutations require Origin/idempotency; edits use versions, retain history, and do not unhide moderated content. DTOs exclude history/identity/contact data; audit excludes feedback text. [Docs37](../../../../Docs/37-refunds-reviews-app-feedback.md). FE integration is pending.
