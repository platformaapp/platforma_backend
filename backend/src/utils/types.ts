import { BookingStatus } from 'src/student/entities/booking.entity';
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

export interface BookingDetails {
  id: string;
  slotId: string;
  tutorId: string;
  studentId: string;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
  slot?: {
    id: string;
    date: string;
    time: string;
    tutor?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
  student?: {
    id: string;
    fullName: string;
    email: string;
  };
  tutor?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface CardDetails {
  first6: string;
  last4: string;
  cardType: string;
  expiryMonth: string;
  expiryYear: string;
}

export interface YookassaWebhook {
  type: 'notification';
  event: string;
  object: {
    id: string;
    status: string;
    payment_method?: {
      id: string;
      type: string;
      saved: boolean;
      card?: {
        first6: string;
        last4: string;
        card_type: string;
        expiry_month: string;
        expiry_year: string;
      };
    };
  };
}
