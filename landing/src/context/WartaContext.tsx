import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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
  login: (displayName: string, email?: string) => void;
  register: (displayName: string, email: string) => void;
  updateDisplayName: (displayName: string) => void;
  verifyCurrentEmail: () => void;
  logout: () => void;
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

const initialState = (): WartaState => ({
  currentUser: SAMPLE_DATA ? CURRENT_USER : null,
  userProfile: SAMPLE_DATA ? defaultProfile(CURRENT_USER) : null,
  role: SAMPLE_DATA ? 'other' : 'guest',
  mapCondition: 'normal',
  activeScreen: 'aduan',
  selectedProjectId: null,
  selectedReportId: null,
  editingDraftId: null,
  compactRupiah: true,
  queue: SAMPLE_DATA ? structuredClone(INITIAL_VERIFICATION_QUEUE) : [],
  myReports: SAMPLE_DATA ? structuredClone(INITIAL_MY_REPORTS) : [],
  myClaims: SAMPLE_DATA ? structuredClone(INITIAL_MY_CLAIMS) : [],
  voteHistory: SAMPLE_DATA ? structuredClone(INITIAL_VOTE_HISTORY) : [],
  loginOpen: false,
});

const WartaContext = createContext<WartaContextValue | null>(null);

export const OWNER_WARNING =
  'Anda adalah pemilik laporan ini. Warga tidak dapat memverifikasi laporan atau klaim miliknya sendiri.';

export function WartaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WartaState>(initialState);

  const patch = useCallback((p: Partial<WartaState>) => setState((s) => ({ ...s, ...p })), []);

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
    [state.role, state.currentUser],
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
      navigate: (activeScreen, projectId, reportId) =>
        patch({
          activeScreen,
          ...(projectId !== undefined ? { selectedProjectId: projectId } : {}),
          ...(reportId !== undefined ? { selectedReportId: reportId } : {}),
          ...(activeScreen !== 'lapor' ? { editingDraftId: null } : {}),
        }),
      selectProject: (selectedProjectId) => patch({ selectedProjectId }),
      selectReport: (selectedReportId) => patch({ selectedReportId }),
      startEditDraft: (reportId) => {
        const found = state.myReports.find((r) => r.id === reportId);
        patch({
          editingDraftId: reportId,
          selectedProjectId: found ? found.projectId : state.selectedProjectId,
          activeScreen: 'lapor',
        });
      },
      clearEditDraft: () => patch({ editingDraftId: null }),
      toggleRupiah: () => setState((s) => ({ ...s, compactRupiah: !s.compactRupiah })),
      login: (displayName, email) =>
        patch({
          currentUser: displayName,
          userProfile: defaultProfile(
            displayName,
            email ?? `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@warga.id`,
            true,
          ),
          role: 'other',
          loginOpen: false,
        }),
      register: (displayName, email) =>
        patch({
          currentUser: displayName,
          userProfile: defaultProfile(displayName, email, false),
          role: 'other',
          loginOpen: false,
        }),
      updateDisplayName: (displayName) =>
        setState((s) => ({
          ...s,
          currentUser: displayName,
          userProfile: s.userProfile ? { ...s.userProfile, displayName } : defaultProfile(displayName),
        })),
      verifyCurrentEmail: () =>
        setState((s) => ({
          ...s,
          userProfile: s.userProfile ? { ...s.userProfile, emailVerified: true } : null,
        })),
      logout: () => patch({ currentUser: null, userProfile: null, role: 'guest' }),
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
          if (!s.currentUser) return s;
          const newEv: EvidenceItem = {
            id: `ev-${Date.now()}`,
            reportId: itemId,
            authorDisplayName: s.currentUser,
            description,
            photoUrl,
            createdAt: 'Baru saja',
          };
          return {
            ...s,
            queue: s.queue.map((it) =>
              it.id === itemId ? { ...it, evidences: [...(it.evidences ?? []), newEv] } : it,
            ),
          };
        }),
      deleteEvidence: (itemId, evidenceId) =>
        setState((s) => ({
          ...s,
          queue: s.queue.map((it) =>
            it.id === itemId
              ? { ...it, evidences: (it.evidences ?? []).filter((e) => e.id !== evidenceId) }
              : it,
          ),
        })),
      reset: () => setState(initialState()),
    }),
    [state, patch, vote, canVote],
  );

  return <WartaContext.Provider value={value}>{children}</WartaContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWarta(): WartaContextValue {
  const ctx = useContext(WartaContext);
  if (!ctx) throw new Error('useWarta harus dipakai di dalam <WartaProvider>');
  return ctx;
}
