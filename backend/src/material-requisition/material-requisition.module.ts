import { Module } from '@nestjs/common';
import { MaterialRequisitionController } from './material-requisition.controller';
import { MaterialRequisitionService } from './material-requisition.service';

@Module({
  controllers: [MaterialRequisitionController],
  providers: [MaterialRequisitionService],
  exports: [MaterialRequisitionService],
})
export class MaterialRequisitionModule {}
