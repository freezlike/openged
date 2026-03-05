import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { SsoAssertionDto } from './dto/sso-assertion.dto';
import { SsoService } from './sso.service';

@Controller('auth/sso')
@Public()
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('providers')
  providers() {
    return this.ssoService.listProviders();
  }

  @Get('oidc/start')
  oidcStart() {
    return this.ssoService.oidcStart();
  }

  @Post('assertion')
  assertion(
    @Body() dto: SsoAssertionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.ssoService.handleAssertion(dto, { ip, userAgent });
  }
}
