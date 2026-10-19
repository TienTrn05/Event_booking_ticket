export interface Account {
  userId: string;
  identityId: string;
  displayName: string;
  authVersion: number;
}

export interface Session extends Account {
  sessionId: string;
  expiresAt: Date;
  refreshToken: string;
}
