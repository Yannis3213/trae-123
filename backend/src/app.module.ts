import { Module, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import * as fs from 'fs';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TreatmentPlansModule } from './treatment-plans/treatment-plans.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AuthMiddleware } from './common/auth.middleware';
import { User } from './entities/user.entity';
import { TreatmentPlan } from './entities/treatment-plan.entity';
import { Attachment } from './entities/attachment.entity';
import { ProcessRecord } from './entities/process-record.entity';
import { AuditNote } from './entities/audit-note.entity';
import { ExceptionCause } from './entities/exception-cause.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { runSeed } from './database/seeder';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: (() => {
        const dir = join(process.cwd(), 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return join(dir, 'app.db');
      })(),
      entities: [
        User,
        TreatmentPlan,
        Attachment,
        ProcessRecord,
        AuditNote,
        ExceptionCause,
      ],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, TreatmentPlan, Attachment, ProcessRecord, AuditNote, ExceptionCause]),
    AuthModule,
    UsersModule,
    TreatmentPlansModule,
    StatisticsModule,
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TreatmentPlan) private planRepo: Repository<TreatmentPlan>,
    @InjectRepository(Attachment) private attRepo: Repository<Attachment>,
    @InjectRepository(ProcessRecord) private recordRepo: Repository<ProcessRecord>,
    @InjectRepository(AuditNote) private noteRepo: Repository<AuditNote>,
    @InjectRepository(ExceptionCause) private causeRepo: Repository<ExceptionCause>,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    await runSeed({
      userRepo: this.userRepo,
      planRepo: this.planRepo,
      attRepo: this.attRepo,
      recordRepo: this.recordRepo,
      noteRepo: this.noteRepo,
      causeRepo: this.causeRepo,
    });
  }
}
