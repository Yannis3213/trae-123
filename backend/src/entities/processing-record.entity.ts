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

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => VenueOrder, (order) => order.processingRecords)
  order: VenueOrder;
}
