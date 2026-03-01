import React, { createContext, useContext, useState, useCallback } from 'react';

interface NodeInfoContextType {
    isOpen: boolean;
    activeNodeInfo: any;
    openInfoPanel: (info: any) => void;
    closeInfoPanel: () => void;
}

const NodeInfoContext = createContext<NodeInfoContextType | undefined>(undefined);

export const useNodeInfo = () => {
    const context = useContext(NodeInfoContext);
    if (!context) {
        throw new Error('useNodeInfo must be used within a NodeInfoProvider');
    }
    return context;
};

export const NodeInfoProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeNodeInfo, setActiveNodeInfo] = useState(null);

    const openInfoPanel = useCallback((info: any) => {
        setActiveNodeInfo(info);
        setIsOpen(true);
    }, []);

    const closeInfoPanel = useCallback(() => {
        setIsOpen(false);
        setActiveNodeInfo(null);
    }, []);

    return (
        <NodeInfoContext.Provider value={{ isOpen, activeNodeInfo, openInfoPanel, closeInfoPanel }}>
            {children}
        </NodeInfoContext.Provider>
    );
};
