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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered (sets refreshToken cookie)',
    schema: {
      example: {
        user: { id: 1, email: 'user@example.com', fullName: 'John Doe', role: 'student' },
        access_token: 'jwt_token',
      },
    },
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response
  ) {
    const result = await this.authService.register(registerDto);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return {
      user: result.user,
      access_token: result.access_token,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully logged in (sets refreshToken cookie)',
    schema: {
      example: {
        user: { id: 1, email: 'user@example.com', fullName: 'John Doe', role: 'student' },
        access_token: 'jwt_token',
      },
    },
  })
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
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully',
    schema: {
      example: {
        access_token: 'new_jwt_token',
      },
    },
  })
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
  @ApiOperation({ summary: 'User logout' })
  @ApiBearerAuth('JWT-auth')
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully logged out',
    schema: {
      example: {
        message: 'Logged out successfully',
      },
    },
  })
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
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset link sent',
    schema: {
      example: {
        message: 'Password reset link sent to your email',
      },
    },
  })
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
  @ApiOperation({ summary: 'Reset password' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully',
    schema: {
      example: {
        message: 'Password reset successfully',
      },
    },
  })
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
