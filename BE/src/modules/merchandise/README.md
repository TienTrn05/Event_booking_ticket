# Merchandise

Product review/SKUs, orders with five-minute PostgreSQL stock reservation, shared payOS dispatch, fulfillment and evidence-backed full refunds. Contracts, lock order, encrypted recipient scope, ERD and FE examples: [Docs44](../../../../Docs/44-backend-v1-extensions.md).

Controllers parse strict HTTP inputs; services own permissions/transactions; repositories contain SQL. Payment adapter uses common PurchasePaymentPort and never issues tickets. Existing booking worker expires merchandise orders; no new service, broker or worker. SKU locks sort by ID, DB clock follows locks, snapshot amounts never come from the browser. Manual compensation requires the exact assigned order report.
