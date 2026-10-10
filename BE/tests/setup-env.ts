// HTTP/unit tests must never load a developer database connection or email credentials.
// Integration tests require explicit DB_* pointing to an isolated test database.
if (process.env.AUTH_TEST_DB !== '1') {
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '5432';
  process.env.DB_USER = 'unused_test_user';
  process.env.DB_PASSWORD = 'unused-test-password';
  process.env.DB_NAME = 'unused_test_database';
}
