import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';

@Entity('audit_notes')
export class AuditNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column({ type: 'text' })
  content: string;

  @Column()
  author: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
  })
  authorRole: UserRole;

  @CreateDateColumn()
  createdAt: Date;
}
