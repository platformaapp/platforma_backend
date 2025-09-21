import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = payload;
      return true;
    } catch (error) {
      if (error) {
        return await this.handleExpiredToken(request, response);
      }

      throw new UnauthorizedException('Invalid token');
    }
  }

  private async handleExpiredToken(request: Request, response: Response): Promise<boolean> {
    try {
      const refreshToken = (request.cookies as Record<string, string | undefined>)?.refreshToken;

      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      const result = await this.authService.refresh(refreshToken);

      const isProduction = process.env.NODE_ENV === 'production';
      response.cookie('refreshToken', result.refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      request.headers.authorization = `Bearer ${result.access_token}`;
      response.setHeader('New-Access-Token', result.access_token);

      const payload = await this.jwtService.verifyAsync<JwtPayload>(result.access_token);
      request.user = payload;

      return true;
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      throw new UnauthorizedException('Token expired and refresh failed');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
