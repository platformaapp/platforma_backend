import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/registration.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response
  ) {
    const result = await this.authService.register(registerDto);

    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: express.Response) {
    const result = await this.authService.login(loginDto);

    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: express.Request, @Res({ passthrough: true }) res: express.Response) {
    const cookies = (req.cookies ?? {}) as Record<string, string>;
    const refreshToken = cookies.refreshToken;

    if (!refreshToken) throw new UnauthorizedException('Refresh token not found');

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      access_token: result.access_token,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: express.Request, @Res({ passthrough: true }) res: express.Response) {
    try {
      const cookies = (req.cookies ?? {}) as Record<string, string>;
      const refreshToken = cookies.refreshToken;

      if (refreshToken) await this.authService.logout(refreshToken);

      this.clearRefreshTokenCookie(res);

      return { message: 'Logged out successfully' };
    } catch (error) {
      console.error('Error in logout:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const { email } = body;
    try {
      await this.authService.requestPasswordChange({ email });
    } catch (error) {
      console.error('Error message: ', (error as Error).message);
    }
    return { message: 'Password reset link sent to your email' };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Password reset successfully' };
  }

  private setRefreshTokenCookie(res: express.Response, token: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: express.Response) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });
  }
}
