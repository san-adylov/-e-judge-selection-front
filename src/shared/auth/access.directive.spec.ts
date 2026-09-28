import { provideHttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { fakeTokenResponse } from '../../testing/tokens';
import { AccessDirective } from './access.directive';
import type { Role } from './access-groups';
import { SessionService } from './session.service';

@Component({
  imports: [AccessDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button *appAccess="'SECRETARY'">Опубликовать</button>
    <button *appAccess="['CHAIRMAN', 'SECRETARY']; else readonly">Изменить</button>
    <ng-template #readonly><span>Только просмотр</span></ng-template>
  `,
})
class HostComponent {}

describe('AccessDirective', () => {
  beforeEach(() => localStorage.clear());

  async function renderAs(roles: Role[] | undefined): Promise<void> {
    await render(HostComponent, { providers: [provideRouter([]), provideHttpClient()] });

    if (roles) TestBed.inject(SessionService).start(fakeTokenResponse({ roles }), 'password');

    TestBed.tick();
  }

  it('shows actions of the user groups', async () => {
    await renderAs(['SECRETARY']);

    expect(screen.getByText('Опубликовать')).toBeTruthy();
    expect(screen.getByText('Изменить')).toBeTruthy();
    expect(screen.queryByText('Только просмотр')).toBeNull();
  });

  it('renders the else template without the group', async () => {
    await renderAs(['BOARD_MEMBER']);

    expect(screen.queryByText('Опубликовать')).toBeNull();
    expect(screen.queryByText('Изменить')).toBeNull();
    expect(screen.getByText('Только просмотр')).toBeTruthy();
  });

  it('hides everything from anonymous users', async () => {
    await renderAs(undefined);

    expect(screen.queryByText('Опубликовать')).toBeNull();
    expect(screen.getByText('Только просмотр')).toBeTruthy();
  });
});
