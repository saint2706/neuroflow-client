import React, { useMemo, useState, useEffect } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Bar, Scatter, Line } from 'react-chartjs-2';
import { FaTable, FaChartBar, FaEye, FaExclamationCircle } from 'react-icons/fa';
import './GenericVisualizerNode.css';

// Register Chart.js components locally to ensure they are available
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const GenericVisualizerNode = ({ id, data, isConnectable }) => {
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'table' | 'visuals'
    const [chartType, setChartType] = useState('auto'); // 'auto' | 'bar' | 'histogram' | 'scatter'
    const [selectedCol1, setSelectedCol1] = useState('');
    const [selectedCol2, setSelectedCol2] = useState('');

    // 1. Fetch Upstream Data
    const upstreamData = useStore((store) => {
        const edges = store.edges.filter((e) => e.target === id);
        if (edges.length === 0) return null;

        // Prioritize the first connected edge
        const edge = edges[0];
        const node = store.nodeInternals.get(edge.source);
        if (!node || !node.data) return null;

        // Normalize data from various node types
        const nodeType = node.type;
        const nodeData = node.data;

        let rows = [];
        let headers = [];
        let sourceName = nodeData.label || nodeType;

        // Exhaustive mapping of potential data sources
        if (nodeData.headers) headers = nodeData.headers;
        else if (nodeData.selectedHeaders) headers = nodeData.selectedHeaders;
        else if (nodeData.pcaHeaders) headers = nodeData.pcaHeaders;
        else if (nodeData.svdHeaders) headers = nodeData.svdHeaders;
        else if (nodeData.clusteredHeaders) headers = nodeData.clusteredHeaders;

        // Rows mapping
        if (nodeData.rows) rows = nodeData.rows; // CSV, Database, Converter
        else if (nodeData.cleanedRows) rows = nodeData.cleanedRows; // Cleaner
        else if (nodeData.encodedRows) rows = nodeData.encodedRows; // Encoder
        else if (nodeData.normalizedRows) rows = nodeData.normalizedRows; // Normalizer
        else if (nodeData.selectedRows) rows = nodeData.selectedRows; // Feature Selector
        else if (nodeData.pcaRows) rows = nodeData.pcaRows; // PCA
        else if (nodeData.svdRows) rows = nodeData.svdRows; // SVD
        else if (nodeData.clusteredData) rows = nodeData.clusteredData; // Clustering

        // Fallback/Validation
        if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
        if (!headers || !Array.isArray(headers) || headers.length === 0) {
            // Auto-generate headers if missing but rows exist (e.g. simple arrays)
            if (rows[0] && Array.isArray(rows[0])) {
                headers = rows[0].map((_, i) => `Col_${i}`);
            } else {
                return null;
            }
        }

        return { rows, headers, sourceName, nodeType };
    });

    // 2. Data Analysis (Memoized)
    const stats = useMemo(() => {
        if (!upstreamData) return null;
        const { rows, headers } = upstreamData;

        const totalRows = rows.length;
        const totalCols = headers.length;

        // Analyze column types based on first 50 rows sample
        const sampleSize = Math.min(rows.length, 50);
        const sampleRows = rows.slice(0, sampleSize);

        let numericCols = 0;
        let categoricalCols = 0;
        let missingValues = 0;
        const colTypes = {}; // Map col name -> 'numeric' | 'categorical'

        headers.forEach((header, idx) => {
            let isNum = true;
            let validCount = 0;

            for (let r = 0; r < sampleSize; r++) {
                const val = sampleRows[r][idx];
                if (val === null || val === undefined || val === '') {
                    missingValues++; // Count missing in sample (scaled up estimation could be done but keep simple)
                    continue;
                }
                if (isNaN(Number(val))) {
                    isNum = false;
                } else {
                    validCount++;
                }
            }

            // Refine logic: if all non-empty are numeric, it's numeric.
            if (isNum && validCount > 0) {
                numericCols++;
                colTypes[header] = 'numeric';
            } else {
                categoricalCols++;
                colTypes[header] = 'categorical';
            }
        });

        return { totalRows, totalCols, numericCols, categoricalCols, missingValues, colTypes };
    }, [upstreamData]);

    // 3. Visualization Data Prep
    const chartData = useMemo(() => {
        if (!upstreamData || activeTab !== 'visuals' || !selectedCol1) return null;
        const { rows, headers } = upstreamData;
        const { colTypes } = stats;

        const col1Idx = headers.indexOf(selectedCol1);
        if (col1Idx === -1) return null;

        // Detect chart type "auto"
        let effectiveType = chartType;
        if (chartType === 'auto') {
            if (selectedCol2) {
                effectiveType = 'scatter';
            } else {
                effectiveType = colTypes[selectedCol1] === 'numeric' ? 'histogram' : 'bar';
            }
        }

        // Prepare Data
        // Limit rows for performance if needed (e.g. scatter plot with 10k points is slow in simple canvas)
        // ChartJS handles ~1000 well.
        const maxPoints = 5000;
        const dataSlice = rows.slice(0, maxPoints);

        if (effectiveType === 'bar') {
            // Frequency Count
            const counts = {};
            dataSlice.forEach(row => {
                const val = row[col1Idx];
                counts[val] = (counts[val] || 0) + 1;
            });

            // Sort by count
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20); // Top 20

            return {
                type: 'bar',
                data: {
                    labels: sorted.map(k => k[0]),
                    datasets: [{
                        label: 'Frequency',
                        data: sorted.map(k => k[1]),
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            };
        }
        else if (effectiveType === 'histogram') {
            // Simple Binning
            const values = dataSlice.map(r => Number(r[col1Idx])).filter(v => !isNaN(v));
            if (values.length === 0) return null;

            const min = Math.min(...values);
            const max = Math.max(...values);
            const binCount = 10;
            const binWidth = (max - min) / binCount;

            const bins = new Array(binCount).fill(0);
            const labels = new Array(binCount).fill('');

            values.forEach(v => {
                const binIdx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
                bins[binIdx]++;
            });

            for (let i = 0; i < binCount; i++) {
                labels[i] = `${(min + i * binWidth).toFixed(1)} - ${(min + (i + 1) * binWidth).toFixed(1)}`;
            }

            return {
                type: 'bar', // Histogram is a bar chart
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Frequency',
                        data: bins,
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: 'rgb(16, 185, 129)',
                        borderWidth: 1,
                        barPercentage: 1.0,
                        categoryPercentage: 1.0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { grid: { offset: false } } }
                }
            };
        }
        else if (effectiveType === 'scatter' && selectedCol2) {
            const col2Idx = headers.indexOf(selectedCol2);
            const points = dataSlice.map(r => ({
                x: Number(r[col1Idx]),
                y: Number(r[col2Idx])
            })).filter(p => !isNaN(p.x) && !isNaN(p.y));

            return {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: `${selectedCol1} vs ${selectedCol2}`,
                        data: points,
                        backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: selectedCol1 } },
                        y: { title: { display: true, text: selectedCol2 } }
                    }
                }
            };
        }

        return null;
    }, [upstreamData, activeTab, chartType, selectedCol1, selectedCol2, stats]);


    // Initialize default selection
    useEffect(() => {
        if (upstreamData && !selectedCol1) {
            // Default to first numeric col, or first col
            const { headers } = upstreamData;
            const { colTypes } = stats || {};
            const firstNum = headers.find(h => colTypes && colTypes[h] === 'numeric');
            setSelectedCol1(firstNum || headers[0]);
        }
    }, [upstreamData, stats, selectedCol1]);


    // --- Render ---

    if (!upstreamData) {
        return (
            <div className="generic-visualizer-node">
                <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="gv-handle" />
                <div className="gv-empty-state">
                    <div className="gv-empty-icon"><FaExclamationCircle /></div>
                    <div>No data connected.</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '8px' }}>Connect a data node (CSV, PCA, Cleaner, etc.) to start.</div>
                </div>
            </div>
        );
    }

    const { rows, headers, sourceName } = upstreamData;

    return (
        <div className="generic-visualizer-node">
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="gv-handle" />
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="gv-handle" />

            {/* Header */}
            <div className="gv-header">
                <div className="gv-title">Generic Visualizer</div>
                <div className="gv-badge-source">{sourceName}</div>
            </div>

            {/* Overview Cards */}
            <div className="gv-overview-grid">
                <div className="gv-stat-card">
                    <div className="gv-stat-value">{stats.totalRows.toLocaleString()}</div>
                    <div className="gv-stat-label">Total Rows</div>
                </div>
                <div className="gv-stat-card">
                    <div className="gv-stat-value">{stats.totalCols}</div>
                    <div className="gv-stat-label">Columns</div>
                </div>
                <div className="gv-stat-card">
                    <div className="gv-stat-value" style={{ color: '#059669' }}>{stats.numericCols}</div>
                    <div className="gv-stat-label">Numeric</div>
                </div>
                <div className="gv-stat-card">
                    <div className="gv-stat-value" style={{ color: '#ea580c' }}>{stats.categoricalCols}</div>
                    <div className="gv-stat-label">Categorical</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="gv-tabs">
                <div className={`gv-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    <FaEye style={{ marginRight: 6 }} /> Preview
                </div>
                <div className={`gv-tab ${activeTab === 'visuals' ? 'active' : ''}`} onClick={() => setActiveTab('visuals')}>
                    <FaChartBar style={{ marginRight: 6 }} /> Visualize
                </div>
            </div>

            {/* Content */}
            <div className="gv-content">
                {activeTab === 'overview' && (
                    <div className="gv-table-container">
                        <table className="gv-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    {headers.map(h => <th key={h}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 10).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <td style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{rIdx + 1}</td>
                                        {row.map((val, cIdx) => (
                                            <td key={cIdx}>
                                                {typeof val === 'number' ? val.toFixed(4).replace(/\.0000$/, '') : String(val)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                            Showing first 10 rows of {rows.length}
                        </div>
                    </div>
                )}

                {activeTab === 'visuals' && (
                    <div>
                        <div className="gv-controls">
                            <div className="gv-control-group">
                                <label className="gv-control-label">Chart Type</label>
                                <select className="gv-select" value={chartType} onChange={e => setChartType(e.target.value)}>
                                    <option value="auto">Auto (Smart)</option>
                                    <option value="bar">Bar (Freq)</option>
                                    <option value="histogram">Histogram</option>
                                    <option value="scatter">Scatter Plot</option>
                                </select>
                            </div>
                            <div className="gv-control-group">
                                <label className="gv-control-label">X Axis / Category</label>
                                <select className="gv-select" value={selectedCol1} onChange={e => setSelectedCol1(e.target.value)}>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className="gv-control-group">
                                <label className="gv-control-label">Y Axis (Optional)</label>
                                <select className="gv-select" value={selectedCol2} onChange={e => setSelectedCol2(e.target.value)}>
                                    <option value="">None (Frequency)</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="gv-chart-container">
                            {chartData ? (
                                chartData.type === 'bar' ? (
                                    <Bar data={chartData.data} options={chartData.options} />
                                ) : chartData.type === 'scatter' ? (
                                    <Scatter data={chartData.data} options={chartData.options} />
                                ) : null
                            ) : (
                                <div className="gv-empty-state" style={{ height: '100%' }}>
                                    Select columns to visualize
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(GenericVisualizerNode);
