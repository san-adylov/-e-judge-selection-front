import type { AccessRule } from '../../auth/access-groups';

export interface NavItem {
  /** Ключ i18n. */
  label: string;
  /** Класс PrimeIcons, например `pi pi-home`. */
  icon: string;
  link: string;
  /** Кто видит пункт; без правила — все, кто видит зону. */
  access?: AccessRule;
  exact?: boolean;
}

export interface NavSection {
  /** Ключ i18n заголовка группы. */
  title?: string;
  items: NavItem[];
}
