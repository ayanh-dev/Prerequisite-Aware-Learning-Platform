import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password";

test("hashes passwords and verifies only the matching value", async () => {
  const hash = await hashPassword("test-only-password-123");

  assert.match(hash, /^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(await verifyPassword("test-only-password-123", hash), true);
  assert.equal(await verifyPassword("another-test-password", hash), false);
});

test("rejects absent and malformed password hashes", async () => {
  assert.equal(await verifyPassword("test-only-password-123", null), false);
  assert.equal(await verifyPassword("test-only-password-123", "not-a-scrypt-hash"), false);
});
