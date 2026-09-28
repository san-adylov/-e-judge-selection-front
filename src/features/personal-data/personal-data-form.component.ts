import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LangPipe, LangService } from '@reforgium/presentia';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { DirectoryStore } from '@domain/stores/directory.store';
import { FileUploadComponent } from '@features/files/file-upload.component';

import { AddressDirectoryService } from './address-directory.service';
import { createPersonalDataForm } from './personal-data.form';
import {
  formToRequest,
  GENDERS,
  MARITAL_STATUSES,
  PREFERRED_LANGUAGES,
  type ProfileRequest,
  type ProfileResponse,
  profileToForm,
} from './personal-data.mapping';
import { PersonalFieldComponent } from './personal-field.component';

interface AddressIds {
  regionId: number | null;
  districtId: number | null;
  cityId: number | null;
}

/** Форма личных данных (`ProfileRequest`). Сохранение — в родителе: `create` без профиля, иначе `update`. */
@Component({
  selector: 'app-personal-data-form',
  imports: [
    ReactiveFormsModule,
    LangPipe,
    Button,
    DatePicker,
    InputText,
    Select,
    Textarea,
    FileUploadComponent,
    PersonalFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './personal-data-form.component.html',
})
export class PersonalDataFormComponent {
  private readonly directories = inject(DirectoryStore);
  private readonly address = inject(AddressDirectoryService);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  /** `null` — личных данных ещё нет (первое заполнение). */
  readonly profile = input.required<ProfileResponse | null>();
  /** ФИО из сессии для первого заполнения. */
  readonly fullName = input<string | null>(null);
  readonly saving = input(false);
  readonly cancellable = input(true);

  readonly save = output<ProfileRequest>();
  readonly cancelled = output();

  protected readonly form = createPersonalDataForm(inject(FormBuilder));
  protected readonly today = new Date();
  private readonly ids = signal<AddressIds>({ regionId: null, districtId: null, cityId: null });

  protected readonly citizenships = this.directories.options('CITIZENSHIP');
  protected readonly nationalities = this.directories.options('NATIONALITY');
  protected readonly regions = this.directories.options('REGION');
  protected readonly districts = computed(() => this.address.options('DISTRICT', this.ids().regionId));
  protected readonly cities = computed(() => this.address.options('CITY', this.ids().districtId));
  protected readonly streets = computed(() => {
    const cityId = this.ids().cityId;

    return cityId === null ? [] : this.address.options('STREET', cityId);
  });

  protected readonly genders = computed(() => this.enumOptions('gender', GENDERS));
  protected readonly maritalStatuses = computed(() => this.enumOptions('marital', MARITAL_STATUSES));
  protected readonly languages = computed(() => this.enumOptions('language', PREFERRED_LANGUAGES));

  constructor() {
    effect(() => {
      const value = profileToForm(this.profile(), this.fullName());

      untracked(() => {
        this.form.reset(value, { emitEvent: false });
        this.ids.set({ regionId: value.regionId, districtId: value.districtId, cityId: value.cityId });
      });
    });

    this.cascade();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.save.emit(formToRequest(this.form.getRawValue()));
  }

  /** Смена уровня адреса сбрасывает нижние уровни: район → город → улица. */
  private cascade(): void {
    const { regionId, districtId, cityId, streetId } = this.form.controls;
    const reset = (...controls: (typeof regionId)[]) => controls.forEach((control) => control.setValue(null));

    regionId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.ids.update((ids) => ({ ...ids, regionId: value }));
      reset(districtId, cityId, streetId);
    });
    districtId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.ids.update((ids) => ({ ...ids, districtId: value }));
      reset(cityId, streetId);
    });
    cityId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.ids.update((ids) => ({ ...ids, cityId: value }));
      reset(streetId);
    });
  }

  private enumOptions<T extends string>(group: string, values: readonly T[]): { label: string; value: T }[] {
    this.lang.currentLang();

    return values.map((value) => ({ label: this.lang.get(`personal.${group}.${value}`), value }));
  }
}
