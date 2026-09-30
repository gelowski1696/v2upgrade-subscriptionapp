import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideBuilding2,
  LucideChevronLeft,
  LucideChevronRight,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type { ApiPage, ClientRecord, ClientStatus } from '../../core/models/api.models';
import { ToastService } from '../../core/notifications/toast.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { DialogFocusDirective } from '../../shared/dialog-focus.directive';

interface ClientForm {
  code: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  status: ClientStatus;
}

@Component({
  selector: 'app-clients',
  imports: [
    FormsModule,
    LucideBuilding2,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideX,
    ConfirmDialogComponent,
    DialogFocusDirective,
  ],
  templateUrl: './clients.html',
})
export class ClientsPage implements OnInit, OnDestroy {
  readonly clients = signal<ClientRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly archiveConfirmationOpen = signal(false);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly error = signal('');
  search = '';
  status: ClientStatus | '' = '';
  page = 1;
  readonly pageSize = 20;
  editing: ClientRecord | null = null;
  form: ClientForm = this.emptyForm();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly toasts: ToastService,
    readonly session: SessionStore,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.api.get<ApiPage<ClientRecord>>('/clients', {
          page: this.page,
          pageSize: this.pageSize,
          search: this.search.trim() || undefined,
          status: this.status || undefined,
        }),
      );
      this.clients.set(result.items);
      this.total.set(result.total);
      this.totalPages.set(result.totalPages);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Clients could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  searchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      void this.load();
    }, 300);
  }

  selectStatus(status: ClientStatus | ''): void {
    this.status = status;
    this.page = 1;
    void this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page) return;
    this.page = page;
    void this.load();
  }

  openCreate(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.editorOpen.set(true);
  }

  openEdit(client: ClientRecord): void {
    this.editing = client;
    this.form = {
      code: client.code,
      businessName: client.businessName,
      ownerName: client.ownerName ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
      status: client.status,
    };
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    if (!this.saving()) this.editorOpen.set(false);
  }

  async save(archiveConfirmed = false): Promise<void> {
    if (!this.form.code.trim() || !this.form.businessName.trim()) return;
    if (
      this.editing?.status !== 'ARCHIVED' &&
      this.form.status === 'ARCHIVED' &&
      !archiveConfirmed
    ) {
      this.archiveConfirmationOpen.set(true);
      return;
    }
    this.saving.set(true);
    try {
      const optional = (value: string): string | undefined => value.trim() || undefined;
      if (this.editing) {
        await firstValueFrom(
          this.api.patch<ClientRecord>(`/clients/${this.editing.id}`, {
            businessName: this.form.businessName.trim(),
            ownerName: optional(this.form.ownerName) ?? null,
            email: optional(this.form.email) ?? null,
            phone: optional(this.form.phone) ?? null,
            address: optional(this.form.address) ?? null,
            notes: optional(this.form.notes) ?? null,
            status: this.form.status,
          }),
        );
      } else {
        await firstValueFrom(
          this.api.post<ClientRecord>('/clients', {
            code: this.form.code.trim(),
            businessName: this.form.businessName.trim(),
            ownerName: optional(this.form.ownerName),
            email: optional(this.form.email),
            phone: optional(this.form.phone),
            address: optional(this.form.address),
            notes: optional(this.form.notes),
          }),
        );
      }
      this.archiveConfirmationOpen.set(false);
      this.editorOpen.set(false);
      this.toasts.show(this.editing ? 'Client updated' : 'Client added', 'success');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Client could not be saved',
        'error',
        apiErrorMessage(error, 'Please review the client details.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  statusClass(status: ClientStatus): string {
    if (status === 'ACTIVE') return 'bg-success-100 text-success-700';
    if (status === 'INACTIVE') return 'bg-warning-100 text-warning-700';
    return 'bg-champagne-200 text-ink-600';
  }

  get canEdit(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR');
  }

  private emptyForm(): ClientForm {
    return {
      code: '',
      businessName: '',
      ownerName: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      status: 'ACTIVE',
    };
  }
}
