import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type EvidenceType = 'shelf' | 'order' | 'delivery';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column()
  fileName: string;

  @Column()
  fileType: string;

  @Column()
  fileUrl: string;

  @Column()
  uploadedBy: string;

  @CreateDateColumn()
  uploadedAt: Date;

  @Column({
    type: 'varchar',
    length: 20,
  })
  evidenceType: EvidenceType;
}
