import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideBuilding2,
  LucideChevronLeft,
  LucideChevronRight,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  ClientGroupRecord,
  ClientGroupStatus,
  ClientRecord,
  ClientStatus,
} from '../../core/models/api.models';
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
  groupId: string;
}

interface ClientGroupForm {
  code: string;
  name: string;
  description: string;
  status: ClientGroupStatus;
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
  readonly groups = signal<ClientGroupRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly archiveConfirmationOpen = signal(false);
  readonly groupManagerOpen = signal(false);
  readonly selectedClientIds = signal<Set<string>>(new Set());
  readonly total = signal(0);
  readonly groupTotal = signal(0);
  readonly totalPages = signal(1);
  readonly error = signal('');
  search = '';
  status: ClientStatus | '' = '';
  groupId = '';
  view: 'clients' | 'groups' = 'clients';
  groupSearch = '';
  groupStatus: ClientGroupStatus | '' = '';
  bulkGroupId = '';
  page = 1;
  readonly pageSize = 20;
  editing: ClientRecord | null = null;
  form: ClientForm = this.emptyForm();
  groupEditing: ClientGroupRecord | null = null;
  groupForm: ClientGroupForm = this.emptyGroupForm();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly toasts: ToastService,
    readonly session: SessionStore,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.view = this.route.snapshot.queryParamMap.get('view') === 'groups' ? 'groups' : 'clients';
    this.groupId = this.route.snapshot.queryParamMap.get('groupId') ?? '';
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
        forkJoin({
          clients: this.api.get<ApiPage<ClientRecord>>('/clients', {
            page: this.page,
            pageSize: this.pageSize,
            search: this.search.trim() || undefined,
            status: this.status || undefined,
            groupId: this.groupId || undefined,
          }),
          groups: this.api.get<ApiPage<ClientGroupRecord>>('/client-groups', {
            page: 1,
            pageSize: 100,
          }),
        }),
      );
      this.clients.set(result.clients.items);
      this.groups.set(result.groups.items);
      this.groupTotal.set(result.groups.total);
      this.total.set(result.clients.total);
      this.totalPages.set(result.clients.totalPages);
      this.selectedClientIds.set(new Set());
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

  selectGroup(groupId: string): void {
    this.groupId = groupId;
    this.page = 1;
    void this.updateWorkspaceUrl();
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
      groupId: client.groupId ?? '',
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
            groupId: this.form.groupId || null,
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
            groupId: this.form.groupId || undefined,
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

  toggleClient(clientId: string, checked: boolean): void {
    const selected = new Set(this.selectedClientIds());
    if (checked) selected.add(clientId);
    else selected.delete(clientId);
    this.selectedClientIds.set(selected);
  }

  async assignSelectedGroup(): Promise<void> {
    const clientIds = [...this.selectedClientIds()];
    if (!clientIds.length || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.post('/clients/bulk-group', {
          clientIds,
          groupId: this.bulkGroupId || null,
        }),
      );
      this.toasts.show(
        `${clientIds.length} client${clientIds.length === 1 ? '' : 's'} updated`,
        'success',
      );
      this.selectedClientIds.set(new Set());
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Client group could not be assigned',
        'error',
        apiErrorMessage(error, 'Try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  openGroupManager(): void {
    this.setView('groups');
    this.groupManagerOpen.set(false);
  }

  setView(view: 'clients' | 'groups'): void {
    this.view = view;
    void this.updateWorkspaceUrl();
  }

  openGroupCreate(): void {
    this.groupEditing = null;
    this.groupForm = this.emptyGroupForm();
    this.groupManagerOpen.set(true);
  }

  editGroup(group: ClientGroupRecord): void {
    this.groupEditing = group;
    this.groupForm = {
      code: group.code,
      name: group.name,
      description: group.description ?? '',
      status: group.status,
    };
    this.groupManagerOpen.set(true);
  }

  resetGroupForm(): void {
    this.groupEditing = null;
    this.groupForm = this.emptyGroupForm();
  }

  async saveGroup(): Promise<void> {
    if (!this.groupForm.code.trim() || !this.groupForm.name.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.groupEditing) {
        await firstValueFrom(
          this.api.patch(`/client-groups/${this.groupEditing.id}`, {
            name: this.groupForm.name.trim(),
            description: this.groupForm.description.trim() || null,
            status: this.groupForm.status,
          }),
        );
      } else {
        await firstValueFrom(
          this.api.post('/client-groups', {
            code: this.groupForm.code.trim(),
            name: this.groupForm.name.trim(),
            description: this.groupForm.description.trim() || undefined,
          }),
        );
      }
      this.toasts.show(this.groupEditing ? 'Group updated' : 'Group created', 'success');
      this.resetGroupForm();
      this.groupManagerOpen.set(false);
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Client group could not be saved',
        'error',
        apiErrorMessage(error, 'Review the group details.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  get canEdit(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR');
  }

  get canManageGroups(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN');
  }

  get visibleGroups(): ClientGroupRecord[] {
    const query = this.groupSearch.trim().toLowerCase();
    return this.groups().filter(
      (group) =>
        (!this.groupStatus || group.status === this.groupStatus) &&
        (!query ||
          group.name.toLowerCase().includes(query) ||
          group.code.toLowerCase().includes(query) ||
          group.description?.toLowerCase().includes(query)),
    );
  }

  showGroupClients(group: ClientGroupRecord): void {
    this.view = 'clients';
    this.groupId = group.id;
    this.page = 1;
    void this.updateWorkspaceUrl();
    void this.load();
  }

  private updateWorkspaceUrl(): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: this.view === 'groups' ? 'groups' : null,
        groupId: this.view === 'clients' && this.groupId ? this.groupId : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
      groupId: '',
    };
  }

  private emptyGroupForm(): ClientGroupForm {
    return {
      code: '',
      name: '',
      description: '',
      status: 'ACTIVE',
    };
  }
}
