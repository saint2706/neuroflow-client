import React, { useState, useEffect, useMemo, useRef } from 'react';
import './AdvancedDataAnalyticsModal.css';
import { MdClose, MdTableChart, MdBarChart, MdScatterPlot, MdShowChart, MdPieChart, MdBubbleChart, MdTimeline, MdFilterList, MdDownload, MdRefresh } from 'react-icons/md';
import { FaChartLine, FaChartBar, FaChartPie, FaChartArea, FaDatabase, FaCalculator, FaFilter, FaSort, FaSearch } from 'react-icons/fa';

// Simple Chart Renderer Component
const SimpleChartRenderer = ({ chartType, xAxis, yAxis, headers, rows, statistics }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !xAxis) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Get data
        const xIdx = headers.indexOf(xAxis);
        const yIdx = yAxis ? headers.indexOf(yAxis) : -1;

        // Prepare data based on chart type
        let chartData = [];

        if (chartType === 'histogram') {
            // Histogram - frequency distribution
            const values = rows.map(r => r[xIdx]).filter(v => v !== null && v !== undefined && v !== '');
            const numericValues = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));

            if (numericValues.length > 0) {
                const min = Math.min(...numericValues);
                const max = Math.max(...numericValues);
                const bins = 20;
                const binSize = (max - min) / bins;

                const frequency = new Array(bins).fill(0);
                numericValues.forEach(v => {
                    const binIndex = Math.min(Math.floor((v - min) / binSize), bins - 1);
                    frequency[binIndex]++;
                });

                chartData = frequency.map((freq, i) => ({
                    x: (min + i * binSize + min + (i + 1) * binSize) / 2,
                    y: freq,
                    label: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`
                }));
            }
        } else if (yIdx >= 0) {
            // Other charts need both X and Y
            const data = rows.map(r => ({
                x: r[xIdx],
                y: parseFloat(r[yIdx])
            })).filter(d => d.x !== null && d.x !== undefined && !isNaN(d.y));

            if (statistics[xAxis]?.type === 'categorical') {
                // Aggregate by category
                const aggregated = {};
                data.forEach(d => {
                    if (!aggregated[d.x]) {
                        aggregated[d.x] = [];
                    }
                    aggregated[d.x].push(d.y);
                });

                chartData = Object.entries(aggregated).map(([key, values]) => ({
                    x: key,
                    y: values.reduce((a, b) => a + b, 0) / values.length,
                    label: key
                }));
            } else {
                chartData = data.map(d => ({
                    x: parseFloat(d.x),
                    y: d.y,
                    label: d.x
                })).filter(d => !isNaN(d.x));
            }
        }

        if (chartData.length === 0) return;

        // Chart dimensions
        const padding = { top: 40, right: 40, bottom: 80, left: 80 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Find data ranges
        const xValues = chartData.map(d => typeof d.x === 'number' ? d.x : 0);
        const yValues = chartData.map(d => d.y);
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(0, ...yValues);
        const yMax = Math.max(...yValues);

        // Scaling functions
        const scaleX = (val) => {
            if (statistics[xAxis]?.type === 'categorical') {
                const index = chartData.findIndex(d => d.label === val);
                return padding.left + (index / (chartData.length - 1 || 1)) * chartWidth;
            }
            return padding.left + ((val - xMin) / (xMax - xMin || 1)) * chartWidth;
        };

        const scaleY = (val) => {
            return height - padding.bottom - ((val - yMin) / (yMax - yMin || 1)) * chartHeight;
        };

        // Draw axes
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        // Draw grid lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (i / 5) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw Y-axis labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const val = yMax - (i / 5) * (yMax - yMin);
            const y = padding.top + (i / 5) * chartHeight;
            ctx.fillText(val.toFixed(1), padding.left - 10, y + 4);
        }

        // Draw chart based on type
        if (chartType === 'bar' || chartType === 'histogram') {
            const barWidth = chartWidth / chartData.length * 0.8;
            ctx.fillStyle = '#3b82f6';

            chartData.forEach((d, i) => {
                const x = statistics[xAxis]?.type === 'categorical'
                    ? padding.left + (i / chartData.length) * chartWidth + chartWidth / chartData.length * 0.1
                    : scaleX(d.x) - barWidth / 2;
                const y = scaleY(d.y);
                const height = scaleY(yMin) - y;

                ctx.fillRect(x, y, barWidth, height);
            });
        } else if (chartType === 'line') {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.beginPath();

            chartData.forEach((d, i) => {
                const x = scaleX(d.x);
                const y = scaleY(d.y);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw points
            ctx.fillStyle = '#60a5fa';
            chartData.forEach(d => {
                const x = scaleX(d.x);
                const y = scaleY(d.y);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (chartType === 'scatter') {
            ctx.fillStyle = '#3b82f6';
            chartData.forEach(d => {
                const x = scaleX(d.x);
                const y = scaleY(d.y);
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw X-axis tick labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';

        if (statistics[xAxis]?.type === 'categorical') {
            // For categorical data, show category labels
            chartData.forEach((d, i) => {
                const x = padding.left + (i / chartData.length) * chartWidth + chartWidth / (chartData.length * 2);
                const y = height - padding.bottom + 20;

                // Rotate text if there are many categories
                if (chartData.length > 10) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(-Math.PI / 4);
                    ctx.textAlign = 'right';
                    ctx.fillText(String(d.label).substring(0, 15), 0, 0);
                    ctx.restore();
                } else {
                    ctx.fillText(String(d.label).substring(0, 20), x, y);
                }
            });
        } else {
            // For numeric data, show evenly spaced values
            const numTicks = Math.min(8, chartData.length);
            for (let i = 0; i < numTicks; i++) {
                const value = xMin + (i / (numTicks - 1)) * (xMax - xMin);
                const x = scaleX(value);
                const y = height - padding.bottom + 20;
                ctx.fillText(value.toFixed(1), x, y);
            }
        }

        // Draw axis labels (titles)
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(xAxis, width / 2, height - 20);

        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yAxis || 'Frequency', 0, 0);
        ctx.restore();

        // Draw title
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`, width / 2, 25);

    }, [chartType, xAxis, yAxis, headers, rows, statistics]);

    return (
        <div className="chart-container">
            <canvas ref={canvasRef} width={800} height={500} style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
    );
};

