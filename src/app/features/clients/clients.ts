import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideBuilding2,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCopy,
  LucideEye,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideShieldCheck,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  AdminPortalAccessResult,
  AdminPortalUser,
  ClientGroupRecord,
  ClientGroupStatus,
  ClientRecord,
  ClientStatus,
  PortalRole,
  PortalStoreCandidate,
  PortalStoreCandidatesResult,
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

interface PortalAccessForm {
  username: string;
  displayName: string;
  role: PortalRole;
}

@Component({
  selector: 'app-clients',
  imports: [
    FormsModule,
    LucideBuilding2,
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCopy,
    LucideEye,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideShieldCheck,
    LucideUsers,
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
  readonly selectedGroup = signal<ClientGroupRecord | null>(null);
  readonly groupMembers = signal<ClientRecord[]>([]);
  readonly groupMembersLoading = signal(false);
  readonly groupMembersError = signal('');
  readonly portalAccessOpen = signal(false);
  readonly portalAccessLoading = signal(false);
  readonly portalAccessSaving = signal(false);
  readonly portalAccessError = signal('');
  readonly portalCandidates = signal<PortalStoreCandidate[]>([]);
  readonly portalUsers = signal<AdminPortalUser[]>([]);
  readonly selectedPortalStoreIds = signal<Set<string>>(new Set());
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
  portalAccessStep: 1 | 2 | 3 = 1;
  portalScope: { clientId?: string; groupId?: string; label: string } = { label: '' };
  portalForm: PortalAccessForm = { username: '', displayName: '', role: 'OWNER' };
  portalEditingUserId = '';
  portalStoreSearch = '';
  portalResult: AdminPortalAccessResult | null = null;
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

  async openGroupDetails(group: ClientGroupRecord): Promise<void> {
    this.selectedGroup.set(group);
    this.groupMembers.set([]);
    this.groupMembersError.set('');
    this.groupMembersLoading.set(true);

    try {
      const firstPage = await firstValueFrom(
        this.api.get<ApiPage<ClientRecord>>('/clients', {
          groupId: group.id,
          page: 1,
          pageSize: 100,
        }),
      );
      const members = [...firstPage.items];
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const nextPage = await firstValueFrom(
          this.api.get<ApiPage<ClientRecord>>('/clients', {
            groupId: group.id,
            page,
            pageSize: 100,
          }),
        );
        members.push(...nextPage.items);
      }
      if (this.selectedGroup()?.id === group.id) this.groupMembers.set(members);
    } catch (error) {
      if (this.selectedGroup()?.id === group.id) {
        this.groupMembersError.set(apiErrorMessage(error, 'Group members could not be loaded.'));
      }
    } finally {
      if (this.selectedGroup()?.id === group.id) this.groupMembersLoading.set(false);
    }
  }

  closeGroupDetails(): void {
    this.selectedGroup.set(null);
    this.groupMembers.set([]);
    this.groupMembersError.set('');
    this.groupMembersLoading.set(false);
  }

  openClientPortalAccess(client: ClientRecord): void {
    void this.openPortalAccess({ clientId: client.id, label: client.businessName });
  }

  openGroupPortalAccess(group: ClientGroupRecord): void {
    this.closeGroupDetails();
    void this.openPortalAccess({ groupId: group.id, label: group.name });
  }

  closePortalAccess(): void {
    if (this.portalAccessSaving()) return;
    this.portalAccessOpen.set(false);
    this.portalResult = null;
  }

  selectPortalUser(user: AdminPortalUser): void {
    this.portalEditingUserId = user.id;
    this.portalForm = {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
    this.selectedPortalStoreIds.set(new Set(user.storeIds));
  }

  newPortalUser(): void {
    this.portalEditingUserId = '';
    this.portalForm = { username: '', displayName: '', role: 'OWNER' };
    this.selectedPortalStoreIds.set(
      new Set(
        this.portalCandidates()
          .filter((store) => store.eligible)
          .map((store) => store.id),
      ),
    );
  }

  portalNext(): void {
    if (this.portalAccessStep === 1 && !this.portalAccountValid) return;
    if (this.portalAccessStep === 2 && !this.selectedPortalStoreIds().size) return;
    if (this.portalAccessStep === 1) this.portalAccessStep = 2;
    else if (this.portalAccessStep === 2) this.portalAccessStep = 3;
  }

  portalBack(): void {
    if (this.portalAccessStep === 3) this.portalAccessStep = 2;
    else if (this.portalAccessStep === 2) this.portalAccessStep = 1;
  }

  togglePortalStore(store: PortalStoreCandidate, checked: boolean): void {
    if (!store.eligible) return;
    const selected = new Set(this.selectedPortalStoreIds());
    if (checked) selected.add(store.id);
    else selected.delete(store.id);
    this.selectedPortalStoreIds.set(selected);
  }

  selectAllVisiblePortalStores(): void {
    const selected = new Set(this.selectedPortalStoreIds());
    for (const store of this.visiblePortalCandidates) {
      if (store.eligible) selected.add(store.id);
    }
    this.selectedPortalStoreIds.set(selected);
  }

  clearPortalStores(): void {
    this.selectedPortalStoreIds.set(new Set());
  }

  async savePortalAccess(): Promise<void> {
    if (
      !this.portalAccountValid ||
      !this.selectedPortalStoreIds().size ||
      this.portalAccessSaving()
    ) {
      return;
    }
    this.portalAccessSaving.set(true);
    this.portalAccessError.set('');
    try {
      const body = {
        username: this.portalForm.username.trim(),
        displayName: this.portalForm.displayName.trim(),
        role: this.portalForm.role,
        storeIds: [...this.selectedPortalStoreIds()],
      };
      if (this.portalEditingUserId) {
        const user = await firstValueFrom(
          this.api.put<AdminPortalUser>(
            `/admin/portal-access/users/${this.portalEditingUserId}/access`,
            { role: body.role, storeIds: body.storeIds },
          ),
        );
        this.portalResult = { mode: 'ACCESS_UPDATED', user };
      } else {
        this.portalResult = await firstValueFrom(
          this.api.post<AdminPortalAccessResult>('/admin/portal-access/invitations', body),
        );
      }
      this.toasts.show(
        this.portalResult.mode === 'INVITATION_CREATED'
          ? 'Dashboard invitation created'
          : 'Dashboard access updated',
        'success',
      );
    } catch (error) {
      this.portalAccessError.set(apiErrorMessage(error, 'Dashboard access could not be saved.'));
    } finally {
      this.portalAccessSaving.set(false);
    }
  }

  async copyPortalActivationToken(): Promise<void> {
    if (this.portalResult?.mode !== 'INVITATION_CREATED') return;
    await navigator.clipboard.writeText(this.portalResult.invitation.activationToken);
    this.toasts.show('Activation token copied', 'success');
  }

  get visiblePortalCandidates(): PortalStoreCandidate[] {
    const query = this.portalStoreSearch.trim().toLowerCase();
    if (!query) return this.portalCandidates();
    return this.portalCandidates().filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        store.code.toLowerCase().includes(query) ||
        store.clientName.toLowerCase().includes(query),
    );
  }

  get portalAccountValid(): boolean {
    return !!this.portalForm.username.trim() && !!this.portalForm.displayName.trim();
  }

  get selectedPortalClients(): number {
    const selected = this.selectedPortalStoreIds();
    return new Set(
      this.portalCandidates()
        .filter((store) => selected.has(store.id))
        .map((store) => store.clientId),
    ).size;
  }

  private async openPortalAccess(scope: {
    clientId?: string;
    groupId?: string;
    label: string;
  }): Promise<void> {
    this.portalScope = scope;
    this.portalAccessStep = 1;
    this.portalResult = null;
    this.portalStoreSearch = '';
    this.portalCandidates.set([]);
    this.portalUsers.set([]);
    this.portalAccessError.set('');
    this.portalAccessOpen.set(true);
    this.portalAccessLoading.set(true);
    this.newPortalUser();
    try {
      const params = {
        clientId: scope.clientId,
        groupId: scope.groupId,
      };
      const result = await firstValueFrom(
        forkJoin({
          candidates: this.api.get<PortalStoreCandidatesResult>(
            '/admin/portal-access/candidates',
            params,
          ),
          users: this.api.get<AdminPortalUser[]>('/admin/portal-access/users', params),
        }),
      );
      this.portalCandidates.set(result.candidates.items);
      this.portalUsers.set(result.users);
      this.newPortalUser();
    } catch (error) {
      this.portalAccessError.set(
        apiErrorMessage(error, 'Dashboard access information could not be loaded.'),
      );
    } finally {
      this.portalAccessLoading.set(false);
    }
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
    this.closeGroupDetails();
    this.view = 'clients';
    this.groupId = group.id;
    this.page = 1;
    void this.updateWorkspaceUrl();
    void this.load();
  }

  date(value: string): string {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
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
