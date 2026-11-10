import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useWarta } from '../../context/WartaContext';
import { SAMPLE_DATA, WARTA_PROJECTS, getProject } from '../../data/wartaData';
import type { ReportCategory } from '../../types/warta';
import { buildReport, buildVerificationItem, buildClaim, buildClaimAddress } from '../../utils/formBuilders';
import { validateReportForm, validateClaimForm } from '../../utils/formValidation';
import { SAMPLE_PHOTOS, MAX_PHOTOS } from '../../constants/formConfig';
import FormSuccess from '../form/FormSuccess';
import ReportForm from '../form/ReportForm';
import ClaimForm from '../form/ClaimForm';

export default function CitizenReportFormView() {
  const {
    activeScreen,
    selectedProjectId,
    selectProject,
    editingDraftId,
    myReports,
    navigate,
    addReport,
    updateDraftReport,
    addClaim,
    currentUser,
    setLoginOpen,
  } = useWarta();

  const editingDraft = myReports.find((r) => r.id === editingDraftId) ?? null;
  const currentProjectId = editingDraft?.projectId ?? selectedProjectId ?? WARTA_PROJECTS[0].id;

  const formMode = activeScreen === 'klaim' ? 'klaim' : 'lapor';
  const [doneState, setDoneState] = useState<'draft' | 'sent' | 'claim-sent' | null>(null);

  // Report form state
  const [category, setCategory] = useState<ReportCategory | ''>(editingDraft?.category ?? '');
  const [narrative, setNarrative] = useState(editingDraft?.narrative ?? '');
  const [proposedAddress, setProposedAddress] = useState(
    editingDraft?.proposedAddress ?? getProject(currentProjectId).locationDesc,
  );
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>(
    editingDraft?.photoUrls?.map((u, idx) => ({ name: `foto-${idx + 1}.jpg`, url: u })) ?? [],
  );
  const [exifValid, setExifValid] = useState<boolean | undefined>(editingDraft?.exifValid);
  const [pin, setPin] = useState({ x: 52, y: 48 });
  const [reportErrors, setReportErrors] = useState<string[]>([]);

  // Claim form state
  const [level, setLevel] = useState('alamat/ruas');
  const [claimAddress, setClaimAddress] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [landmark, setLandmark] = useState('');
  const [claimPhoto, setClaimPhoto] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<string[]>([]);

  const handleProjectChange = (nextId: string) => {
    selectProject(nextId);
    if (!editingDraft) {
      setProposedAddress(getProject(nextId).locationDesc);
    }
  };

  const handleAddPhotos = (files: FileList | null) => {
    if (!files) return;
    const newPhotos = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    setPhotos((prev) => [
      ...prev,
      ...newPhotos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    ]);
  };

  const handleAddSamplePhoto = () => {
    if (photos.length >= MAX_PHOTOS) return;
    const nextUrl = SAMPLE_PHOTOS[photos.length % SAMPLE_PHOTOS.length];
    setPhotos((prev) => [...prev, { name: `bukti-lapangan-${prev.length + 1}.jpg`, url: nextUrl }]);
  };

  const handleSaveDraft = () => {
    const draftObj = buildReport({
      id: editingDraft?.id,
      projectId: currentProjectId,
      projectTitle: getProject(currentProjectId).title,
      spseCode: getProject(currentProjectId).spseCode,
      category,
      narrative,
      proposedAddress,
      photoUrls: photos.map((ph) => ph.url),
      exifValid,
      status: 'draft',
    });

    if (editingDraft) {
      updateDraftReport(editingDraft.id, draftObj);
    } else {
      addReport(draftObj);
    }
    setDoneState('draft');
  };

  const handleSubmitReport = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }

    const errs = validateReportForm(category, proposedAddress, narrative, photos.length);
    setReportErrors(errs);
    if (errs.length > 0) return;

    const p = getProject(currentProjectId);
    const submitted = buildReport({
      id: editingDraft?.id,
      projectId: currentProjectId,
      projectTitle: p.title,
      spseCode: p.spseCode,
      category: category as ReportCategory,
      narrative,
      proposedAddress,
      photoUrls: photos.map((ph) => ph.url),
      exifValid,
      status: 'menunggu',
    });

    const queueItem = buildVerificationItem({
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      satker: p.satker,
      paguCompact: p.paguCompact,
      itemType: 'laporan_kondisi',
      category: submitted.category,
      authorDisplayName: currentUser,
      exifValid,
      narrative: submitted.narrative,
      proposedAddress: submitted.proposedAddress,
      photoUrl: photos[0].url,
      photoUrls: photos.map((ph) => ph.url),
      coordinates: { lat: -6.1 - pin.y / 1000, lng: 106.8 + pin.x / 1000 },
    });

    if (editingDraft) {
      updateDraftReport(editingDraft.id, submitted, queueItem);
    } else {
      addReport(submitted, queueItem);
    }
    setDoneState('sent');
  };

  const handleSubmitClaim = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }

    const errs = validateClaimForm(level, claimAddress, kecamatan, claimPhoto);
    setClaimErrors(errs);
    if (errs.length > 0) return;

    const p = getProject(currentProjectId);
    const proposed = buildClaimAddress(claimAddress, kelurahan, kecamatan, landmark);

    const claim = buildClaim({
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      proposedAddress: proposed,
      proposedPrecision: level,
      photoUrl: claimPhoto!,
    });

    const item = buildVerificationItem({
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      satker: p.satker,
      paguCompact: p.paguCompact,
      itemType: 'klaim_lokasi',
      authorDisplayName: currentUser,
      exifValid,
      narrative: landmark.trim() ? `Patokan lapangan: ${landmark.trim()}` : 'Usulan titik lokasi kanonik paket.',
      proposedAddress: proposed,
      proposedPrecision: level,
      photoUrl: claimPhoto!,
      photoUrls: [claimPhoto!],
      coordinates: { lat: -6.1 - pin.y / 1000, lng: 106.8 + pin.x / 1000 },
    });

    addClaim(claim, item);
    setDoneState('claim-sent');
  };

  if (doneState) {
    return (
      <FormSuccess
        type={doneState}
        onMyReports={() => navigate('profil')}
        onFeed={() => navigate('aduan')}
      />
    );
  }

  const containerClass = 'mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12';

  if (formMode === 'lapor') {
    return (
      <div className={containerClass}>
        <ReportForm
          projectId={currentProjectId}
          editingDraftId={editingDraftId}
          category={category}
          onCategoryChange={setCategory}
          narrative={narrative}
          onNarrativeChange={setNarrative}
          proposedAddress={proposedAddress}
          onAddressChange={setProposedAddress}
          photos={photos}
          onPhotosAdd={handleAddPhotos}
          onPhotosRemove={(i) => setPhotos((ps) => ps.filter((_, j) => j !== i))}
          exifValid={exifValid}
          onExifChange={setExifValid}
          pin={pin}
          onPinChange={setPin}
          errors={reportErrors}
          onDraft={handleSaveDraft}
          onSubmit={handleSubmitReport}
          onBack={() => navigate('aduan')}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <ClaimForm
        projectId={currentProjectId}
        level={level}
        onLevelChange={setLevel}
        claimAddress={claimAddress}
        onAddressChange={setClaimAddress}
        kelurahan={kelurahan}
        onKelurahanChange={setKelurahan}
        kecamatan={kecamatan}
        onKecamatanChange={setKecamatan}
        landmark={landmark}
        onLandmarkChange={setLandmark}
        claimPhoto={claimPhoto}
        onPhotoChange={setClaimPhoto}
        exifValid={exifValid}
        onExifChange={setExifValid}
        pin={pin}
        onPinChange={setPin}
        errors={claimErrors}
        onSubmit={handleSubmitClaim}
        onBack={() => navigate('aduan')}
      />
    </div>
  );
}
