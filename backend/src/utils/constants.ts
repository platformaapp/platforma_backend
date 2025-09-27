import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export const FRONTEND_URL = process.env.FRONTEND_URL;
export const JWT_SECRET = process.env.JWT_SECRET;
export const PORT = process.env.PORT;

export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = Number(process.env.SMTP_PORT);
export const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;

export const NODE_ENV = process.env.NODE_ENV;
