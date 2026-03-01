export interface AppState {
    theme: 'light' | 'dark' | 'system';
    activeNodeId: string | null;
    edgeType: 'default' | 'straight' | 'step' | 'smoothstep' | 'simplebezier';
    nodeInfo: any;
    isNodeInfoOpen: boolean;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setActiveNodeId: (nodeId: string | null) => void;
    setEdgeType: (type: 'default' | 'straight' | 'step' | 'smoothstep' | 'simplebezier') => void;
    setNodeInfo: (info: any) => void;
    closeNodeInfo: () => void;
}

import { create } from 'zustand';

export const useAppStore = create<AppState>((set) => ({
    theme: 'light',
    activeNodeId: null,
    edgeType: 'smoothstep',
    nodeInfo: null,
    isNodeInfoOpen: false,
    setTheme: (theme) => set({ theme }),
    setActiveNodeId: (activeNodeId) => set({ activeNodeId }),
    setEdgeType: (edgeType) => set({ edgeType }),
    setNodeInfo: (info) => set({ nodeInfo: info, isNodeInfoOpen: true }),
    closeNodeInfo: () => set({ nodeInfo: null, isNodeInfoOpen: false }),
}));
