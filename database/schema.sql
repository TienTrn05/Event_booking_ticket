-- Event Ticketing Platform — bản thiết kế vật lý để review, chưa là migration production.
-- Dialect: MySQL 8.0.16+ / 8.4, InnoDB. Không dùng MariaDB thay thế để kết luận tương thích.
-- Chạy trên database RỖNG do người vận hành chọn; không CREATE/DROP DATABASE, không USE cố định.
-- DDL có implicit commit. Không bọc file này trong transaction để giả lập rollback schema.
-- TTL, currency, quota, refund policy không có default chưa được duyệt; xem docs/18.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_cs;
SET time_zone = '+00:00';

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email_canonical VARCHAR(254) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    email_verified_at DATETIME(6) NULL,
    auth_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email_canonical),
    KEY ix_users_status_created (status, created_at, id),
    CONSTRAINT ck_users_status CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','BLOCKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    granted_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, role_id),
    KEY ix_user_roles_role (role_id, user_id),
    KEY ix_user_roles_granter (granted_by),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_user_roles_granter FOREIGN KEY (granted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (role_id, permission_id),
    KEY ix_role_permissions_permission (permission_id, role_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE event_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_categories_slug (slug),
    CONSTRAINT ck_categories_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organizer_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'DRAFT',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_events_slug (slug),
    KEY ix_events_organizer (organizer_id, created_at, id),
    KEY ix_events_category (category_id),
    KEY ix_events_status_category (status, category_id, id),
    KEY ix_events_status_title (status, title, id),
    CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES users(id),
    CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES event_categories(id),
    CONSTRAINT ck_events_status CHECK (status IN ('DRAFT','PUBLISHED','BLOCKED','CANCELLED','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE venues (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(180) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(120) NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), KEY ix_venues_owner (owner_id, id), KEY ix_venues_city (city, id),
    CONSTRAINT fk_venues_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT ck_venues_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE venue_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    venue_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_sections_venue_code (venue_id, code),
    CONSTRAINT fk_sections_venue FOREIGN KEY (venue_id) REFERENCES venues(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE venue_rows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    section_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_rows_section_code (section_id, code),
    CONSTRAINT fk_rows_section FOREIGN KEY (section_id) REFERENCES venue_sections(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE seats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    row_id BIGINT UNSIGNED NOT NULL,
    number VARCHAR(40) NOT NULL,
    map_x DECIMAL(10,3) NOT NULL,
    map_y DECIMAL(10,3) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_seats_row_number (row_id, number),
    CONSTRAINT fk_seats_row FOREIGN KEY (row_id) REFERENCES venue_rows(id),
    CONSTRAINT ck_seats_coordinates CHECK (map_x >= 0 AND map_y >= 0),
    CONSTRAINT ck_seats_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE event_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id BIGINT UNSIGNED NOT NULL,
    venue_id BIGINT UNSIGNED NOT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6) NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sale_opens_at DATETIME(6) NOT NULL,
    sale_closes_at DATETIME(6) NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'SCHEDULED',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_sessions_event_status_start (event_id, status, starts_at),
    KEY ix_sessions_venue_time (venue_id, starts_at, ends_at),
    CONSTRAINT fk_sessions_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_sessions_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT ck_sessions_time CHECK (ends_at > starts_at AND sale_closes_at > sale_opens_at),
    CONSTRAINT ck_sessions_status CHECK (status IN ('SCHEDULED','CANCELLED','COMPLETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE seat_holds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_holds_id_session (id, session_id),
    UNIQUE KEY uq_holds_owner_session (id, customer_id, session_id),
    KEY ix_holds_customer_status (customer_id, status, id),
    KEY ix_holds_session (session_id), KEY ix_holds_expiry (status, expires_at, id),
    CONSTRAINT fk_holds_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_holds_session FOREIGN KEY (session_id) REFERENCES event_sessions(id),
    CONSTRAINT ck_holds_status CHECK (status IN ('ACTIVE','CONVERTED','RELEASED','EXPIRED')),
    CONSTRAINT ck_holds_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    hold_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'AWAITING_PAYMENT',
    total_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    confirmed_at DATETIME(6) NULL,
    confirmed_payment_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_bookings_hold (hold_id),
    UNIQUE KEY uq_bookings_id_session (id, session_id),
    KEY ix_bookings_hold_scope (hold_id, customer_id, session_id),
    KEY ix_bookings_customer_created (customer_id, created_at, id),
    KEY ix_bookings_session_status (session_id, status, id),
    KEY ix_bookings_expiry (status, expires_at, id),
    KEY ix_bookings_confirmed_payment (confirmed_payment_id, id),
    CONSTRAINT fk_bookings_hold_scope FOREIGN KEY (hold_id, customer_id, session_id)
        REFERENCES seat_holds(id, customer_id, session_id),
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_bookings_session FOREIGN KEY (session_id) REFERENCES event_sessions(id),
    CONSTRAINT ck_bookings_status CHECK (status IN ('AWAITING_PAYMENT','CONFIRMED','EXPIRED','CANCELLED','REFUNDED')),
    CONSTRAINT ck_bookings_amount CHECK (total_minor >= 0),
    CONSTRAINT ck_bookings_currency CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c')),
    CONSTRAINT ck_bookings_confirmation CHECK (
        (status IN ('CONFIRMED','REFUNDED') AND confirmed_at IS NOT NULL AND confirmed_payment_id IS NOT NULL)
        OR (status IN ('AWAITING_PAYMENT','EXPIRED','CANCELLED') AND confirmed_at IS NULL AND confirmed_payment_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE session_seats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id BIGINT UNSIGNED NOT NULL,
    seat_id BIGINT UNSIGNED NOT NULL,
    price_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'AVAILABLE',
    hold_id BIGINT UNSIGNED NULL,
    current_booking_id BIGINT UNSIGNED NULL,
    hold_expires_at DATETIME(6) NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_session_seats_physical (session_id, seat_id),
    UNIQUE KEY uq_session_seats_id_session (id, session_id),
    KEY ix_session_seats_seat (seat_id),
    KEY ix_session_seats_price (session_id, status, price_minor),
    KEY ix_session_seats_expiry (status, hold_expires_at),
    KEY ix_session_seats_hold (hold_id, session_id),
    KEY ix_session_seats_booking (current_booking_id, session_id),
    CONSTRAINT fk_session_seats_session FOREIGN KEY (session_id) REFERENCES event_sessions(id),
    CONSTRAINT fk_session_seats_seat FOREIGN KEY (seat_id) REFERENCES seats(id),
    CONSTRAINT fk_session_seats_hold FOREIGN KEY (hold_id, session_id) REFERENCES seat_holds(id, session_id),
    CONSTRAINT fk_session_seats_booking FOREIGN KEY (current_booking_id, session_id) REFERENCES bookings(id, session_id),
    CONSTRAINT ck_session_seats_price CHECK (price_minor >= 0),
    CONSTRAINT ck_session_seats_currency CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c')),
    CONSTRAINT ck_session_seats_allocation CHECK (
        (status = 'AVAILABLE' AND hold_id IS NULL AND current_booking_id IS NULL AND hold_expires_at IS NULL)
        OR (status = 'HELD' AND hold_id IS NOT NULL AND hold_expires_at IS NOT NULL)
        OR (status = 'SOLD' AND hold_id IS NULL AND current_booking_id IS NOT NULL AND hold_expires_at IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE seat_hold_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    hold_id BIGINT UNSIGNED NOT NULL,
    session_seat_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    price_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_hold_items_seat (hold_id, session_seat_id),
    KEY ix_hold_items_hold_scope (hold_id, session_id),
    KEY ix_hold_items_seat_scope (session_seat_id, session_id),
    CONSTRAINT fk_hold_items_hold FOREIGN KEY (hold_id, session_id) REFERENCES seat_holds(id, session_id),
    CONSTRAINT fk_hold_items_seat FOREIGN KEY (session_seat_id, session_id) REFERENCES session_seats(id, session_id),
    CONSTRAINT ck_hold_items_price CHECK (price_minor >= 0),
    CONSTRAINT ck_hold_items_currency CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE booking_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    session_seat_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    price_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    seat_label_snapshot VARCHAR(160) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_booking_items_seat (booking_id, session_seat_id),
    UNIQUE KEY uq_booking_items_ticket_scope (id, session_seat_id),
    KEY ix_booking_items_booking_scope (booking_id, session_id),
    KEY ix_booking_items_seat_scope (session_seat_id, session_id),
    CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id, session_id) REFERENCES bookings(id, session_id),
    CONSTRAINT fk_booking_items_seat FOREIGN KEY (session_seat_id, session_id) REFERENCES session_seats(id, session_id),
    CONSTRAINT ck_booking_items_price CHECK (price_minor >= 0),
    CONSTRAINT ck_booking_items_currency CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_reference VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
    provider_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    reconciliation_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'NONE',
    reconciliation_reason VARCHAR(255) NULL,
    pending_booking_guard BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN booking_id ELSE NULL END) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_payments_id_booking (id, booking_id),
    UNIQUE KEY uq_payments_id_provider (id, provider),
    UNIQUE KEY uq_payments_provider_reference (provider, provider_reference),
    UNIQUE KEY uq_payments_provider_key (provider, provider_key),
    UNIQUE KEY uq_payments_pending_booking (pending_booking_guard),
    KEY ix_payments_booking_created (booking_id, created_at, id),
    KEY ix_payments_status_updated (status, updated_at, id),
    KEY ix_payments_reconciliation (reconciliation_status, updated_at, id),
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT ck_payments_amount CHECK (amount_minor >= 0),
    CONSTRAINT ck_payments_currency CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c')),
    CONSTRAINT ck_payments_status CHECK (status IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
    CONSTRAINT ck_payments_reconciliation CHECK (reconciliation_status IN ('NONE','REQUIRED','RESOLVED')),
    CONSTRAINT ck_payments_reason CHECK (reconciliation_status <> 'REQUIRED' OR reconciliation_reason IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- FK vòng được bổ sung sau khi cả hai bảng đã tồn tại. Không vô hiệu hóa FOREIGN_KEY_CHECKS.
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_confirmed_payment
    FOREIGN KEY (confirmed_payment_id, id) REFERENCES payments(id, booking_id);

CREATE TABLE tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_item_id BIGINT UNSIGNED NOT NULL,
    session_seat_id BIGINT UNSIGNED NOT NULL,
    qr_token_hash BINARY(32) NOT NULL,
    qr_token_ciphertext VARBINARY(1024) NOT NULL,
    qr_key_version VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'VALID',
    checked_in_at DATETIME(6) NULL,
    checked_in_by BIGINT UNSIGNED NULL,
    active_seat_guard BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('VALID','USED') THEN session_seat_id ELSE NULL END) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_tickets_item (booking_item_id),
    UNIQUE KEY uq_tickets_qr_hash (qr_token_hash), UNIQUE KEY uq_tickets_active_seat (active_seat_guard),
    KEY ix_tickets_item_scope (booking_item_id, session_seat_id),
    KEY ix_tickets_session_seat (session_seat_id), KEY ix_tickets_status (status, id),
    KEY ix_tickets_checkin_actor (checked_in_by, checked_in_at),
    CONSTRAINT fk_tickets_item FOREIGN KEY (booking_item_id, session_seat_id) REFERENCES booking_items(id, session_seat_id),
    CONSTRAINT fk_tickets_seat FOREIGN KEY (session_seat_id) REFERENCES session_seats(id),
    CONSTRAINT fk_tickets_checkin_actor FOREIGN KEY (checked_in_by) REFERENCES users(id),
    CONSTRAINT ck_tickets_status CHECK (status IN ('VALID','USED','CANCELLED','REFUNDED','EXPIRED')),
    CONSTRAINT ck_tickets_checkin CHECK (
        (status = 'USED' AND checked_in_at IS NOT NULL AND checked_in_by IS NOT NULL)
        OR (status <> 'USED' AND checked_in_at IS NULL AND checked_in_by IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NULL,
    approved_by BIGINT UNSIGNED NULL,
    type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'REQUESTED',
    amount_minor BIGINT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    provider VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_reference VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
    full_refund_guard BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status <> 'REJECTED' THEN payment_id ELSE NULL END) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_refunds_provider_key (provider, provider_key),
    UNIQUE KEY uq_refunds_provider_reference (provider, provider_reference),
    UNIQUE KEY uq_refunds_full_payment (full_refund_guard),
    KEY ix_refunds_payment_status (payment_id, status, id),
    KEY ix_refunds_payment_provider (payment_id, provider),
    KEY ix_refunds_requested_by (requested_by), KEY ix_refunds_approved_by (approved_by),
    KEY ix_refunds_status_updated (status, updated_at, id),
    CONSTRAINT fk_refunds_payment_provider FOREIGN KEY (payment_id, provider) REFERENCES payments(id, provider),
    CONSTRAINT fk_refunds_requester FOREIGN KEY (requested_by) REFERENCES users(id),
    CONSTRAINT fk_refunds_approver FOREIGN KEY (approved_by) REFERENCES users(id),
    CONSTRAINT ck_refunds_amount CHECK (amount_minor > 0),
    CONSTRAINT ck_refunds_type CHECK (type IN ('CUSTOMER','COMPENSATION')),
    CONSTRAINT ck_refunds_status CHECK (status IN ('REQUESTED','REJECTED','PROCESSING','SUCCESS','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE auth_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    family_id BINARY(16) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    device_label VARCHAR(160) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_auth_sessions_family (family_id),
    KEY ix_auth_sessions_user_revoked (user_id, revoked_at, id), KEY ix_auth_sessions_expiry (expires_at, id),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ck_auth_sessions_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id BIGINT UNSIGNED NOT NULL,
    parent_id BIGINT UNSIGNED NULL,
    token_hash BINARY(32) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_refresh_hash (token_hash), UNIQUE KEY uq_refresh_parent (parent_id),
    UNIQUE KEY uq_refresh_id_session (id, session_id), KEY ix_refresh_session (session_id, id),
    KEY ix_refresh_parent_scope (parent_id, session_id), KEY ix_refresh_expiry (expires_at, id),
    CONSTRAINT fk_refresh_session FOREIGN KEY (session_id) REFERENCES auth_sessions(id),
    CONSTRAINT fk_refresh_parent_scope FOREIGN KEY (parent_id, session_id) REFERENCES refresh_tokens(id, session_id),
    CONSTRAINT ck_refresh_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE verification_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    purpose VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash BINARY(32) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_verification_hash (token_hash),
    KEY ix_verification_user_purpose (user_id, purpose, id), KEY ix_verification_expiry (expires_at, id),
    CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ck_verification_purpose CHECK (purpose IN ('EMAIL_VERIFY','PASSWORD_RESET')),
    CONSTRAINT ck_verification_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE idempotency_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_scope VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    operation VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    idempotency_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash BINARY(32) NOT NULL,
    resource_type VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NULL,
    resource_id BIGINT UNSIGNED NULL,
    response_code SMALLINT UNSIGNED NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_idempotency_scope (actor_scope, operation, idempotency_key),
    KEY ix_idempotency_expiry (expires_at, id),
    CONSTRAINT ck_idempotency_result CHECK (
        (resource_type IS NULL AND resource_id IS NULL AND response_code IS NULL)
        OR (resource_type IS NOT NULL AND resource_id IS NOT NULL AND response_code IS NOT NULL AND response_code BETWEEN 200 AND 299)
    ),
    CONSTRAINT ck_idempotency_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE payment_webhooks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_event_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payment_id BIGINT UNSIGNED NULL,
    payload_hash BINARY(32) NOT NULL,
    normalized_payload JSON NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'RECEIVED',
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at DATETIME(6) NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_webhooks_provider_event (provider, provider_event_id),
    KEY ix_webhooks_payment_provider (payment_id, provider), KEY ix_webhooks_status_received (status, received_at, id),
    CONSTRAINT fk_webhooks_payment_provider FOREIGN KEY (payment_id, provider) REFERENCES payments(id, provider),
    CONSTRAINT ck_webhooks_status CHECK (status IN ('RECEIVED','PROCESSED','QUARANTINED')),
    CONSTRAINT ck_webhooks_payload CHECK (JSON_TYPE(normalized_payload) = 'OBJECT'),
    CONSTRAINT ck_webhooks_processed CHECK (
        (status = 'PROCESSED' AND processed_at IS NOT NULL)
        OR (status IN ('RECEIVED','QUARANTINED') AND processed_at IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE outbox_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    type VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    aggregate_type VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    aggregate_id BIGINT UNSIGNED NOT NULL,
    aggregate_version INT UNSIGNED NOT NULL,
    dedupe_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_minimal JSON NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    available_at DATETIME(6) NOT NULL,
    lease_until DATETIME(6) NULL,
    lease_token BINARY(16) NULL,
    last_error_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_outbox_dedupe (dedupe_key),
    KEY ix_outbox_available (status, available_at, id), KEY ix_outbox_lease (status, lease_until, id),
    CONSTRAINT ck_outbox_status CHECK (status IN ('PENDING','PROCESSING','DONE','FAILED')),
    CONSTRAINT ck_outbox_payload CHECK (JSON_TYPE(payload_minimal) = 'OBJECT'),
    CONSTRAINT ck_outbox_lease CHECK (
        (status = 'PROCESSING' AND lease_until IS NOT NULL AND lease_token IS NOT NULL)
        OR (status <> 'PROCESSING' AND lease_until IS NULL AND lease_token IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_type VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource_id BIGINT UNSIGNED NULL,
    request_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(500) NULL,
    before_redacted JSON NULL,
    after_redacted JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), KEY ix_audit_resource (resource_type, resource_id, created_at),
    KEY ix_audit_actor (actor_id, created_at), KEY ix_audit_request (request_id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
    CONSTRAINT ck_audit_actor_type CHECK (actor_type IN ('USER','SYSTEM','ANONYMOUS')),
    CONSTRAINT ck_audit_actor CHECK (
        (actor_type = 'USER' AND actor_id IS NOT NULL)
        OR (actor_type IN ('SYSTEM','ANONYMOUS') AND actor_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
