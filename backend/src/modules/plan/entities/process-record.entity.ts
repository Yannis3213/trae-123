import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Plan } from './plan.entity';

@Entity()
export class ProcessRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column()
  action: string;

  @Column()
  operator: string;

  @Column()
  operatorRole: string;

  @Column({ nullable: true })
  fromStatus: string | null;

  @Column()
  toStatus: string;

  @Column({ nullable: true })
  result: string | null;

  @Column({ nullable: true })
  returnReason: string | null;

  @Column({ nullable: true })
  auditNote: string | null;

  @Column({ nullable: true })
  exceptionReason: string | null;

  @CreateDateColumn()
  createdAt: string;

  @ManyToOne(() => Plan, (plan) => plan.processRecords)
  plan: Plan;
}
