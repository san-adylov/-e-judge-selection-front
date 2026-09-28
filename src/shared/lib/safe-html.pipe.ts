import { Pipe, type PipeTransform } from '@angular/core';
import DOMPurify from 'dompurify';

/**
 * HTML из TinyMCE и с бэкенда — только через этот pipe: `<div [innerHTML]="html | safeHtml"></div>`.
 * DOMPurify чистит разметку, Angular дополнительно санитизирует `innerHTML`.
 * `bypassSecurityTrustHtml` в проекте не используется.
 */
@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  transform(html: string | null | undefined): string {
    return html ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : '';
  }
}
