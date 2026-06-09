import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TreatmentPlanStatus } from '../common/types';

@Entity('treatment_plan')
export class TreatmentPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  patientName: string;

  @Column()
  patientIdCard: string;

  @Column()
  patientPhone: string;

  @Column({ unique: true })
  planNo: string;

  @Column({ type: 'text' })
  status: TreatmentPlanStatus;

  @Column({ default: 1 })
  version: number;

  @Column()
  currentHandler: number;

  @Column({ nullable: true })
  doctorId: number;

  @Column({ nullable: true })
  consultantId: number;

  @Column({ nullable: true })
  deanId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  deadline: Date;

  @Column({ nullable: true, type: 'text' })
  lastHandlerRemark: string;

  @Column({ default: false })
  materialsComplete: boolean;

  @Column({ default: false })
  planComplete: boolean;

  @Column({ default: false })
  reminderComplete: boolean;
}
