import type { Request } from 'express';
import { UserRole } from '../users/user.enums.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export const JWT_ISSUER = 'devpanel-api';
export const JWT_AUDIENCE = 'devpanel-web';
