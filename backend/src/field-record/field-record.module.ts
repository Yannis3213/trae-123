import { Module } from '@nestjs/common';
import { FieldRecordController } from './field-record.controller';
import { FieldRecordService } from './field-record.service';

@Module({
  controllers: [FieldRecordController],
  providers: [FieldRecordService],
  exports: [FieldRecordService],
})
export class FieldRecordModule {}
