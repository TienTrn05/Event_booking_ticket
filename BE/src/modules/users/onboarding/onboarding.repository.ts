import type { PoolClient } from 'pg';
import { AppError } from '../../../shared/errors/app-error.js';
import type { PreferencesInput, OnboardingInput } from './onboarding.schema.js';
export class OnboardingRepository {
  async state(db: PoolClient, userId: string) {
    return (
      await db.query<{
        registrationRole: 'CUSTOMER' | 'ORGANIZER' | null;
        completedAt: Date | null;
        favoriteCategories: string[];
        preferredCity: string | null;
      }>(
        `SELECT registration_role AS "registrationRole",onboarding_completed_at AS "completedAt",favorite_categories AS "favoriteCategories",preferred_city AS "preferredCity" FROM users WHERE id=$1`,
        [userId],
      )
    ).rows[0]!;
  }
  async roles(db: PoolClient, userId: string) {
    return (
      await db.query<{ code: string }>(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 ORDER BY r.code`,
        [userId],
      )
    ).rows.map((r) => r.code);
  }
  async options(db: PoolClient) {
    const categories = await db.query(
      `SELECT slug AS id,name FROM event_categories WHERE is_active ORDER BY id`,
    );
    const cities = await db.query(
      `SELECT city AS id,display_name AS name FROM city_profiles ORDER BY sort_order,city`,
    );
    const organizers = await db.query(
      `SELECT o.public_id AS id,o.name,o.avatar_url AS avatar FROM organizations o WHERE o.status='APPROVED' AND o.public_id IS NOT NULL ORDER BY o.name,o.id LIMIT 100`,
    );
    return { categories: categories.rows, cities: cities.rows, organizers: organizers.rows };
  }
  async validatePreferences(db: PoolClient, input: PreferencesInput) {
    const categories = await db.query(
      `SELECT slug FROM event_categories WHERE is_active AND slug=ANY($1::text[]) FOR SHARE`,
      [input.favoriteCategories],
    );
    if (categories.rowCount !== input.favoriteCategories.length)
      throw new AppError(422, 'UNKNOWN_CATEGORY', 'Danh mục sở thích không hợp lệ.');
    if (
      input.preferredCity &&
      !(
        await db.query('SELECT city FROM city_profiles WHERE city=$1 FOR SHARE', [
          input.preferredCity,
        ])
      ).rowCount
    )
      throw new AppError(422, 'UNKNOWN_CITY', 'Thành phố không có trong danh mục.');
  }
  async savePreferences(db: PoolClient, userId: string, input: PreferencesInput) {
    await db.query(`UPDATE users SET favorite_categories=$2,preferred_city=$3 WHERE id=$1`, [
      userId,
      input.favoriteCategories,
      input.preferredCity,
    ]);
  }
  async complete(db: PoolClient, userId: string, input: OnboardingInput) {
    const wanted = input.role === 'CUSTOMER' ? ['CUSTOMER'] : ['ORGANIZER'];
    const roles = await db.query<{ id: string }>(
      `SELECT id::text FROM roles WHERE code=ANY($1::text[])`,
      [wanted],
    );
    if (roles.rowCount !== wanted.length)
      throw new AppError(503, 'AUTH_UNAVAILABLE', 'Chưa cài đặt từ điển vai trò.');
    if (input.role === 'ORGANIZER') {
      if (
        (
          await db.query(
            `SELECT id FROM bookings WHERE customer_id=$1 AND status='AWAITING_PAYMENT' AND expires_at>clock_timestamp() UNION ALL SELECT id FROM seat_holds WHERE customer_id=$1 AND status='ACTIVE' AND expires_at>clock_timestamp() LIMIT 1`,
            [userId],
          )
        ).rowCount
      )
        throw new AppError(
          409,
          'ROLE_CHANGE_DURING_BOOKING',
          'Hoàn tất hoặc hủy lượt mua hiện tại trước khi chọn Organizer.',
        );
      await db.query(
        `DELETE FROM user_roles ur USING roles r WHERE ur.user_id=$1 AND ur.role_id=r.id AND r.code='CUSTOMER' AND ur.granted_by IS NULL`,
        [userId],
      );
    }
    for (const role of roles.rows)
      await db.query(
        'INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [userId, role.id],
      );
    await db.query(
      `UPDATE users SET display_name=$2,gender=$3,date_of_birth=$4,registration_role=$5,onboarding_completed_at=clock_timestamp(),favorite_categories=$6,preferred_city=$7 WHERE id=$1`,
      [
        userId,
        input.displayName,
        input.gender,
        input.dateOfBirth,
        input.role,
        input.favoriteCategories,
        input.preferredCity,
      ],
    );
  }
  async activateCustomer(db: PoolClient, userId: string) {
    if (!(await db.query("SELECT id FROM roles WHERE code='CUSTOMER'")).rowCount)
      throw new AppError(503, 'AUTH_UNAVAILABLE', 'Chưa cài đặt từ điển vai trò.');
    await db.query(
      `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='CUSTOMER' ON CONFLICT DO NOTHING`,
      [userId],
    );
  }
  async followedIds(db: PoolClient, userId: string) {
    return (
      await db.query<{ id: string }>(
        `SELECT o.public_id AS id FROM organization_follows f JOIN organizations o ON o.id=f.organization_id WHERE f.user_id=$1 ORDER BY f.organization_id`,
        [userId],
      )
    ).rows.map((r) => r.id);
  }
  async audit(db: PoolClient, userId: string, requestId: string, action: string) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id) VALUES('USER',$1,$3,'USER',$1,$2)`,
      [userId, requestId, action],
    );
  }
}
