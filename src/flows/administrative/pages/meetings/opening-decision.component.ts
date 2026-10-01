import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { catchError, of } from 'rxjs';

import type { Schemas } from '@domain/api/api.types';
import { DocumentsApi } from '@domain/api/documents.api';
import { VotesApi } from '@domain/api/votes.api';
import { saveBlob } from '@shared/lib/download';
import { NotifyService } from '@shared/ui/notify.service';

import { agendaSubjectId, type Meeting } from './meeting-rules';

type OpeningDocument = Extract<Schemas['GenerateDocumentRequest']['type'], 'ADMISSION' | 'NON_ADMISSION'>;
type Summary = Schemas['VoteSummaryResponse'];
type StoredFile = Schemas['StoredFileRef'];

const TEXT_MAX = 8000;

/**
 * Решение заседания об открытии конкурса (`OPEN_COMPETITION`): секретарь пишет тексты, файл формирует
 * `POST /documents/generate` — `ADMISSION` при одобрении, `NON_ADMISSION` при отказе
 * (`DecisionParameters`: preSolution/solutions либо summaryText/found/summaryOfTheDecision).
 * Состав Совета подставляется из участников заседания. Доступно после голосования всех участников.
 */
@Component({
  selector: 'app-opening-decision',
  imports: [FormsModule, LangPipe, Button, Message, SelectButton, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opening-decision.component.html',
})
export class OpeningDecisionComponent {
  private readonly documents = inject(DocumentsApi);
  private readonly votes = inject(VotesApi);
  private readonly notify = inject(NotifyService);
  private readonly lang = inject(LangService);

  readonly meeting = input.required<Meeting>();
  /** Счётчик перезагрузки от родителя (события SSE). */
  readonly version = input(0);

  protected readonly textMax = TEXT_MAX;
  protected readonly summary = signal<Summary | null>(null);
  protected readonly type = signal<OpeningDocument>('ADMISSION');
  protected readonly typeTouched = signal(false);
  protected readonly preSolution = signal('');
  protected readonly solutions = signal('');
  protected readonly summaryText = signal('');
  protected readonly found = signal('');
  protected readonly summaryOfTheDecision = signal('');
  protected readonly generating = signal(false);
  protected readonly downloading = signal<number | null>(null);
  protected readonly files = signal<StoredFile[]>([]);

  protected readonly typeOptions = computed(() => {
    this.lang.currentLang();

    return (['ADMISSION', 'NON_ADMISSION'] as const).map((value) => ({
      value,
      label: this.lang.get(`staff-decisions.document.${value}`),
    }));
  });
  protected readonly allVoted = computed(() => this.summary()?.allVoted === true);
  protected readonly chairmanName = computed(
    () =>
      this.meeting()
        .participants?.find((participant) => participant.chairman)
        ?.fullName?.trim() ?? '',
  );
  protected readonly boardMembers = computed(() =>
    (this.meeting().participants ?? [])
      .filter((participant) => !participant.chairman)
      .map((participant) => participant.fullName?.trim())
      .filter((name): name is string => !!name),
  );
  protected readonly canGenerate = computed(() => {
    if (!this.allVoted() || this.generating()) return false;

    return this.type() === 'ADMISSION'
      ? !!this.preSolution().trim() && !!this.solutions().trim()
      : !!this.summaryText().trim() && !!this.found().trim() && !!this.summaryOfTheDecision().trim();
  });

  constructor() {
    effect(() => {
      const meeting = this.meeting();

      this.version();
      untracked(() => this.loadSummary(meeting));
    });
  }

  protected setType(type: OpeningDocument): void {
    this.type.set(type);
    this.typeTouched.set(true);
  }

  protected generate(): void {
    if (!this.canGenerate()) return;

    this.generating.set(true);
    this.documents.generate({ type: this.type(), model: this.model() }).subscribe({
      next: (file) => {
        this.generating.set(false);
        this.files.update((files) => [file, ...files]);
        this.notify.success(this.lang.get('staff-meetings.opening.generated'));
      },
      error: () => this.generating.set(false),
    });
  }

  protected download(file: StoredFile): void {
    if (file.id === undefined) return;

    this.downloading.set(file.id);
    this.documents.download(file.id).subscribe({
      next: (response) => {
        this.downloading.set(null);
        saveBlob(response, file.fileName || `decision-${file.id}.pdf`);
      },
      error: () => this.downloading.set(null),
    });
  }

  /** Ключи модели — бизнес-имена `DocumentModel` и `DecisionParameters`; пустые поля не отправляются. */
  private model(): Record<string, unknown> {
    const model: Record<string, unknown> = {
      contestName: this.meeting().title,
      chairmanName: this.chairmanName() || undefined,
      boardMembers: this.boardMembers().join('\n') || undefined,
    };

    if (this.type() === 'ADMISSION') {
      model['preSolution'] = this.preSolution().trim();
      model['solutions'] = this.solutions().trim();
    } else {
      model['summaryText'] = this.summaryText().trim();
      model['found'] = this.found().trim();
      model['summaryOfTheDecision'] = this.summaryOfTheDecision().trim();
    }

    return Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined && value !== ''));
  }

  private loadSummary(meeting: Meeting): void {
    const subjectId = agendaSubjectId(meeting);

    if (meeting.id === undefined || subjectId === null) {
      this.summary.set(null);

      return;
    }

    this.votes
      .summary(meeting.id, subjectId)
      .pipe(catchError(() => of<Summary | null>(null)))
      .subscribe((summary) => {
        this.summary.set(summary);

        // Тип документа по итогу голосования, пока секретарь не выбрал его сам.
        if (summary?.allVoted && !this.typeTouched()) this.type.set(summary.approved ? 'ADMISSION' : 'NON_ADMISSION');
      });
  }
}
