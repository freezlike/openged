import { Module } from '@nestjs/common';

import { PermissionsModule } from '../permissions/permissions.module';
import { DmsController } from './dms.controller';
import { DmsService } from './dms.service';

@Module({
  imports: [PermissionsModule],
  controllers: [DmsController],
  providers: [DmsService],
  exports: [DmsService],
})
export class DmsModule {}
