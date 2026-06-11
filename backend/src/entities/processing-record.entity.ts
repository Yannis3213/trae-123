import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { VenueOrder } from './venue-order.entity';

@Entity('processing_records')
export class ProcessingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 50 })
  operator: string;

  @Column({ type: 'varchar', length: 20 })
  operatorRole: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  opinion: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  paymentVerification: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  admissionConfirmation: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  paymentAmount: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentStatus: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  admissionStatus: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  correctReason: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  returnOpinion: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  exceptionReason: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  responsibleNode: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  auditRemark: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => VenueOrder, (order) => order.processingRecords)
  order: VenueOrder;
}
