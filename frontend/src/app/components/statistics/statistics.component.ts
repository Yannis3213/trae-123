import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import {
  Statistics,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
  WARNING_LABELS,
  WARNING_COLORS,
  RecordStatus,
  UserRole,
  WarningType,
} from '../../models/models';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.css',
})
export class StatisticsComponent implements OnInit {
  stats: Statistics | null = null;
  loading = true;

  statusItems: { key: string; label: string; color: string; count: number }[] = [];
  warningItems: { key: string; label: string; color: string; count: number }[] = [];
  roleItems: { key: string; label: string; count: number }[] = [];

  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  ROLE_LABELS = ROLE_LABELS;
  WARNING_LABELS = WARNING_LABELS;
  WARNING_COLORS = WARNING_COLORS;

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.api.getStatistics().subscribe({
      next: (data) => {
        this.stats = data;
        this.buildCards();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private buildCards(): void {
    if (!this.stats) return;

    const statusKeys: RecordStatus[] = ['draft', 'pending_review', 'approved', 'synced', 'returned'];
    this.statusItems = statusKeys.map(key => ({
      key,
      label: STATUS_LABELS[key],
      color: STATUS_COLORS[key],
      count: this.stats!.status_counts[key] || 0,
    }));

    const warningKeys: WarningType[] = ['normal', 'approaching', 'overdue'];
    this.warningItems = warningKeys.map(key => ({
      key,
      label: WARNING_LABELS[key],
      color: WARNING_COLORS[key],
      count: this.stats!.warning_counts[key] || 0,
    }));

    const roleKeys: UserRole[] = ['checkin_agent', 'baggage_supervisor', 'station_manager'];
    this.roleItems = roleKeys.map(key => ({
      key,
      label: ROLE_LABELS[key] + '待处理',
      count: this.stats!.role_counts[key] || 0,
    }));
  }

  switchNav(nav: string): void {
    if (nav === 'records') this.router.navigate(['/records']);
    else if (nav === 'warnings') this.router.navigate(['/warnings']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
