import fs from "fs";
import path from "path";
import { encryptTokenData, decryptTokenData } from "./crypto";
import { config } from "./config";

export interface UserAccount {
  id: string; // usually sub / google id
  email: string;
  name: string;
  picture?: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number; // ms timestamp
  id_token?: string;
  scope?: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  account: UserAccount;
  tokens: OAuthTokens;
}

export interface CredentialStore {
  saveSession(session: SessionData): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  deleteSession(sessionId: string): Promise<void>;
  updateTokens(sessionId: string, tokens: OAuthTokens): Promise<void>;
}

// In-Memory implementation
class MemoryStore implements CredentialStore {
  private sessions = new Map<string, SessionData>();

  async saveSession(session: SessionData) {
    this.sessions.set(session.sessionId, session);
  }
  async getSession(sessionId: string) {
    return this.sessions.get(sessionId) || null;
  }
  async deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
  async updateTokens(sessionId: string, tokens: OAuthTokens) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tokens = { ...session.tokens, ...tokens };
      this.sessions.set(sessionId, session);
    }
  }
}

// Local File implementation (gitignored file)
class LocalFileStore implements CredentialStore {
  private filePath: string;

  constructor(filename = ".credentials.json") {
    this.filePath = path.join(process.cwd(), filename);
  }

  private loadData(): Record<string, string> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("LocalFileStore read error:", err);
    }
    return {};
  }

  private saveData(data: Record<string, string>) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async saveSession(session: SessionData) {
    const data = this.loadData();
    const encrypted = encryptTokenData(JSON.stringify(session));
    data[session.sessionId] = encrypted;
    this.saveData(data);
  }

  async getSession(sessionId: string) {
    const data = this.loadData();
    const encrypted = data[sessionId];
    if (!encrypted) return null;
    try {
      const decrypted = decryptTokenData(encrypted);
      return JSON.parse(decrypted) as SessionData;
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string) {
    const data = this.loadData();
    delete data[sessionId];
    this.saveData(data);
  }

  async updateTokens(sessionId: string, tokens: OAuthTokens) {
    const session = await this.getSession(sessionId);
    if (session) {
      session.tokens = { ...session.tokens, ...tokens };
      await this.saveSession(session);
    }
  }
}

// Firestore placeholder
class FirestoreStore implements CredentialStore {
  async saveSession(session: SessionData) {
    // throw new Error("Firestore store not implemented yet.");
    console.warn("FirestoreStore saveSession called (stub)");
  }
  async getSession(sessionId: string) {
    console.warn("FirestoreStore getSession called (stub)");
    return null;
  }
  async deleteSession(sessionId: string) {
    console.warn("FirestoreStore deleteSession called (stub)");
  }
  async updateTokens(sessionId: string, tokens: OAuthTokens) {
    console.warn("FirestoreStore updateTokens called (stub)");
  }
}

let storeInstance: CredentialStore;
switch (config.CREDENTIAL_STORE_TYPE) {
  case "local":
    storeInstance = new LocalFileStore();
    break;
  case "firestore":
    storeInstance = new FirestoreStore();
    break;
  case "memory":
  default:
    storeInstance = new MemoryStore();
    break;
}

export const credentialStore = storeInstance;
