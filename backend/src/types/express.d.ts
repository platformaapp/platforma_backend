import { JwtPayload } from '../utils/types';

declare module 'express' {
  export interface Request {
    user?: JwtPayload;
  }
}

declare namespace Express {
  export interface Request {
    rawBody?: Buffer;
  }
}
