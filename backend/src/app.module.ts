import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { PlanModule } from './modules/plan/plan.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'pr_system.db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    AuthModule,
    PlanModule,
  ],
})
export class AppModule {}
