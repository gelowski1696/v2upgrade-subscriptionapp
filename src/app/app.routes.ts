import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { superAdminGuard } from './core/auth/super-admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((module) => module.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/shell/app-shell').then((module) => module.AppShell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((module) => module.DashboardPage),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/clients').then((module) => module.ClientsPage),
      },
      {
        path: 'plans',
        loadComponent: () => import('./features/plans/plans').then((module) => module.PlansPage),
      },
      {
        path: 'subscriptions',
        loadComponent: () =>
          import('./features/subscriptions/subscriptions').then(
            (module) => module.SubscriptionsPage,
          ),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance').then((module) => module.FinancePage),
      },
      {
        path: 'web-analytics',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/web-analytics/web-analytics').then(
            (module) => module.WebAnalyticsPage,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
