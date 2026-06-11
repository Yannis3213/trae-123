import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./pages/application-list/application-list.component').then(m => m.ApplicationListComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'application/:id',
    loadComponent: () => import('./pages/application-detail/application-detail.component').then(m => m.ApplicationDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'batch-result',
    loadComponent: () => import('./pages/batch-result/batch-result.component').then(m => m.BatchResultComponent),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '' }
];
