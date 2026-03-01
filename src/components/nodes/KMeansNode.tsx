import React, { useMemo, useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/apiClient';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import './ClusteringNode.css';
import { FaProjectDiagram } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import axios from 'axios';
import InfoButton from '../ui/InfoButton';

const KMeansNode = ({ id, data, isConnectable }) => {
    const { setNodes } = useReactFlow();

    // State management
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [nClusters, setNClusters] = useState(3);
    const [nClustersInput, setNClustersInput] = useState('3');
    const [maxIterations, setMaxIterations] = useState(300);
    const [tolerance, setTolerance] = useState(0.0001);
    const [randomState, setRandomState] = useState(42);
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

    // Toggle feature selection
    const toggleFeature = (h) => {
        setSelectedFeatures((prev) => (prev.includes(h) ? prev.filter((c) => c !== h) : [...prev, h]));
    };

    // Restore state from node data
    useEffect(() => {
        if (data) {
            if (data.selectedFeatures) setSelectedFeatures(data.selectedFeatures);
            if (data.nClusters) setNClusters(data.nClusters);
            if (data.nClustersInput) setNClustersInput(data.nClustersInput);
            if (data.maxIterations) setMaxIterations(data.maxIterations);
            if (data.tolerance) setTolerance(data.tolerance);
            if (data.randomState) setRandomState(data.randomState);
            if (data.distanceMetric) setDistanceMetric(data.distanceMetric);
            if (data.minkowskiP) setMinkowskiP(data.minkowskiP);
            if (data.minkowskiPInput) setMinkowskiPInput(data.minkowskiPInput);
        }
    }, []);

    // Run K-Means clustering
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
        if (nClusters < 2 || nClusters > 20) {
            alert('Number of clusters must be between 2 and 20.');
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

            if (nClusters >= rows.length) {
                alert(`Number of clusters (${nClusters}) must be less than number of samples (${rows.length}).`);
                setIsRunning(false);
                return;
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

            if (X.length < nClusters) {
                throw new Error(`Not enough valid rows. Need at least ${nClusters} rows for ${nClusters} clusters.`);
            }

            // Call backend API
            setTrainMsg(`Running K-Means clustering (K=${nClusters}, metric=${distanceMetric})...`);
            setTrainMsg(`Running K-Means clustering (K=${nClusters}, metric=${distanceMetric})...`);
            const response = await axios.post(`${API_BASE_URL}/kmeans`, {
                X: X,
                n_clusters: nClusters,
                max_iters: maxIterations,
                tol: tolerance,
                random_state: randomState,
                distance_metric: distanceMetric,
                minkowski_p: minkowskiP
            });

            if (response.data.success) {
                const clusterLabels = response.data.cluster_labels;
                const clusterCenters = response.data.cluster_centers;

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
                            clusterCenters: clusterCenters,
                            clusterSizes: response.data.cluster_sizes,
                            inertia: response.data.inertia,
                            nIterations: response.data.n_iterations,
                            converged: response.data.converged,
                            selectedFeatures: selectedFeatures,
                            nClusters: nClusters,
                            distanceMetric: distanceMetric,
                            // Store for Model Evaluator
                            model: {
                                selectedFeatures: selectedFeatures,
                                clusterCenters: clusterCenters,
                                nClusters: nClusters,
                                distanceMetric: distanceMetric,
                                X_mean: response.data.X_mean,
                                X_std: response.data.X_std,
                                minkowskiP: minkowskiP,
                                preprocessing: preprocessing,
                                // Add test_metrics for Model Visualizer
                                test_metrics: {
                                    inertia: response.data.inertia,
                                    n_clusters: nClusters
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
                setTrainMsg(`Clustering complete! ${response.data.n_clusters} clusters formed in ${response.data.n_iterations} iterations.`);
                alert('K-Means clustering finished.');
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
            return `${results.n_clusters} clusters | ${results.cluster_sizes.reduce((a, b) => a + b, 0)} samples`;
        }
        if (selectedFeatures.length > 0) {
            return `Configured | K=${nClusters}`;
        }
        return 'Configure clustering';
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                nodeType="kMeans"
                category="clustering"
                title={data.label || 'K-Means Clustering'}
                icon={<FaProjectDiagram />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="kMeans" />}
                collapsedSummary={getCollapsedSummary()}
                className="clustering-node"
            >

                {headers.length > 0 && (
                    <div className="cluster-selects">
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
                            <label>Number of Clusters (K):</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (nClusters > 2) {
                                            const newVal = nClusters - 1;
                                            setNClusters(newVal);
                                            setNClustersInput(newVal.toString());
                                        }
                                    }}
                                    disabled={nClusters <= 2}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: nClusters <= 2 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min="2"
                                    max="20"
                                    step="1"
                                    value={nClustersInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setNClustersInput(val);
                                        const numVal = parseInt(val, 10);
                                        if (!isNaN(numVal) && numVal >= 2 && numVal <= 20) {
                                            setNClusters(numVal);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const numVal = parseInt(e.target.value, 10);
                                        if (isNaN(numVal) || numVal < 2 || numVal > 20) {
                                            setNClustersInput(nClusters.toString());
                                        } else {
                                            setNClustersInput(numVal.toString());
                                            setNClusters(numVal);
                                        }
                                    }}
                                    style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (nClusters < 20) {
                                            const newVal = nClusters + 1;
                                            setNClusters(newVal);
                                            setNClustersInput(newVal.toString());
                                        }
                                    }}
                                    disabled={nClusters >= 20}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: nClusters >= 20 ? 'not-allowed' : 'pointer'
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
                                <label>Minkowski p-value:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (minkowskiP > 1) {
                                                const newVal = minkowskiP - 0.5;
                                                setMinkowskiP(newVal);
                                                setMinkowskiPInput(newVal.toString());
                                            }
                                        }}
                                        disabled={minkowskiP <= 1}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid #ccc',
                                            borderRadius: '3px',
                                            background: '#f8f9fa',
                                            cursor: minkowskiP <= 1 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        step="0.5"
                                        value={minkowskiPInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMinkowskiPInput(val);
                                            const numVal = parseFloat(val);
                                            if (!isNaN(numVal) && numVal >= 1 && numVal <= 10) {
                                                setMinkowskiP(numVal);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const numVal = parseFloat(e.target.value);
                                            if (isNaN(numVal) || numVal < 1 || numVal > 10) {
                                                setMinkowskiPInput(minkowskiP.toString());
                                            } else {
                                                setMinkowskiPInput(numVal.toString());
                                                setMinkowskiP(numVal);
                                            }
                                        }}
                                        style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (minkowskiP < 10) {
                                                const newVal = minkowskiP + 0.5;
                                                setMinkowskiP(newVal);
                                                setMinkowskiPInput(newVal.toString());
                                            }
                                        }}
                                        disabled={minkowskiP >= 10}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid #ccc',
                                            borderRadius: '3px',
                                            background: '#f8f9fa',
                                            cursor: minkowskiP >= 10 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        +
                                    </button>
                                    <span style={{ marginLeft: '4px', fontSize: '0.85em', color: '#666' }}>
                                        (p=1: Manhattan, p=2: Euclidean)
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="cluster-actions">
                            <button className="cluster-btn" onClick={onRun} disabled={isRunning}>
                                {isRunning ? 'Running...' : 'Run Clustering'}
                            </button>
                        </div>

                        {trainMsg && <div className="cluster-msg">{trainMsg}</div>}

                        {results && (
                            <div className="cluster-results">
                                <div style={{ fontWeight: '700', color: '#1a202c', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    Clustering Results
                                </div>
                                <div>Clusters: <strong>{results.n_clusters}</strong></div>
                                <div>Iterations: <strong>{results.n_iterations}</strong></div>
                                <div>Inertia: <strong>{results.inertia.toFixed(2)}</strong></div>
                                <div>Converged: <strong>{results.converged ? '✓ Yes' : '✗ No'}</strong></div>
                                <div>Distance Metric: <strong>{distanceMetricOptions.find(o => o.value === results.distance_metric)?.label}</strong></div>

                                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    Cluster Centers
                                </div>
                                {results.cluster_centers.map((center, idx) => (
                                    <div key={idx} style={{
                                        marginBottom: '4px',
                                        padding: '4px',
                                        borderLeft: `3px solid ${clusterColors[idx % clusterColors.length]}`,
                                        paddingLeft: '8px',
                                        background: '#f7fafc'
                                    }}>
                                        <strong>Cluster {idx}:</strong> [{center.map(v => v.toFixed(3)).join(', ')}]
                                        <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.85em' }}>
                                            ({results.cluster_sizes[idx]} points)
                                        </span>
                                    </div>
                                ))}

                                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e1e8f0', fontSize: '0.8rem', color: '#718096' }}>
                                    <div>Total Samples: <strong>{results.cluster_sizes.reduce((a, b) => a + b, 0)}</strong></div>
                                    <div style={{ marginTop: '4px', fontSize: '0.75em', color: '#a0aec0' }}>
                                        💡 Tip: Normalizing features before clustering is recommended
                                    </div>
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

export default React.memo(KMeansNode);
