import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  ActiveScreen,
  CitizenClaim,
  CitizenReport,
  MapCondition,
  UserRole,
  VerificationItem,
  VoteChoice,
  VoteRecord,
} from '../types/warta';
import {
  CURRENT_USER,
  INITIAL_MY_CLAIMS,
  INITIAL_MY_REPORTS,
  INITIAL_VERIFICATION_QUEUE,
  INITIAL_VOTE_HISTORY,
} from '../data/wartaData';

interface WartaState {
  currentUser: string | null;
  role: UserRole;
  mapCondition: MapCondition;
  activeScreen: ActiveScreen;
  selectedProjectId: string | null;
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
  navigate: (s: ActiveScreen, projectId?: string) => void;
  selectProject: (id: string | null) => void;
  toggleRupiah: () => void;
  login: (displayName: string) => void;
  logout: () => void;
  setLoginOpen: (o: boolean) => void;
  vote: (itemId: string, choice: VoteChoice) => void;
  canVote: (item: VerificationItem) => { allowed: boolean; reason?: string };
  addReport: (r: CitizenReport, item?: VerificationItem) => void;
  addClaim: (c: CitizenClaim, item: VerificationItem) => void;
  reset: () => void;
}

const initialState = (): WartaState => ({
  currentUser: CURRENT_USER,
  role: 'other',
  mapCondition: 'normal',
  activeScreen: 'peta',
  selectedProjectId: null,
  compactRupiah: true,
  queue: structuredClone(INITIAL_VERIFICATION_QUEUE),
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

  const canVote = useCallback(
    (item: VerificationItem): { allowed: boolean; reason?: string } => {
      if (state.role === 'guest' || !state.currentUser)
        return { allowed: false, reason: 'Masuk dengan Nama Tampilan Publik untuk memberi suara.' };
      if (state.role === 'owner' || state.currentUser === item.authorDisplayName)
        return { allowed: false, reason: OWNER_WARNING };
      if (item.voters.includes(state.currentUser))
        return { allowed: false, reason: 'Anda sudah memberi 1 suara untuk item ini.' };
      if (item.status !== 'menunggu') return { allowed: false, reason: 'Verifikasi item ini sudah selesai.' };
      return { allowed: true };
    },
    [state.role, state.currentUser],
  );

  const vote = useCallback(
    (itemId: string, choice: VoteChoice) => {
      setState((s) => {
        const user = s.currentUser;
        if (!user) return s;
        let record: VoteRecord | null = null;
        const queue = s.queue.map((it) => {
          if (it.id !== itemId || it.voters.includes(user) || it.status !== 'menunggu') return it;
          const votesAgree = it.votesAgree + (choice === 'setuju' ? 1 : 0);
          const votesDisagree = it.votesDisagree + (choice === 'tidak_setuju' ? 1 : 0);
          let status: VerificationItem['status'] = it.status;
          if (votesAgree >= it.targetVotes) status = it.itemType === 'klaim_lokasi' ? 'diterima' : 'terverifikasi';
          else if (votesDisagree >= it.targetVotes) status = 'ditolak';
          record = {
            itemId,
            projectTitle: it.projectTitle,
            itemType: it.itemType,
            authorDisplayName: it.authorDisplayName,
            choice,
            votedAt: 'Baru saja',
          };
          return { ...it, votesAgree, votesDisagree, status, voters: [...it.voters, user] };
        });
        return record ? { ...s, queue, voteHistory: [record, ...s.voteHistory] } : s;
      });
    },
    [],
  );

  const value = useMemo<WartaContextValue>(
    () => ({
      ...state,
      setRole: (role) => patch({ role, currentUser: role === 'guest' ? null : state.currentUser ?? CURRENT_USER }),
      setMapCondition: (mapCondition) => patch({ mapCondition }),
      navigate: (activeScreen, projectId) =>
        patch({ activeScreen, ...(projectId ? { selectedProjectId: projectId } : {}) }),
      selectProject: (selectedProjectId) => patch({ selectedProjectId }),
      toggleRupiah: () => setState((s) => ({ ...s, compactRupiah: !s.compactRupiah })),
      login: (currentUser) => patch({ currentUser, role: 'other', loginOpen: false }),
      logout: () => patch({ currentUser: null, role: 'guest' }),
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
