'use client';

import { create } from 'zustand';
import { mockFloorplan } from '@/lib/data/mock-floorplan';
import { prepareFloorplanForLiveData } from '@/lib/data/prepare-floorplan-for-live-data';
import { applyLiveRoomFeed } from '@/lib/live-data/apply-live-room-data';
import { sanitizeRoomAssignments } from '@/lib/live-data/sanitize-room-assignments';
import { mockPatientRooms, mockPatientAvailableRooms } from '@/lib/data/mock-patient-rooms';
import type { BodyAnchorOverrideMap } from '@/lib/scene/body-anchors';
import type { BodyAnchorId, ParsedFloorplan, Patient, SceneMode, TransitionState } from '@/types/domain';

interface UploadState {
  previewUrl: string | null;
  fileName: string | null;
  status: 'idle' | 'ready' | 'error';
  error: string | null;
}

interface AnalysisState {
  status: 'idle' | 'running' | 'complete' | 'error';
  mode: 'mock' | 'rich' | 'fallback' | 'live' | null;
  message: string | null;
}

interface DebugState {
  showAnchors: boolean;
  showAnalysis: boolean;
  anchorEditMode: boolean;
}

interface PopupScreenPosition {
  x: number;
  y: number;
  visible: boolean;
}

interface AppStore {
  sceneMode: SceneMode;
  transitionState: TransitionState;
  selectedRoomId: string | null;
  selectedPatientId: string | null;
  selectedConditionId: string | null;
  selectedAnchorId: BodyAnchorId | null;
  parsedFloorplan: ParsedFloorplan;
  patients: Patient[];
  useMockPatients: boolean;
  uploadState: UploadState;
  analysisState: AnalysisState;
  activeRequestId: string | null;
  activeAbortController: AbortController | null;
  debug: DebugState;
  popupScreenPosition: PopupScreenPosition;
  anchorEditorScreenPosition: PopupScreenPosition;
  anchorOverrides: BodyAnchorOverrideMap;
  cameraResetNonce: number;
  patientRefreshNonce: number;
  hydrateMock: () => void;
  setUploadReady: (payload: { previewUrl: string; fileName: string }) => void;
  setUploadError: (message: string) => void;
  setAnalysisRunning: (requestId: string, controller: AbortController) => void;
  finishAnalysis: (payload: { parsedFloorplan: ParsedFloorplan; requestId: string; mode: 'mock' | 'rich' | 'fallback' }) => void;
  failAnalysis: (requestId: string, message: string) => void;
  applyLiveRoomData: (payload: { parsedFloorplan: ParsedFloorplan; patients: Patient[]; assignedCount: number }) => void;
  resetForUpload: () => void;
  selectRoom: (roomId: string | null) => void;
  enterPatientMode: (roomId: string, patientId: string) => void;
  returnToHospital: () => void;
  selectCondition: (conditionId: string | null) => void;
  selectAnchor: (anchorId: BodyAnchorId | null) => void;
  setPopupScreenPosition: (payload: PopupScreenPosition) => void;
  setAnchorEditorScreenPosition: (payload: PopupScreenPosition) => void;
  setAnchorOverride: (anchorId: BodyAnchorId, payload: { x?: number; y?: number; z?: number }) => void;
  resetAnchorOverride: (anchorId: BodyAnchorId) => void;
  toggleAnchorDebug: () => void;
  toggleAnalysisDebug: () => void;
  toggleAnchorEditMode: () => void;
  requestCameraReset: () => void;
}

const seededFloorplan = prepareFloorplanForLiveData(mockFloorplan);

const MOCK_PATIENTS_ENABLED = process.env.NEXT_PUBLIC_MOCK_PATIENTS !== 'false';

function applyMockPatientData(baseFloorplan: ParsedFloorplan) {
  return applyLiveRoomFeed({
    rooms: mockPatientRooms,
    availableRooms: mockPatientAvailableRooms,
    baseFloorplan,
  });
}

const initialMock = MOCK_PATIENTS_ENABLED ? applyMockPatientData(seededFloorplan) : null;

