import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ExceptionType } from '../common/types';

@Entity('exception_cause')
export class ExceptionCause {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column({ type: 'text' })
  type: ExceptionType;

  @Column({ type: 'text' })
  description: string;

  @Column()
  reportedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  resolved: boolean;
}
