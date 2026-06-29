import { z } from 'zod';
import { StateCreator } from 'zustand';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { AdminStore } from '@/stores/admin.tsx';

export interface LocationsSlice {
  locations: Pagination<z.infer<typeof adminLocationSchema>>;

  setLocations: (locations: Pagination<z.infer<typeof adminLocationSchema>>) => void;
  addLocation: (location: z.infer<typeof adminLocationSchema>) => void;
  removeLocation: (location: z.infer<typeof adminLocationSchema>) => void;
}

export const createLocationsSlice: StateCreator<AdminStore, [], [], LocationsSlice> = (set): LocationsSlice => ({
  locations: getEmptyPaginationSet<z.infer<typeof adminLocationSchema>>(),

  setLocations: (value) => set((state) => ({ ...state, locations: value })),
  addLocation: (location) =>
    set((state) => ({
      locations: {
        ...state.locations,
        data: [...state.locations.data, location],
        total: state.locations.total + 1,
      },
    })),
  removeLocation: (location) =>
    set((state) => ({
      locations: {
        ...state.locations,
        data: state.locations.data.filter((l) => l.uuid !== location.uuid),
        total: state.locations.total - 1,
      },
    })),
});
