import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ActiveScreen,
  CitizenClaim,
  CitizenReport,
  EvidenceItem,
  MapCondition,
  UserProfile,
  UserRole,
  VerificationItem,
  VoteChoice,
  VoteRecord,
} from '../types/warta';
import {
  CURRENT_USER,
  SAMPLE_DATA,
  INITIAL_MY_CLAIMS,
  INITIAL_MY_REPORTS,
  INITIAL_VERIFICATION_QUEUE,
  INITIAL_VOTE_HISTORY,
} from '../data/wartaData';
import { authService } from '../services/auth';

interface WartaState {
  currentUser: string | null;
  userProfile: UserProfile | null;
  role: UserRole;
  mapCondition: MapCondition;
  activeScreen: ActiveScreen;
  selectedProjectId: string | null;
  selectedReportId: string | null;
  editingDraftId: string | null;
  compactRupiah: boolean;
  queue: VerificationItem[];
  myReports: CitizenReport[];
  myClaims: CitizenClaim[];
  voteHistory: VoteRecord[];
  loginOpen: boolean;
}

interface WartaContextValue extends WartaState {
  setRole: (r: UserRole) => void;
  setMapCondition: (c: MapCondition) => void;
  navigate: (s: ActiveScreen, projectId?: string, reportId?: string) => void;
  selectProject: (id: string | null) => void;
  selectReport: (id: string | null) => void;
  startEditDraft: (reportId: string) => void;
  clearEditDraft: () => void;
  toggleRupiah: () => void;
  login: (email: string, password?: string) => Promise<void>;
  register: (displayName: string, email: string, password?: string) => Promise<void>;
  updateDisplayName: (displayName: string) => void;
  verifyCurrentEmail: () => void;
  logout: () => Promise<void>;
  setLoginOpen: (o: boolean) => void;
  vote: (itemId: string, choice: VoteChoice) => void;
  canVote: (item: VerificationItem) => { allowed: boolean; reason?: string };
  addReport: (r: CitizenReport, item?: VerificationItem) => void;
  updateDraftReport: (reportId: string, updated: Partial<CitizenReport>, submittedItem?: VerificationItem) => void;
  deleteReport: (reportId: string) => void;
  addClaim: (c: CitizenClaim, item: VerificationItem) => void;
  addEvidence: (itemId: string, description: string, photoUrl?: string) => void;
  deleteEvidence: (itemId: string, evidenceId: string) => void;
  reset: () => void;
}

const defaultProfile = (displayName: string, email = 'warga.kebonjeruk@contoh.id', emailVerified = true): UserProfile => ({
  id: 'usr-01',
  displayName,
  email,
  emailVerified,
  isActive: true,
  createdAt: 'Januari 2025',
});

const VALID_SCREENS: ReadonlySet<ActiveScreen> = new Set([
  'peta',
  'aduan',
  'detail',
  'lapor',
  'verifikasi',
  'klaim',
  'profil',
]);

function parseHashLocation(): { screen: ActiveScreen; projectId: string | null; reportId: string | null } {
  if (typeof window === 'undefined') return { screen: 'aduan', projectId: null, reportId: null };
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  if (!raw) return { screen: 'aduan', projectId: null, reportId: null };

  const [pathPart, queryPart] = raw.split('?');
  const candidateScreen = pathPart.split('/')[0] as ActiveScreen;
  const screen = VALID_SCREENS.has(candidateScreen) ? candidateScreen : 'aduan';

  let projectId: string | null = null;
  let reportId: string | null = null;

  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    const p = params.get('project') || params.get('projectId');
    const r = params.get('report') || params.get('reportId');
    if (p) projectId = p;
    if (r) reportId = r;
  }

  return { screen, projectId, reportId };
}

function buildHash(screen: ActiveScreen, projectId?: string | null, reportId?: string | null): string {
  let hash = `#${screen}`;
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  if (reportId) params.set('report', reportId);
  const qs = params.toString();
  return qs ? `${hash}?${qs}` : hash;
}

function getSavedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user_profile');
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

