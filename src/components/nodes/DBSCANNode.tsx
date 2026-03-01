import React, { useMemo, useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/apiClient';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import './ClusteringNode.css';
import { FaProjectDiagram } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import axios from 'axios';
import InfoButton from '../ui/InfoButton';

const DBSCANNode = ({ id, data, isConnectable }) => {
    const { setNodes } = useReactFlow();

    // State management
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [eps, setEps] = useState(0.5);
    const [epsInput, setEpsInput] = useState('0.5');
    const [minSamples, setMinSamples] = useState(5);
    const [minSamplesInput, setMinSamplesInput] = useState('5');
    const [distanceMetric, setDistanceMetric] = useState('euclidean');
    const [minkowskiP, setMinkowskiP] = useState(3);
    const [minkowskiPInput, setMinkowskiPInput] = useState('3');

    const [isRunning, setIsRunning] = useState(false);
    const [trainMsg, setTrainMsg] = useState('');
    const [results, setResults] = useState(null);

    // Get upstream data
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
            if (src?.type === 'featureSelector') {
                return {
                    type: 'featureSelector',
                    headers: src.data?.selectedHeaders || [],
                    selectedRows: src.data?.selectedRows || []
                };
            }
            if (src?.type === 'pca') {
                return {
                    type: 'pca',
                    headers: src.data?.pcaHeaders || [],
                    pcaRows: src.data?.pcaRows || [],
                    pcaInfo: src.data?.pcaInfo
                };
            }
            if (src?.type === 'svd') {
                return {
                    type: 'svd',
                    headers: src.data?.svdHeaders || [],
                    svdRows: src.data?.svdRows || [],
                    svdInfo: src.data?.svdInfo
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

    const hasNormalizer = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        for (const e of incoming) {
            const src = store.nodeInternals.get(e.source);
            if (src?.type === 'normalizer') return true;
        }
        return false;
    });

    // Toggle feature selection
    const toggleFeature = (h) => {
        setSelectedFeatures((prev) => (prev.includes(h) ? prev.filter((c) => c !== h) : [...prev, h]));
    };

    // Run DBSCAN clustering
    const onRun = async () => {
        setTrainMsg('');
        if (!upstreamData) {
            alert('Please connect a data source node.');
            return;
        }
        if (selectedFeatures.length === 0) {
            alert('Please select at least one feature column.');
            return;
        }
        if (eps <= 0) {
            alert('Epsilon must be positive.');
            return;
        }
        if (minSamples < 1) {
            alert('Minimum samples must be at least 1.');
            return;
        }

        setIsRunning(true);

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
            } else if (upstreamData.type === 'featureSelector') {
                rows = upstreamData.selectedRows;
            } else if (upstreamData.type === 'pca') {
                rows = upstreamData.pcaRows;
            } else if (upstreamData.type === 'svd') {
                rows = upstreamData.svdRows;
            } else if (upstreamData.type === 'dataTypeConverter') {
                rows = upstreamData.rows;
            } else {
                throw new Error('Unknown data source type.');
            }

            // Get indices of selected features
            const featureIndices = selectedFeatures.map((c) => headers.indexOf(c));
            if (featureIndices.some((i) => i === -1)) throw new Error('Selected features not found.');

            // Extract feature matrix
            const X = [];
            for (const r of rows) {
                const xRow = [];
                let valid = true;
                for (const i of featureIndices) {
                    const v = parseFloat(r[i]);
                    if (!Number.isFinite(v)) { valid = false; break; }
                    xRow.push(v);
                }
                if (!valid) continue;
                X.push(xRow);
            }

            if (X.length < minSamples) {
                throw new Error(`Not enough valid rows. Need at least ${minSamples} rows.`);
            }

            // Call backend API
            setTrainMsg(`Running DBSCAN (eps=${eps}, min_samples=${minSamples})...`);
            setTrainMsg(`Running DBSCAN (eps=${eps}, min_samples=${minSamples})...`);
            const response = await axios.post(`${API_BASE_URL}/dbscan`, {
                X: X,
                eps: eps,
                min_samples: minSamples,
                distance_metric: distanceMetric,
                minkowski_p: minkowskiP
            });

            if (response.data.success) {
                const clusterLabels = response.data.cluster_labels;
                const coreSamples = response.data.core_samples;
                const coreSampleLabels = response.data.core_sample_labels;

                // Inject preprocessing info if available
                let preprocessing = null;
                if (upstreamData.type === 'pca' && upstreamData.pcaInfo) {
                    preprocessing = { ...upstreamData.pcaInfo, type: 'pca' };
                } else if (upstreamData.type === 'svd' && upstreamData.svdInfo) {
                    preprocessing = { ...upstreamData.svdInfo, type: 'svd' };
                }

                // Add cluster labels to dataset
                // Use X (valid rows) to ensure alignment with PCA and cluster labels
                const clusteredData = X.map((row, idx) => [...row, clusterLabels[idx]]);
                const clusteredHeaders = [...selectedFeatures, 'cluster_label'];

                // Update node data
                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            clusteredData: clusteredData,
                            clusteredHeaders: clusteredHeaders,
                            clusterLabels: clusterLabels,
                            clusterCenters: response.data.cluster_representatives,
                            clusterSizes: response.data.cluster_sizes,
                            nClusters: response.data.n_clusters,
                            nNoise: response.data.n_noise,
                            n_noise: response.data.n_noise, // For Model Visualizer
                            selectedFeatures: selectedFeatures,
                            eps: eps,
                            minSamples: minSamples,
                            distanceMetric: distanceMetric,
                            // Store for Model Evaluator
                            model: {
                                selectedFeatures: selectedFeatures,
                                eps: eps,
                                minSamples: minSamples,
                                distanceMetric: distanceMetric,
                                coreSamples: coreSamples,
                                coreSampleLabels: coreSampleLabels,
                                X_mean: response.data.X_mean,
                                X_std: response.data.X_std,
                                minkowskiP: minkowskiP,
                                preprocessing: preprocessing,
                                // Add test_metrics for Model Visualizer
                                test_metrics: {
                                    n_clusters: response.data.n_clusters
                                }
                            },
                            X_mean: response.data.X_mean,
                            X_std: response.data.X_std,
                            minkowskiP: minkowskiP,
                            pcaData: response.data.pca_data
                        }
                    };
                }));

                setResults(response.data);
                setTrainMsg(`DBSCAN complete! ${response.data.n_clusters} clusters found, ${response.data.n_noise} noise points.`);
                alert('DBSCAN clustering finished.');
            } else {
                throw new Error(response.data.error || 'Clustering failed');
            }
        } catch (err) {
            setTrainMsg(err?.message || 'Clustering failed.');
            alert(err?.message || 'Clustering failed.');
        } finally {
            setIsRunning(false);
        }
    };

    const distanceMetricOptions = [
        { value: 'euclidean', label: 'Euclidean Distance' },
        { value: 'manhattan', label: 'Manhattan Distance' },
        { value: 'minkowski', label: 'Minkowski Distance' },
        { value: 'chebyshev', label: 'Chebyshev Distance' },
        { value: 'cosine', label: 'Cosine Similarity Distance' }
    ];

    // Cluster colors
    const clusterColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'];

    const getStatusIndicator = () => {
        if (results) return <div className="status-dot status-trained" title="Trained/Clustered" />;
        if (selectedFeatures.length > 0) return <div className="status-dot status-configured" title="Configured" />;
        return <div className="status-dot status-not-configured" title="Not Configured" />;
    };

    const getCollapsedSummary = () => {
        if (results) {
            return `${results.n_clusters} clusters | ${results.n_noise} noise`;
        }
        if (selectedFeatures.length > 0) {
            return `Configured | ε=${eps}`;
        }
        return 'Configure clustering';
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                nodeType="dbscan"
                category="clustering"
                title={data.label || 'DBSCAN'}
                icon={<FaProjectDiagram />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="dbscan" />}
                collapsedSummary={getCollapsedSummary()}
                className="clustering-node"
            >

                {headers.length > 0 && (
                    <div className="cluster-selects">
                        {!hasNormalizer && (
                            <div style={{
                                padding: '8px',
                                background: '#fff3cd',
                                color: '#856404',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                marginBottom: '10px',
                                border: '1px solid #ffeeba'
                            }}>
                                ⚠️ DBSCAN relies on distances. Normalization is strongly recommended.
                            </div>
                        )}

                        <div className="cluster-row">
                            <label>Feature Columns (X):</label>
                            <div className="cluster-columns">
                                {headers.map((h) => (
                                    <label key={h} className="cluster-option">
                                        <input type="checkbox" checked={selectedFeatures.includes(h)} onChange={() => toggleFeature(h)} />
                                        <span>{h}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="cluster-row">
                            <label>Epsilon (ε):</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (eps > 0.1) {
                                            const newVal = Math.max(0.1, parseFloat((eps - 0.1).toFixed(1)));
                                            setEps(newVal);
                                            setEpsInput(newVal.toString());
                                        }
                                    }}
                                    disabled={eps <= 0.1}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: eps <= 0.1 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={epsInput}
                                    onChange={(e) => {
                                        setEpsInput(e.target.value);
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val) && val > 0) setEps(val);
                                    }}
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (isNaN(val) || val <= 0) {
                                            setEpsInput(eps.toString());
                                        } else {
                                            setEpsInput(val.toString());
                                            setEps(val);
                                        }
                                    }}
                                    style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = parseFloat((eps + 0.1).toFixed(1));
                                        setEps(newVal);
                                        setEpsInput(newVal.toString());
                                    }}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: 'pointer'
                                    }}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="cluster-row">
                            <label>Min Samples:</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (minSamples > 1) {
                                            const newVal = minSamples - 1;
                                            setMinSamples(newVal);
                                            setMinSamplesInput(newVal.toString());
                                        }
                                    }}
                                    disabled={minSamples <= 1}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: minSamples <= 1 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={minSamplesInput}
                                    onChange={(e) => {
                                        setMinSamplesInput(e.target.value);
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val) && val >= 1) setMinSamples(val);
                                    }}
                                    onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (isNaN(val) || val < 1) {
                                            setMinSamplesInput(minSamples.toString());
                                        } else {
                                            setMinSamplesInput(val.toString());
                                            setMinSamples(val);
                                        }
                                    }}
                                    style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = minSamples + 1;
                                        setMinSamples(newVal);
                                        setMinSamplesInput(newVal.toString());
                                    }}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: 'pointer'
                                    }}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="cluster-row">
                            <label>Distance Metric:</label>
                            <select value={distanceMetric} onChange={(e) => setDistanceMetric(e.target.value)}>
                                {distanceMetricOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        {distanceMetric === 'minkowski' && (
                            <div className="cluster-row">
                                <label>Minkowski p:</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={minkowskiPInput}
                                    onChange={(e) => {
                                        setMinkowskiPInput(e.target.value);
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val) && val >= 1) setMinkowskiP(val);
                                    }}
                                    onBlur={() => setMinkowskiPInput(minkowskiP.toString())}
                                    style={{ width: '60px', padding: '4px' }}
                                />
                            </div>
                        )}

                        <div className="cluster-actions">
                            <button className="cluster-btn" onClick={onRun} disabled={isRunning}>
                                {isRunning ? 'Running...' : 'Run DBSCAN'}
                            </button>
                        </div>

                        {trainMsg && <div className="cluster-msg">{trainMsg}</div>}

                        {results && (
                            <div className="cluster-results">
                                <div style={{ fontWeight: '700', color: '#1a202c', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    DBSCAN Results
                                </div>
                                <div>Clusters Found: <strong>{results.n_clusters}</strong></div>
                                <div>Noise Points: <strong style={{ color: '#e53e3e' }}>{results.n_noise}</strong></div>

                                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    Cluster Sizes
                                </div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {results.cluster_sizes.map((size, idx) => (
                                        <div key={idx} style={{
                                            marginBottom: '4px',
                                            padding: '4px',
                                            borderLeft: `3px solid ${clusterColors[idx % clusterColors.length]}`,
                                            paddingLeft: '8px',
                                            background: '#f7fafc',
                                            fontSize: '0.9em'
                                        }}>
                                            <strong>Cluster {idx}:</strong> {size} samples
                                        </div>
                                    ))}
                                    {results.n_noise > 0 && (
                                        <div style={{
                                            marginBottom: '4px',
                                            padding: '4px',
                                            borderLeft: `3px solid #718096`,
                                            paddingLeft: '8px',
                                            background: '#edf2f7',
                                            fontSize: '0.9em',
                                            color: '#4a5568'
                                        }}>
                                            <strong>Noise (-1):</strong> {results.n_noise} samples
                                        </div>
                                    )}
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

export default React.memo(DBSCANNode);
