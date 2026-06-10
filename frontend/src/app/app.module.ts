import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { LayoutComponent } from './components/layout/layout.component';
import { RegistrationComponent } from './components/registration/registration.component';
import { VerificationComponent } from './components/verification/verification.component';
import { ReviewComponent } from './components/review/review.component';
import { WarningComponent } from './components/warning/warning.component';
import { LedgerComponent } from './components/ledger/ledger.component';
import { WorkorderListComponent } from './components/workorder-list/workorder-list.component';
import { WorkorderDetailComponent } from './components/workorder-detail/workorder-detail.component';

import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'registration', pathMatch: 'full' },
      { path: 'registration', component: RegistrationComponent },
      { path: 'verification', component: VerificationComponent },
      { path: 'review', component: ReviewComponent },
      { path: 'warning', component: WarningComponent },
      { path: 'ledger', component: LedgerComponent },
      { path: 'workorder/:id', component: WorkorderDetailComponent },
    ]
  },
  { path: '**', redirectTo: 'registration' }
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    LayoutComponent,
    RegistrationComponent,
    VerificationComponent,
    ReviewComponent,
    WarningComponent,
    LedgerComponent,
    WorkorderListComponent,
    WorkorderDetailComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
