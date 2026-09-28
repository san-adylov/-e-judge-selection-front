import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LangPipe, LangService } from '@reforgium/presentia';

import type { DirectoryCode } from '@domain/api/api.types';
import { DirectoryStore } from '@domain/stores/directory.store';
import { FileLinkComponent } from '@features/files/file-link.component';
import { LocalDatePipe, ServerDateTimePipe } from '@shared/lib/format.pipes';

import { AddressDirectoryService } from './address-directory.service';
import type { ProfileResponse } from './personal-data.mapping';

interface ViewRow {
  /** Ключ `personal.field.<key>`. */
  key: string;
  value: string;
  wide?: boolean;
}

/** Просмотр личных данных: пары «подпись — значение», пустые поля — прочерком. */
@Component({
  selector: 'app-personal-data-view',
  imports: [LangPipe, ServerDateTimePipe, FileLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of groups(); track group.key) {
      <h3 class="m-0 mb-3 text-base font-semibold" [class.mt-6]="!$first">
        {{ 'personal.groups.' + group.key | lang }}
      </h3>
      <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 tablet:grid-cols-2 desktop-s:grid-cols-3">
        @for (row of group.rows; track row.key) {
          <div class="flex min-w-0 flex-col gap-0.5" [class.col-span-full]="row.wide">
            <dt class="text-sm text-surface-500">{{ 'personal.field.' + row.key | lang }}</dt>
            <dd class="m-0 break-words whitespace-pre-line">{{ row.value || '—' }}</dd>
          </div>
        }
      </dl>
    }

    <h3 class="m-0 mt-6 mb-3 text-base font-semibold">{{ 'personal.groups.extra' | lang }}</h3>
    <dl class="m-0 grid grid-cols-1 gap-3">
      <div class="flex flex-col gap-0.5">
        <dt class="text-sm text-surface-500">{{ 'personal.field.fileId' | lang }}</dt>
        <dd class="m-0">
          @if (profile().fileId; as fileId) {
            <app-file-link [fileId]="fileId" />
          } @else {
            <span class="text-red-600">{{ 'personal.completeness.no-file' | lang }}</span>
          }
        </dd>
      </div>
      <div class="flex flex-col gap-0.5">
        <dt class="text-sm text-surface-500">{{ 'personal.field.additionalInformation' | lang }}</dt>
        <dd class="m-0 break-words whitespace-pre-line">{{ profile().additionalInformation || '—' }}</dd>
      </div>
      <div class="flex flex-col gap-0.5">
        <dt class="text-sm text-surface-500">{{ 'personal.updatedAt' | lang }}</dt>
        <dd class="m-0">{{ profile().updatedAt | serverDateTime }}</dd>
      </div>
    </dl>
  `,
})
export class PersonalDataViewComponent {
  private readonly directories = inject(DirectoryStore);
  private readonly address = inject(AddressDirectoryService);
  private readonly lang = inject(LangService);

  readonly profile = input.required<ProfileResponse>();

  private readonly citizenships = this.directories.options('CITIZENSHIP');
  private readonly nationalities = this.directories.options('NATIONALITY');
  private readonly regions = this.directories.options('REGION');
  private readonly localDate = new LocalDatePipe();

  protected readonly groups = computed(() => {
    const p = this.profile();
    const option = (options: { label: string; value: number }[], id: number | undefined) =>
      options.find((item) => item.value === id)?.label ?? '';
    const label = (code: DirectoryCode, id: number | undefined) => this.address.label(code, id);

    const main: ViewRow[] = [
      { key: 'pin', value: p.pin ?? '' },
      { key: 'lastName', value: p.lastName ?? '' },
      { key: 'firstName', value: p.firstName ?? '' },
      { key: 'middleName', value: p.middleName ?? '' },
      { key: 'birthDate', value: this.localDate.transform(p.birthDate, '') },
      { key: 'gender', value: this.enumLabel('gender', p.gender) },
      { key: 'maritalStatus', value: this.enumLabel('marital', p.maritalStatus) },
      { key: 'citizenshipId', value: option(this.citizenships(), p.citizenshipId) },
      { key: 'nationalityId', value: option(this.nationalities(), p.nationalityId) },
      { key: 'preferredLanguage', value: this.enumLabel('language', p.preferredLanguage) },
      { key: 'birthPlace', value: p.birthPlace ?? '', wide: true },
    ];
    const contacts: ViewRow[] = [
      { key: 'phoneNumber', value: p.phoneNumber ?? '' },
      { key: 'additionalPhoneNumber', value: p.additionalPhoneNumber ?? '' },
      { key: 'email', value: p.email ?? '' },
      { key: 'additionalEmail', value: p.additionalEmail ?? '' },
    ];
    const address: ViewRow[] = [
      { key: 'regionId', value: option(this.regions(), p.regionId) },
      { key: 'districtId', value: label('DISTRICT', p.districtId) },
      { key: 'cityId', value: label('CITY', p.cityId) },
      { key: 'streetId', value: label('STREET', p.streetId) },
      { key: 'postalCode', value: p.postalCode ?? '' },
      { key: 'residentialAddress', value: p.residentialAddress ?? '', wide: true },
      { key: 'actualAddress', value: p.actualAddress ?? '', wide: true },
    ];

    return [
      { key: 'main', rows: main },
      { key: 'contacts', rows: contacts },
      { key: 'address', rows: address },
    ];
  });

  private enumLabel(group: string, value: string | undefined): string {
    return value ? this.lang.get(`personal.${group}.${value}`) : '';
  }
}
