import { Module } from '@nestjs/common';

import { DmsModule } from '../dms/dms.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { InstallerController } from './installer.controller';
import { InstallerService } from './installer.service';

@Module({
  imports: [UsersModule, DmsModule, StorageModule],
  controllers: [InstallerController],
  providers: [InstallerService],
})
export class InstallerModule {}
