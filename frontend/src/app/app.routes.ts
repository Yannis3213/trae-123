import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: '', redirectTo: '/orders', pathMatch: 'full' },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/order-list/order-list.component').then(m => m.OrderListComponent),
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
  },
  {
    path: 'warnings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/warnings/warnings.component').then(m => m.WarningsComponent),
  },
  { path: '**', redirectTo: '/orders' },
];
