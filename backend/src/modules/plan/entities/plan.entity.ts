import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Attachment } from './attachment.entity';
import { ProcessRecord } from './process-record.entity';
import { AuditNote } from './audit-note.entity';

@Entity()
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  planNo: string;

  @Column()
  title: string;

  @Column()
  type: string;

  @Column()
  status: string;

  @Column()
  priority: string;

  @Column()
  dueDate: string;

  @Column()
  responsiblePerson: string;

  @Column()
  currentHandler: string;

  @Column()
  currentHandlerRole: string;

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  exceptionTag: string | null;

  @Column({ default: 'normal' })
  dueWarning: string;

  @Column()
  creatorId: number;

  @Column({ nullable: true })
  reviewResult: string | null;

  @Column({ nullable: true })
  verifyResult: string | null;

  @Column({ nullable: true })
  returnReason: string | null;

  @CreateDateColumn()
  createdAt: string;

  @UpdateDateColumn()
  updatedAt: string;

  @OneToMany(() => Attachment, (a) => a.plan)
  attachments: Attachment[];

  @OneToMany(() => ProcessRecord, (r) => r.plan)
  processRecords: ProcessRecord[];

  @OneToMany(() => AuditNote, (n) => n.plan)
  auditNotes: AuditNote[];
}
