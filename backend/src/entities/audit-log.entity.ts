import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { VenueOrder } from './venue-order.entity';

@Entity('audit_logs')
export class AuditLog {
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

  @Column({ type: 'varchar', length: 500, nullable: true })
  detail: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => VenueOrder, (order) => order.auditLogs)
  order: VenueOrder;
}
