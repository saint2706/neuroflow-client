import React, { useMemo, useState } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './PCANode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { applyPCA } from '../../utils/apiClient';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import { FaProjectDiagram } from 'react-icons/fa';

const PCANode = ({ id, data, isConnectable }) => {
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [selectionMode, setSelectionMode] = useState('count'); // 'count' or 'variance'
    const [nComponents, setNComponents] = useState(2);
    const [varianceThreshold, setVarianceThreshold] = useState(0.95);
    const [standardize, setStandardize] = useState(true);
    const [center, setCenter] = useState(true);
    const [returnLoadings, setReturnLoadings] = useState(false);
    const [returnExplainedVariance, setReturnExplainedVariance] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pcaData, setPcaData] = useState(null);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const { setNodes } = useReactFlow();

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
                    encodedRows: src.data?.encodedRows || [],
                    encodingInfo: src.data?.encodingInfo || {}
                };
            }
            if (src?.type === 'normalizer') {
                return {
                    type: 'normalized',
                    headers: src.data?.headers || [],
                    normalizedRows: src.data?.normalizedRows || [],
                    normalizationInfo: src.data?.normalizationInfo || {}
                };
            }
            if (src?.type === 'featureSelector') {
                return {
                    type: 'featureSelector',
                    headers: src.data?.selectedHeaders || [],
                    selectedRows: src.data?.selectedRows || []
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

    // Check if normalizer is upstream
    const hasNormalizer = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        for (const e of incoming) {
            const src = store.nodeInternals.get(e.source);
            if (src?.type === 'normalizer') return true;
            // Check recursively upstream
            const srcIncoming = Array.from(store.edges.values()).filter((edge) => edge.target === e.source);
            for (const srcEdge of srcIncoming) {
                const srcSrc = store.nodeInternals.get(srcEdge.source);
                if (srcSrc?.type === 'normalizer') return true;
            }
        }
        return false;
    });

    const toggleColumn = (header) => {
        setSelectedColumns(prev =>
            prev.includes(header)
                ? prev.filter(col => col !== header)
                : [...prev, header]
        );
    };

    const onApplyPCA = async () => {
        if (!upstreamData) {
            setError('Please connect a data source (CSV Reader, Data Cleaner, Encoder, Normalizer, or Feature Selector).');
            return;
        }
        if (selectedColumns.length === 0) {
            setError('Please select at least one column for PCA.');
            return;
        }

        setIsProcessing(true);
        setError('');
        setWarning('');

        try {
            let rows;

            // Get data from upstream source
            if (upstreamData.type === 'csv') {
                const parsed = await parseFullTabularFile(upstreamData.file);
                rows = parsed.rows;
            } else if (upstreamData.type === 'cleaned') {
                rows = upstreamData.cleanedRows;
            } else if (upstreamData.type === 'encoded') {
                rows = upstreamData.encodedRows;
            } else if (upstreamData.type === 'normalized') {
                rows = upstreamData.normalizedRows;
            } else if (upstreamData.type === 'featureSelector') {
                rows = upstreamData.selectedRows;
            } else if (upstreamData.type === 'dataTypeConverter') {
                rows = upstreamData.rows;
            } else {
                throw new Error('Unknown data source type.');
            }

            // Extract selected columns
            const selectedIndices = selectedColumns.map(col => headers.indexOf(col));
            const data = rows.map(row => selectedIndices.map(idx => parseFloat(row[idx])));

            // Validate numeric data
            const hasNonNumeric = data.some(row => row.some(val => !Number.isFinite(val)));
            if (hasNonNumeric) {
                throw new Error('Selected columns contain non-numeric values. Please select only numeric columns.');
            }

            // Check if component count exceeds feature count
            if (selectionMode === 'count' && nComponents > selectedColumns.length) {
                setWarning(`Warning: Component count (${nComponents}) exceeds feature count (${selectedColumns.length}). Using ${selectedColumns.length} components.`);
            }

            // Warn if no normalizer upstream
            if (!hasNormalizer && standardize === false) {
                setWarning('⚠️ PCA works best with normalized data. Consider connecting a Normalizer node before PCA.');
            }

            // Prepare config
            const config = {
                n_components: selectionMode === 'count' ? nComponents : null,
                variance_threshold: selectionMode === 'variance' ? varianceThreshold : null,
                standardize,
                center,
                return_loadings: returnLoadings,
                return_explained_variance: returnExplainedVariance
            };

            // Prepare full row data for propagating unselected columns
            // Convert all rows to numeric where possible, keep original values for non-selected columns
            const fullRowsNumeric = rows.map(row =>
                row.map(val => {
                    const num = parseFloat(val);
                    return Number.isFinite(num) ? num : val;
                })
            );

            // Call API with full row data
            const result = await applyPCA(data, selectedColumns, config, fullRowsNumeric, headers, selectedIndices);

            if (result.success) {
                // Convert transformed data back to row format
                const transformedRows = result.transformed_data;

                setPcaData({
                    headers: result.component_headers,
                    rows: transformedRows,
                    explainedVariance: result.explained_variance || [],
                    cumulativeVariance: result.cumulative_variance || [],
                    totalVarianceExplained: result.total_variance_explained || 0,
                    nComponentsUsed: result.n_components_used,
                    loadings: result.loadings || null,
                    originalFeatures: selectedColumns
                });

                // Store PCA data in node for downstream nodes
                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            pcaHeaders: result.component_headers,
                            pcaRows: transformedRows,
                            pcaInfo: {
                                explainedVariance: result.explained_variance,
                                cumulativeVariance: result.cumulative_variance,
                                totalVarianceExplained: result.total_variance_explained,
                                nComponentsUsed: result.n_components_used,
                                originalFeatures: selectedColumns,
                                loadings: result.loadings,
                                components: result.components,
                                mean: result.mean,
                                std: result.std
                            }
                        }
                    };
                }));

            } else {
                throw new Error(result.error || 'PCA transformation failed');
            }
        } catch (err) {
            setError(err?.message || 'PCA transformation failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const onClear = () => {
        setPcaData(null);
        setSelectedColumns([]);
        setError('');
        setWarning('');
        setNodes((nds) => nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, pcaHeaders: [], pcaRows: [], pcaInfo: {} } } : n
        ));
    };

    const getCollapsedSummary = () => {
        if (pcaData) {
            return `${pcaData.nComponentsUsed} components | ${(pcaData.totalVarianceExplained * 100).toFixed(0)}% Var`;
        }
        return 'Configure PCA';
    };

    const getStatusIndicator = () => {
        if (pcaData) return <div className="status-dot status-trained" title="PCA Applied" />;
        if (headers.length > 0) return <div className="status-dot status-configured" title="Ready to Apply" />;
        return <div className="status-dot status-not-configured" title="No Data" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="dim-reduction" nodeType="pca"
                title={data.label || 'PCA'}
                icon={<FaProjectDiagram />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="pca" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                className="pca-node"
            >
                {headers.length > 0 && (
                    <div className="pca-content">
                        {/* Column Selection */}
                        <div className="columns-section">
                            <label>Select Numeric Columns:</label>
                            <div className="column-checkboxes">
                                {headers.map((header) => (
                                    <label key={header} className="column-option">
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

                        {/* Component Selection Mode */}
                        <div className="mode-section">
                            <label>Component Selection:</label>
                            <div className="mode-options">
                                <label className="mode-option">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="count"
                                        checked={selectionMode === 'count'}
                                        onChange={(e) => setSelectionMode(e.target.value)}
                                    />
                                    <span>Number of Components</span>
                                </label>
                                <label className="mode-option">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="variance"
                                        checked={selectionMode === 'variance'}
                                        onChange={(e) => setSelectionMode(e.target.value)}
                                    />
                                    <span>Variance Retention</span>
                                </label>
                            </div>
                        </div>

                        {/* Component Count or Variance Threshold */}
                        {selectionMode === 'count' ? (
                            <div className="param-section">
                                <label>Number of Components:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedColumns.length || 10}
                                    value={nComponents}
                                    onChange={(e) => setNComponents(parseInt(e.target.value, 10))}
                                />
                            </div>
                        ) : (
                            <div className="param-section">
                                <label>Variance Threshold:</label>
                                <select value={varianceThreshold} onChange={(e) => setVarianceThreshold(parseFloat(e.target.value))}>
                                    <option value={0.90}>90%</option>
                                    <option value={0.95}>95%</option>
                                    <option value={0.99}>99%</option>
                                </select>
                            </div>
                        )}

                        {/* Optional Settings */}
                        <div className="options-section">
                            <label className="option-checkbox">
                                <input
                                    type="checkbox"
                                    checked={center}
                                    onChange={(e) => setCenter(e.target.checked)}
                                />
                                <span>Center Data (Subtract Mean)</span>
                            </label>
                            <label className="option-checkbox">
                                <input
                                    type="checkbox"
                                    checked={standardize}
                                    onChange={(e) => setStandardize(e.target.checked)}
                                />
                                <span>Scale Data (Unit Variance)</span>
                            </label>
                            <label className="option-checkbox">
                                <input
                                    type="checkbox"
                                    checked={returnExplainedVariance}
                                    onChange={(e) => setReturnExplainedVariance(e.target.checked)}
                                />
                                <span>Return Explained Variance</span>
                            </label>
                            <label className="option-checkbox">
                                <input
                                    type="checkbox"
                                    checked={returnLoadings}
                                    onChange={(e) => setReturnLoadings(e.target.checked)}
                                />
                                <span>Return Component Loadings</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="pca-actions">
                            <button
                                className="btn primary"
                                onClick={onApplyPCA}
                                disabled={isProcessing || selectedColumns.length === 0}
                            >
                                {isProcessing ? 'Applying PCA...' : 'Apply PCA'}
                            </button>
                            {pcaData && (
                                <button className="btn secondary" onClick={onClear}>
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Warnings */}
                        {warning && <div className="warning-text" style={{ marginTop: '8px', color: '#d97706', fontSize: '0.9em' }}>{warning}</div>}

                        {/* Errors */}
                        {error && <div className="error-text">{error}</div>}

                        {/* PCA Results */}
                        {pcaData && (
                            <div className="pca-preview">
                                <div className="preview-title" style={{ marginTop: '12px' }}>
                                    PCA Results ({pcaData.nComponentsUsed} components)
                                </div>

                                {/* Explained Variance */}
                                {returnExplainedVariance && pcaData.explainedVariance.length > 0 && (
                                    <div className="variance-section">
                                        <div className="variance-title">Explained Variance:</div>
                                        {pcaData.explainedVariance.map((variance, idx) => (
                                            <div key={idx} className="variance-item">
                                                <span className="variance-label">PC{idx + 1}:</span>
                                                <span className="variance-value">{(variance * 100).toFixed(2)}%</span>
                                                <div className="variance-bar">
                                                    <div
                                                        className="variance-fill"
                                                        style={{ width: `${variance * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        <div className="variance-total">
                                            Total Variance Explained: <strong>{(pcaData.totalVarianceExplained * 100).toFixed(2)}%</strong>
                                        </div>
                                    </div>
                                )}

                                {/* Component Loadings */}
                                {returnLoadings && pcaData.loadings && (
                                    <div className="loadings-section" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                        <div className="preview-title">
                                            Component Loadings (Feature Weights)
                                        </div>
                                        <div className="table-scroll" style={{ maxHeight: '200px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th style={{ position: 'sticky', left: 0, zIndex: 1, background: '#f8fafc' }}>Feature</th>
                                                        {pcaData.loadings[0] && pcaData.loadings[0].map((_, i) => (
                                                            <th key={i}>{`PC${i + 1}`}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pcaData.originalFeatures.map((feature, fIdx) => (
                                                        <tr key={fIdx}>
                                                            <td style={{ position: 'sticky', left: 0, background: '#f8fafc', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>{feature}</td>
                                                            {pcaData.loadings[fIdx] && pcaData.loadings[fIdx].map((loading, cIdx) => (
                                                                <td key={cIdx} style={{
                                                                    color: Math.abs(loading) > 0.5 ? '#2563eb' : 'inherit',
                                                                    fontWeight: Math.abs(loading) > 0.5 ? 600 : 400
                                                                }}>
                                                                    {loading !== undefined ? loading.toFixed(4) : ''}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Data Preview */}
                                <div className="preview-title" style={{ marginTop: '12px' }}>
                                    Transformed Data Preview (showing {Math.min(5, pcaData.rows.length)} of {pcaData.rows.length} rows)
                                    {pcaData.rows.length > 5 && (
                                        <span style={{ fontSize: '0.75em', color: '#2563eb', fontWeight: 500, marginLeft: '8px' }}>
                                            Right-click node to view all
                                        </span>
                                    )}
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                {pcaData.headers.map((header, idx) => (
                                                    <th key={idx}>{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pcaData.rows.slice(0, 5).map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    {row.map((val, cIdx) => (
                                                        <td key={cIdx}>
                                                            {typeof val === 'number' ? val.toFixed(4) : String(val ?? '')}
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
        </>
    );
};

export default React.memo(PCANode);