export const useAppStore = create<AppStore>((set, get) => ({
  sceneMode: 'hospital',
  transitionState: 'idle',
  selectedRoomId: null,
  selectedPatientId: null,
  selectedConditionId: null,
  selectedAnchorId: null,
  parsedFloorplan: initialMock?.parsedFloorplan ?? seededFloorplan,
  patients: initialMock?.patients ?? [],
  useMockPatients: MOCK_PATIENTS_ENABLED,
  uploadState: {
    previewUrl: null,
    fileName: null,
    status: 'idle',
    error: null,
  },
  analysisState: {
    status: MOCK_PATIENTS_ENABLED ? 'complete' : 'idle',
    mode: MOCK_PATIENTS_ENABLED ? 'live' : 'mock',
    message: MOCK_PATIENTS_ENABLED
      ? `Mock patient data active. ${initialMock!.patients.length} patient records loaded.`
      : 'Showing the default hospital layout. Rooms remain inactive until live JSON data is applied.',
  },
  activeRequestId: null,
  activeAbortController: null,
  debug: {
    showAnchors: false,
    showAnalysis: false,
    anchorEditMode: false,
  },
  popupScreenPosition: {
    x: 0,
    y: 0,
    visible: false,
  },
  anchorEditorScreenPosition: {
    x: 0,
    y: 0,
    visible: false,
  },
  anchorOverrides: {},
  cameraResetNonce: 0,
  patientRefreshNonce: 0,
  hydrateMock: () => {
    const base = prepareFloorplanForLiveData(mockFloorplan);

    set({
      parsedFloorplan: base,
      patients: [],
      selectedRoomId: null,
      selectedPatientId: null,
      selectedConditionId: null,
      selectedAnchorId: null,
      sceneMode: 'hospital',
      transitionState: 'idle',
      analysisState: {
        status: 'complete',
        mode: 'live',
        message: 'Default layout restored. Loading patient data...',
      },
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      cameraResetNonce: get().cameraResetNonce + 1,
      patientRefreshNonce: get().patientRefreshNonce + 1,
    });
  },
  setUploadReady: ({ previewUrl, fileName }) =>
    set({
      uploadState: {
        previewUrl,
        fileName,
        status: 'ready',
        error: null,
      },
    }),
  setUploadError: (message) =>
    set({
      uploadState: {
        previewUrl: get().uploadState.previewUrl,
        fileName: get().uploadState.fileName,
        status: 'error',
        error: message,
      },
    }),
  setAnalysisRunning: (requestId, controller) =>
    set({
      sceneMode: 'hospital',
      transitionState: 'analyzing',
      selectedRoomId: null,
      selectedPatientId: null,
      selectedConditionId: null,
      selectedAnchorId: null,
      activeRequestId: requestId,
      activeAbortController: controller,
      analysisState: {
        status: 'running',
        mode: null,
        message: 'Analyzing uploaded floor plan...',
      },
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
    }),
  finishAnalysis: ({ parsedFloorplan, requestId, mode }) => {
    if (get().activeRequestId !== requestId) {
      return;
    }

    const base = prepareFloorplanForLiveData(parsedFloorplan);

    set({
      parsedFloorplan: base,
      patients: [],
      sceneMode: 'hospital',
      transitionState: 'idle',
      selectedRoomId: null,
      selectedPatientId: null,
      selectedConditionId: null,
      selectedAnchorId: null,
      activeRequestId: null,
      activeAbortController: null,
      analysisState: {
        status: 'complete',
        mode: mode,
        message: 'Floor plan analyzed. Loading patient data...',
      },
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      patientRefreshNonce: get().patientRefreshNonce + 1,
    });
  },
  failAnalysis: (requestId, message) => {
    if (get().activeRequestId !== requestId) {
      return;
    }

    set({
      transitionState: 'idle',
      activeRequestId: null,
      activeAbortController: null,
      analysisState: {
        status: 'error',
        mode: null,
        message,
      },
    });
  },
  applyLiveRoomData: (payload) => {
    const { parsedFloorplan, patients, assignedCount } = sanitizeRoomAssignments(payload);
    set({
      parsedFloorplan,
      patients,
      sceneMode: 'hospital',
      transitionState: 'idle',
      selectedRoomId: null,
      selectedPatientId: null,
      selectedConditionId: null,
      selectedAnchorId: null,
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      analysisState: {
        status: 'complete',
        mode: 'live',
        message: `Loaded ${assignedCount} live room record${assignedCount === 1 ? '' : 's'}.`,
      },
      cameraResetNonce: get().cameraResetNonce + 1,
    });
  },
  resetForUpload: () => {
    get().activeAbortController?.abort();
    set({
      sceneMode: 'hospital',
      transitionState: 'idle',
      selectedRoomId: null,
      selectedPatientId: null,
      selectedConditionId: null,
      selectedAnchorId: null,
      activeRequestId: null,
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      cameraResetNonce: get().cameraResetNonce + 1,
    });
  },
  selectRoom: (roomId) => set({ selectedRoomId: roomId }),
  enterPatientMode: (roomId, patientId) =>
    set({
      sceneMode: 'patient',
      transitionState: 'toPatient',
      selectedRoomId: roomId,
      selectedPatientId: patientId,
      selectedConditionId: null,
      selectedAnchorId: null,
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
    }),
  returnToHospital: () =>
    set({
      sceneMode: 'hospital',
      transitionState: 'toHospital',
      selectedPatientId: null,
      selectedConditionId: null,
      selectedAnchorId: null,
      popupScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      anchorEditorScreenPosition: {
        x: 0,
        y: 0,
        visible: false,
      },
      cameraResetNonce: get().cameraResetNonce + 1,
    }),
  selectCondition: (conditionId) =>
    set({
      selectedConditionId: conditionId,
      selectedAnchorId: conditionId ? null : get().selectedAnchorId,
      anchorEditorScreenPosition: conditionId
        ? {
            x: 0,
            y: 0,
            visible: false,
          }
        : get().anchorEditorScreenPosition,
    }),
  selectAnchor: (anchorId) =>
    set({
      selectedAnchorId: anchorId,
      selectedConditionId: anchorId ? null : get().selectedConditionId,
      popupScreenPosition: anchorId
        ? {
            x: 0,
            y: 0,
            visible: false,
          }
        : get().popupScreenPosition,
      anchorEditorScreenPosition: anchorId
        ? get().anchorEditorScreenPosition
        : {
            x: 0,
            y: 0,
            visible: false,
          },
    }),
  setPopupScreenPosition: (payload) => set({ popupScreenPosition: payload }),
  setAnchorEditorScreenPosition: (payload) => set({ anchorEditorScreenPosition: payload }),
  setAnchorOverride: (anchorId, payload) =>
    set((state) => ({
      anchorOverrides: {
        ...state.anchorOverrides,
        [anchorId]: {
          ...state.anchorOverrides[anchorId],
          ...payload,
        },
      },
    })),
  resetAnchorOverride: (anchorId) =>
    set((state) => {
      const nextOverrides = { ...state.anchorOverrides };
      delete nextOverrides[anchorId];
      return { anchorOverrides: nextOverrides };
    }),
  toggleAnchorDebug: () => set((state) => ({ debug: { ...state.debug, showAnchors: !state.debug.showAnchors } })),
  toggleAnalysisDebug: () => set((state) => ({ debug: { ...state.debug, showAnalysis: !state.debug.showAnalysis } })),
  toggleAnchorEditMode: () =>
    set((state) => {
      const nextAnchorEditMode = !state.debug.anchorEditMode;
      return {
        debug: {
          ...state.debug,
          anchorEditMode: nextAnchorEditMode,
        },
        selectedAnchorId: nextAnchorEditMode ? state.selectedAnchorId : null,
        anchorEditorScreenPosition: nextAnchorEditMode
          ? state.anchorEditorScreenPosition
          : {
              x: 0,
              y: 0,
              visible: false,
            },
      };
    }),
  requestCameraReset: () => set((state) => ({ cameraResetNonce: state.cameraResetNonce + 1 })),
}));
