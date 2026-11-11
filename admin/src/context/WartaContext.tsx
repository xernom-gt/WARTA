import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ActiveScreen,
  CitizenClaim,
  CitizenReport,
  MapCondition,
  ProjectPackage,
  ReportStatus,
  UserRole,
  VerificationItem,
  VoteChoice,
  VoteRecord,
} from '../types/warta';
import {
  INITIAL_MY_CLAIMS,
  INITIAL_MY_REPORTS,
  INITIAL_VERIFICATION_QUEUE,
  INITIAL_VOTE_HISTORY,
  WARTA_PROJECTS,
  PROJECT_ID_MAP,
} from '../data/wartaData';
import { authService, type UserPrivate } from '../services/auth';

interface WartaState {
  currentUser: string | null;
  authUser: UserPrivate | null;
  role: UserRole;
  isAuthChecking: boolean;
  mapCondition: MapCondition;
  activeScreen: ActiveScreen;
  selectedProjectId: string | null;
  editingProjectId: string | null;
  isCreateProjectOpen: boolean;
  compactRupiah: boolean;
  projects: ProjectPackage[];
  queue: VerificationItem[];
  myReports: CitizenReport[];
  myClaims: CitizenClaim[];
  voteHistory: VoteRecord[];
  loginOpen: boolean;
}

interface WartaContextValue extends WartaState {
  setRole: (r: UserRole) => void;
  setMapCondition: (c: MapCondition) => void;
  navigate: (s: ActiveScreen, projectId?: string) => void;
  selectProject: (id: string | null) => void;
  setEditingProjectId: (id: string | null) => void;
  setIsCreateProjectOpen: (open: boolean) => void;
  toggleRupiah: () => void;
  login: (displayName: string, userObj?: UserPrivate) => void;
  logout: () => void;
  setLoginOpen: (o: boolean) => void;
  vote: (itemId: string, choice: VoteChoice) => void;
  canVote: (item: VerificationItem) => { allowed: boolean; reason?: string };
  addReport: (r: CitizenReport, item?: VerificationItem) => void;
  addClaim: (c: CitizenClaim, item: VerificationItem) => void;
  reset: () => void;
  setQueue: (items: VerificationItem[] | ((prev: VerificationItem[]) => VerificationItem[])) => void;
  recordVote: (record: VoteRecord, updatedItem?: VerificationItem) => void;
  // Fitur Utama Admin:
  updateProject: (id: string, partial: Partial<ProjectPackage>) => void;
  addProject: (newProj: ProjectPackage) => void;
  deleteProject: (id: string) => void;
  updateReportStatus: (itemId: string, status: ReportStatus, adminNote?: string) => void;
}

const STORAGE_KEY_PROJECTS = 'warta_admin_projects_v6';
const STORAGE_KEY_QUEUE = 'warta_admin_queue_v6';
const STORAGE_KEY_SCREEN = 'warta_admin_screen_v6';

const loadPersistedProjects = (): ProjectPackage[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS) || localStorage.getItem('warta_admin_projects_v5');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalize legacy proj-* IDs to canonical UUIDs
        const normalized: ProjectPackage[] = parsed.map((p: ProjectPackage) => {
          const canonicalId = PROJECT_ID_MAP[p.id] || p.id;
          return canonicalId !== p.id ? { ...p, id: canonicalId } : p;
        });

        const merged: ProjectPackage[] = [];

        // 1. Custom projects created by admin (IDs not matching any canonical project)
        const customProjects = normalized.filter(
          (p: ProjectPackage) => !WARTA_PROJECTS.some((wp) => wp.id === p.id),
        );
        merged.push(...customProjects);

        // 2. 10 Canonical DKI Jakarta Projects (with admin edits applied)
        for (const wp of WARTA_PROJECTS) {
          const edited = normalized.find((p: ProjectPackage) => p.id === wp.id);
          merged.push(edited ? { ...wp, ...edited } : structuredClone(wp));
        }

        // Clean up legacy v5 key and persist v6
        localStorage.removeItem('warta_admin_projects_v5');
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(merged));

        return merged;
      }
    }
  } catch {
    // Ignore storage issues
  }
  return structuredClone(WARTA_PROJECTS);
};

const loadPersistedQueue = (): VerificationItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Abaikan
  }
  return structuredClone(INITIAL_VERIFICATION_QUEUE);
};

const loadPersistedScreen = (): ActiveScreen => {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY_SCREEN) as ActiveScreen | null;
    if (s && ['dashboard', 'aduan', 'proyek', 'peta', 'detail', 'verifikasi'].includes(s)) {
      return s;
    }
  } catch {
    // Abaikan
  }
  return 'dashboard';
};

