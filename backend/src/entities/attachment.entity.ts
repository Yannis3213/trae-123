import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { VenueOrder } from './venue-order.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @Column({ type: 'varchar', length: 200 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 50 })
  uploadedBy: string;

  @CreateDateColumn()
  uploadedAt: Date;

  @ManyToOne(() => VenueOrder, (order) => order.attachments)
  order: VenueOrder;
}
