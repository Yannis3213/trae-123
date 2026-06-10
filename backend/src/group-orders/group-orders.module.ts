import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupOrdersController } from './group-orders.controller';
import { GroupOrdersService } from './group-orders.service';
import { GroupOrder } from '../entities/group-order.entity';
import { ProcessingRecord } from '../entities/processing-record.entity';
import { Attachment } from '../entities/attachment.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionReason } from '../entities/exception-reason.entity';
import { RoleGuard } from '../common/guards/role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupOrder, ProcessingRecord, Attachment, AuditNote, ExceptionReason]),
  ],
  controllers: [GroupOrdersController],
  providers: [GroupOrdersService, RoleGuard],
})
export class GroupOrdersModule {}
