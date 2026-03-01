import React, { useState, useMemo, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import { FaTable, FaCog, FaSync, FaInfoCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './DescribeNode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { describeData } from '../../utils/apiClient';
import InfoButton from '../ui/InfoButton';

const DescribeNode = ({ id, data, isConnectable }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { setNodes } = useReactFlow();

    // Inspect incoming edge to find the upstream node
    const upstreamData = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        if (incoming.length === 0) return null;

        // We only take the first connection for simplicity in this version, 
        // or we could merge but usually nodes have 1 main data input
        const e = incoming[0];
        const src = store.nodeInternals.get(e.source);

        if (!src) return null;

        if (src.type === 'csvReader') {
            return {
                type: 'csv',
                headers: src.data?.headers || [],
                file: src.data?.file
            };
        }
        if (src.type === 'databaseReader') {
            return {
                type: 'database',
                headers: src.data?.headers || [],
                rows: src.data?.rows || []
            };
        }
        if (src.type === 'dataCleaner') {
            return {
                type: 'cleaned',
                headers: src.data?.headers || [],
                rows: src.data?.cleanedRows || []
            };
        }
        if (src.type === 'encoder') {
            return {
                type: 'encoded',
                headers: src.data?.headers || [],
                rows: src.data?.encodedRows || []
            };
        }
        if (src.type === 'normalizer') {
            return {
                type: 'normalized',
                headers: src.data?.headers || [],
                rows: src.data?.normalizedRows || []
            };
        }
        if (src.type === 'featureSelector') {
            return {
                type: 'featureSelector',
                headers: src.data?.selectedHeaders || [],
                rows: src.data?.selectedRows || []
            };
        }
        if (src.type === 'pca') {
            return {
                type: 'pca',
                headers: src.data?.pcaHeaders || [],
                rows: src.data?.pcaRows || []
            };
        }
        if (src.type === 'svd') {
            return {
                type: 'svd',
                headers: src.data?.svdHeaders || [], // Assuming consistent naming, might need check
                rows: src.data?.svdRows || []
            };
        }
        if (src.type === 'dataTypeConverter') {
            return {
                type: 'dataTypeConverter',
                headers: src.data?.headers || [],
                rows: src.data?.convertedRows || []
            };
        }

        // customizable fallback
        return {
            type: 'unknown',
            headers: src.data?.headers || [],
            rows: src.data?.rows || []
        };
    });

    const headers = useMemo(() => upstreamData?.headers || [], [upstreamData]);

    // Reset stats if upstream changes significantly
    useEffect(() => {
        setStatistics(null);
        setError('');
    }, [upstreamData?.type, upstreamData?.file, headers]); // headers change -> reset

    const handleColumnToggle = (col) => {
        setSelectedColumns(prev => {
            if (prev.includes(col)) return prev.filter(c => c !== col);
            return [...prev, col];
        });
    };

    const selectAllColumns = () => {
        if (selectedColumns.length === headers.length) {
            setSelectedColumns([]);
        } else {
            setSelectedColumns([...headers]);
        }
    };

    const onRunDescribe = async () => {
        if (!upstreamData) {
            setError('No input data connected.');
            return;
        }

        setIsLoading(true);
        setError('');
        setStatistics(null);

        try {
            let rows = [];

            if (upstreamData.type === 'csv') {
                if (!upstreamData.file) throw new Error("CSV file not found on upstream node.");
                const parsed = await parseFullTabularFile(upstreamData.file);
                rows = parsed.rows;
            } else {
                rows = upstreamData.rows;
            }

            if (!rows || rows.length === 0) {
                throw new Error("Input dataset is empty.");
            }

            // Call Backend API
            const result = await describeData(rows, headers, selectedColumns.length > 0 ? selectedColumns : headers);

            if (result.success) {
                setStatistics(result.statistics);

                // Pass data through unchanged (as per requirement)
                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    // We pass exactly what we received + maybe the stats as metadata
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            headers: headers,
                            rows: rows, // pass through
                            statistics: result.statistics
                        }
                    };
                }));
            }
        } catch (err) {
            setError(err.message || "Failed to describe data.");
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to get color for type badge
    const getTypeColor = (type) => {
        if (type === 'numeric') return '#48bb78'; // green
        if (type === 'object' || type === 'string/object') return '#ed8936'; // orange
        return '#a0aec0'; // gray
    };

    return (
        <div className={`describe-node ${isExpanded ? 'expanded' : ''}`}>
            <InfoButton nodeType="describeNode" />
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="handle-dot" />
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="handle-dot" />

            <div className="node-header" onDoubleClick={() => setIsExpanded(!isExpanded)}>
                <div className="header-title">
                    <FaTable className="header-icon" />
                    <span>Describe Data</span>
                </div>
                <div className="header-actions">
                    <button className="icon-btn" onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="node-body">
                    {!upstreamData ? (
                        <div className="placeholder-text">Connect a dataset node to begin.</div>
                    ) : (
                        <>
                            <div className="controls-section">
                                <div className="section-label">Selected Columns ({selectedColumns.length === 0 ? 'All' : selectedColumns.length})</div>
                                <div className="column-selector">
                                    <button className="btn-xs" onClick={selectAllColumns}>
                                        {selectedColumns.length === headers.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <div className="columns-list">
                                        {headers.map(h => (
                                            <label key={h} className="col-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedColumns.length === 0 || selectedColumns.includes(h)}
                                                    onChange={() => handleColumnToggle(h)}
                                                />
                                                <span title={h}>{h}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button className="btn primary full-width" onClick={onRunDescribe} disabled={isLoading}>
                                    {isLoading ? <><FaSync className="spin" /> Analyzing...</> : 'Analyze Data'}
                                </button>

                                {error && <div className="error-msg">{error}</div>}
                            </div>

                            {statistics && (
                                <div className="results-section">
                                    {/* Section 1: Data Types */}
                                    <div className="result-block">
                                        <h5>Column Overview</h5>
                                        <div className="table-wrapper">
                                            <table className="stats-table">
                                                <thead>
                                                    <tr>
                                                        <th>Column</th>
                                                        <th>Type</th>
                                                        <th>Count</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {statistics.map((stat, idx) => (
                                                        <tr key={idx}>
                                                            <td>{stat.name}</td>
                                                            <td>
                                                                <span className="type-badge" style={{ backgroundColor: getTypeColor(stat.type) }}>
                                                                    {stat.type}
                                                                </span>
                                                            </td>
                                                            <td>{stat.count}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Section 2: Detailed Stats */}
                                    <div className="result-block">
                                        <h5>Statistical Summary</h5>
                                        <div className="table-wrapper">
                                            <table className="stats-table dense">
                                                <thead>
                                                    <tr>
                                                        <th>Metric</th>
                                                        {statistics.map(s => <th key={s.name}>{s.name}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {['mean', 'std', 'min', '25%', '50%', '75%', 'max', 'variance', 'skewness', 'kurtosis'].map(metric => (
                                                        <tr key={metric}>
                                                            <td className="metric-name">{metric}</td>
                                                            {statistics.map((stat, idx) => (
                                                                <td key={`${stat.name}-${metric}`}>
                                                                    {stat[metric] !== undefined ?
                                                                        (typeof stat[metric] === 'number' ? stat[metric].toFixed(2) : stat[metric])
                                                                        : '-'}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                    {/* Top/Freq for string cols */}
                                                    <tr>
                                                        <td className="metric-name">top</td>
                                                        {statistics.map((stat, idx) => (
                                                            <td key={`${stat.name}-top`}>{stat.top || '-'}</td>
                                                        ))}
                                                    </tr>
                                                    <tr>
                                                        <td className="metric-name">freq</td>
                                                        {statistics.map((stat, idx) => (
                                                            <td key={`${stat.name}-freq`}>{stat.freq || '-'}</td>
                                                        ))}
                                                    </tr>
                                                    <tr>
                                                        <td className="metric-name">unique</td>
                                                        {statistics.map((stat, idx) => (
                                                            <td key={`${stat.name}-unique`}>{stat.unique || '-'}</td>
                                                        ))}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="handle-dot" />
            <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="handle-dot" />
        </div>
    );
};

export default DescribeNode;
