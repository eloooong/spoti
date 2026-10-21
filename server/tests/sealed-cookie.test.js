const assert = require("node:assert/strict");
const test = require("node:test");
const { sealCookie, openCookie } = require("../sealed-cookie");
const secret = "test-only-secret-not-a-production-credential";

test("encrypted cookies round-trip without exposing token text and use random nonces", () => {
  const value = { access_token: "example-private-token", sessionId: "visitor-a" };
  const first = sealCookie(value, secret, "session", 60_000);
  assert.deepEqual(openCookie(first, secret, "session"), value);
  assert.equal(first.includes(value.access_token), false);
  assert.notEqual(first, sealCookie(value, secret, "session", 60_000));
});

test("tampering, the wrong key and the wrong cookie purpose fail closed", () => {
  const cookie = sealCookie({ sessionId: "visitor-a" }, secret, "session", 60_000);
  const tampered = cookie.slice(0, 30) + (cookie[30] === "A" ? "B" : "A") + cookie.slice(31);
  assert.equal(openCookie(tampered, secret, "session"), null);
  assert.equal(openCookie(cookie, "a-different-secret", "session"), null);
  assert.equal(openCookie(cookie, secret, "login"), null);
});

test("expired, missing and malformed cookies cannot create a session", () => {
  assert.equal(openCookie(sealCookie({}, secret, "login", -1), secret, "login"), null);
  for (const value of [undefined, null, "", "broken"]) assert.equal(openCookie(value, secret, "session"), null);
  assert.equal(openCookie("broken", undefined, "session"), null);
});

test("serverless sessions require an explicit encryption secret", () => {
  assert.throws(() => sealCookie({}, "", "session", 60_000), /STATE_SECRET/);
});
