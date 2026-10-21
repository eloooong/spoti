const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { sealCookie, openCookie } = require("../sealed-cookie");

process.env.VERCEL = "1";
process.env.STATE_SECRET = "test-only-serverless-secret-not-a-live-key";
process.env.SPOTIFY_CLIENT_ID = "test-client";
process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
process.env.SPOTIFY_REDIRECT_URI = "https://example.test/callback";
delete process.env.DATABASE_URL;

const axios = require("axios");
let tokenExchanges = 0;
axios.post = async (url, params) => {
  assert.equal(url, "https://accounts.spotify.com/api/token");
  tokenExchanges += 1;
  return { data: params.get("grant_type") === "refresh_token"
    ? { access_token: "refreshed-token", refresh_token: "rotated-refresh", expires_in: 3600 }
    : { access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 } };
};
axios.get = async () => ({ data: { items: [] } });
const cookieHeader = cookies => cookies.map(cookie => cookie.split(";")[0]).join("; ");

test("Vercel login, callback, session reads and refresh work across cold starts", async () => {
  const servers = [];
  async function coldStart() {
    for (const file of ["../../api/index", "../server"]) delete require.cache[require.resolve(file)];
    const handler = require("../../api/index");
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }
  try {
    const first = await coldStart();
    const loggedOut = await fetch(`${first}/api/status`);
    assert.deepEqual(await loggedOut.json(), { logged_in: false });
    const login = await fetch(`${first}/login`, { redirect: "manual", headers: { "x-forwarded-proto": "https" } });
    assert.equal(login.status, 302);
    const location = new URL(login.headers.get("location"));
    assert.equal(location.hostname, "accounts.spotify.com");
    const state = location.searchParams.get("state");
    const loginCookies = login.headers.getSetCookie();
    const sid = loginCookies.find(cookie => cookie.startsWith("sid=")).split(";")[0];
    assert.ok(loginCookies.some(cookie => cookie.startsWith("spoti_login=") && /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Lax/.test(cookie)));

    const second = await coldStart();
    const invalid = await fetch(`${second}/callback?code=fake&state=wrong`, { redirect: "manual", headers: { cookie: cookieHeader(loginCookies) } });
    assert.equal(invalid.status, 403);
    assert.equal(tokenExchanges, 0);
    const callback = await fetch(`${second}/callback?code=fake&state=${state}`, { redirect: "manual", headers: { cookie: cookieHeader(loginCookies), "x-forwarded-proto": "https" } });
    assert.equal(callback.status, 302);
    const sessionCookie = callback.headers.getSetCookie().find(cookie => cookie.startsWith("spoti_session="));
    assert.ok(/HttpOnly/.test(sessionCookie) && /Secure/.test(sessionCookie) && /SameSite=Lax/.test(sessionCookie));
    assert.equal(sessionCookie.includes("test-access"), false);
    const authenticatedCookies = `${sid}; ${sessionCookie.split(";")[0]}`;

    const third = await coldStart();
    const status = await fetch(`${third}/api/status`, { headers: { cookie: authenticatedCookies } });
    assert.deepEqual(await status.json(), { logged_in: true });
    const wrongVisitor = await fetch(`${third}/api/status`, { headers: { cookie: `sid=other-visitor; ${sessionCookie.split(";")[0]}` } });
    assert.deepEqual(await wrongVisitor.json(), { logged_in: false });

    const encryptedExpiredSession = sealCookie({ sessionId: sid.slice(4), tokens: { access_token: "expired", refresh_token: "test-refresh", expires_at: Date.now() - 1000 } }, process.env.STATE_SECRET, "session", 60_000);
    const refreshed = await fetch(`${third}/api/top-artists`, { headers: { cookie: `${sid}; spoti_session=${encryptedExpiredSession}` } });
    assert.equal(refreshed.status, 200);
    const refreshedCookie = refreshed.headers.getSetCookie().find(cookie => cookie.startsWith("spoti_session=")).split(";")[0].slice("spoti_session=".length);
    assert.equal(openCookie(refreshedCookie, process.env.STATE_SECRET, "session").tokens.refresh_token, "rotated-refresh");

    const logout = await fetch(`${third}/logout`, { redirect: "manual", headers: { cookie: authenticatedCookies } });
    assert.equal(logout.status, 302);
    for (const name of ["sid", "spoti_session", "spoti_login"]) assert.ok(logout.headers.getSetCookie().some(cookie => cookie.startsWith(`${name}=;`)));
  } finally {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});
