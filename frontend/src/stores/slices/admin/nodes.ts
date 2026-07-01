import { z } from 'zod';
import { StateCreator } from 'zustand';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminNodeAllocationSchema, adminNodeMountSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers.ts';
import { AdminStore } from '@/stores/admin.tsx';

export interface NodesSlice {
  nodes: Pagination<z.infer<typeof adminNodeSchema>>;
  nodeMounts: Pagination<z.infer<typeof adminNodeMountSchema>>;
  nodeBackups: Pagination<z.infer<typeof adminServerBackupSchema>>;
  nodeAllocations: Pagination<z.infer<typeof adminNodeAllocationSchema>>;
  selectedNodeAllocations: ObjectSet<z.infer<typeof adminNodeAllocationSchema>, 'uuid'>;

  setNodes: (nodes: Pagination<z.infer<typeof adminNodeSchema>>) => void;
  addNode: (node: z.infer<typeof adminNodeSchema>) => void;
  removeNode: (node: z.infer<typeof adminNodeSchema>) => void;

  setNodeMounts: (mounts: Pagination<z.infer<typeof adminNodeMountSchema>>) => void;
  addNodeMount: (mount: z.infer<typeof adminNodeMountSchema>) => void;
  removeNodeMount: (mount: z.infer<typeof adminNodeMountSchema>) => void;

  setNodeBackups: (backups: Pagination<z.infer<typeof adminServerBackupSchema>>) => void;
  removeNodeBackup: (backup: z.infer<typeof adminServerBackupSchema>) => void;

  setNodeAllocations: (allocations: Pagination<z.infer<typeof adminNodeAllocationSchema>>) => void;
  removeNodeAllocations: (allocations: z.infer<typeof adminNodeAllocationSchema>[]) => void;

  setSelectedNodeAllocations: (allocations: z.infer<typeof adminNodeAllocationSchema>[]) => void;
  addSelectedNodeAllocation: (allocation: z.infer<typeof adminNodeAllocationSchema>) => void;
  removeSelectedNodeAllocation: (allocation: z.infer<typeof adminNodeAllocationSchema>) => void;
}

export const createNodesSlice: StateCreator<AdminStore, [], [], NodesSlice> = (set, get): NodesSlice => ({
  nodes: getEmptyPaginationSet<z.infer<typeof adminNodeSchema>>(),
  nodeMounts: getEmptyPaginationSet<z.infer<typeof adminNodeMountSchema>>(),
  nodeBackups: getEmptyPaginationSet<z.infer<typeof adminServerBackupSchema>>(),
  nodeAllocations: getEmptyPaginationSet<z.infer<typeof adminNodeAllocationSchema>>(),
  selectedNodeAllocations: new ObjectSet('uuid'),

  setNodes: (value) => set((state) => ({ ...state, nodes: value })),
  addNode: (node) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        data: [...state.nodes.data, node],
        total: state.nodes.total + 1,
      },
    })),
  removeNode: (node) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        data: state.nodes.data.filter((l) => l.uuid !== node.uuid),
        total: state.nodes.total - 1,
      },
    })),

  setNodeMounts: (value) => set((state) => ({ ...state, nodeMounts: value })),
  addNodeMount: (mount) =>
    set((state) => ({
      nodeMounts: {
        ...state.nodeMounts,
        data: [...state.nodeMounts.data, mount],
        total: state.nodeMounts.total + 1,
      },
    })),
  removeNodeMount: (mount) =>
    set((state) => ({
      nodeMounts: {
        ...state.nodeMounts,
        data: state.nodeMounts.data.filter((l) => l.mount.uuid !== mount.mount.uuid),
        total: state.nodeMounts.total - 1,
      },
    })),

  setNodeBackups: (value) => set((state) => ({ ...state, nodeBackups: value })),
  removeNodeBackup: (backup) =>
    set((state) => ({
      nodeBackups: {
        ...state.nodeBackups,
        data: state.nodeBackups.data.filter((b) => b.uuid !== backup.uuid),
        total: state.nodeBackups.total - 1,
      },
    })),

  setNodeAllocations: (value) => set((state) => ({ ...state, nodeAllocations: value })),
  removeNodeAllocations: (allocations) =>
    set((state) => ({
      nodeAllocations: {
        ...state.nodeAllocations,
        data: state.nodeAllocations.data.filter((a) => !allocations.some((al) => al.uuid === a.uuid)),
        total: state.nodeAllocations.total - allocations.length,
      },
    })),

  setSelectedNodeAllocations: (value) =>
    set((state) => ({ ...state, selectedNodeAllocations: new ObjectSet('uuid', value) })),
  addSelectedNodeAllocation: (value) =>
    set((state) => ({ ...state, selectedNodeAllocations: state.selectedNodeAllocations.clone().add(value) })),
  removeSelectedNodeAllocation: (value) =>
    set((state) => {
      const next = state.selectedNodeAllocations.clone();
      next.delete(value);
      return { ...state, selectedNodeAllocations: next };
    }),
});
