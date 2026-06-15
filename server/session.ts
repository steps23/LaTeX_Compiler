import express from "express";
import { credentialStore } from "./credentialStore";
import { OAuth2Client } from "google-auth-library";
import { config } from "./config";

export const sessionRouter = express.Router();

function getOAuthClient() {
  return new OAuth2Client(config.OAUTH_CLIENT_ID, config.OAUTH_CLIENT_SECRET);
}

// Custom middleware to attach session
export const requireSession = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    return res.status(401).json({ error: "No session" });
  }

  const session = await credentialStore.getSession(sessionId);
  if (!session) {
    res.clearCookie("session_id");
    return res.status(401).json({ error: "Session expired or invalid" });
  }

  // Check if token needs refresh
  if (
    session.tokens.expiry_date &&
    session.tokens.expiry_date <= Date.now() + 60000
  ) {
    if (session.tokens.refresh_token) {
      try {
        const client = getOAuthClient();
        client.setCredentials(session.tokens);
        const { credentials } = await client.refreshAccessToken();

        await credentialStore.updateTokens(sessionId, {
          access_token: credentials.access_token!,
          refresh_token:
            credentials.refresh_token || session.tokens.refresh_token,
          expiry_date: credentials.expiry_date || undefined,
          id_token: credentials.id_token || undefined,
        });

        // re-load session to have latest tokens
        const updated = await credentialStore.getSession(sessionId);
        if (updated) {
          (req as any).sessionData = updated;
        }
      } catch (err) {
        console.error("Failed to refresh token:", err);
        return res
          .status(401)
          .json({ error: "Session expired and refresh failed", revoked: true });
      }
    } else {
      return res
        .status(401)
        .json({
          error: "Token expired and no refresh token available",
          revoked: true,
        });
    }
  } else {
    (req as any).sessionData = session;
  }

  next();
};

sessionRouter.get("/current", requireSession, (req, res) => {
  const account = (req as any).sessionData.account;
  res.json({ account });
});

sessionRouter.post("/logout", async (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    await credentialStore.deleteSession(sessionId);
    res.clearCookie("session_id", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
  }
  res.json({ success: true });
});

sessionRouter.post("/revoke", async (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    const session = await credentialStore.getSession(sessionId);
    if (session && session.tokens.refresh_token) {
      const client = getOAuthClient();
      try {
        await client.revokeToken(session.tokens.refresh_token);
      } catch (err) {
        console.error("Error revoking token:", err);
      }
    }
    await credentialStore.deleteSession(sessionId);
    res.clearCookie("session_id", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
  }
  res.json({ success: true });
});
