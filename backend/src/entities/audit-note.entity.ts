import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_note')
export class AuditNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column()
  userId: number;

  @Column({ type: 'text' })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
