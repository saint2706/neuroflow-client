import React, { useMemo, useState } from 'react';
import { MdClose, MdExpandMore, MdExpandLess } from 'react-icons/md';
import './ClusterVisualizerModal.css';

const DendrogramModal = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const [showGuide, setShowGuide] = useState(true);

    const { dendrogram, cutHeight, nClusters, linkageMethod, distanceMetric, sampleData, headers } = data;

    // Calculate dimensions based on number of samples
    const numSamples = dendrogram?.leaves?.length || dendrogram?.ivl?.length || 50;
    const sampleWidth = 60; // Width per sample for spacing
    const width = Math.max(1200, numSamples * sampleWidth);
    const height = 1400; // Much taller for better vertical spacing
    const padding = { top: 100, right: 80, bottom: 280, left: 120 }; // Increased padding all around

    // Calculate scales and bounds
    const scales = useMemo(() => {
        if (!dendrogram || !dendrogram.icoord || !dendrogram.dcoord) {
            return null;
        }

        // Find bounds from dendrogram data
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        dendrogram.icoord.forEach(coords => {
            coords.forEach(x => {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
            });
        });

        dendrogram.dcoord.forEach(coords => {
            coords.forEach(y => {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            });
        });

        // Add small padding to bounds
        const xPadding = (maxX - minX) * 0.02;
        const yPadding = (maxY - minY) * 0.05;

        minX -= xPadding;
        maxX += xPadding;
        minY = Math.max(0, minY - yPadding); // Don't go below 0
        maxY += yPadding;

        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        // X scale maps dendrogram x-coordinates to SVG x-coordinates
        const xScale = (val) => {
            return padding.left + ((val - minX) / (maxX - minX)) * plotWidth;
        };

        // Y scale maps dendrogram y-coordinates (heights) to SVG y-coordinates
        // FLIP: Higher values should be at the top
        const yScale = (val) => {
            return padding.top + ((maxY - val) / (maxY - minY)) * plotHeight;
        };

        return { xScale, yScale, minX, maxX, minY, maxY };
    }, [dendrogram, width, height, padding]);

    if (!scales) {
        return (
            <div className="cluster-modal-overlay">
                <div className="cluster-modal-content">
                    <div className="cluster-modal-header">
                        <h3>Dendrogram Visualization</h3>
                        <button className="close-btn" onClick={onClose}>
                            <MdClose />
                        </button>
                    </div>
                    <div className="cluster-modal-body">
                        <p>No dendrogram data available.</p>
                    </div>
                </div>
            </div>
        );
    }

    const { xScale, yScale, minX, maxX, minY, maxY } = scales;

    // Generate Y-axis ticks (Height/Distance axis)
    const yTicks = [];
    const yTickCount = 10;
    for (let i = 0; i <= yTickCount; i++) {
        const value = minY + (i / yTickCount) * (maxY - minY);
        yTicks.push(value);
    }

    // Get sample labels from dendrogram
    const sampleLabels = dendrogram.ivl || [];

    // Extract actual leaf positions from dendrogram
    // In scipy's dendrogram, leaves are at positions 5, 15, 25, 35, etc. (increments of 10)
    // We need to find the x-coordinates where the vertical lines touch the bottom
    const labelPositions = [];
    if (sampleLabels.length > 0 && dendrogram.icoord && dendrogram.dcoord) {
        // Find all unique x-coordinates where y=0 (bottom of dendrogram)
        const leafXCoords = new Set();

        dendrogram.icoord.forEach((icoord, idx) => {
            const dcoord = dendrogram.dcoord[idx];
            // Check each point in the segment
            for (let i = 0; i < icoord.length; i++) {
                // If this point is at the bottom (y ≈ 0), it's a leaf position
                if (Math.abs(dcoord[i]) < 0.01) {
                    leafXCoords.add(icoord[i]);
                }
            }
        });

        // Convert to sorted array
        const sortedLeafX = Array.from(leafXCoords).sort((a, b) => a - b);

        // Use these positions for labels
        sortedLeafX.forEach(x => {
            labelPositions.push(x);
        });
    }

    return (
        <div className="cluster-modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div className="cluster-modal-content" style={{
                width: '95vw',
                height: '95vh',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Fixed Header */}
                <div className="cluster-modal-header" style={{
                    padding: '16px 24px',
                    borderBottom: '2px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>
                            Cluster Dendrogram
                        </h3>
                        <div style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9 }}>
                            {linkageMethod.toUpperCase()} linkage • {distanceMetric.toUpperCase()} distance • {nClusters} clusters • Cut: {cutHeight?.toFixed(3)}
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: 'white',
                        padding: '8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}>
                        <MdClose />
                    </button>
                </div>

                {/* Main Content Area with Sidebar and Graph */}
                <div style={{
                    display: 'flex',
                    flexGrow: 1,
                    overflow: 'hidden'
                }}>
                    {/* Left Sidebar - How to Read Guide */}
                    <div style={{
                        width: '280px',
                        flexShrink: 0,
                        background: '#f8fafc',
                        borderRight: '2px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {/* Guide Header */}
                        <div
                            onClick={() => setShowGuide(!showGuide)}
                            style={{
                                padding: '16px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                userSelect: 'none',
                                borderBottom: '1px solid rgba(255,255,255,0.2)'
                            }}
                        >
                            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                                📊 How to Read
                            </div>
                            <div style={{ fontSize: '20px' }}>
                                {showGuide ? <MdExpandLess /> : <MdExpandMore />}
                            </div>
                        </div>

                        {/* Guide Content */}
                        {showGuide && (
                            <div style={{
                                padding: '16px',
                                overflowY: 'auto',
                                fontSize: '0.85rem',
                                lineHeight: '1.6'
                            }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        fontWeight: '700',
                                        color: '#2563eb',
                                        marginBottom: '8px',
                                        fontSize: '0.9rem'
                                    }}>
                                        Understanding the Dendrogram
                                    </div>
                                    <div style={{ color: '#64748b' }}>
                                        Shows how samples are hierarchically grouped based on similarity.
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                                    <strong style={{ color: '#1e293b' }}>• Vertical Lines</strong>
                                    <div style={{ color: '#64748b', marginTop: '4px', paddingLeft: '12px' }}>
                                        Represent individual samples or clusters
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                                    <strong style={{ color: '#1e293b' }}>• Horizontal Lines</strong>
                                    <div style={{ color: '#64748b', marginTop: '4px', paddingLeft: '12px' }}>
                                        Connect clusters being merged
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                                    <strong style={{ color: '#1e293b' }}>• Height</strong>
                                    <div style={{ color: '#64748b', marginTop: '4px', paddingLeft: '12px' }}>
                                        Y-axis shows distance between clusters. Lower = more similar.
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                                    <strong style={{ color: '#dc2626' }}>• Red Dashed Line</strong>
                                    <div style={{ color: '#64748b', marginTop: '4px', paddingLeft: '12px' }}>
                                        Cut point forming {nClusters} clusters
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                                    <strong style={{ color: '#1e293b' }}>• Sample Labels</strong>
                                    <div style={{ color: '#64748b', marginTop: '4px', paddingLeft: '12px' }}>
                                        Individual sample identifiers at the bottom
                                    </div>
                                </div>

                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px',
                                    background: '#dbeafe',
                                    borderLeft: '3px solid #2563eb',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ fontWeight: '700', color: '#1e40af', marginBottom: '6px', fontSize: '0.85rem' }}>
                                        💡 Pro Tip
                                    </div>
                                    <div style={{ color: '#1e40af', fontSize: '0.8rem' }}>
                                        Use scrollbars to explore. Samples closer together merged earlier.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side - Scrollable Dendrogram */}
                    <div style={{
                        flexGrow: 1,
                        overflow: 'auto',
                        background: '#fafafa',
                        position: 'relative'
                    }}>
                        <div style={{
                            padding: '20px',
                            minWidth: 'fit-content',
                            minHeight: 'fit-content'
                        }}>
                            <svg width={width} height={height} style={{
                                display: 'block',
                                background: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                border: '1px solid #e5e7eb'
                            }}>
                                {/* Title */}
                                <text
                                    x={width / 2}
                                    y={40}
                                    textAnchor="middle"
                                    fontSize="22"
                                    fontWeight="700"
                                    fill="#1f2937"
                                >
                                    Cluster Dendrogram
                                </text>

                                {/* Plot area background */}
                                <rect
                                    x={padding.left}
                                    y={padding.top}
                                    width={width - padding.left - padding.right}
                                    height={height - padding.top - padding.bottom}
                                    fill="white"
                                    stroke="none"
                                />

                                {/* Horizontal grid lines */}
                                {yTicks.map((value, i) => {
                                    const y = yScale(value);
                                    return (
                                        <line
                                            key={`grid-h-${i}`}
                                            x1={padding.left}
                                            y1={y}
                                            x2={width - padding.right}
                                            y2={y}
                                            stroke="#f0f0f0"
                                            strokeWidth="1"
                                        />
                                    );
                                })}

                                {/* Dendrogram Lines - Classic Black Style */}
                                {dendrogram.icoord.map((icoord, idx) => {
                                    const dcoord = dendrogram.dcoord[idx];

                                    const points = icoord.map((x, i) => ({
                                        x: xScale(x),
                                        y: yScale(dcoord[i])
                                    }));

                                    return (
                                        <path
                                            key={`dend-${idx}`}
                                            d={`M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                            fill="none"
                                            strokeLinecap="square"
                                            strokeLinejoin="miter"
                                        />
                                    );
                                })}

                                {/* Cut Line - Red Dashed */}
                                {cutHeight !== undefined && cutHeight !== null && (
                                    <line
                                        x1={padding.left}
                                        y1={yScale(cutHeight)}
                                        x2={width - padding.right}
                                        y2={yScale(cutHeight)}
                                        stroke="#dc2626"
                                        strokeWidth="2"
                                        strokeDasharray="8,4"
                                    />
                                )}

                                {/* Y Axis */}
                                <line
                                    x1={padding.left}
                                    y1={padding.top}
                                    x2={padding.left}
                                    y2={height - padding.bottom}
                                    stroke="#000000"
                                    strokeWidth="1.5"
                                />

                                {/* Y Axis Ticks and Labels */}
                                {yTicks.map((value, i) => {
                                    const y = yScale(value);
                                    return (
                                        <g key={`y-tick-${i}`}>
                                            <line
                                                x1={padding.left - 6}
                                                y1={y}
                                                x2={padding.left}
                                                y2={y}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                            />
                                            <text
                                                x={padding.left - 10}
                                                y={y + 4}
                                                textAnchor="end"
                                                fontSize="12"
                                                fill="#000000"
                                                fontFamily="Arial, sans-serif"
                                            >
                                                {value.toFixed(0)}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* Y Axis Label */}
                                <text
                                    x={40}
                                    y={height / 2}
                                    textAnchor="middle"
                                    transform={`rotate(-90, 40, ${height / 2})`}
                                    fontSize="15"
                                    fontWeight="400"
                                    fill="#000000"
                                    fontFamily="Arial, sans-serif"
                                >
                                    Height
                                </text>

                                {/* X Axis (bottom line) */}
                                <line
                                    x1={padding.left}
                                    y1={height - padding.bottom}
                                    x2={width - padding.right}
                                    y2={height - padding.bottom}
                                    stroke="#000000"
                                    strokeWidth="1.5"
                                />

                                {/* Sample Labels at Bottom */}
                                {sampleLabels.map((label, i) => {
                                    const x = xScale(labelPositions[i]);

                                    // The label is the original sample index (as string)
                                    const sampleIndex = parseInt(label, 10);

                                    // Create tooltip text with sample information
                                    let tooltipText = `Index: ${label}`;

                                    // If we have sample data and headers, show the actual data
                                    if (sampleData && !isNaN(sampleIndex) && sampleData[sampleIndex] && headers) {
                                        tooltipText += `\n${'─'.repeat(30)}`;
                                        headers.forEach((header, idx) => {
                                            const value = sampleData[sampleIndex][idx];
                                            tooltipText += `\n${header}: ${value}`;
                                        });
                                    } else {
                                        tooltipText += `\nIndex: ${label}`;
                                        tooltipText += `\nHover to see sample data`;
                                    }

                                    return (
                                        <g key={`label-${i}`}>
                                            {/* Invisible wider hitbox for better hover */}
                                            <rect
                                                x={x - 15}
                                                y={height - padding.bottom}
                                                width={30}
                                                height={padding.bottom - 30}
                                                fill="transparent"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <title>{tooltipText}</title>
                                            </rect>
                                            {/* Label text */}
                                            <text
                                                x={x}
                                                y={height - padding.bottom + 25}
                                                textAnchor="end"
                                                transform={`rotate(-90, ${x}, ${height - padding.bottom + 25})`}
                                                fontSize="11"
                                                fill="#000000"
                                                fontFamily="Arial, sans-serif"
                                                style={{ cursor: 'pointer', pointerEvents: 'none' }}
                                            >
                                                {label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DendrogramModal;
