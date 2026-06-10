import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { GroupOrder } from '../entities/group-order.entity';
import { Attachment } from '../entities/attachment.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionReason } from '../entities/exception-reason.entity';
import { ProcessingRecord } from '../entities/processing-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GroupOrder,
      Attachment,
      AuditNote,
      ExceptionReason,
      ProcessingRecord,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
