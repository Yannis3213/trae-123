import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Plan } from './plan.entity';

@Entity()
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column()
  fileName: string;

  @Column({ default: 0 })
  fileSize: number;

  @Column()
  fileType: string;

  @Column({ default: false })
  required: boolean;

  @Column({ nullable: true })
  uploadedAt: string | null;

  @ManyToOne(() => Plan, (plan) => plan.attachments)
  plan: Plan;
}
