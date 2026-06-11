import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(filters: { orderId?: string; operator?: string }) {
    const qb = this.auditRepo.createQueryBuilder('al')
      .orderBy('al.createdAt', 'DESC');

    if (filters.orderId) {
      qb.andWhere('al.orderId = :orderId', { orderId: filters.orderId });
    }
    if (filters.operator) {
      qb.andWhere('al.operator = :operator', { operator: filters.operator });
    }

    return qb.getMany();
  }
}
