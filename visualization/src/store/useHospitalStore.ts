import { create } from 'zustand';

interface HospitalStore {
  selectedRoom: string | null;
  selectedCondition: string | null;
  selectRoom: (roomId: string) => void;
  selectCondition: (conditionId: string | null) => void;
  resetSelection: () => void;
}

export const useHospitalStore = create<HospitalStore>((set) => ({
  selectedRoom: null,
  selectedCondition: null,
  selectRoom: (roomId) =>
    set((state) =>
      state.selectedRoom === roomId
        ? state
        : {
            selectedRoom: roomId,
            selectedCondition: null,
          },
    ),
  selectCondition: (conditionId) =>
    set({
      selectedCondition: conditionId,
    }),
  resetSelection: () =>
    set({
      selectedRoom: null,
      selectedCondition: null,
    }),
}));
