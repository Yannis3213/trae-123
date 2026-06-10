import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ActionType } from '../common/enums/action-type.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Entity('processing_records')
export class ProcessingRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column({
    type: 'simple-enum',
    enum: ActionType,
  })
  actionType: ActionType;

  @Column()
  operator: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
  })
  operatorRole: UserRole;

  @Column({
    type: 'simple-enum',
    enum: OrderStatus,
    nullable: true,
  })
  previousStatus: OrderStatus;

  @Column({
    type: 'simple-enum',
    enum: OrderStatus,
    nullable: true,
  })
  newStatus: OrderStatus;

  @Column({ nullable: true })
  previousHandler: string;

  @Column({ nullable: true })
  newHandler: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  version: number;
}
