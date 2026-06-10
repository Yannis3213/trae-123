import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Entity('group_orders')
export class GroupOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderNo: string;

  @Column()
  productName: string;

  @Column()
  sku: string;

  @Column({ type: 'date' })
  shelfDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  grouponPrice: number;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'simple-enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_ASSIGN,
  })
  orderStatus: OrderStatus;

  @Column({ nullable: true })
  currentHandler: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    nullable: true,
  })
  currentRole: UserRole;

  @Column({ type: 'datetime', nullable: true })
  deadline: Date;

  @Column({ default: 1 })
  version: number;

  @Column({ default: false })
  isOverdue: boolean;

  @Column({ nullable: true })
  overdueReason: string;

  @Column({ default: false })
  isMaterialComplete: boolean;

  @Column({ nullable: true })
  shelfEvidence: string;

  @Column({ nullable: true })
  orderEvidence: string;

  @Column({ nullable: true })
  deliveryEvidence: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  assignedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date;
}
