import React, { useState, useMemo, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import { FaRandom, FaSync, FaExclamationTriangle, FaLock, FaLockOpen } from 'react-icons/fa';
import './DataTypeConverterNode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { convertDataTypes, describeData } from '../../utils/apiClient';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';

const DataTypeConverterNode = ({ id, data, isConnectable }) => {
    const [columnTypes, setColumnTypes] = useState({}); // Current detected types
    const [conversions, setConversions] = useState({}); // { colName: targetType }
    const [dateFormats, setDateFormats] = useState({}); // { colName: formatString }

    const [isProcessing, setIsProcessing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    interface ConversionStats {
        [key: string]: { success: number; failed: number };
    }
    const [conversionStats, setConversionStats] = useState<ConversionStats | null>(null);

    const { setNodes } = useReactFlow();

    // Inspect incoming edge (Full logic preserved)
    const upstreamData = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        if (incoming.length === 0) return null;

        const e = incoming[0];
        const src = store.nodeInternals.get(e.source);

        if (!src) return null;

        // Standardize upstream data structure
        let type = 'unknown';
        let headers = [];
        let rows = [];

        if (src.type === 'csvReader') {
            type = 'csv';
            headers = src.data?.headers || [];
            return { type, headers, file: src.data?.file };
        }

        // For other types, rows are directly available
        headers = src.data?.headers || src.data?.selectedHeaders || src.data?.pcaHeaders || [];

        if (src.type === 'databaseReader') rows = src.data?.rows || [];
        else if (src.type === 'dataCleaner') rows = src.data?.cleanedRows || [];
        else if (src.type === 'encoder') rows = src.data?.encodedRows || [];
        else if (src.type === 'normalizer') rows = src.data?.normalizedRows || [];
        else if (src.type === 'featureSelector') rows = src.data?.selectedRows || [];
        else if (src.type === 'pca') rows = src.data?.pcaRows || [];
        else if (src.type === 'describeNode') rows = src.data?.rows || [];
        else if (src.type === 'dataTypeConverter') rows = src.data?.convertedRows || [];

        return { type: src.type, headers, rows };
    });

    const headers = useMemo(() => upstreamData?.headers || [], [upstreamData]);

    // Initial Type Detection on Load
    useEffect(() => {
        const detectTypes = async () => {
            if (!upstreamData) return;
            if (isLocked) return; // Don't reset if locked

            let rowsToAnalyze = [];
            try {
                if (upstreamData.type === 'csv' && upstreamData.file) {
                    const parsed = await parseFullTabularFile(upstreamData.file);
                    rowsToAnalyze = parsed.rows;
                } else {
                    rowsToAnalyze = upstreamData.rows || [];
                }

                if (rowsToAnalyze.length > 0) {
                    const result = await describeData(rowsToAnalyze.slice(0, 100), headers);
                    if (result.success) {
                        const types = {};
                        result.statistics.forEach(stat => {
                            types[stat.name] = stat.type; // 'numeric' or 'object'
                        });
                        setColumnTypes(types);
                    }
                }
            } catch (e) {
                console.error("Auto-detect types failed", e);
            }
        };

        detectTypes();
    }, [upstreamData, headers, isLocked]);

    const handleConversionChange = (col, type) => {
        setConversions(prev => {
            if (type === 'original') {
                const next = { ...prev };
                delete next[col];
                return next;
            }
            return { ...prev, [col]: type };
        });
    };

    const handleDateFormatChange = (col, format) => {
        setDateFormats(prev => ({ ...prev, [col]: format }));
    };

    const applyConversions = async () => {
        if (!upstreamData) return;

        setIsProcessing(true);
        setError('');
        setSuccessMsg('');
        setConversionStats(null);

        try {
            let rows = [];
            if (upstreamData.type === 'csv' && upstreamData.file) {
                const parsed = await parseFullTabularFile(upstreamData.file);
                rows = parsed.rows;
            } else {
                rows = upstreamData.rows || [];
            }

            if (!rows || rows.length === 0) throw new Error("No data available to convert.");

            const result = await convertDataTypes(rows, headers, conversions, dateFormats);

            if (result.success) {
                setConversionStats(result.conversion_metadata);
                setSuccessMsg("Conversions applied successfully.");
                setIsLocked(true);

                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            headers: result.headers,
                            convertedRows: result.data,
                            conversionMetadata: result.conversion_metadata
                        }
                    };
                }));
            }
        } catch (err) {
            setError(err.message || "Conversion failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    const unlock = () => {
        setIsLocked(false);
        setSuccessMsg('');
        setConversionStats(null);
    };

    const getCollapsedSummary = () => {
        if (conversionStats) {
            const count = Object.keys(conversions).length;
            return `Converted ${count} Columns`;
        }
        return `Configure Types (${headers.length} cols)`;
    };

    const getStatusIndicator = () => {
        if (conversionStats) return <div className="status-dot status-trained" title="Types Converted" />;
        if (headers.length > 0) return <div className="status-dot status-configured" title="Ready" />;
        return <div className="status-dot status-not-configured" title="No Data" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="preprocessing" nodeType="dataTypeConverter"
                title={data.label || 'Type Converter'}
                icon={<FaRandom />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="dataTypeConverter" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                className="datatype-converter-node"
            >
                {!upstreamData ? (
                    <div className="placeholder-text">Connect a dataset node to begin.</div>
                ) : (
                    <>
                        <div className="table-wrapper">
                            <table className="converter-table">
                                <thead>
                                    <tr>
                                        <th>Column</th>
                                        <th>Current Type</th>
                                        <th>Target Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headers.map(col => (
                                        <tr key={col}>
                                            <td className="col-name" title={col}>{col}</td>
                                            <td>
                                                <span className={`type-badge ${columnTypes[col] === 'numeric' ? 'green' : 'orange'}`}>
                                                    {columnTypes[col] || '-'}
                                                </span>
                                            </td>
                                            <td>
                                                {!isLocked ? (
                                                    <div className="target-cell">
                                                        <select
                                                            value={conversions[col] || 'original'}
                                                            onChange={(e) => handleConversionChange(col, e.target.value)}
                                                            className="type-select"
                                                        >
                                                            <option value="original">Unchanged</option>
                                                            <option value="integer">Integer</option>
                                                            <option value="float">Float</option>
                                                            <option value="string">String</option>
                                                            <option value="boolean">Boolean</option>
                                                            <option value="datetime">Datetime</option>
                                                        </select>

                                                        {conversions[col] === 'datetime' && (
                                                            <input
                                                                type="text"
                                                                placeholder="Format (auto)"
                                                                className="fmt-input"
                                                                value={dateFormats[col] || ''}
                                                                onChange={(e) => handleDateFormatChange(col, e.target.value)}
                                                                title="e.g. YYYY-MM-DD"
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="locked-val">
                                                        {conversions[col] ? (
                                                            <>
                                                                <span className="target-badge">{conversions[col]}</span>
                                                                {conversions[col] === 'datetime' && dateFormats[col] && (
                                                                    <span className="fmt-badge">{dateFormats[col]}</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="no-change">Unchanged</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="actions-section">
                            {!isLocked ? (
                                <button className="btn primary full-width" onClick={applyConversions} disabled={isProcessing}>
                                    {isProcessing ? <><FaSync className="spin" /> Converting...</> : 'Apply Changes'}
                                </button>
                            ) : (
                                <button className="btn secondary full-width" onClick={unlock}>
                                    <FaLockOpen /> Unlock & Edit
                                </button>
                            )}

                            {error && <div className="error-msg"><FaExclamationTriangle /> {error}</div>}
                            {successMsg && <div className="success-msg">{successMsg}</div>}

                            {conversionStats && (
                                <div className="stats-summary">
                                    <h6>Conversion Results</h6>
                                    <div className="stats-grid">
                                        {Object.entries(conversionStats).filter(([_, s]) => s.success > 0 || s.failed > 0).map(([col, s]) => (
                                            <div key={col} className={`stat-item ${s.failed > 0 ? 'has-errors' : ''}`}>
                                                <span className="stat-col">{col}</span>:
                                                <span className="stat-ok">{s.success} OK</span>
                                                {s.failed > 0 && <span className="stat-fail">, {s.failed} Failed</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isLocked && data.convertedRows && data.convertedRows.length > 0 && (
                                <div className="preview-section">
                                    <h6 style={{ marginTop: '12px' }}>
                                        Data Preview (showing {Math.min(5, data.convertedRows.length)} of {data.convertedRows.length} rows)
                                        {data.convertedRows.length > 5 && (
                                            <span style={{ fontSize: '0.75em', color: '#2563eb', fontWeight: 500, marginLeft: '8px' }}>
                                                Right-click node to view all
                                            </span>
                                        )}
                                    </h6>
                                    <div className="table-wrapper preview-wrapper">
                                        <table className="converter-table preview-table">
                                            <thead>
                                                <tr>
                                                    {data.headers.map((h, i) => <th key={i}>{h}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.convertedRows.slice(0, 5).map((row, rIdx) => (
                                                    <tr key={rIdx}>
                                                        {row.map((cell, cIdx) => (
                                                            <td key={cIdx}>{cell === null ? <span className="null-val">null</span> : String(cell)}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CollapsibleNodeWrapper>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Right} isConnectable={isConnectable} style={{ background: '#555' }} />
        </>
    );
};

export default DataTypeConverterNode;
