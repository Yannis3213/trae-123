import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TreatmentPlan, User])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
