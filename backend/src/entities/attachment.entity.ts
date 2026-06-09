import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { AttachmentType } from '../common/types';

@Entity('attachment')
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planId: number;

  @Column({ type: 'text' })
  type: AttachmentType;

  @Column()
  filename: string;

  @Column()
  url: string;

  @Column()
  uploadedBy: number;

  @CreateDateColumn()
  uploadedAt: Date;
}
