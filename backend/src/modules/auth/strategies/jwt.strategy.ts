import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { AppConfigService } from '../../../config/app-config.service';
import { UsersService } from '../../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  sid: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    config: AppConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid user session');
    }

    return {
      id: user.id,
      email: user.email,
      authSource: user.authSource,
      roles: payload.roles as RequestUser['roles'],
    };
  }
}
