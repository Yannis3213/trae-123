import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ReasonType = 'overdue' | 'conflict' | 'material_missing' | 'other';

@Entity('exception_reasons')
export class ExceptionReason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  reasonType: ReasonType;

  @Column()
  operator: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  resolved: boolean;
}
