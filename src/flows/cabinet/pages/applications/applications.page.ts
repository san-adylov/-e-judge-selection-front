import { ChangeDetectionStrategy, Component, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LangPipe } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';

import type { Schemas } from '@domain/api/api.types';
import { ContestApplicationApi } from '@domain/api/contest-application.api';
import { SseService } from '@shared/api/sse.service';
import { PageHeaderComponent } from '@shared/ui/page/page-header.component';

import { ApplicationCardComponent } from './application-card.component';

const PAGE_SIZE = 10;

/** «Мои заявки»: все заявки кандидата страницей, новые сверху (`GET /contest-application/my`). */
@Component({
  selector: 'app-applications-page',
  imports: [RouterLink, LangPipe, Button, Paginator, Skeleton, PageHeaderComponent, ApplicationCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl">
      <app-page-header title="applications.list.title" subtitle="applications.list.subtitle">
        <p-button
          icon="pi pi-search"
          severity="secondary"
          [outlined]="true"
          [label]="'applications.list.to-contests' | lang"
          routerLink="/cabinet/contests"
        />
      </app-page-header>

      @if (loading() && !items().length) {
        <div class="flex flex-col gap-3">
          @for (row of [1, 2, 3]; track row) {
            <p-skeleton height="8rem" borderRadius="0.75rem" />
          }
        </div>
      } @else {
        <div class="flex flex-col gap-3" [class.opacity-60]="loading()">
          @for (application of items(); track application.id) {
            <app-application-card [application]="application" />
          } @empty {
            <section
              class="flex flex-col items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-8 text-center"
            >
              <i class="pi pi-inbox text-4xl text-surface-400" aria-hidden="true"></i>
              <p class="m-0 font-medium">{{ 'applications.list.empty' | lang }}</p>
              <p class="m-0 text-sm text-surface-500">{{ 'applications.list.empty-hint' | lang }}</p>
              <p-button
                icon="pi pi-arrow-right"
                [label]="'applications.list.to-contests' | lang"
                routerLink="/cabinet/contests"
              />
            </section>
          }
        </div>
      }

      @if (total() > size()) {
        <p-paginator
          class="mt-4 block"
          [rows]="size()"
          [first]="page() * size()"
          [totalRecords]="total()"
          (onPageChange)="onPage($event)"
        />
      }
    </div>
  `,
})
export default class ApplicationsPage implements OnInit {
  private readonly api = inject(ContestApplicationApi);
  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<Schemas['ApplicationResponse'][]>([]);
  protected readonly loading = signal(true);
  protected readonly page = signal(0);
  protected readonly size = signal(PAGE_SIZE);
  protected readonly total = signal(0);

  constructor() {
    // Статус заявки на текущей странице сменился — перечитываем страницу.
    this.sse
      .on('applicationStatus')
      .pipe(takeUntilDestroyed())
      .subscribe(({ applicationId }) => {
        if (this.items().some((item) => item.id === applicationId)) this.load(this.page(), this.size());
      });
  }

  ngOnInit(): void {
    this.load(0, PAGE_SIZE);
  }

  protected onPage(state: PaginatorState): void {
    const size = state.rows ?? this.size();

    this.load(Math.floor((state.first ?? 0) / size), size);
  }

  private load(page: number, size: number): void {
    this.loading.set(true);
    this.api
      .my({ page, size })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.items.set(result.content);
          this.page.set(result.page);
          this.size.set(result.size || size);
          this.total.set(result.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