const initialState = (): WartaState => ({
  currentUser: null,
  authUser: null,
  role: 'guest',
  isAuthChecking: Boolean(typeof window !== 'undefined' && localStorage.getItem('token')),
  mapCondition: 'normal',
  activeScreen: loadPersistedScreen(),
  selectedProjectId: null,
  editingProjectId: null,
  isCreateProjectOpen: false,
  compactRupiah: true,
  projects: loadPersistedProjects(),
  queue: loadPersistedQueue(),
  myReports: structuredClone(INITIAL_MY_REPORTS),
  myClaims: structuredClone(INITIAL_MY_CLAIMS),
  voteHistory: structuredClone(INITIAL_VOTE_HISTORY),
  loginOpen: false,
});

const WartaContext = createContext<WartaContextValue | null>(null);

export const OWNER_WARNING =
  'Anda adalah pemilik laporan ini. Warga tidak dapat memverifikasi laporan atau klaim miliknya sendiri.';

export function WartaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WartaState>(initialState);

  const patch = useCallback((p: Partial<WartaState>) => setState((s) => ({ ...s, ...p })), []);

  // Simpan projects ke localStorage saat ada perubahan
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(state.projects));
    } catch {
      // Abaikan quota
    }
  }, [state.projects]);

  // Simpan queue ke localStorage saat ada perubahan
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(state.queue));
    } catch {
      // Abaikan quota
    }
  }, [state.queue]);

  // Simpan screen ke sessionStorage agar saat refresh tidak mental
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_SCREEN, state.activeScreen);
    } catch {
      // Abaikan
    }
  }, [state.activeScreen]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState((s) => ({ ...s, isAuthChecking: false }));
      return;
    }
    if (token === 'demo-admin-token') {
      setState((s) => ({
        ...s,
        currentUser: 'Admin Pengelola (Dinas PUPR)',
        authUser: {
          id: 'a0000000-0000-0000-0000-000000000001',
          display_name: 'Admin Pengelola (Dinas PUPR)',
          email: 'admin@dinas.pupr.go.id',
          role: 'admin',
          email_verified_at: new Date().toISOString(),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        role: 'other',
        isAuthChecking: false,
      }));
      return;
    }
    authService
      .getMe()
      .then((user) => {
        // Jika akun warga mencoba buka portal admin, tolak sesi
        if (user.role && user.role !== 'admin') {
          localStorage.removeItem('token');
          setState((s) => ({
            ...s,
            currentUser: null,
            authUser: null,
            role: 'guest',
            isAuthChecking: false,
          }));
          return;
        }
        setState((s) => ({
          ...s,
          currentUser: user.display_name,
          authUser: user,
          role: 'other',
          isAuthChecking: false,
        }));
      })
      .catch(() => {
        localStorage.removeItem('token');
        setState((s) => ({
          ...s,
          currentUser: null,
          authUser: null,
          role: 'guest',
          isAuthChecking: false,
        }));
      });
  }, []);

  const canVote = useCallback(
    (item: VerificationItem): { allowed: boolean; reason?: string } => {
      const user = state.currentUser;
      if (!user) return { allowed: false, reason: 'Masuk untuk mencatat suara.' };
      if (item.authorDisplayName === user) return { allowed: false, reason: OWNER_WARNING };
      if (item.voters.includes(user)) return { allowed: false, reason: 'Anda sudah mencatat suara untuk aduan ini.' };
      if (item.status === 'terverifikasi' || item.status === 'diterima' || item.status === 'ditolak') {
        return { allowed: false, reason: 'Aduan ini sudah mencapai keputusan final.' };
      }
      return { allowed: true };
    },
    [state.currentUser],
  );

  const vote = useCallback(
    (itemId: string, choice: VoteChoice) => {
      setState((s) => {
        const user = s.currentUser ?? 'Admin';
        const target = s.queue.find((it) => it.id === itemId);
        if (!target) return s;
        const votesAgree = target.votesAgree + (choice === 'setuju' ? 1 : 0);
        const votesDisagree = target.votesDisagree + (choice === 'tidak_setuju' ? 1 : 0);
        let status: VerificationItem['status'] = target.status;
        if (votesAgree >= target.targetVotes) {
          status = target.itemType === 'klaim_lokasi' ? 'diterima' : 'terverifikasi';
        } else if (votesDisagree >= target.targetVotes) {
          status = 'ditolak';
        }
        const updatedItem: VerificationItem = {
          ...target,
          votesAgree,
          votesDisagree,
          status,
          voters: [...target.voters, user],
        };
        const record: VoteRecord = {
          itemId,
          projectId: target.projectId,
          projectTitle: target.projectTitle,
          itemType: target.itemType,
          authorDisplayName: target.authorDisplayName,
          choice,
          votedAt: 'Baru saja',
        };
        return {
          ...s,
          queue: s.queue.map((it) => (it.id === itemId ? updatedItem : it)),
          voteHistory: [record, ...s.voteHistory],
        };
      });
    },
    [],
  );

  const setQueue = useCallback((items: VerificationItem[] | ((prev: VerificationItem[]) => VerificationItem[])) => {
    setState((s) => ({
      ...s,
      queue: typeof items === 'function' ? items(s.queue) : items,
    }));
  }, []);

  const recordVote = useCallback((record: VoteRecord, updatedItem?: VerificationItem) => {
    setState((s) => ({
      ...s,
      queue: updatedItem ? s.queue.map((it) => (it.id === updatedItem.id ? updatedItem : it)) : s.queue,
      voteHistory: [record, ...s.voteHistory],
    }));
  }, []);

  // Mutasi Proyek Admin
  const updateProject = useCallback((id: string, partial: Partial<ProjectPackage>) => {
    setState((s) => {
      const exists = s.projects.some((p) => p.id === id);
      if (exists) {
        return {
          ...s,
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...partial } : p)),
        };
      }
      // Jika belum ada di state.projects (misal fallback dari WARTA_PROJECTS)
      const base = WARTA_PROJECTS.find((p) => p.id === id);
      if (base) {
        return {
          ...s,
          projects: [...s.projects, { ...base, ...partial }],
        };
      }
      return s;
    });
  }, []);

  const addProject = useCallback((newProj: ProjectPackage) => {
    setState((s) => ({
      ...s,
      projects: [newProj, ...s.projects],
    }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      projects: s.projects.filter((p) => p.id !== id),
      selectedProjectId: s.selectedProjectId === id ? null : s.selectedProjectId,
    }));
  }, []);

  // Mutasi Status Aduan Admin (Menunggu -> Diproses -> Selesai -> Ditolak)
  const updateReportStatus = useCallback((itemId: string, status: ReportStatus, adminNote?: string) => {
    setState((s) => ({
      ...s,
      queue: s.queue.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status,
              ...(adminNote !== undefined ? { adminNote } : {}),
            }
          : item,
      ),
    }));
  }, []);

  const value = useMemo<WartaContextValue>(
    () => ({
      ...state,
      setRole: (role) =>
        patch({
          role,
          currentUser: role === 'guest' ? null : state.currentUser ?? 'Admin Pengelola (Dinas PUPR)',
        }),
      setMapCondition: (mapCondition) => patch({ mapCondition }),
      navigate: (activeScreen, projectId) => {
        try {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        } catch {
          // Abaikan
        }
        patch({ activeScreen, ...(projectId ? { selectedProjectId: projectId } : {}) });
      },
      selectProject: (selectedProjectId) => patch({ selectedProjectId }),
      setEditingProjectId: (editingProjectId) => patch({ editingProjectId }),
      setIsCreateProjectOpen: (isCreateProjectOpen) => patch({ isCreateProjectOpen }),
      toggleRupiah: () => setState((s) => ({ ...s, compactRupiah: !s.compactRupiah })),
      login: (currentUser, userObj) =>
        patch({
          currentUser,
          authUser: userObj ?? null,
          role: 'other',
          loginOpen: false,
          isAuthChecking: false,
        }),
      logout: () => {
        authService.logout().catch(() => {});
        patch({ currentUser: null, authUser: null, role: 'guest', isAuthChecking: false });
      },
      setLoginOpen: (loginOpen) => patch({ loginOpen }),
      vote,
      canVote,
      addReport: (r, item) =>
        setState((s) => ({
          ...s,
          myReports: [r, ...s.myReports],
          queue: item ? [item, ...s.queue] : s.queue,
        })),
      addClaim: (c, item) =>
        setState((s) => ({ ...s, myClaims: [c, ...s.myClaims], queue: [item, ...s.queue] })),
      reset: () => {
        localStorage.removeItem(STORAGE_KEY_PROJECTS);
        localStorage.removeItem(STORAGE_KEY_QUEUE);
        sessionStorage.removeItem(STORAGE_KEY_SCREEN);
        setState(initialState());
      },
      setQueue,
      recordVote,
      updateProject,
      addProject,
      deleteProject,
      updateReportStatus,
    }),
    [state, patch, vote, canVote, setQueue, recordVote, updateProject, addProject, deleteProject, updateReportStatus],
  );

  return <WartaContext.Provider value={value}>{children}</WartaContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWarta(): WartaContextValue {
  const ctx = useContext(WartaContext);
  if (!ctx) throw new Error('useWarta harus dipakai di dalam <WartaProvider>');
  return ctx;
}
