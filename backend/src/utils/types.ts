import { User } from 'src/users/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface PasswordResetPayload extends JwtPayload {
  type: 'password_reset';
}

export interface JwtError extends Error {
  name: 'TokenExpiredError' | 'JsonWebTokenError' | 'NotBeforeError';
}

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

export interface PaymentsSummary {
  total: string | null;
  month: string | null;
  week: string | null;
  count: string | null;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  access_token: string;
  refresh_token: string;
}
