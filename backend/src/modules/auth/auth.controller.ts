import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { loginSchema, LoginDto } from './dto/login.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';

const REFRESH_COOKIE = 'refresh_token';

const updateProfileSchema = z.object({ name: z.string().min(1).max(120) });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    // Default 'lax' assumes the recommended same-domain setup (frontend proxies /api
    // to the API via a Next rewrite), keeping the cookie first-party. Set
    // COOKIE_SAMESITE=none only if the API is served on a different site than the app
    // (requires Secure + browser third-party-cookie allowance).
    const sameSite = ((this.config.get('COOKIE_SAMESITE') as 'lax' | 'none' | 'strict') || 'lax');
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd || sameSite === 'none',
      sameSite,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Public()
  // Brute-force guard: 5 attempts per minute per IP. There was no rate limiting at
  // all, so an attacker could guess passwords as fast as the API would answer.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate and receive an access token' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate tokens using the refresh cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { message: 'Logged out.' };
  }

  @AuthenticatedOnly()
  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @AuthenticatedOnly()
  @Patch('me')
  @ApiOperation({ summary: 'Update your own profile (name)' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: z.infer<typeof updateProfileSchema>,
  ) {
    return this.auth.updateProfile(user.id, dto.name);
  }

  // Verifies the current password, so it's a guessing surface too.
  @AuthenticatedOnly()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change your own password' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: z.infer<typeof changePasswordSchema>,
  ) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
