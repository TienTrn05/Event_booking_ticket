-- Event Ticketing Platform — DDL hiện hành theo ADR-014, 2026-09-13.
-- MySQL 8.0.16+ / 8.4, InnoDB; kiểm chứng thực tế ghi trong database/README.md.
-- Chỉ nạp vào database RỖNG được chọn chủ động; không DROP, USE hoặc tắt FK checks.
-- Đây là thiết kế để triển khai migration sau, không phải upgrade script cho DB cũ.
-- CHECK/UQ/FK bảo vệ cấu trúc; quyền, geometry, calendar cutoff, quota và transition cần service/transaction.
-- Không có password nội bộ. Google/phone/company email dùng external_identities và otp_challenges.
-- ticket_code là một credential dùng chung cho mã nhập tay và QR; không lưu dữ liệu thẻ ngân hàng/giấy tờ.


USE event_ticketing;
SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_cs;
SET time_zone = '+00:00';

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    display_name VARCHAR(120) NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE', 
    auth_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_users_status_created (status, created_at, id),
    CONSTRAINT ck_users_name CHECK (CHAR_LENGTH(TRIM(display_name)) > 0),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE','BLOCKED'))
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

CREATE TABLE external_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    email_canonical VARCHAR(254) NULL,
    email_verified_at DATETIME(6) NULL,
    hosted_domain VARCHAR(253) CHARACTER SET ascii COLLATE ascii_bin NULL,
    verified_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_identity_provider_subject (provider, subject),
    UNIQUE KEY uq_identity_owner (id, user_id),
    UNIQUE KEY uq_identity_company_owner (id, user_id, provider),
    KEY ix_identity_user (user_id, id),
    CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ck_identity_provider CHECK (provider IN ('GOOGLE','PHONE','COMPANY_EMAIL')),
    CONSTRAINT ck_identity_subject CHECK (CHAR_LENGTH(subject) > 0),
    CONSTRAINT ck_identity_email CHECK (
        (provider = 'PHONE' AND email_canonical IS NULL AND email_verified_at IS NULL AND hosted_domain IS NULL)
        OR (provider = 'COMPANY_EMAIL' AND email_canonical IS NOT NULL AND email_verified_at IS NOT NULL
            AND hosted_domain IS NULL AND subject = email_canonical)
        OR (provider = 'GOOGLE' AND (email_verified_at IS NULL OR email_canonical IS NOT NULL))
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE otp_challenges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    challenge_id BINARY(16) NOT NULL,
    channel VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    purpose VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_canonical VARCHAR(254) NOT NULL,
    target_hash BINARY(32) NOT NULL,
    code_mac BINARY(32) NOT NULL,
    mac_key_version VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    browser_binding_hash BINARY(32) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    used_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_otp_public_challenge (challenge_id),
    KEY ix_otp_target_purpose (target_hash, channel, purpose, created_at, id),
    KEY ix_otp_user (user_id), KEY ix_otp_expiry (expires_at, id),
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ck_otp_channel CHECK (channel IN ('PHONE','COMPANY_EMAIL')),
    CONSTRAINT ck_otp_purpose CHECK (purpose IN ('LOGIN','LINK_IDENTITY','REAUTHENTICATE')),
    CONSTRAINT ck_otp_bound_user CHECK (purpose = 'LOGIN' OR user_id IS NOT NULL),
    CONSTRAINT ck_otp_attempts CHECK (max_attempts > 0 AND attempts <= max_attempts),
    CONSTRAINT ck_otp_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_otp_used CHECK (used_at IS NULL OR (used_at >= created_at AND used_at < expires_at)),
    CONSTRAINT ck_otp_target CHECK (CHAR_LENGTH(TRIM(target_canonical)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE organizations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    company_domain VARCHAR(253) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    applicant_user_id BIGINT UNSIGNED NOT NULL,
    company_identity_id BIGINT UNSIGNED NOT NULL,
    company_identity_provider VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING_REVIEW',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(6) NULL,
    review_reason VARCHAR(2000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_org_applicant (applicant_user_id, id),
    KEY ix_org_identity_scope (company_identity_id, applicant_user_id, company_identity_provider),
    KEY ix_org_reviewer (reviewed_by),
    KEY ix_org_review_queue (status, created_at, id),
    CONSTRAINT fk_org_applicant FOREIGN KEY (applicant_user_id) REFERENCES users(id),
    CONSTRAINT fk_org_company_identity FOREIGN KEY (company_identity_id, applicant_user_id, company_identity_provider)
        REFERENCES external_identities(id, user_id, provider),
    CONSTRAINT fk_org_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
    CONSTRAINT ck_org_company_provider CHECK (company_identity_provider IN ('GOOGLE','COMPANY_EMAIL')),
    CONSTRAINT ck_org_status CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED','SUSPENDED')),
    CONSTRAINT ck_org_review CHECK (
        (status = 'PENDING_REVIEW' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (status IN ('APPROVED','REJECTED','SUSPENDED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT ck_org_reason CHECK (status NOT IN ('REJECTED','SUSPENDED') OR
        (review_reason IS NOT NULL AND CHAR_LENGTH(TRIM(review_reason)) > 0)),
    CONSTRAINT ck_org_fields CHECK (CHAR_LENGTH(TRIM(name)) > 0 AND CHAR_LENGTH(company_domain) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE organization_memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organization_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    company_identity_id BIGINT UNSIGNED NOT NULL,
    company_identity_provider VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    approved_by BIGINT UNSIGNED NOT NULL,
    approved_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_membership_org_user (organization_id, user_id),
    KEY ix_membership_user (user_id, status, organization_id),
    KEY ix_membership_identity (company_identity_id, user_id, company_identity_provider),
    KEY ix_membership_approver (approved_by),
    CONSTRAINT fk_membership_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_membership_company FOREIGN KEY (company_identity_id, user_id, company_identity_provider)
        REFERENCES external_identities(id, user_id, provider),
    CONSTRAINT fk_membership_approver FOREIGN KEY (approved_by) REFERENCES users(id),
    CONSTRAINT ck_membership_provider CHECK (company_identity_provider IN ('GOOGLE','COMPANY_EMAIL')),
    CONSTRAINT ck_membership_status CHECK (status IN ('ACTIVE','REVOKED'))
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
    organization_id BIGINT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'DRAFT',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    approved_review_id BIGINT UNSIGNED NULL,
    approved_event_version INT UNSIGNED NULL,
    approval_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_events_slug (slug),
    UNIQUE KEY uq_events_org_scope (id, organization_id),
    KEY ix_events_org_created (organization_id, created_at, id), KEY ix_events_creator (created_by),
    KEY ix_events_category (category_id), KEY ix_events_status_category (status, category_id, id),
    KEY ix_events_status_title (status, title, id),
    KEY ix_events_approval_scope (approved_review_id, id, approved_event_version, approval_status),
    CONSTRAINT fk_events_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_events_creator FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES event_categories(id),
    CONSTRAINT ck_events_status CHECK (status IN ('DRAFT','PENDING_REVIEW','REJECTED','PUBLISHED','BLOCKED','CANCELLED','ARCHIVED')),
    CONSTRAINT ck_events_approval_fields CHECK (
        (approved_review_id IS NULL AND approved_event_version IS NULL AND approval_status IS NULL)
        OR (approved_review_id IS NOT NULL AND approved_event_version IS NOT NULL
            AND approval_status IS NOT NULL AND approval_status = 'APPROVED')
    ),
    CONSTRAINT ck_events_public_approval CHECK (
        (status IN ('PUBLISHED','BLOCKED','ARCHIVED') AND approved_review_id IS NOT NULL)
        OR (status IN ('DRAFT','PENDING_REVIEW','REJECTED') AND approved_review_id IS NULL)
        OR status = 'CANCELLED'
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE venues (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    catalog_code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(180) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(120) NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    canvas_width DECIMAL(10,3) NOT NULL,
    canvas_height DECIMAL(10,3) NOT NULL,
    bounds_json JSON NOT NULL,
    max_capacity INT UNSIGNED NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_venue_catalog_code (catalog_code), KEY ix_venues_city (city, id),
    CONSTRAINT ck_venue_dimensions CHECK (canvas_width > 0 AND canvas_height > 0 AND max_capacity > 0),
    CONSTRAINT ck_venue_bounds CHECK (JSON_TYPE(bounds_json) = 'OBJECT'),
    CONSTRAINT ck_venues_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE seat_layouts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organization_id BIGINT UNSIGNED NOT NULL,
    event_id BIGINT UNSIGNED NOT NULL,
    venue_id BIGINT UNSIGNED NOT NULL,
    venue_version INT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'DRAFT',
    geometry_json JSON NOT NULL,
    bounds_snapshot JSON NOT NULL,
    canvas_width DECIMAL(10,3) NOT NULL,
    canvas_height DECIMAL(10,3) NOT NULL,
    capacity_snapshot INT UNSIGNED NOT NULL,
    frozen_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_layout_event_venue (id, event_id, venue_id),
    KEY ix_layout_org (organization_id, id), KEY ix_layout_event_org (event_id, organization_id),
    KEY ix_layout_venue (venue_id, id),
    CONSTRAINT fk_layout_event_org FOREIGN KEY (event_id, organization_id) REFERENCES events(id, organization_id),
    CONSTRAINT fk_layout_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_layout_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT ck_layout_geometry CHECK (JSON_TYPE(geometry_json) = 'OBJECT' AND JSON_TYPE(bounds_snapshot) = 'OBJECT'),
    CONSTRAINT ck_layout_dimensions CHECK (canvas_width > 0 AND canvas_height > 0 AND capacity_snapshot > 0),
    CONSTRAINT ck_layout_frozen CHECK (
        (status = 'DRAFT' AND frozen_at IS NULL) OR (status = 'FROZEN' AND frozen_at IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE layout_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_section_layout_code (layout_id, code),
    UNIQUE KEY uq_section_scope (id, layout_id),
    CONSTRAINT fk_section_layout FOREIGN KEY (layout_id) REFERENCES seat_layouts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE layout_rows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    section_id BIGINT UNSIGNED NOT NULL,
    layout_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_row_section_code (section_id, code), UNIQUE KEY uq_row_scope (id, layout_id),
    KEY ix_row_section_scope (section_id, layout_id), KEY ix_row_layout (layout_id),
    CONSTRAINT fk_row_section FOREIGN KEY (section_id, layout_id) REFERENCES layout_sections(id, layout_id),
    CONSTRAINT fk_row_layout FOREIGN KEY (layout_id) REFERENCES seat_layouts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE seats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    row_id BIGINT UNSIGNED NOT NULL,
    layout_id BIGINT UNSIGNED NOT NULL,
    number VARCHAR(40) NOT NULL,
    map_x DECIMAL(10,3) NOT NULL,
    map_y DECIMAL(10,3) NOT NULL,
    width DECIMAL(10,3) NOT NULL,
    height DECIMAL(10,3) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_seats_row_number (row_id, number), UNIQUE KEY uq_seat_layout (id, layout_id),
    KEY ix_seat_row_scope (row_id, layout_id), KEY ix_seat_layout (layout_id, id),
    CONSTRAINT fk_seat_row FOREIGN KEY (row_id, layout_id) REFERENCES layout_rows(id, layout_id),
    CONSTRAINT fk_seat_layout FOREIGN KEY (layout_id) REFERENCES seat_layouts(id),
    CONSTRAINT ck_seat_geometry CHECK (map_x >= 0 AND map_y >= 0 AND width > 0 AND height > 0),
    CONSTRAINT ck_seat_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE event_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id BIGINT UNSIGNED NOT NULL,
    venue_id BIGINT UNSIGNED NOT NULL,
    layout_id BIGINT UNSIGNED NOT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6) NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sale_opens_at DATETIME(6) NOT NULL,
    sale_closes_at DATETIME(6) NOT NULL,
    counter_opens_at DATETIME(6) NOT NULL,
    counter_closes_at DATETIME(6) NOT NULL,
    admission_opens_at DATETIME(6) NOT NULL,
    admission_closes_at DATETIME(6) NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'SCHEDULED',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_session_event (id, event_id), UNIQUE KEY uq_session_layout (id, layout_id),
    KEY ix_session_layout_scope (layout_id, event_id, venue_id),
    KEY ix_sessions_event_status_start (event_id, status, starts_at),
    KEY ix_sessions_venue_time (venue_id, starts_at, ends_at),
    CONSTRAINT fk_sessions_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_sessions_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT fk_session_layout FOREIGN KEY (layout_id, event_id, venue_id) REFERENCES seat_layouts(id, event_id, venue_id),
    CONSTRAINT ck_session_windows CHECK (counter_closes_at > counter_opens_at AND admission_closes_at > admission_opens_at
        AND counter_closes_at <= admission_closes_at AND admission_closes_at <= ends_at),
    CONSTRAINT ck_sessions_time CHECK (ends_at > starts_at AND sale_closes_at > sale_opens_at),
    CONSTRAINT ck_sessions_status CHECK (status IN ('SCHEDULED','CANCELLED','COMPLETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE ticket_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_ticket_type_code (session_id, code), UNIQUE KEY uq_ticket_type_scope (id, session_id),
    CONSTRAINT fk_ticket_type_session FOREIGN KEY (session_id) REFERENCES event_sessions(id),
    CONSTRAINT ck_ticket_type_labels CHECK (CHAR_LENGTH(TRIM(code)) > 0 AND CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE reservation_quotas (
    customer_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (customer_id, session_id), KEY ix_quota_session (session_id, customer_id),
    CONSTRAINT fk_quota_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_quota_session FOREIGN KEY (session_id) REFERENCES event_sessions(id)
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
    event_id BIGINT UNSIGNED NOT NULL,
    hold_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'AWAITING_PAYMENT',
    total_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    confirmed_at DATETIME(6) NULL,
    confirmed_payment_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_booking_event (id, event_id),
    UNIQUE KEY uq_booking_hold_session (id, hold_id, session_id),
    KEY ix_booking_event (event_id), KEY ix_booking_session_event (session_id, event_id), UNIQUE KEY uq_bookings_hold (hold_id),
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
    CONSTRAINT fk_booking_session_event FOREIGN KEY (session_id, event_id) REFERENCES event_sessions(id, event_id),
    CONSTRAINT fk_booking_event FOREIGN KEY (event_id) REFERENCES events(id),
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
    layout_id BIGINT UNSIGNED NOT NULL,
    ticket_type_id BIGINT UNSIGNED NOT NULL,
    price_minor BIGINT NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'AVAILABLE',
    hold_id BIGINT UNSIGNED NULL,
    current_booking_id BIGINT UNSIGNED NULL,
    hold_expires_at DATETIME(6) NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_session_seats_position (session_id, seat_id),
    UNIQUE KEY uq_session_seats_id_session (id, session_id),
    KEY ix_ss_session_layout (session_id, layout_id), KEY ix_ss_seat_layout (seat_id, layout_id),
    KEY ix_ss_type_scope (ticket_type_id, session_id), KEY ix_ss_booking_hold (current_booking_id, hold_id, session_id),
    KEY ix_session_seats_seat (seat_id),
    KEY ix_session_seats_price (session_id, status, price_minor),
    KEY ix_session_seats_expiry (status, hold_expires_at),
    KEY ix_session_seats_hold (hold_id, session_id),
    KEY ix_session_seats_booking (current_booking_id, session_id),
    CONSTRAINT fk_session_seats_session FOREIGN KEY (session_id) REFERENCES event_sessions(id),
    CONSTRAINT fk_session_seats_seat FOREIGN KEY (seat_id) REFERENCES seats(id),
    CONSTRAINT fk_session_seats_hold FOREIGN KEY (hold_id, session_id) REFERENCES seat_holds(id, session_id),
    CONSTRAINT fk_session_seats_booking FOREIGN KEY (current_booking_id, session_id) REFERENCES bookings(id, session_id),
    CONSTRAINT fk_ss_session_layout FOREIGN KEY (session_id, layout_id) REFERENCES event_sessions(id, layout_id),
    CONSTRAINT fk_ss_seat_layout FOREIGN KEY (seat_id, layout_id) REFERENCES seats(id, layout_id),
    CONSTRAINT fk_ss_type FOREIGN KEY (ticket_type_id, session_id) REFERENCES ticket_types(id, session_id),
    CONSTRAINT fk_ss_booking_hold FOREIGN KEY (current_booking_id, hold_id, session_id) REFERENCES bookings(id, hold_id, session_id),
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
    attendee_name_snapshot VARCHAR(200) NOT NULL,
    ticket_type_code_snapshot VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ticket_type_name_snapshot VARCHAR(120) NOT NULL,
    seat_label_snapshot VARCHAR(160) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_booking_items_seat (booking_id, session_seat_id),
    UNIQUE KEY uq_booking_items_ticket_scope (id, session_seat_id),
    KEY ix_booking_items_booking_scope (booking_id, session_id),
    KEY ix_booking_items_seat_scope (session_seat_id, session_id),
    CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id, session_id) REFERENCES bookings(id, session_id),
    CONSTRAINT fk_booking_items_seat FOREIGN KEY (session_seat_id, session_id) REFERENCES session_seats(id, session_id),
    CONSTRAINT ck_item_attendee CHECK (CHAR_LENGTH(TRIM(attendee_name_snapshot)) > 0),
    CONSTRAINT ck_item_type_snapshot CHECK (CHAR_LENGTH(TRIM(ticket_type_code_snapshot)) > 0 AND CHAR_LENGTH(TRIM(ticket_type_name_snapshot)) > 0),
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

CREATE TABLE tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_item_id BIGINT UNSIGNED NOT NULL,
    session_seat_id BIGINT UNSIGNED NOT NULL,
    ticket_code_hash BINARY(32) NOT NULL,
    ticket_code_ciphertext VARBINARY(1024) NOT NULL,
    ticket_key_version VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'VALID',
    admission_check_in_id BIGINT UNSIGNED NULL,
    admitted_at DATETIME(6) NULL,
    admitted_by BIGINT UNSIGNED NULL,
    active_seat_guard BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('VALID','USED') THEN session_seat_id ELSE NULL END) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_tickets_item (booking_item_id),
    UNIQUE KEY uq_tickets_code_hash (ticket_code_hash), UNIQUE KEY uq_tickets_active_seat (active_seat_guard),
    KEY ix_ticket_admission_checkin (admission_check_in_id, id),
    KEY ix_tickets_item_scope (booking_item_id, session_seat_id),
    KEY ix_tickets_session_seat (session_seat_id), KEY ix_tickets_status (status, id),
    KEY ix_tickets_admission_actor (admitted_by, admitted_at),
    CONSTRAINT fk_tickets_item FOREIGN KEY (booking_item_id, session_seat_id) REFERENCES booking_items(id, session_seat_id),
    CONSTRAINT fk_tickets_seat FOREIGN KEY (session_seat_id) REFERENCES session_seats(id),
    CONSTRAINT fk_tickets_admission_actor FOREIGN KEY (admitted_by) REFERENCES users(id),
    CONSTRAINT ck_tickets_status CHECK (status IN ('VALID','USED','CANCELLED','REFUNDED','EXPIRED')),
    CONSTRAINT ck_tickets_checkin CHECK (
        (status = 'USED' AND admission_check_in_id IS NOT NULL AND admitted_at IS NOT NULL AND admitted_by IS NOT NULL)
        OR (status <> 'USED' AND admission_check_in_id IS NULL AND admitted_at IS NULL AND admitted_by IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE check_ins (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT UNSIGNED NOT NULL,
    method VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    checked_in_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_checkin_ticket (ticket_id), UNIQUE KEY uq_checkin_scope (id, ticket_id),
    KEY ix_checkin_actor (actor_id, checked_in_at),
    CONSTRAINT fk_checkin_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    CONSTRAINT fk_checkin_actor FOREIGN KEY (actor_id) REFERENCES users(id),
    CONSTRAINT ck_checkin_method CHECK (method IN ('ONLINE','COUNTER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE support_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_id BIGINT UNSIGNED NOT NULL,
    event_id BIGINT UNSIGNED NOT NULL,
    booking_id BIGINT UNSIGNED NULL,
    target_user_id BIGINT UNSIGNED NULL,
    reason VARCHAR(2000) NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'OPEN',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    assigned_admin_id BIGINT UNSIGNED NULL,
    resolution VARCHAR(2000) NULL,
    resolved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), KEY ix_report_reporter (reporter_id, created_at, id),
    KEY ix_report_event (event_id, status, id), KEY ix_report_booking_scope (booking_id, event_id),
    KEY ix_report_target_user (target_user_id), KEY ix_report_admin (assigned_admin_id, status, id),
    KEY ix_report_queue (status, created_at, id),
    CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_report_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_report_booking FOREIGN KEY (booking_id, event_id) REFERENCES bookings(id, event_id),
    CONSTRAINT fk_report_target FOREIGN KEY (target_user_id) REFERENCES users(id),
    CONSTRAINT fk_report_admin FOREIGN KEY (assigned_admin_id) REFERENCES users(id),
    CONSTRAINT ck_report_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
    CONSTRAINT ck_report_status CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED')),
    CONSTRAINT ck_report_assigned CHECK (status = 'OPEN' OR assigned_admin_id IS NOT NULL),
    CONSTRAINT ck_report_resolved CHECK (
        (status = 'RESOLVED' AND resolved_at IS NOT NULL AND resolution IS NOT NULL AND CHAR_LENGTH(TRIM(resolution)) > 0)
        OR (status <> 'RESOLVED' AND resolved_at IS NULL AND resolution IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NULL,
    approved_by BIGINT UNSIGNED NULL,
    support_report_id BIGINT UNSIGNED NULL,
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
    KEY ix_refund_report (support_report_id),
    KEY ix_refunds_requested_by (requested_by), KEY ix_refunds_approved_by (approved_by),
    KEY ix_refunds_status_updated (status, updated_at, id),
    CONSTRAINT fk_refunds_payment_provider FOREIGN KEY (payment_id, provider) REFERENCES payments(id, provider),
    CONSTRAINT fk_refunds_requester FOREIGN KEY (requested_by) REFERENCES users(id),
    CONSTRAINT fk_refunds_approver FOREIGN KEY (approved_by) REFERENCES users(id),
    CONSTRAINT fk_refund_report FOREIGN KEY (support_report_id) REFERENCES support_reports(id),
    CONSTRAINT ck_refunds_amount CHECK (amount_minor > 0),
    CONSTRAINT ck_refunds_type CHECK (type IN ('CUSTOMER','COMPENSATION')),
    CONSTRAINT ck_refunds_status CHECK (status IN ('REQUESTED','REJECTED','PROCESSING','SUCCESS','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE auth_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    identity_id BIGINT UNSIGNED NOT NULL,
    authenticated_at DATETIME(6) NOT NULL,
    family_id BINARY(16) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    device_label VARCHAR(160) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_auth_sessions_family (family_id),
    KEY ix_auth_sessions_user_revoked (user_id, revoked_at, id), KEY ix_auth_sessions_expiry (expires_at, id),
    KEY ix_auth_identity_owner (identity_id, user_id),
    CONSTRAINT fk_auth_identity FOREIGN KEY (identity_id, user_id) REFERENCES external_identities(id, user_id),
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

CREATE TABLE event_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id BIGINT UNSIGNED NOT NULL,
    event_version INT UNSIGNED NOT NULL,
    submitted_by BIGINT UNSIGNED NOT NULL,
    submitted_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    earliest_session_starts_at DATETIME(6) NOT NULL,
    submission_cutoff_at DATETIME(6) NOT NULL,
    calendar_timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_json JSON NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    decided_by BIGINT UNSIGNED NULL,
    decided_at DATETIME(6) NULL,
    pending_event_guard BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status='PENDING' THEN event_id ELSE NULL END) STORED,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_review_version (event_id, event_version),
    UNIQUE KEY uq_review_pending (pending_event_guard),
    UNIQUE KEY uq_review_approval_scope (id, event_id, event_version, status),
    KEY ix_review_submitter (submitted_by), KEY ix_review_decider (decided_by),
    KEY ix_review_queue (status, expires_at, id),
    CONSTRAINT fk_review_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT fk_review_submitter FOREIGN KEY (submitted_by) REFERENCES users(id),
    CONSTRAINT fk_review_decider FOREIGN KEY (decided_by) REFERENCES users(id),
    CONSTRAINT ck_review_snapshot CHECK (JSON_TYPE(snapshot_json)='OBJECT'),
    CONSTRAINT ck_review_submission CHECK (submitted_at <= submission_cutoff_at AND submission_cutoff_at < earliest_session_starts_at),
    CONSTRAINT ck_review_ttl CHECK (expires_at = DATE_ADD(submitted_at, INTERVAL 15 DAY)),
    CONSTRAINT ck_review_status CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','WITHDRAWN')),
    CONSTRAINT ck_review_decision CHECK (
        (status='PENDING' AND decided_at IS NULL AND decided_by IS NULL)
        OR (status IN ('APPROVED','REJECTED','WITHDRAWN') AND decided_at IS NOT NULL AND decided_by IS NOT NULL
            AND decided_at >= submitted_at AND decided_at < expires_at)
        OR (status='EXPIRED' AND decided_at IS NOT NULL AND decided_by IS NULL AND decided_at >= expires_at)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE reason_notices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    review_id BIGINT UNSIGNED NOT NULL,
    reason_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reason_text VARCHAR(4000) NULL,
    guidance VARCHAR(2000) NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'DRAFT',
    version INT UNSIGNED NOT NULL DEFAULT 0,
    authored_by BIGINT UNSIGNED NULL,
    sent_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_notice_review (review_id), UNIQUE KEY uq_notice_scope (id, review_id),
    KEY ix_notice_author (authored_by), KEY ix_notice_work (status, created_at, id),
    CONSTRAINT fk_notice_review FOREIGN KEY (review_id) REFERENCES event_reviews(id),
    CONSTRAINT fk_notice_author FOREIGN KEY (authored_by) REFERENCES users(id),
    CONSTRAINT ck_notice_status CHECK (status IN ('DRAFT','SENT')),
    CONSTRAINT ck_notice_sent CHECK (
        (status='DRAFT' AND sent_at IS NULL)
        OR (status='SENT' AND sent_at IS NOT NULL AND authored_by IS NOT NULL
            AND reason_code IS NOT NULL AND CHAR_LENGTH(TRIM(reason_code))>0
            AND reason_text IS NOT NULL AND CHAR_LENGTH(TRIM(reason_text))>0)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    recipient_user_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    review_id BIGINT UNSIGNED NOT NULL,
    reason_notice_id BIGINT UNSIGNED NULL,
    payload_redacted JSON NOT NULL,
    read_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id), UNIQUE KEY uq_notification_dedupe (recipient_user_id, type, review_id),
    KEY ix_notification_inbox (recipient_user_id, created_at, id), KEY ix_notification_review (review_id),
    KEY ix_notification_notice (reason_notice_id, review_id),
    CONSTRAINT fk_notification_user FOREIGN KEY (recipient_user_id) REFERENCES users(id),
    CONSTRAINT fk_notification_review FOREIGN KEY (review_id) REFERENCES event_reviews(id),
    CONSTRAINT fk_notification_notice FOREIGN KEY (reason_notice_id, review_id) REFERENCES reason_notices(id, review_id),
    CONSTRAINT ck_notification_type CHECK (type IN ('REVIEW_APPROVED','REVIEW_REJECTED','REVIEW_EXPIRED','REASON_NOTICE')),
    CONSTRAINT ck_notification_notice CHECK ((type='REASON_NOTICE' AND reason_notice_id IS NOT NULL)
        OR (type<>'REASON_NOTICE' AND reason_notice_id IS NULL)),
    CONSTRAINT ck_notification_payload CHECK (JSON_TYPE(payload_redacted)='OBJECT')
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
    organization_id BIGINT UNSIGNED NULL,
    support_report_id BIGINT UNSIGNED NULL,
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
    KEY ix_audit_org (organization_id, created_at), KEY ix_audit_report (support_report_id, created_at),
    CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_audit_report FOREIGN KEY (support_report_id) REFERENCES support_reports(id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
    CONSTRAINT ck_audit_actor_type CHECK (actor_type IN ('USER','SYSTEM','ANONYMOUS')),
    CONSTRAINT ck_audit_actor CHECK (
        (actor_type = 'USER' AND actor_id IS NOT NULL)
        OR (actor_type IN ('SYSTEM','ANONYMOUS') AND actor_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Tham chiếu vòng thêm khi hai bảng đã tồn tại; không dùng FOREIGN_KEY_CHECKS=0.
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_confirmed_payment
    FOREIGN KEY (confirmed_payment_id, id) REFERENCES payments(id, booking_id);
ALTER TABLE tickets ADD CONSTRAINT fk_ticket_admission_checkin
    FOREIGN KEY (admission_check_in_id, id) REFERENCES check_ins(id, ticket_id);
ALTER TABLE events ADD CONSTRAINT fk_event_approved_review
    FOREIGN KEY (approved_review_id, id, approved_event_version, approval_status)
    REFERENCES event_reviews(id, event_id, event_version, status);
