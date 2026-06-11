import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database.module';
import { AuthModule } from './auth/auth.module';
import { PlantingTaskModule } from './planting-task/planting-task.module';
import { MaterialRequisitionModule } from './material-requisition/material-requisition.module';
import { FieldRecordModule } from './field-record/field-record.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { OverdueQueueModule } from './overdue-queue/overdue-queue.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PlantingTaskModule,
    MaterialRequisitionModule,
    FieldRecordModule,
    AuditLogModule,
    OverdueQueueModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
