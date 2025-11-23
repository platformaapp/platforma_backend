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
  sessionInfo?: {
    sessionId: string;
    price: number;
    requiresPayment: boolean;
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
    // Добавляем недостающие свойства
    error?: {
      message?: string;
    };
    cancellation_details?: {
      reason?: string;
    };
  };
}

export interface CreateSessionPaymentParams {
  amount: number;
  paymentMethodToken: string;
  description: string;
  paymentId: string;
  returnUrl: string;
}

export interface YookassaPayment {
  id: string;
  status: string;
  amount?: {
    value: string;
    currency: string;
  };
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
  cancellation_details?: {
    reason?: string;
  };
  captured_at?: string;
  created_at?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface YookassaSessionPaymentResponse {
  id: string;
  status: string;
  confirmation_url?: string;
}

export interface YookassaConfig {
  shopId: string;
  secretKey: string;
  baseUrl: string;
}

export interface YookassaPaymentResponse {
  id: string;
  status: string;
  confirmation: {
    confirmation_url: string;
  };
}

export interface CreateWebinarParams {
  name: string;
  start: string; // YYYY-MM-DD HH:MM:SS
  duration: number; // в минутах
  description?: string;
  maxParticipants?: number;
  close?: boolean; // приватный или публичный
  language?: string;
}

export interface WebinarResponse {
  success: string;
  alias: string;
  webinarLink: string;
  mainModeratorLink: string;
}

export interface MyOwnConferenceRequest {
  key: string;
  action: string;
  params: any[];
}

export interface MyOwnConferenceResponse {
  response: {
    error?: string;
    alias?: string;
    webinarLink?: string;
    mainModeratorLink?: string;
  };
}

export interface UpdateWebinarParams {
  name?: string;
  start?: string;
  duration?: number;
  description?: string;
  maxParticipants?: number;
  close?: boolean;
  language?: string;
}

export interface UpdateWebinarRequest {
  key: string;
  action: string;
  params: any[];
}

export interface UpdateWebinarResponse {
  response: {
    error?: string;
    success?: string;
  };
}

export interface DeleteWebinarRequest {
  key: string;
  action: string;
  params: {
    alias: string;
  };
}

export interface DeleteWebinarResponse {
  response: {
    error?: string;
    success?: string;
  };
}

export interface CreateAttendeeRequest {
  key: string;
  action: string;
  params: {
    email: string;
    name: string;
  };
}

export interface AddAttendeeToWebinarRequest {
  key: string;
  action: string;
  params: {
    alias: string;
    attendees: string[];
  };
}

export interface AttendeeApiResponse {
  response: {
    error?: string;
    success?: string;
  };
}

export interface BaseApiResponse {
  response: {
    error?: string;
    success?: string;
  };
}

export interface WebinarInfoResponse {
  response: {
    error?: string;
    success?: string;
    alias?: string;
    webinarLink?: string;
    mainModeratorLink?: string;
  };
}

export interface AttendeesListResponse {
  response: {
    error?: string;
    list?: Array<{
      email: string;
      link: string;
    }>;
  };
}
