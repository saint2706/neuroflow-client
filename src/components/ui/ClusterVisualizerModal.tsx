import React, { useMemo, useState } from 'react';
import { MdClose } from 'react-icons/md';
import './ClusterVisualizerModal.css';

const ClusterVisualizerModal = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const { rows, headers, centers, features, pcaData } = data;
    const clusterLabelIdx = headers.indexOf('cluster_label');

    // View modes: 'custom' or 'pca'
    const [viewMode, setViewMode] = useState(pcaData ? 'pca' : 'custom');

    // Axes selection for custom mode
    // Default to first two selected features
    const initialX = features && features.length > 0 ? features[0] : (headers[0] || '');
    const initialY = features && features.length > 1 ? features[1] : (headers.length > 1 ? headers[1] : (headers[0] || ''));

    const [xFeature, setXFeature] = useState(initialX);
    const [yFeature, setYFeature] = useState(initialY);

    const [hoveredPoint, setHoveredPoint] = useState(null);

    const numericHeaders = useMemo(() => {
        // Filter headers to only numeric columns (simple check: try to parse first row)
        if (!rows || rows.length === 0) return headers;
        return headers.filter((h, idx) => {
            // Exclude cluster_label from axis selection usually, or keep it?
            if (h === 'cluster_label') return false;
            const val = rows[0][idx];
            return !isNaN(parseFloat(val));
        });
    }, [headers, rows]);

    // Derived data based on view mode
    const plotData = useMemo(() => {
        if (viewMode === 'pca' && pcaData) {
            return {
                points: pcaData.coords.map((row, i) => ({
                    x: row[0],
                    y: row[1],
                    cluster: clusterLabelIdx !== -1 ? parseInt(rows[i][clusterLabelIdx]) : 0,
                    originalData: rows[i]
                })),
                centroids: pcaData.centroids.map((center, i) => ({
                    x: center[0],
                    y: center[1],
                    cluster: i
                })),
                xLabel: 'Principal Component 1',
                yLabel: 'Principal Component 2',
                explainedVariance: pcaData.variance_ratio
            };
        } else {
            // Custom mode
            const xIdx = headers.indexOf(xFeature);
            const yIdx = headers.indexOf(yFeature);

            return {
                points: rows.map((row, i) => {
                    const cluster = clusterLabelIdx !== -1 ? parseInt(row[clusterLabelIdx]) : 0;
                    let x = parseFloat(row[xIdx]);
                    let y = parseFloat(row[yIdx]);
                    if (isNaN(x)) x = 0;
                    if (isNaN(y)) y = 0;
                    return { x, y, cluster, originalData: rows[i] };
                }),
                centroids: centers ? centers.map((center, i) => {
                    // Center values correspond to `features` list.
                    // We need to find the value corresponding to xFeature and yFeature.
                    // But `centers` only contains values for `features` (the subset used for training).
                    // If user selects a feature NOT in `features` (e.g. from original dataset but not used in training), we can't plot centroid for it.

                    // Check if xFeature is in `features`
                    const featXIdx = features.indexOf(xFeature);
                    const featYIdx = features.indexOf(yFeature);

                    if (featXIdx === -1 || featYIdx === -1) {
                        return null; // Cannot plot centroid if axis is not a training feature
                    }

                    return {
                        x: center[featXIdx],
                        y: center[featYIdx],
                        cluster: i
                    };
                }).filter(c => c !== null) : [],
                xLabel: xFeature,
                yLabel: yFeature
            };
        }
    }, [viewMode, pcaData, xFeature, yFeature, headers, rows, centers, features, clusterLabelIdx]);

    // Calculate bounds
    const bounds = useMemo(() => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        plotData.points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        plotData.centroids.forEach(c => {
            minX = Math.min(minX, c.x);
            maxX = Math.max(maxX, c.x);
            minY = Math.min(minY, c.y);
            maxY = Math.max(maxY, c.y);
        });

        const paramX = (maxX - minX) * 0.1 || 1;
        const paramY = (maxY - minY) * 0.1 || 1;

        return {
            minX: minX - paramX,
            maxX: maxX + paramX,
            minY: minY - paramY,
            maxY: maxY + paramY
        };
    }, [plotData]);

    const width = 600;
    const height = 400;
    const padding = 60;

    const xScale = (val) => {
        return padding + ((val - bounds.minX) / (bounds.maxX - bounds.minX)) * (width - 2 * padding);
    };

    const yScale = (val) => {
        return height - padding - ((val - bounds.minY) / (bounds.maxY - bounds.minY)) * (height - 2 * padding);
    };

    const clusterColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'];

    return (
        <div className="cluster-modal-overlay">
            <div className="cluster-modal-content">
                <div className="cluster-modal-header">
                    <h3>Cluster Visualization</h3>
                    <div className="view-controls">
                        {pcaData && (
                            <div className="mode-toggle">
                                <button
                                    className={viewMode === 'custom' ? 'active' : ''}
                                    onClick={() => setViewMode('custom')}
                                >
                                    Custom Axes
                                </button>
                                <button
                                    className={viewMode === 'pca' ? 'active' : ''}
                                    onClick={() => setViewMode('pca')}
                                    title="Visualize high-dimensional data in 2D using PCA"
                                >
                                    Smart View (PCA)
                                </button>
                            </div>
                        )}
                        <button className="close-btn" onClick={onClose}>
                            <MdClose />
                        </button>
                    </div>
                </div>

                <div className="cluster-modal-body">
                    <div className="visualization-container">

                        {viewMode === 'custom' && (
                            <div className="axis-selectors">
                                <div className="selector">
                                    <label>X Axis:</label>
                                    <select value={xFeature} onChange={(e) => setXFeature(e.target.value)}>
                                        {numericHeaders.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="selector">
                                    <label>Y Axis:</label>
                                    <select value={yFeature} onChange={(e) => setYFeature(e.target.value)}>
                                        {numericHeaders.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {viewMode === 'pca' && plotData.explainedVariance && (
                            <div className="variance-info">
                                PCA Explained Variance: {(plotData.explainedVariance * 100).toFixed(1)}%
                            </div>
                        )}

                        <svg width={width} height={height} className="cluster-plot">
                            {/* Axes */}
                            <line
                                x1={padding} y1={height - padding}
                                x2={width - padding} y2={height - padding}
                                stroke="#ccc" strokeWidth="2"
                            />
                            <line
                                x1={padding} y1={padding}
                                x2={padding} y2={height - padding}
                                stroke="#ccc" strokeWidth="2"
                            />

                            {/* X Axis Ticks and Values */}
                            {(() => {
                                const tickCount = 5;
                                const ticks = [];
                                for (let i = 0; i <= tickCount; i++) {
                                    const value = bounds.minX + (i / tickCount) * (bounds.maxX - bounds.minX);
                                    const x = xScale(value);
                                    ticks.push(
                                        <g key={`x-${i}`}>
                                            <line x1={x} y1={height - padding} x2={x} y2={height - padding + 5} stroke="#ccc" strokeWidth="2" />
                                            <text x={x} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="#666">
                                                {value.toFixed(2)}
                                            </text>
                                        </g>
                                    );
                                }
                                return ticks;
                            })()}

                            {/* Y Axis Ticks and Values */}
                            {(() => {
                                const tickCount = 5;
                                const ticks = [];
                                for (let i = 0; i <= tickCount; i++) {
                                    const value = bounds.minY + (i / tickCount) * (bounds.maxY - bounds.minY);
                                    const y = yScale(value);
                                    ticks.push(
                                        <g key={`y-${i}`}>
                                            <line x1={padding - 5} y1={y} x2={padding} y2={y} stroke="#ccc" strokeWidth="2" />
                                            <text x={padding - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#666">
                                                {value.toFixed(2)}
                                            </text>
                                        </g>
                                    );
                                }
                                return ticks;
                            })()}

                            {/* Axis Labels */}
                            <text x={width / 2} y={height - 10} textAnchor="middle" className="axis-label">{plotData.xLabel}</text>
                            <text x={20} y={height / 2} textAnchor="middle" transform={`rotate(-90, 20, ${height / 2})`} className="axis-label">{plotData.yLabel}</text>

                            {/* Data Points */}
                            {plotData.points.map((p, i) => (
                                <circle
                                    key={i}
                                    cx={xScale(p.x)}
                                    cy={yScale(p.y)}
                                    r={hoveredPoint?.index === i ? 6 : 4}
                                    fill={clusterColors[p.cluster % clusterColors.length]}
                                    opacity={hoveredPoint && hoveredPoint.index !== i ? 0.3 : 0.6}
                                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => {
                                        const rect = e.target.getBoundingClientRect();
                                        // Get parent modal rect to position relative to it
                                        const modalRect = document.querySelector('.cluster-modal-content').getBoundingClientRect();

                                        setHoveredPoint({
                                            index: i,
                                            data: p.originalData,
                                            // Position absolute relative to modal content
                                            x: rect.left - modalRect.left + rect.width / 2,
                                            y: rect.top - modalRect.top - 10
                                        });
                                    }}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                />
                            ))}

                            {/* Centroids */}
                            {plotData.centroids.map((c, i) => {
                                const plotX = xScale(c.x);
                                const plotY = yScale(c.y);
                                return (
                                    <g key={`c-${i}`}>
                                        <path
                                            d={`M ${plotX - 6} ${plotY - 6} L ${plotX + 6} ${plotY + 6} M ${plotX + 6} ${plotY - 6} L ${plotX - 6} ${plotY + 6}`}
                                            stroke="black"
                                            strokeWidth="3"
                                        />
                                        <path
                                            d={`M ${plotX - 6} ${plotY - 6} L ${plotX + 6} ${plotY + 6} M ${plotX + 6} ${plotY - 6} L ${plotX - 6} ${plotY + 6}`}
                                            stroke={clusterColors[c.cluster % clusterColors.length]}
                                            strokeWidth="2"
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Tooltip */}
                        {hoveredPoint && (
                            <div
                                className="cluster-tooltip"
                                style={{
                                    left: hoveredPoint.x,
                                    top: hoveredPoint.y,
                                    transform: 'translate(-50%, -100%)'
                                }}
                            >
                                <div className="tooltip-header">Cluster {hoveredPoint.data[clusterLabelIdx]}</div>
                                <div className="tooltip-body">
                                    {headers.map((h, idx) => {
                                        if (h === 'cluster_label') return null;
                                        // Limit to first 6-8 items to avoid huge tooltip
                                        if (idx > 8) return null;
                                        return (
                                            <div key={h} className="tooltip-row">
                                                <span className="tooltip-label">{h}:</span>
                                                <span className="tooltip-value">{hoveredPoint.data[idx]}</span>
                                            </div>
                                        );
                                    })}
                                    {headers.length > 9 && <div className="tooltip-more">...and more</div>}
                                </div>
                            </div>
                        )}

                        <div className="cluster-legend">
                            {/* We can infer number of clusters from centroids or max cluster index */}
                            {Array.from(new Set(plotData.points.map(p => p.cluster))).sort((a, b) => a - b).map(clusterIdx => (
                                <div key={clusterIdx} className="legend-item">
                                    <div className="legend-color" style={{ background: clusterColors[clusterIdx % clusterColors.length] }}></div>
                                    <span>Cluster {clusterIdx}</span>
                                </div>
                            ))}
                            {plotData.centroids.length > 0 && (
                                <div className="legend-item">
                                    <div className="legend-symbol">✖</div>
                                    <span>Centroid</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClusterVisualizerModal;