const initialState = (): WartaState => {
  const loc = parseHashLocation();
  const savedProfile = getSavedProfile();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const profile = token ? savedProfile : null;
  const user = profile?.displayName ?? (SAMPLE_DATA ? CURRENT_USER : null);

  return {
    currentUser: user,
    userProfile: profile ?? (SAMPLE_DATA && user ? defaultProfile(user) : null),
    role: user ? 'other' : 'guest',
    mapCondition: 'normal',
    activeScreen: loc.screen,
    selectedProjectId: loc.projectId,
    selectedReportId: loc.reportId,
    editingDraftId: null,
    compactRupiah: true,
    queue: SAMPLE_DATA ? structuredClone(INITIAL_VERIFICATION_QUEUE) : [],
    myReports: SAMPLE_DATA ? structuredClone(INITIAL_MY_REPORTS) : [],
    myClaims: SAMPLE_DATA ? structuredClone(INITIAL_MY_CLAIMS) : [],
    voteHistory: SAMPLE_DATA ? structuredClone(INITIAL_VOTE_HISTORY) : [],
    loginOpen: false,
  };
};

const WartaContext = createContext<WartaContextValue | null>(null);

export const OWNER_WARNING =
  'Anda adalah pemilik laporan ini. Warga tidak dapat memverifikasi laporan atau klaim miliknya sendiri.';

