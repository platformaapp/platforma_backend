import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from 'src/utils/types';
import { Request } from 'express';

@Injectable()
export class StudentGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) return false;

    const request = context.switchToHttp().getRequest<Request>();
    const user: JwtPayload = request.user;

    return !!user && user.role === 'student';
  }
}
