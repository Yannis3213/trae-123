import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { User } from '../entities/user.entity';
import { TreatmentPlanStatus } from '../common/types';

const APPROACHING_DAYS = 7;

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(TreatmentPlan)
    private plansRepository: Repository<TreatmentPlan>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private computeDueStatus(deadline: Date | null | undefined): 'normal' | 'approaching' | 'overdue' {
    if (!deadline) return 'normal';
    const now = new Date();
    const dl = new Date(deadline);
    const approachingThreshold = new Date(
      now.getTime() + APPROACHING_DAYS * 24 * 60 * 60 * 1000,
    );
    if (dl < now) return 'overdue';
    if (dl <= approachingThreshold) return 'approaching';
    return 'normal';
  }

  async getStatistics() {
    const statuses: TreatmentPlanStatus[] = [
      'pending_confirm',
      'confirmed',
      'exception',
      'pending_review',
      'reviewed',
      'archived',
    ];
    const statusCounts: Record<string, number> = {};
    for (const s of statuses) {
      statusCounts[s] = await this.plansRepository.count({
        where: { status: s },
      });
    }

    const warning = await this.getDueWarningInternal();

    const all = await this.plansRepository.find();

    return {
      statusCounts,
      dueStatusCounts: {
        normal: warning.normal.length,
        approaching: warning.approaching.length,
        overdue: warning.overdue.length,
      },
      total: all.length,
      deadlineWarning: warning,
    };
  }

  private async getDueWarningInternal() {
    const all = await this.plansRepository.find();
    const handlerIds: number[] = all.map((p: TreatmentPlan) => p.currentHandler).filter((x): x is number => !!x);
    const uniqueHandlerIds = Array.from(new Set(handlerIds));
    const users = uniqueHandlerIds.length
      ? await this.usersRepository.find({ where: { id: In(uniqueHandlerIds) } })
      : [];
    const userMap = new Map(users.map((u: User) => [u.id, u]));

    let overdue: any[] = [];
    let approaching: any[] = [];
    let normal: any[] = [];

    for (const p of all) {
      if (!p.deadline) continue;
      const ds = this.computeDueStatus(p.deadline);
      const item = {
        id: p.id,
        planNo: p.planNo,
        patientName: p.patientName,
        patientPhone: p.patientPhone,
        phone: p.patientPhone,
        status: p.status,
        currentHandler: userMap.get(p.currentHandler)?.name || '',
        createdAt: p.createdAt,
        deadline: p.deadline,
        dueStatus: ds,
        version: p.version,
        followUpDate: p.followUpDate,
        reminderComplete: p.reminderComplete,
        materialsComplete: p.materialsComplete,
        planComplete: p.planComplete,
        correctCount: 0,
        abnormalSummary: '',
      };
      if (ds === 'overdue') overdue.push(item);
      else if (ds === 'approaching') approaching.push(item);
      else normal.push(item);
    }

    return { normal, approaching, overdue };
  }

  async getDueWarning() {
    return this.getDueWarningInternal();
  }
}
