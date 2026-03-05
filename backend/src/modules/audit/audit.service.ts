import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorId?: string;
    eventType: string;
    objectType: string;
    objectId?: string;
    details?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        eventType: params.eventType,
        objectType: params.objectType,
        objectId: params.objectId,
        details: params.details as object | undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async query(dto: QueryAuditDto) {
    return this.prisma.auditLog.findMany({
      where: {
        eventType: dto.eventType,
        actorId: dto.actorId,
        createdAt: {
          gte: dto.from ? new Date(dto.from) : undefined,
          lte: dto.to ? new Date(dto.to) : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: dto.limit,
    });
  }

  async export(dto: QueryAuditDto): Promise<string> {
    const logs = await this.query(dto);

    if (dto.format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    const headers = [
      'id',
      'actorId',
      'eventType',
      'objectType',
      'objectId',
      'createdAt',
      'ipAddress',
      'userAgent',
      'details',
    ];

    const rows = logs.map((log) => {
      const values = [
        log.id,
        log.actorId ?? '',
        log.eventType,
        log.objectType,
        log.objectId ?? '',
        log.createdAt.toISOString(),
        log.ipAddress ?? '',
        log.userAgent ?? '',
        JSON.stringify(log.details ?? {}),
      ];

      return values
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
