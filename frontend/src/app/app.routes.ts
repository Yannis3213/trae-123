import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'records', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'records', loadComponent: () => import('./components/record-list/record-list.component').then(m => m.RecordListComponent), canActivate: [authGuard] },
  { path: 'records/:id', loadComponent: () => import('./components/record-detail/record-detail.component').then(m => m.RecordDetailComponent), canActivate: [authGuard] },
  { path: 'warnings', loadComponent: () => import('./components/warning-queue/warning-queue.component').then(m => m.WarningQueueComponent), canActivate: [authGuard] },
  { path: 'statistics', loadComponent: () => import('./components/statistics/statistics.component').then(m => m.StatisticsComponent), canActivate: [authGuard] },
];
