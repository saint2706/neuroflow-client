import React from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import useNodeCollapse from '../../hooks/useNodeCollapse';
import './CollapsibleNodeWrapper.css';

interface CollapsibleNodeWrapperProps {
    nodeId: string;
    nodeType?: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    statusIndicator?: React.ReactNode;
    infoButton?: React.ReactNode;
    collapsedSummary?: React.ReactNode;
    defaultCollapsed?: boolean;
    forceExpand?: boolean;
    showCollapseToggle?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
    children?: React.ReactNode;
    className?: string;
    headerClassName?: string;
    bodyClassName?: string;
    category?:
    | 'data-source'
    | 'preprocessing'
    | 'dim-reduction'
    | 'regression'
    | 'classification'
    | 'clustering'
    | 'neural-network'
    | 'visualization'
    | 'miscellaneous'
    | string;
}

/**
 * CollapsibleNodeWrapper - Standardized wrapper for all NeuroFlow nodes
 * 
 * Provides visual consistency and collapse/expand functionality.
 * Now supports distinct visual categories.
 * 
 * @component
 */
const CollapsibleNodeWrapper: React.FC<CollapsibleNodeWrapperProps> = ({
    nodeId,
    nodeType,
    title,
    subtitle,
    icon,
    statusIndicator,
    infoButton,
    collapsedSummary,
    defaultCollapsed = false,
    forceExpand = false,
    showCollapseToggle = true,
    onCollapseChange,
    children,
    className = '',
    headerClassName = '',
    bodyClassName = '',
    category = 'miscellaneous' // New prop for visual differentiation
}) => {
    const {
        isCollapsed,
        toggleCollapse,
        canCollapse
    } = useNodeCollapse(nodeId, defaultCollapsed, forceExpand);

    // State to manage overflow visibility (for tooltips/popups)
    const [isOverflowVisible, setIsOverflowVisible] = React.useState(!isCollapsed);

    // Handle overflow state during transitions
    React.useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (!isCollapsed) {
            // If expanding, wait for animation to finish before showing overflow
            timeout = setTimeout(() => {
                setIsOverflowVisible(true);
            }, 300); // Slightly longer than animation duration
        } else {
            // If collapsing, hide overflow immediately
            setIsOverflowVisible(false);
        }
        return () => clearTimeout(timeout);
    }, [isCollapsed]);

    // Notify parent of collapse state changes
    React.useEffect(() => {
        if (onCollapseChange) {
            onCollapseChange(isCollapsed);
        }
    }, [isCollapsed, onCollapseChange]);

    const handleHeaderClick = (e: React.MouseEvent) => {
        // Don't toggle if clicking on info button or other interactive elements
        if ((e.target as HTMLElement).closest('.collapsible-node-info-button')) {
            return;
        }
        if (canCollapse && showCollapseToggle) {
            toggleCollapse();
        }
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canCollapse && showCollapseToggle) {
            toggleCollapse();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Toggle on Enter or Space
        if ((e.key === 'Enter' || e.key === ' ') && canCollapse && showCollapseToggle) {
            e.preventDefault();
            toggleCollapse();
        }
    };

    const categoryClass = `node-category-${category}`;

    return (
        <div
            className={`collapsible-node-wrapper ${categoryClass} ${className} ${isCollapsed ? 'collapsed' : 'expanded'} ${isOverflowVisible ? 'overflow-visible' : ''}`}
            data-node-type={nodeType}
            data-node-category={category}
        >
            {/* Node Header */}
            <div
                className={`collapsible-node-header ${headerClassName} ${canCollapse && showCollapseToggle ? 'clickable' : ''}`}
                onClick={handleHeaderClick}
                onKeyDown={handleKeyDown}
                role={canCollapse && showCollapseToggle ? 'button' : undefined}
                tabIndex={canCollapse && showCollapseToggle ? 0 : undefined}
                aria-expanded={!isCollapsed}
            >
                {/* Left Section: Icon and Title */}
                <div className="collapsible-node-header-left">
                    {icon && <div className="collapsible-node-icon">{icon}</div>}
                    <div className="collapsible-node-title-section">
                        <div className="flex items-center gap-2">
                            <div className="collapsible-node-title" title={title}>{title}</div>
                            {infoButton && (
                                <div className="collapsible-node-info-button-inline" onClick={(e) => e.stopPropagation()}>
                                    {infoButton}
                                </div>
                            )}
                        </div>
                        {subtitle && <div className="collapsible-node-subtitle" title={subtitle}>{subtitle}</div>}
                    </div>
                </div>

                {/* Right Section: Status, Buttons, Toggle */}
                <div className="collapsible-node-header-right">
                    {statusIndicator && (
                        <div className="collapsible-node-status">
                            {statusIndicator}
                        </div>
                    )}



                    {showCollapseToggle && canCollapse && (
                        <button
                            className="collapsible-node-chevron"
                            onClick={handleChevronClick}
                            aria-label={isCollapsed ? "Expand node" : "Collapse node"}
                        >
                            {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsed Summary (Visible only when collapsed) */}
            {isCollapsed && collapsedSummary && (
                <div className="collapsible-node-summary">
                    {collapsedSummary}
                </div>
            )}

            {/* Node Body (Content) */}
            <div
                className={`collapsible-node-body ${bodyClassName} ${!isCollapsed ? 'visible' : 'hidden'} ${isOverflowVisible ? 'overflow-visible' : ''}`}
            >
                {children}
            </div>
        </div>
    );
};

export default CollapsibleNodeWrapper;
