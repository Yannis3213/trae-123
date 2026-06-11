import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { User } from './entities/user.entity';
import { VenueOrder } from './entities/venue-order.entity';
import { ProcessingRecord } from './entities/processing-record.entity';
import { Attachment } from './entities/attachment.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { AuditModule } from './audit/audit.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { seedDatabase } from './seed';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: path.join(__dirname, '..', 'venue_orders.db'),
      synchronize: true,
      entities: [User, VenueOrder, ProcessingRecord, Attachment, AuditLog],
    }),
    AuthModule,
    OrdersModule,
    AuditModule,
    AttachmentsModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    await seedDatabase(this.dataSource);
  }
}
