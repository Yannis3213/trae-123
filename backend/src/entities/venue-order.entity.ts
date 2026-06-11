import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessingRecord } from './processing-record.entity';
import { Attachment } from './attachment.entity';
import { AuditLog } from './audit-log.entity';

@Entity('venue_orders')
export class VenueOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  orderNo: string;

  @Column({ type: 'varchar', length: 100 })
  venueName: string;

  @Column({ type: 'varchar', length: 100 })
  courtName: string;

  @Column({ type: 'varchar', length: 20 })
  reservationDate: string;

  @Column({ type: 'varchar', length: 50 })
  timeSlot: string;

  @Column({ type: 'varchar', length: 50 })
  applicantName: string;

  @Column({ type: 'varchar', length: 20 })
  applicantPhone: string;

  @Column({ type: 'varchar', length: 30, default: 'pending_review' })
  status: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  correctReason: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  returnOpinion: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  exceptionReason: string | null;

  @Column({ type: 'varchar', length: 50 })
  currentHandler: string;

  @Column({ type: 'varchar', length: 20 })
  currentHandlerRole: string;

  @Column({ type: 'varchar', length: 20 })
  deadline: string;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  warningLevel: string;

  @Column({ type: 'varchar', length: 50 })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProcessingRecord, (record) => record.order)
  processingRecords: ProcessingRecord[];

  @OneToMany(() => Attachment, (attachment) => attachment.order)
  attachments: Attachment[];

  @OneToMany(() => AuditLog, (log) => log.order)
  auditLogs: AuditLog[];
}
