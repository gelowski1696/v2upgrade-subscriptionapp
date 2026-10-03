import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/auth/session.store';
import type { ApiPage, ClientGroupRecord, ClientRecord } from '../../core/models/api.models';
import type { ToastService } from '../../core/notifications/toast.service';
import { ClientsPage } from './clients';

describe('ClientsPage group details', () => {
  it('loads and exposes all members for the selected group', async () => {
    const group = groupRecord();
    const member = clientRecord(group);
    const response: ApiPage<ClientRecord> = {
      items: [member],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    };
    const api = { get: vi.fn().mockReturnValue(of(response)) };
    const page = createPage(api as unknown as ApiService);

    await page.openGroupDetails(group);

    expect(api.get).toHaveBeenCalledWith('/clients', {
      groupId: group.id,
      page: 1,
      pageSize: 100,
    });
    expect(page.selectedGroup()).toEqual(group);
    expect(page.groupMembers()).toEqual([member]);
    expect(page.groupMembersLoading()).toBe(false);
  });

  it('clears the selected group and members when the inspector closes', () => {
    const group = groupRecord();
    const page = createPage({} as ApiService);
    page.selectedGroup.set(group);
    page.groupMembers.set([clientRecord(group)]);

    page.closeGroupDetails();

    expect(page.selectedGroup()).toBeNull();
    expect(page.groupMembers()).toEqual([]);
  });
});

function createPage(api: ApiService): ClientsPage {
  const queryParamMap = { get: vi.fn().mockReturnValue(null) };
  return new ClientsPage(
    api,
    { show: vi.fn() } as unknown as ToastService,
    new SessionStore(),
    { snapshot: { queryParamMap } } as never,
    { navigate: vi.fn().mockResolvedValue(true) } as never,
  );
}

function groupRecord(): ClientGroupRecord {
  return {
    id: 'group-1',
    code: 'IGNO',
    name: 'IGNO Clients',
    description: 'Imported clients',
    status: 'ACTIVE',
    clientCount: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
  };
}

function clientRecord(group: ClientGroupRecord): ClientRecord {
  return {
    id: 'client-1',
    code: 'IGNO-0001',
    businessName: 'RFI LPG STORE',
    ownerName: 'ROCHELLE IGNO',
    email: null,
    phone: null,
    address: null,
    notes: null,
    status: 'ACTIVE',
    groupId: group.id,
    group: {
      id: group.id,
      code: group.code,
      name: group.name,
      status: group.status,
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}
