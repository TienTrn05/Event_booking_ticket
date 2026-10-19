# Refunds

Full manual refund requested >=24 hours before session, only CONFIRMED purchases with all tickets VALID. Request/decision/result/retry are idempotent and versioned. Approval cancels tickets atomically before any manual transfer; completion marks payment/booking/tickets REFUNDED. Seats remain SOLD; failures never revive tickets. Bank reference/evidence/time/actor are recorded manually, not confirmed by payOS.

RefundService depends on narrow booking/payment ports; adapters mutate their own modules using the same PostgreSQL transaction. Quota and allocation locks serialize admission/refund. Admin needs an assigned IN_REVIEW report for the exact booking/event; app feedback does not provide this access. Report claim/resolve removes scope after closure.

API and policy: [Docs37](../../../../Docs/37-refunds-reviews-app-feedback.md). Migration012 reuses refunds/support_reports. Integration fixtures cover money state, USED, replay, races and report scope. No automatic transfer/compensation or FE UI yet.
