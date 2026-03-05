import { Module } from '@nestjs/common';

import { PermissionsModule } from '../permissions/permissions.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentVersioningService } from './services/document-versioning.service';

@Module({
  imports: [StorageModule, PermissionsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentVersioningService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
