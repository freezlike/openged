import { Module } from '@nestjs/common';

import { PermissionsModule } from '../permissions/permissions.module';
import { LookupController } from './lookup.controller';
import { LookupService } from './lookup.service';

@Module({
  imports: [PermissionsModule],
  controllers: [LookupController],
  providers: [LookupService],
  exports: [LookupService],
})
export class LookupModule {}
