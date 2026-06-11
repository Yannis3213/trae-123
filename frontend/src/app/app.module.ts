import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { LaunchPlanListComponent } from './components/launch-plan-list/launch-plan-list.component';
import { LaunchPlanDetailComponent } from './components/launch-plan-detail/launch-plan-detail.component';
import { CreatePlanModalComponent } from './components/create-plan-modal/create-plan-modal.component';
import { BatchResultModalComponent } from './components/batch-result-modal/batch-result-modal.component';
import { RejectModalComponent } from './components/reject-modal/reject-modal.component';
import { ArchiveModalComponent } from './components/archive-modal/archive-modal.component';
import { AuditTimelineComponent } from './components/audit-timeline/audit-timeline.component';

const routes: Routes = [
  { path: '', component: LaunchPlanListComponent, pathMatch: 'full' },
  { path: 'launch-plans/:id', component: LaunchPlanDetailComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  declarations: [
    AppComponent,
    LaunchPlanListComponent,
    LaunchPlanDetailComponent,
    CreatePlanModalComponent,
    BatchResultModalComponent,
    RejectModalComponent,
    ArchiveModalComponent,
    AuditTimelineComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot(routes, { useHash: true }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
