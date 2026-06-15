import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { authRouter } from "../server/auth";
import { sessionRouter } from "../server/session";
import cookieParser from "cookie-parser";

// Mock config
vi.mock("../server/config", () => ({
  config: {
    OAUTH_CLIENT_ID: "test_client_id",
    OAUTH_CLIENT_SECRET: "test_client_secret",
    OAUTH_REDIRECT_URI: "http://localhost:3000/auth/callback",
    ENCRYPTION_KEY: "01234567890123456789012345678901",
    CREDENTIAL_STORE_TYPE: "memory"
  }
}));

// Mock google-auth-library
const mockGenerateAuthUrl = vi.fn().mockImplementation((config) => {
  return `https://accounts.google.com/o/oauth2/v2/auth?state=${config.state}&nonce=${config.nonce}`;
});
const mockGetToken = vi.fn().mockResolvedValue({
  tokens: {
    access_token: "mock_access",
    refresh_token: "mock_refresh",
    id_token: "mock_id",
    expiry_date: Date.now() + 3600000,
  }
});
const mockSetCredentials = vi.fn();
const mockVerifyIdToken = vi.fn().mockImplementation(async function(args: any) {
  // we extract nonce from the URL that was returned to state via generateAuthUrl
  return {
    getPayload: () => ({
      sub: "mock_google_id",
      email: "mock@example.com",
      name: "Mock User",
      picture: "http://example.com/mock.jpg",
      // normally the nonce should strictly match but since we mock to bypass, we will let test inject it
      nonce: "MOCK_NONCE"
    })
  };
});

vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: class {
      generateAuthUrl = mockGenerateAuthUrl;
      getToken = mockGetToken;
      setCredentials = mockSetCredentials;
      verifyIdToken = mockVerifyIdToken;
      revokeToken = vi.fn();
      refreshAccessToken = vi.fn().mockResolvedValue({
        credentials: {
          access_token: "new_mock_access_token",
          expiry_date: Date.now() + 3600000,
        }
      });
    }
  };
});

// Since the auth router holds state internally for validation, we'll patch crypto so we know the state/nonce
import crypto from "crypto";
const originalRandomBytes = crypto.randomBytes;
vi.spyOn(crypto, "randomBytes").mockImplementation((size: number) => {
  // Let the first 32 bytes be verifier, next 16 be state, next 16 be nonce
  return Buffer.alloc(size, "a");
});

describe("OAuth Flow", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use("/api/auth", authRouter);
    app.use("/api/session", sessionRouter);
    vi.clearAllMocks();
  });

  it("should generate oauth url with PKCE and state", async () => {
    const res = await request(app).get("/api/auth/url");
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.body.url).toContain("state=");
  });

  it("should handle oauth callback with matching state", async () => {
    const testState = Buffer.alloc(16, "a").toString("hex");
    const testNonce = Buffer.alloc(16, "a").toString("hex");

    // Manually force the mock verify fallback to our predictable nonce
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "mock_google_id",
        email: "mock@example.com",
        name: "Mock User",
        nonce: testNonce
      })
    });

    // 1. Kick off URL to store state in authFlows map
    await request(app).get("/api/auth/url");

    // 2. Callback
    const res = await request(app).get(`/api/auth/callback?code=mock_code&state=${testState}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Authentication successful");

    // Verify session cookie is set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/session_id=/);
  });
});
