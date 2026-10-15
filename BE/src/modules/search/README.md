# Public event search

Home search/autocomplete: English Elasticsearch single-node, Redis candidate cache15s, authoritative PostgreSQL hydration for current publication/session/filter/price/availability/personal blocks. Native completion FST + edge N-gram/N-gram/fuzzy, no separate Trie service. Controllers parse HTTP, service orchestrates, repository owns SQL; existing notifications worker drains durable SEARCH_EVENT_SYNC outbox without network inside PG transactions.

Migration015 adds only functions/triggers to existing outbox; no tables or auth contract changes. See [contract, setup, consistency, tests and limits](../../../../Docs/41-home-event-search.md). No raw provider error/credentials/private drafts/attendee/payment data in index or logs. Elasticsearch9.5.5 one instance was explicitly approved under ADR-036; API remains Modular Monolith one instance.
