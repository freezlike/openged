import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { CheckinDocumentDto } from './dto/checkin-document.dto';
import { DeleteDocumentsDto } from './dto/delete-documents.dto';
import { UpdateMetadataDto } from './dto/update-metadata.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.upload(user.id, dto, file);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
    @Res() response: Response,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    const file = await this.documentsService.download(user.id, id);

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);

    file.stream.pipe(response);
  }

  @Put(':id/metadata')
  async updateMetadata(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: UpdateMetadataDto,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.updateMetadata(user.id, id, dto);
  }

  @Post(':id/checkout')
  async checkout(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.checkout(user.id, id);
  }

  @Post(':id/checkin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async checkin(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: CheckinDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.checkin(user.id, id, dto, file);
  }

  @Get(':id/versions')
  async versions(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.versions(user.id, id);
  }

  @Get(':id')
  async details(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.details(user.id, id);
  }

  @Get(':id/activity')
  async activity(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.activity(user.id, id);
  }

  @Get(':id/workflows/history')
  async workflowHistory(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.workflowHistory(user.id, id);
  }

  @Post('bulk-delete')
  async bulkDelete(
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: DeleteDocumentsDto,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.documentsService.bulkDelete(user.id, dto.ids);
  }
}
