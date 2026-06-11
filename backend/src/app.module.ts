import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { RecordsModule } from './records/records.module';
import { BatchModule } from './batch/batch.module';
import { ExpiryModule } from './expiry/expiry.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    RecordsModule,
    BatchModule,
    ExpiryModule,
    AuditModule,
  ],
})
export class AppModule {}
