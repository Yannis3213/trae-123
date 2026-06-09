import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { TreatmentPlanStatus } from '../common/types';

@Entity('process_record')
export class ProcessRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column()
  userId: number;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  fromStatus: TreatmentPlanStatus;

  @Column({ type: 'text', nullable: true })
  toStatus: TreatmentPlanStatus;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ type: 'text', nullable: true })
  evidence: string;

  @CreateDateColumn()
  createdAt: Date;
}
