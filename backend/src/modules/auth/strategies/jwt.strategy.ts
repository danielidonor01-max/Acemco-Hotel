import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from '../../../common/types/jwt-payload.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    // No fallback. This used to default to a hardcoded 'insecure-dev-secret', so a
    // deploy missing the env var would still verify tokens — signed with a string
    // anyone can read in this repo. Boot must fail instead (see assertSecrets).
    if (!secret) throw new Error('JWT_SECRET is not set — refusing to configure the JWT strategy.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
