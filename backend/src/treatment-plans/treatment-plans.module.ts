import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreatmentPlansController } from './treatment-plans.controller';
import { TreatmentPlansService } from './treatment-plans.service';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { Attachment } from '../entities/attachment.entity';
import { ProcessRecord } from '../entities/process-record.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionCause } from '../entities/exception-cause.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TreatmentPlan,
      Attachment,
      ProcessRecord,
      AuditNote,
      ExceptionCause,
      User,
    ]),
  ],
  controllers: [TreatmentPlansController],
  providers: [TreatmentPlansService],
  exports: [TreatmentPlansService],
})
export class TreatmentPlansModule {}
