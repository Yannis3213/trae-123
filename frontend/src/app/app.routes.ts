import { Routes, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './services/api.service';
import { UserRole } from './models';
import { map, catchError, of, Observable } from 'rxjs';

const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean | UrlTree> | boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  const roles = route.data['roles'] as UserRole[] | undefined;
  if (roles && roles.length) {
    const user = auth.currentUser!;
    if (!roles.includes(user.role)) {
      return router.createUrlTree(['/forbidden']);
    }
  }
  return true;
};

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPageComponent),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./pages/forbidden.page').then((m) => m.ForbiddenPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/layout.page').then((m) => m.LayoutPageComponent),
    children: [
      {
        path: '',
        redirectTo: 'topics',
        pathMatch: 'full',
      },
      {
        path: 'topics',
        loadComponent: () => import('./pages/topic-list.page').then((m) => m.TopicListPageComponent),
      },
      {
        path: 'topics/new',
        loadComponent: () => import('./pages/topic-new.page').then((m) => m.TopicNewPageComponent),
        data: { roles: ['registrar'] as UserRole[] },
      },
      {
        path: 'topics/batch',
        loadComponent: () => import('./pages/topic-batch.page').then((m) => m.TopicBatchPageComponent),
      },
      {
        path: 'topics/:id',
        loadComponent: () => import('./pages/topic-detail.page').then((m) => m.TopicDetailPageComponent),
      },
      {
        path: 'exception-demo',
        loadComponent: () => import('./pages/exception-demo.page').then((m) => m.ExceptionDemoPageComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
