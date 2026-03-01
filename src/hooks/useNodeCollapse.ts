import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing node collapse state
 * 
 * Features:
 * - Persistent collapse state per node
 * - Force expand capability (e.g., during training)
 * - Smooth state transitions
 * - Keyboard accessibility support
 * 
 * @param {string} nodeId - Unique identifier for the node
 * @param {boolean} defaultCollapsed - Initial collapse state (default: false)
 * @param {boolean} forceExpand - Override to force expand (default: false)
 * @returns {Object} Collapse state and control functions
 */
export const useNodeCollapse = (nodeId, defaultCollapsed = false, forceExpand = false) => {
    // Initialize state from localStorage or use default
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (forceExpand) return false;

        try {
            const stored = localStorage.getItem(`node-collapse-${nodeId}`);
            return stored !== null ? JSON.parse(stored) : defaultCollapsed;
        } catch (error) {
            console.warn(`Failed to load collapse state for node ${nodeId}:`, error);
            return defaultCollapsed;
        }
    });

    // Force expand when forceExpand prop changes to true
    useEffect(() => {
        if (forceExpand && isCollapsed) {
            setIsCollapsed(false);
        }
    }, [forceExpand, isCollapsed]);

    // Persist collapse state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(`node-collapse-${nodeId}`, JSON.stringify(isCollapsed));
        } catch (error) {
            console.warn(`Failed to save collapse state for node ${nodeId}:`, error);
        }
    }, [nodeId, isCollapsed]);

    /**
     * Toggle collapse state
     */
    const toggleCollapse = useCallback(() => {
        if (!forceExpand) {
            setIsCollapsed(prev => !prev);
        }
    }, [forceExpand]);

    /**
     * Explicitly set collapse state
     * @param {boolean} collapsed - New collapse state
     */
    const setCollapsed = useCallback((collapsed) => {
        if (!forceExpand) {
            setIsCollapsed(collapsed);
        }
    }, [forceExpand]);

    /**
     * Expand the node
     */
    const expand = useCallback(() => {
        setIsCollapsed(false);
    }, []);

    /**
     * Collapse the node
     */
    const collapse = useCallback(() => {
        if (!forceExpand) {
            setIsCollapsed(true);
        }
    }, [forceExpand]);

    return {
        isCollapsed: forceExpand ? false : isCollapsed,
        toggleCollapse,
        setCollapsed,
        expand,
        collapse,
        canCollapse: !forceExpand
    };
};

/**
 * Hook for managing collapse state for multiple nodes
 * Useful for "Collapse All" / "Expand All" functionality
 * 
 * @returns {Object} Functions to control all nodes
 */
export const useGlobalNodeCollapse = () => {
    const collapseAll = useCallback(() => {
        // Get all node collapse keys from localStorage
        const keys = Object.keys(localStorage).filter(key => key.startsWith('node-collapse-'));
        keys.forEach(key => {
            try {
                localStorage.setItem(key, JSON.stringify(true));
            } catch (error) {
                console.warn(`Failed to collapse node ${key}:`, error);
            }
        });
        // Trigger re-render by dispatching custom event
        window.dispatchEvent(new CustomEvent('nodes-collapse-all'));
    }, []);

    const expandAll = useCallback(() => {
        // Get all node collapse keys from localStorage
        const keys = Object.keys(localStorage).filter(key => key.startsWith('node-collapse-'));
        keys.forEach(key => {
            try {
                localStorage.setItem(key, JSON.stringify(false));
            } catch (error) {
                console.warn(`Failed to expand node ${key}:`, error);
            }
        });
        // Trigger re-render by dispatching custom event
        window.dispatchEvent(new CustomEvent('nodes-expand-all'));
    }, []);

    return {
        collapseAll,
        expandAll
    };
};

export default useNodeCollapse;
