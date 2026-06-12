import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Plan } from './plan.entity';

@Entity()
export class AuditNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column()
  content: string;

  @Column()
  author: string;

  @Column()
  authorRole: string;

  @CreateDateColumn()
  createdAt: string;

  @ManyToOne(() => Plan, (plan) => plan.auditNotes)
  plan: Plan;
}