export function WartaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WartaState>(initialState);

  const patch = useCallback((p: Partial<WartaState>) => setState((s) => ({ ...s, ...p })), []);

  // Restore authenticated session from localStorage JWT
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    authService
      .getMe()
      .then((user) => {
        const profile: UserProfile = {
          id: user.id,
          displayName: user.display_name,
          email: user.email,
          emailVerified: Boolean(user.email_verified_at),
          isActive: user.is_active,
          createdAt: user.created_at,
        };
        try {
          localStorage.setItem('user_profile', JSON.stringify(profile));
        } catch {
          // ignore storage error
        }
        setState((s) => ({
          ...s,
          currentUser: user.display_name,
          userProfile: profile,
          role: 'other',
        }));
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_profile');
        setState((s) => ({
          ...s,
          currentUser: null,
          userProfile: null,
          role: 'guest',
        }));
      });
  }, []);

  // Sync activeScreen with browser URL hash (Back/Forward/Ctrl+R support)
  useEffect(() => {
    const onHashChange = () => {
      const loc = parseHashLocation();
      setState((s) => {
        if (
          s.activeScreen === loc.screen &&
          (loc.projectId === null || s.selectedProjectId === loc.projectId) &&
          (loc.reportId === null || s.selectedReportId === loc.reportId)
        ) {
          return s;
        }
        return {
          ...s,
          activeScreen: loc.screen,
          ...(loc.projectId !== null ? { selectedProjectId: loc.projectId } : {}),
          ...(loc.reportId !== null ? { selectedReportId: loc.reportId } : {}),
        };
      });
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);
  const canVote = useCallback(
    (item: VerificationItem): { allowed: boolean; reason?: string } => {
      if (state.role === 'guest' || !state.currentUser)
        return { allowed: false, reason: 'Masuk dengan akun warga terlebih dahulu untuk memberi suara.' };
      if (state.role === 'owner' || state.currentUser === item.authorDisplayName)
        return { allowed: false, reason: OWNER_WARNING };
      if (item.voters.includes(state.currentUser))
        return { allowed: false, reason: 'Anda sudah memberi 1 suara untuk kiriman ini.' };
      if (item.status !== 'menunggu') return { allowed: false, reason: 'Verifikasi kiriman ini sudah selesai.' };
      return { allowed: true };
    },
    [state.currentUser, state.role],
  );

  const vote = useCallback((itemId: string, choice: VoteChoice) => {
    setState((s) => {
      const user = s.currentUser;
      if (!user) return s;
      const target = s.queue.find((it) => it.id === itemId);
      if (!target || target.voters.includes(user) || target.status !== 'menunggu') return s;

      const votesAgree = target.votesAgree + (choice === 'setuju' ? 1 : 0);
      const votesDisagree = target.votesDisagree + (choice === 'tidak_setuju' ? 1 : 0);
      let status: VerificationItem['status'] = target.status;
      if (votesAgree >= target.targetVotes) {
        status = target.itemType === 'klaim_lokasi' ? 'diterima' : 'terverifikasi';
      } else if (votesDisagree >= target.targetVotes) {
        status = 'ditolak';
      }

      const record: VoteRecord = {
        itemId,
        projectId: target.projectId,
        projectTitle: target.projectTitle,
        itemType: target.itemType,
        authorDisplayName: target.authorDisplayName,
        choice,
        votedAt: 'Baru saja',
        resolution: status,
      };

      const queue = s.queue.map((it) =>
        it.id === itemId
          ? { ...it, votesAgree, votesDisagree, status, voters: [...it.voters, user] }
          : it,
      );
      return { ...s, queue, voteHistory: [record, ...s.voteHistory] };
    });
  }, []);

  const login = useCallback(async (email: string, password = '') => {
    if (password) {
      const authData = await authService.login({ email, password });
      localStorage.setItem('token', authData.access_token);

      let profile: UserProfile;
      try {
        const me = await authService.getMe();
        profile = {
          id: me.id,
          displayName: me.display_name,
          email: me.email,
          emailVerified: Boolean(me.email_verified_at),
          isActive: me.is_active,
          createdAt: me.created_at,
        };
      } catch {
        profile = {
          id: authData.user.id,
          displayName: authData.user.display_name,
          email: authData.user.email,
          emailVerified: Boolean(authData.user.email_verified_at),
          isActive: true,
          createdAt: new Date().toISOString(),
        };
      }

      try {
        localStorage.setItem('user_profile', JSON.stringify(profile));
      } catch {
        // ignore storage quota error
      }
      setState((s) => ({
        ...s,
        currentUser: profile.displayName,
        userProfile: profile,
        role: 'other',
        loginOpen: false,
      }));
      return;
    }

    const displayName = email.split('@')[0];
    setState((s) => ({
      ...s,
      currentUser: displayName,
      userProfile: defaultProfile(displayName, email, true),
      role: 'other',
      loginOpen: false,
    }));
  }, []);

  const register = useCallback(async (displayName: string, email: string, password = '') => {
    if (password) {
      await authService.register({ display_name: displayName, email, password });
      const authData = await authService.login({ email, password });
      localStorage.setItem('token', authData.access_token);

      const profile: UserProfile = {
        id: authData.user.id,
        displayName: authData.user.display_name,
        email: authData.user.email,
        emailVerified: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('user_profile', JSON.stringify(profile));
      } catch {
        // ignore storage error
      }
      setState((s) => ({
        ...s,
        currentUser: profile.displayName,
        userProfile: profile,
        role: 'other',
        loginOpen: false,
      }));
      return;
    }

    setState((s) => ({
      ...s,
      currentUser: displayName,
      userProfile: defaultProfile(displayName, email, false),
      role: 'other',
      loginOpen: false,
    }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user_profile');
      setState((s) => ({
        ...s,
        currentUser: null,
        userProfile: null,
        role: 'guest',
      }));
    }
  }, []);

  const value = useMemo<WartaContextValue>(
    () => ({
      ...state,
      setRole: (role) => {
        const nextUser = role === 'guest' ? null : state.currentUser ?? CURRENT_USER;
        patch({
          role,
          currentUser: nextUser,
          userProfile: nextUser ? defaultProfile(nextUser) : null,
        });
      },
      setMapCondition: (mapCondition) => patch({ mapCondition }),
      navigate: (activeScreen, projectId, reportId) => {
        const nextProjectId = projectId !== undefined ? projectId : (activeScreen === 'detail' || activeScreen === 'lapor' ? state.selectedProjectId : null);
        const nextReportId = reportId !== undefined ? reportId : (activeScreen === 'aduan' ? state.selectedReportId : null);
        const targetHash = buildHash(activeScreen, nextProjectId, nextReportId);
        if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
        patch({
          activeScreen,
          ...(projectId !== undefined ? { selectedProjectId: projectId } : {}),
          ...(reportId !== undefined ? { selectedReportId: reportId } : {}),
          ...(activeScreen !== 'lapor' ? { editingDraftId: null } : {}),
        });
      },
      selectProject: (selectedProjectId) => patch({ selectedProjectId }),
      selectReport: (selectedReportId) => patch({ selectedReportId }),
      startEditDraft: (reportId) => {
        const found = state.myReports.find((r) => r.id === reportId);
        const targetProjectId = found ? found.projectId : state.selectedProjectId;
        const targetHash = buildHash('lapor', targetProjectId, null);
        if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
        patch({
          editingDraftId: reportId,
          selectedProjectId: targetProjectId,
          activeScreen: 'lapor',
        });
      },
      clearEditDraft: () => patch({ editingDraftId: null }),
      toggleRupiah: () => setState((s) => ({ ...s, compactRupiah: !s.compactRupiah })),
      login,
      register,
      updateDisplayName: (displayName) =>
        setState((s) => {
          const nextProfile = s.userProfile ? { ...s.userProfile, displayName } : defaultProfile(displayName);
          try {
            localStorage.setItem('user_profile', JSON.stringify(nextProfile));
          } catch {
            // ignore
          }
          return {
            ...s,
            currentUser: displayName,
            userProfile: nextProfile,
          };
        }),
      verifyCurrentEmail: () =>
        setState((s) => ({
          ...s,
          userProfile: s.userProfile ? { ...s.userProfile, emailVerified: true } : null,
        })),
      logout,
      setLoginOpen: (loginOpen) => patch({ loginOpen }),
      vote,
      canVote,
      addReport: (r, item) =>
        setState((s) => ({
          ...s,
          myReports: [r, ...s.myReports],
          queue: item ? [item, ...s.queue] : s.queue,
        })),
      updateDraftReport: (reportId, updated, submittedItem) =>
        setState((s) => ({
          ...s,
          editingDraftId: null,
          myReports: s.myReports.map((r) => (r.id === reportId ? { ...r, ...updated } : r)),
          queue: submittedItem ? [submittedItem, ...s.queue] : s.queue,
        })),
      deleteReport: (reportId) =>
        setState((s) => {
          const target = s.myReports.find((r) => r.id === reportId);
          return {
            ...s,
            myReports: s.myReports.filter((r) => r.id !== reportId),
            queue: target
              ? s.queue.filter(
                  (q) =>
                    !(
                      q.projectId === target.projectId &&
                      q.authorDisplayName === s.currentUser &&
                      q.narrative === target.narrative
                    ),
                )
              : s.queue,
          };
        }),
      addClaim: (c, item) =>
        setState((s) => ({ ...s, myClaims: [c, ...s.myClaims], queue: [item, ...s.queue] })),
      addEvidence: (itemId, description, photoUrl) =>
        setState((s) => {
          const target = s.queue.find((it) => it.id === itemId);
          if (!target) return s;
          const newEv: EvidenceItem = {
            id: `ev-${Date.now()}`,
            reportId: itemId,
            authorDisplayName: s.currentUser ?? 'Warga',
            description,
            photoUrl,
            createdAt: 'Baru saja',
          };
          const existing = target.evidences ?? [];
          return {
            ...s,
            queue: s.queue.map((it) => (it.id === itemId ? { ...it, evidences: [newEv, ...existing] } : it)),
          };
        }),
      deleteEvidence: (itemId, evidenceId) =>
        setState((s) => {
          const target = s.queue.find((it) => it.id === itemId);
          if (!target) return s;
          return {
            ...s,
            queue: s.queue.map((it) =>
              it.id === itemId ? { ...it, evidences: (it.evidences ?? []).filter((e: EvidenceItem) => e.id !== evidenceId) } : it,
            ),
          };
        }),
      reset: () => setState(initialState()),
    }),
    [canVote, login, logout, patch, register, state, vote],
  );

  return <WartaContext.Provider value={value}>{children}</WartaContext.Provider>;
}

export function useWarta() {
  const ctx = useContext(WartaContext);
  if (!ctx) throw new Error('useWarta harus digunakan di dalam WartaProvider');
  return ctx;
}
