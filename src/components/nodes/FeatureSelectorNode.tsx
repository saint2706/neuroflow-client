import React, { useMemo, useState } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './FeatureSelectorNode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import { FaFilter } from 'react-icons/fa';

const FeatureSelectorNode = ({ id, data, isConnectable }) => {
    const { setNodes } = useReactFlow();

    const [selectedColumns, setSelectedColumns] = useState([]);
    const [filteredData, setFilteredData] = useState(null);
    const [error, setError] = useState('');

    // Find upstream data source
    const upstreamData = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        for (const e of incoming) {
            const src = store.nodeInternals.get(e.source);
            if (src?.type === 'csvReader') {
                return {
                    type: 'csv',
                    headers: src.data?.headers || [],
                    file: src.data?.file
                };
            }
            if (src?.type === 'databaseReader') {
                return {
                    type: 'database',
                    headers: src.data?.headers || [],
                    rows: src.data?.rows || []
                };
            }
            if (src?.type === 'dataCleaner') {
                return {
                    type: 'cleaned',
                    headers: src.data?.headers || [],
                    cleanedRows: src.data?.cleanedRows || []
                };
            }
            if (src?.type === 'encoder') {
                return {
                    type: 'encoded',
                    headers: src.data?.headers || [],
                    encodedRows: src.data?.encodedRows || []
                };
            }
            if (src?.type === 'normalizer') {
                return {
                    type: 'normalized',
                    headers: src.data?.headers || [],
                    normalizedRows: src.data?.normalizedRows || []
                };
            }
            if (src?.type === 'dataTypeConverter') {
                return {
                    type: 'dataTypeConverter',
                    headers: src.data?.headers || [],
                    rows: src.data?.convertedRows || []
                };
            }
        }
        return null;
    });

    const headers = useMemo(() => upstreamData?.headers || [], [upstreamData]);

    const toggleColumn = (columnName) => {
        setSelectedColumns(prev =>
            prev.includes(columnName)
                ? prev.filter(col => col !== columnName)
                : [...prev, columnName]
        );
    };

    const selectAll = () => {
        setSelectedColumns([...headers]);
    };

    const deselectAll = () => {
        setSelectedColumns([]);
    };

    const onApply = async () => {
        if (!upstreamData) {
            setError('Please connect a data source.');
            return;
        }

        if (selectedColumns.length === 0) {
            setError('Please select at least one column.');
            return;
        }

        setError('');

        try {
            let rows;

            if (upstreamData.type === 'csv') {
                const parsed = await parseFullTabularFile(upstreamData.file);
                rows = parsed.rows;
            } else if (upstreamData.type === 'database') {
                rows = upstreamData.rows;
            } else if (upstreamData.type === 'cleaned') {
                rows = upstreamData.cleanedRows;
            } else if (upstreamData.type === 'encoded') {
                rows = upstreamData.encodedRows;
            } else if (upstreamData.type === 'normalized') {
                rows = upstreamData.normalizedRows;
            } else if (upstreamData.type === 'dataTypeConverter') {
                rows = upstreamData.rows;
            } else {
                throw new Error('Unknown data source type.');
            }

            const selectedIndices = selectedColumns.map(col => headers.indexOf(col));

            const filteredRows = rows.map(row =>
                selectedIndices.map(idx => row[idx])
            );

            setFilteredData({
                selectedHeaders: selectedColumns,
                selectedRows: filteredRows,
                totalRows: filteredRows.length
            });

            setNodes((nds) => nds.map((n) => {
                if (n.id !== id) return n;
                return {
                    ...n,
                    data: {
                        ...n.data,
                        selectedHeaders: selectedColumns,
                        selectedRows: filteredRows
                    }
                };
            }));

        } catch (err) {
            setError(err?.message || 'Feature selection failed.');
            console.error('Feature selection error:', err);
        }
    };

    const onClear = () => {
        setFilteredData(null);
        setSelectedColumns([]);
        setError('');
        setNodes((nds) => nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, selectedHeaders: [], selectedRows: [] } } : n
        ));
    };

    const getCollapsedSummary = () => {
        if (filteredData) {
            return `Selected ${filteredData.selectedHeaders.length} Columns`;
        }
        return `Configure Filter`;
    };

    const getStatusIndicator = () => {
        if (filteredData) return <div className="status-dot status-trained" title="Features Selected" />;
        if (headers.length > 0) return <div className="status-dot status-configured" title="Ready" />;
        return <div className="status-dot status-not-configured" title="No Data" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="preprocessing" nodeType="featureSelector"
                title={data.label || 'Feature Selector'}
                icon={<FaFilter />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="featureSelector" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                className="feature-selector-node"
            >
                {headers.length > 0 && (
                    <div className="fs-content">
                        {/* Column Selection */}
                        <div className="fs-section">
                            <div className="section-header">
                                Select Features ({selectedColumns.length}/{headers.length})
                            </div>
                            <div className="fs-actions-top">
                                <button className="btn-small" onClick={selectAll}>Select All</button>
                                <button className="btn-small" onClick={deselectAll}>Clear All</button>
                            </div>
                            <div className="column-checkboxes">
                                {headers.map((header, idx) => (
                                    <label key={idx} className="column-option">
                                        <input
                                            type="checkbox"
                                            checked={selectedColumns.includes(header)}
                                            onChange={() => toggleColumn(header)}
                                        />
                                        <span>{header}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="fs-actions">
                            <button
                                className="btn primary"
                                onClick={onApply}
                                disabled={selectedColumns.length === 0}
                                style={{ flex: filteredData ? 0.6 : 1 }}
                            >
                                Apply Selection
                            </button>
                            {filteredData && (
                                <button className="btn secondary" onClick={onClear} style={{ flex: 0.4 }}>
                                    Clear
                                </button>
                            )}
                        </div>

                        {error && <div className="error-text">{error}</div>}

                        {/* Preview */}
                        {filteredData && (
                            <div className="fs-preview">
                                <div className="preview-header">
                                    <span className="preview-title">
                                        Selected Data Preview (showing {Math.min(5, filteredData.totalRows)} of {filteredData.totalRows} rows)
                                        {filteredData.totalRows > 5 && (
                                            <span style={{ fontSize: '0.75em', color: '#2563eb', fontWeight: 500, marginLeft: '8px' }}>
                                                Right-click node to view all
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                {filteredData.selectedHeaders.map((header, idx) => (
                                                    <th key={idx}>{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData.selectedRows.slice(0, 5).map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx}>
                                                            {typeof cell === 'number'
                                                                ? cell.toFixed(4)
                                                                : String(cell ?? '')
                                                            }
                                                        </td>
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
            </CollapsibleNodeWrapper>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Right} isConnectable={isConnectable} style={{ background: '#555' }} />
        </>
    );
};

export default FeatureSelectorNode;
