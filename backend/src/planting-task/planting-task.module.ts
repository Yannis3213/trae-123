import { Module } from '@nestjs/common';
import { PlantingTaskController } from './planting-task.controller';
import { PlantingTaskService } from './planting-task.service';

@Module({
  controllers: [PlantingTaskController],
  providers: [PlantingTaskService],
  exports: [PlantingTaskService],
})
export class PlantingTaskModule {}
