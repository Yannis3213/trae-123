import { Module } from '@nestjs/common';
import { OverdueQueueController } from './overdue-queue.controller';
import { OverdueQueueService } from './overdue-queue.service';
import { PlantingTaskModule } from '../planting-task/planting-task.module';

@Module({
  imports: [PlantingTaskModule],
  controllers: [OverdueQueueController],
  providers: [OverdueQueueService],
  exports: [OverdueQueueService],
})
export class OverdueQueueModule {}
