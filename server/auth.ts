import express from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "./config";
import crypto from "crypto";
import { credentialStore } from "./credentialStore";
import { v4 as uuidv4 } from "uuid";

export const authRouter = express.Router();

function getOAuthClient(redirectUri: string) {
  return new OAuth2Client(
    config.OAUTH_CLIENT_ID,
    config.OAUTH_CLIENT_SECRET,
    redirectUri,
  );
}

function getAppRedirectUri(req: express.Request) {
  // If behind a proxy, try to use X-Forwarded-Proto / Host
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers.host || req.hostname;
  return `${protocol}://${host}/auth/callback`;
}

// Memory store for in-flight auth flows (state -> { verifier, nonce })
const authFlows = new Map<
  string,
  { verifier: string; nonce: string; timestamp: number }
>();

// Cleanup old auth flows
setInterval(
  () => {
    const now = Date.now();
    for (const [state, flow] of authFlows.entries()) {
      if (now - flow.timestamp > 10 * 60 * 1000) {
        // 10 minutes
        authFlows.delete(state);
      }
    }
  },
  5 * 60 * 1000,
);

authRouter.get("/url", (req, res) => {
  const redirectUri = config.OAUTH_REDIRECT_URI || getAppRedirectUri(req);
  const client = getOAuthClient(redirectUri);

  // Generate PKCE verifier
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  authFlows.set(state, { verifier, nonce, timestamp: Date.now() });

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file",
    ],
    state,
    prompt: "consent", // Ensure we get a refresh token
    include_granted_scopes: true,
    code_challenge_method: "S256",
    code_challenge: challenge,
    nonce, // OIDC nonce
  });

  res.json({ url: authUrl });
});

// The callback route for the provider
authRouter.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Invalid callback request");
  }

  const flow = authFlows.get(state);
  if (!flow) {
    return res.status(400).send("Invalid or expired state parameter");
  }
  authFlows.delete(state);

  const redirectUri = config.OAUTH_REDIRECT_URI || getAppRedirectUri(req);
  const client = getOAuthClient(redirectUri);

  try {
    const { tokens } = await client.getToken({
      code,
      codeVerifier: flow.verifier,
    });

    client.setCredentials(tokens);

    // Get user profile info via OpenID connect id_token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.OAUTH_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || payload.nonce !== flow.nonce) {
      return res.status(401).send("Invalid ID token or nonce");
    }

    const sessionId = uuidv4();
    const account = {
      id: payload.sub,
      email: payload.email!,
      name: payload.name || "Unknown User",
      picture: payload.picture,
    };

    await credentialStore.saveSession({
      sessionId,
      userId: account.id,
      account,
      tokens: {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token || undefined,
        expiry_date: tokens.expiry_date || undefined,
        id_token: tokens.id_token || undefined,
        scope: tokens.scope || undefined,
      },
    });

    // Set HttpOnly, Secure, SameSite=none cookie
    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    res.status(500).send("Failed to exchange code: " + error.message);
  }
});