const AdvancedDataAnalyticsModal = ({ isOpen, onClose, headers, rows, fileName, onLoadFilteredData }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
    const [filterConfig, setFilterConfig] = useState({});
    const [chartType, setChartType] = useState('bar');
    const [xAxis, setXAxis] = useState('');
    const [yAxis, setYAxis] = useState('');

    // SQL Query state
    const [sqlQuery, setSqlQuery] = useState('');
    const [sqlResult, setSqlResult] = useState(null);
    const [sqlError, setSqlError] = useState('');

    // Load filtered data back to CSV Reader
    const loadFilteredData = () => {
        if (!sqlResult || !onLoadFilteredData) return;

        onLoadFilteredData({
            headers: sqlResult.headers,
            rows: sqlResult.rows
        });

        // Show success message and close modal
        alert(`Successfully loaded ${sqlResult.count} filtered rows into CSV Reader!`);
        onClose();
    };

    // Execute SQL-like query
    const executeSQLQuery = () => {
        setSqlError('');
        setSqlResult(null);

        try {
            const query = sqlQuery.trim().toUpperCase();

            if (!query.startsWith('SELECT')) {
                throw new Error('Query must start with SELECT');
            }

            // Parse SELECT columns
            const selectMatch = query.match(/SELECT\s+(.*?)\s+FROM/i);
            if (!selectMatch) {
                throw new Error('Invalid SELECT syntax. Use: SELECT columns FROM data');
            }

            const selectPart = selectMatch[1].trim();
            let selectedCols = [];
            let selectedIndices = [];

            if (selectPart === '*') {
                selectedCols = [...headers];
                selectedIndices = headers.map((_, i) => i);
            } else {
                const colNames = selectPart.split(',').map(c => c.trim());
                selectedCols = colNames;
                selectedIndices = colNames.map(col => {
                    const idx = headers.findIndex(h => h.toUpperCase() === col.toUpperCase());
                    if (idx === -1) throw new Error(`Column '${col}' not found`);
                    return idx;
                });
            }

            // Start with all rows
            let resultRows = rows.map(row => selectedIndices.map(idx => row[idx]));

            // Parse WHERE clause
            const whereMatch = query.match(/WHERE\s+(.*?)(?:\s+ORDER|\s+LIMIT|$)/i);
            if (whereMatch) {
                const whereClause = whereMatch[1].trim();
                resultRows = resultRows.filter((row, originalIdx) => {
                    return evaluateWhereClause(whereClause, headers, rows[originalIdx]);
                });
            }

            // Parse ORDER BY clause
            const orderMatch = query.match(/ORDER\s+BY\s+(.*?)(?:\s+LIMIT|$)/i);
            if (orderMatch) {
                const orderPart = orderMatch[1].trim();
                const orderParts = orderPart.split(/\s+/);
                const orderCol = orderParts[0];
                const orderDir = orderParts[1]?.toUpperCase() === 'DESC' ? 'desc' : 'asc';

                const orderIdx = selectedCols.findIndex(c => c.toUpperCase() === orderCol.toUpperCase());
                if (orderIdx === -1) throw new Error(`ORDER BY column '${orderCol}' not in SELECT`);

                resultRows.sort((a, b) => {
                    const aVal = a[orderIdx];
                    const bVal = b[orderIdx];
                    const aNum = parseFloat(aVal);
                    const bNum = parseFloat(bVal);

                    let comparison = 0;
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        comparison = aNum - bNum;
                    } else {
                        comparison = String(aVal).localeCompare(String(bVal));
                    }

                    return orderDir === 'asc' ? comparison : -comparison;
                });
            }

            // Parse LIMIT clause
            const limitMatch = query.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                const limit = parseInt(limitMatch[1]);
                resultRows = resultRows.slice(0, limit);
            }

            setSqlResult({
                headers: selectedCols,
                rows: resultRows,
                count: resultRows.length
            });

        } catch (err) {
            setSqlError(err.message);
        }
    };

    // Evaluate WHERE clause
    const evaluateWhereClause = (whereClause, headers, row) => {
        try {
            // Simple WHERE evaluation (supports AND, OR, =, !=, <, >, <=, >=, LIKE)
            let condition = whereClause;

            // Replace column names with values
            headers.forEach((header, idx) => {
                const value = row[idx];
                const numValue = parseFloat(value);

                // Handle LIKE operator
                const likeRegex = new RegExp(`${header}\\s+LIKE\\s+'([^']*)'`, 'gi');
                condition = condition.replace(likeRegex, (match, pattern) => {
                    const regexPattern = pattern.replace(/%/g, '.*');
                    const matches = new RegExp(`^${regexPattern}$`, 'i').test(String(value));
                    return matches ? 'true' : 'false';
                });

                // Replace column references with actual values
                const colRegex = new RegExp(`\\b${header}\\b`, 'gi');
                condition = condition.replace(colRegex, () => {
                    if (!isNaN(numValue)) {
                        return numValue;
                    } else {
                        return `'${String(value).replace(/'/g, "\\'")}'`;
                    }
                });
            });

            // Replace SQL operators with JavaScript operators
            condition = condition.replace(/\s+AND\s+/gi, ' && ');
            condition = condition.replace(/\s+OR\s+/gi, ' || ');
            condition = condition.replace(/\s*=\s*/g, ' === ');
            condition = condition.replace(/\s*!=\s*/g, ' !== ');

            // Evaluate the condition
            return eval(condition);
        } catch (err) {
            return false;
        }
    };

    // Statistics calculation
    const statistics = useMemo(() => {
        if (!rows || rows.length === 0) return {};

        const stats = {};
        headers.forEach((header, idx) => {
            const values = rows.map(row => row[idx]).filter(v => v !== null && v !== undefined && v !== '');
            const numericValues = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));

            stats[header] = {
                count: values.length,
                missing: rows.length - values.length,
                unique: new Set(values).size,
                type: numericValues.length > values.length * 0.5 ? 'numeric' : 'categorical',
            };

            if (numericValues.length > 0) {
                const sorted = [...numericValues].sort((a, b) => a - b);
                const sum = numericValues.reduce((a, b) => a + b, 0);
                const mean = sum / numericValues.length;
                const variance = numericValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numericValues.length;

                stats[header] = {
                    ...stats[header],
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues),
                    mean: mean,
                    median: sorted[Math.floor(sorted.length / 2)],
                    std: Math.sqrt(variance),
                    q1: sorted[Math.floor(sorted.length * 0.25)],
                    q3: sorted[Math.floor(sorted.length * 0.75)],
                };
            } else {
                // Categorical stats
                const frequency = {};
                values.forEach(v => {
                    frequency[v] = (frequency[v] || 0) + 1;
                });
                const sortedFreq = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
                stats[header].topValues = sortedFreq.slice(0, 5);
            }
        });

        return stats;
    }, [headers, rows]);

    // Correlation matrix for numeric columns
    const correlationMatrix = useMemo(() => {
        const numericCols = headers.filter((h, idx) => statistics[h]?.type === 'numeric');
        if (numericCols.length < 2) return null;

        const matrix = {};
        numericCols.forEach(col1 => {
            matrix[col1] = {};
            numericCols.forEach(col2 => {
                const idx1 = headers.indexOf(col1);
                const idx2 = headers.indexOf(col2);

                const values1 = rows.map(r => parseFloat(r[idx1])).filter(v => !isNaN(v));
                const values2 = rows.map(r => parseFloat(r[idx2])).filter(v => !isNaN(v));

                if (values1.length === values2.length && values1.length > 0) {
                    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
                    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

                    let numerator = 0;
                    let denom1 = 0;
                    let denom2 = 0;

                    for (let i = 0; i < values1.length; i++) {
                        const diff1 = values1[i] - mean1;
                        const diff2 = values2[i] - mean2;
                        numerator += diff1 * diff2;
                        denom1 += diff1 * diff1;
                        denom2 += diff2 * diff2;
                    }

                    const correlation = numerator / Math.sqrt(denom1 * denom2);
                    matrix[col1][col2] = isNaN(correlation) ? 0 : correlation;
                } else {
                    matrix[col1][col2] = 0;
                }
            });
        });

        return { columns: numericCols, matrix };
    }, [headers, rows, statistics]);

    // Data quality metrics
    const dataQuality = useMemo(() => {
        const totalCells = rows.length * headers.length;
        const missingCells = Object.values(statistics).reduce((sum, stat) => sum + stat.missing, 0);
        const duplicateRows = rows.length - new Set(rows.map(r => JSON.stringify(r))).size;

        return {
            completeness: ((totalCells - missingCells) / totalCells * 100).toFixed(2),
            duplicates: duplicateRows,
            totalRows: rows.length,
            totalColumns: headers.length,
        };
    }, [headers, rows, statistics]);

    // Filtered and sorted data
    const processedData = useMemo(() => {
        let filtered = [...rows];

        // Apply search
        if (searchTerm) {
            filtered = filtered.filter(row =>
                row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Apply filters
        Object.entries(filterConfig).forEach(([colIdx, filterValue]) => {
            if (filterValue) {
                filtered = filtered.filter(row =>
                    String(row[colIdx]).toLowerCase().includes(filterValue.toLowerCase())
                );
            }
        });

        // Apply sorting
        if (sortConfig.column !== null) {
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.column];
                const bVal = b[sortConfig.column];
                const aNum = parseFloat(aVal);
                const bNum = parseFloat(bVal);

                let comparison = 0;
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    comparison = aNum - bNum;
                } else {
                    comparison = String(aVal).localeCompare(String(bVal));
                }

                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    }, [rows, searchTerm, filterConfig, sortConfig]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            const handleEscape = (e) => {
                if (e.key === 'Escape') onClose();
            };
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('keydown', handleEscape);
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSort = (colIdx) => {
        setSortConfig(prev => ({
            column: colIdx,
            direction: prev.column === colIdx && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleExport = (format) => {
        let content = '';
        const dataToExport = processedData;

        if (format === 'csv') {
            content = [headers.join(','), ...dataToExport.map(row => row.join(','))].join('\n');
            const blob = new Blob([content], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName || 'data'}_export.csv`;
            a.click();
        }
    };

    return (
        <div className="advanced-analytics-overlay" onClick={onClose}>
            <div className="advanced-analytics-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="analytics-header">
                    <div className="analytics-title">
                        <MdTableChart className="title-icon" />
                        <div>
                            <h2>Advanced Data Analytics</h2>
                            <span className="file-name">{fileName}</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <MdClose />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="analytics-tabs">
                    <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                        <FaDatabase /> Overview
                    </button>
                    <button className={activeTab === 'statistics' ? 'active' : ''} onClick={() => setActiveTab('statistics')}>
                        <FaCalculator /> Statistics
                    </button>
                    <button className={activeTab === 'visualizations' ? 'active' : ''} onClick={() => setActiveTab('visualizations')}>
                        <MdBarChart /> Visualizations
                    </button>
                    <button className={activeTab === 'correlation' ? 'active' : ''} onClick={() => setActiveTab('correlation')}>
                        <MdBubbleChart /> Correlations
                    </button>
                    <button className={activeTab === 'quality' ? 'active' : ''} onClick={() => setActiveTab('quality')}>
                        <MdFilterList /> Data Quality
                    </button>
                    <button className={activeTab === 'sql' ? 'active' : ''} onClick={() => setActiveTab('sql')}>
                        <FaDatabase /> SQL Query
                    </button>
                    <button className={activeTab === 'table' ? 'active' : ''} onClick={() => setActiveTab('table')}>
                        <MdTableChart /> Full Table
                    </button>
                </div>

                {/* Content Area */}
                <div className="analytics-content">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="overview-tab">
                            <div className="metrics-grid">
                                <div className="metric-card">
                                    <div className="metric-icon rows"><MdTableChart /></div>
                                    <div className="metric-info">
                                        <div className="metric-value">{dataQuality.totalRows.toLocaleString()}</div>
                                        <div className="metric-label">Total Rows</div>
                                    </div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-icon cols"><MdBarChart /></div>
                                    <div className="metric-info">
                                        <div className="metric-value">{dataQuality.totalColumns}</div>
                                        <div className="metric-label">Columns</div>
                                    </div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-icon quality"><MdShowChart /></div>
                                    <div className="metric-info">
                                        <div className="metric-value">{dataQuality.completeness}%</div>
                                        <div className="metric-label">Data Completeness</div>
                                    </div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-icon duplicates"><MdFilterList /></div>
                                    <div className="metric-info">
                                        <div className="metric-value">{dataQuality.duplicates}</div>
                                        <div className="metric-label">Duplicate Rows</div>
                                    </div>
                                </div>
                            </div>

                            <div className="column-overview">
                                <h3>Column Summary</h3>
                                <div className="column-grid">
                                    {headers.map((header, idx) => (
                                        <div key={idx} className="column-card">
                                            <div className="column-header">
                                                <span className="column-name">{header}</span>
                                                <span className={`column-type ${statistics[header]?.type}`}>
                                                    {statistics[header]?.type}
                                                </span>
                                            </div>
                                            <div className="column-stats">
                                                <div className="stat-item">
                                                    <span className="stat-label">Count:</span>
                                                    <span className="stat-value">{statistics[header]?.count}</span>
                                                </div>
                                                <div className="stat-item">
                                                    <span className="stat-label">Unique:</span>
                                                    <span className="stat-value">{statistics[header]?.unique}</span>
                                                </div>
                                                <div className="stat-item">
                                                    <span className="stat-label">Missing:</span>
                                                    <span className="stat-value missing">{statistics[header]?.missing}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Statistics Tab */}
                    {activeTab === 'statistics' && (
                        <div className="statistics-tab">
                            <h3>Detailed Statistics</h3>
                            <div className="stats-table-wrapper">
                                <table className="stats-table">
                                    <thead>
                                        <tr>
                                            <th>Column</th>
                                            <th>Type</th>
                                            <th>Count</th>
                                            <th>Missing</th>
                                            <th>Unique</th>
                                            <th>Min/Top</th>
                                            <th>Max/Freq</th>
                                            <th>Mean</th>
                                            <th>Median</th>
                                            <th>Std Dev</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {headers.map((header, idx) => {
                                            const stat = statistics[header];
                                            return (
                                                <tr key={idx}>
                                                    <td className="col-name">{header}</td>
                                                    <td><span className={`type-badge ${stat.type}`}>{stat.type}</span></td>
                                                    <td>{stat.count}</td>
                                                    <td className={stat.missing > 0 ? 'warning' : ''}>{stat.missing}</td>
                                                    <td>{stat.unique}</td>
                                                    <td>{stat.type === 'numeric' ? stat.min?.toFixed(2) : (stat.topValues?.[0]?.[0] || '-')}</td>
                                                    <td>{stat.type === 'numeric' ? stat.max?.toFixed(2) : (stat.topValues?.[0]?.[1] || '-')}</td>
                                                    <td>{stat.mean?.toFixed(2) || '-'}</td>
                                                    <td>{stat.median?.toFixed(2) || '-'}</td>
                                                    <td>{stat.std?.toFixed(2) || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Visualizations Tab */}
                    {activeTab === 'visualizations' && (
                        <div className="visualizations-tab">
                            <div className="viz-controls">
                                <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                                    <option value="bar">Bar Chart</option>
                                    <option value="line">Line Chart</option>
                                    <option value="scatter">Scatter Plot</option>
                                    <option value="histogram">Histogram</option>
                                </select>
                                <select value={xAxis} onChange={(e) => setXAxis(e.target.value)}>
                                    <option value="">Select X-Axis</option>
                                    {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                </select>
                                {chartType !== 'histogram' && (
                                    <select value={yAxis} onChange={(e) => setYAxis(e.target.value)}>
                                        <option value="">Select Y-Axis</option>
                                        {headers.filter(h => statistics[h]?.type === 'numeric').map((h, i) => <option key={i} value={h}>{h}</option>)}
                                    </select>
                                )}
                            </div>

                            {xAxis && (chartType === 'histogram' || yAxis) ? (
                                <SimpleChartRenderer
                                    chartType={chartType}
                                    xAxis={xAxis}
                                    yAxis={yAxis}
                                    headers={headers}
                                    rows={rows}
                                    statistics={statistics}
                                />
                            ) : (
                                <div className="viz-placeholder">
                                    <MdBarChart className="viz-icon" />
                                    <p>Select columns to generate visualization</p>
                                    <small>Choose X-axis{chartType !== 'histogram' ? ' and Y-axis' : ''} to see the chart</small>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Correlation Tab */}
                    {activeTab === 'correlation' && correlationMatrix && (
                        <div className="correlation-tab">
                            <h3>Correlation Matrix</h3>
                            <div className="correlation-matrix">
                                <table className="corr-table">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            {correlationMatrix.columns.map((col, i) => (
                                                <th key={i}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {correlationMatrix.columns.map((row, i) => (
                                            <tr key={i}>
                                                <th>{row}</th>
                                                {correlationMatrix.columns.map((col, j) => {
                                                    const corr = correlationMatrix.matrix[row][col];
                                                    const intensity = Math.abs(corr);
                                                    const color = corr > 0 ? `rgba(76, 175, 80, ${intensity})` : `rgba(244, 67, 54, ${intensity})`;
                                                    return (
                                                        <td key={j} style={{ background: color, color: intensity > 0.5 ? 'white' : 'black' }}>
                                                            {corr.toFixed(2)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Data Quality Tab */}
                    {activeTab === 'quality' && (
                        <div className="quality-tab">
                            <h3>Data Quality Report</h3>
                            <div className="quality-metrics">
                                <div className="quality-card">
                                    <h4>Completeness</h4>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${dataQuality.completeness}%` }}></div>
                                    </div>
                                    <span>{dataQuality.completeness}%</span>
                                </div>
                                <div className="quality-card">
                                    <h4>Missing Values by Column</h4>
                                    <div className="missing-list">
                                        {headers.map((h, i) => statistics[h].missing > 0 && (
                                            <div key={i} className="missing-item">
                                                <span>{h}</span>
                                                <span className="missing-count">{statistics[h].missing} ({(statistics[h].missing / rows.length * 100).toFixed(1)}%)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SQL Query Tab */}
                    {activeTab === 'sql' && (
                        <div className="sql-tab">
                            <h3>SQL Query Editor</h3>
                            <div className="sql-info">
                                <p>Write SQL-like queries to filter and analyze your data. Table name is <code>data</code>.</p>
                                <div className="sql-examples">
                                    <strong>Examples:</strong>
                                    <div className="example-queries">
                                        <code onClick={() => setSqlQuery('SELECT * FROM data LIMIT 10')}>
                                            SELECT * FROM data LIMIT 10
                                        </code>
                                        <code onClick={() => setSqlQuery(`SELECT ${headers[0] || 'column'} FROM data WHERE ${headers[0] || 'column'} > 100`)}>
                                            SELECT column FROM data WHERE column &gt; 100
                                        </code>
                                        <code onClick={() => setSqlQuery(`SELECT * FROM data ORDER BY ${headers[0] || 'column'} DESC`)}>
                                            SELECT * FROM data ORDER BY column DESC
                                        </code>
                                        <code onClick={() => setSqlQuery(`SELECT ${headers.slice(0, 2).join(', ') || 'col1, col2'} FROM data WHERE ${headers[0] || 'column'} LIKE '%value%'`)}>
                                            SELECT columns FROM data WHERE column LIKE '%value%'
                                        </code>
                                    </div>
                                </div>
                            </div>

                            <div className="sql-editor">
                                <textarea
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    placeholder="SELECT * FROM data WHERE ..."
                                    rows={6}
                                />
                                <button className="execute-btn" onClick={executeSQLQuery}>
                                    <MdRefresh /> Execute Query
                                </button>
                            </div>

                            {sqlError && (
                                <div className="sql-error">
                                    <strong>Error:</strong> {sqlError}
                                </div>
                            )}

                            {sqlResult && (
                                <div className="sql-results">
                                    <div className="results-header">
                                        <h4>Query Results</h4>
                                        <div className="results-actions">
                                            <span className="result-count">{sqlResult.count} rows returned</span>
                                            {onLoadFilteredData && (
                                                <button className="load-data-btn" onClick={loadFilteredData} title="Replace CSV Reader data with these filtered results">
                                                    <MdDownload /> Load Filtered Data
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="results-table-wrapper">
                                        <table className="results-table">
                                            <thead>
                                                <tr>
                                                    <th className="row-num">#</th>
                                                    {sqlResult.headers.map((h, idx) => (
                                                        <th key={idx}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sqlResult.rows.map((row, rIdx) => (
                                                    <tr key={rIdx}>
                                                        <td className="row-num">{rIdx + 1}</td>
                                                        {row.map((cell, cIdx) => (
                                                            <td key={cIdx}>{String(cell ?? '')}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Full Table Tab */}
                    {activeTab === 'table' && (
                        <div className="table-tab">
                            <div className="table-controls">
                                <div className="search-box">
                                    <FaSearch />
                                    <input
                                        type="text"
                                        placeholder="Search across all columns..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button className="export-btn" onClick={() => handleExport('csv')}>
                                    <MdDownload /> Export CSV
                                </button>
                            </div>
                            <div className="table-info">
                                Showing {processedData.length} of {rows.length} rows
                            </div>
                            <div className="full-table-scroll">
                                <table className="full-data-table">
                                    <thead>
                                        <tr>
                                            <th className="row-num">#</th>
                                            {headers.map((h, idx) => (
                                                <th key={idx} onClick={() => handleSort(idx)} className="sortable">
                                                    {h}
                                                    {sortConfig.column === idx && (
                                                        <span className="sort-indicator">
                                                            {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                                                        </span>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedData.map((row, rIdx) => (
                                            <tr key={rIdx}>
                                                <td className="row-num">{rIdx + 1}</td>
                                                {row.map((cell, cIdx) => (
                                                    <td key={cIdx}>{String(cell ?? '')}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdvancedDataAnalyticsModal;
