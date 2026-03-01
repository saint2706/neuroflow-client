import React, { useMemo, useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/apiClient';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import './ClusteringNode.css';
import { FaLayerGroup } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import axios from 'axios';
import InfoButton from '../ui/InfoButton';

const HierarchicalClusteringNode = ({ id, data, isConnectable }) => {
    const { setNodes } = useReactFlow();

    // State management
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [linkageMethod, setLinkageMethod] = useState('ward');
    const [distanceMetric, setDistanceMetric] = useState('euclidean');
    const [nClusters, setNClusters] = useState(3);
    const [nClustersInput, setNClustersInput] = useState('3');
    const [distanceThreshold, setDistanceThreshold] = useState(4.5);
    const [distanceThresholdInput, setDistanceThresholdInput] = useState('4.5');
    const [cutMode, setCutMode] = useState('clusters'); // 'clusters' or 'distance'

    const [isRunning, setIsRunning] = useState(false);
    const [trainMsg, setTrainMsg] = useState('');
    const [results, setResults] = useState(null);
    const [showNormalizerWarning, setShowNormalizerWarning] = useState(false);

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

    // Check if normalizer is in the upstream chain
    useEffect(() => {
        if (upstreamData && upstreamData.type !== 'normalized') {
            setShowNormalizerWarning(true);
        } else {
            setShowNormalizerWarning(false);
        }
    }, [upstreamData]);

    // Toggle feature selection
    const toggleFeature = (h) => {
        setSelectedFeatures((prev) => (prev.includes(h) ? prev.filter((c) => c !== h) : [...prev, h]));
    };

    // Restore state from node data
    useEffect(() => {
        if (data) {
            if (data.selectedFeatures) setSelectedFeatures(data.selectedFeatures);
            if (data.nClusters) {
                setNClusters(data.nClusters);
                setNClustersInput(data.nClusters.toString());
            }
            if (data.linkageMethod) setLinkageMethod(data.linkageMethod);
            if (data.distanceMetric) setDistanceMetric(data.distanceMetric);
            if (data.cutCriterion === 'n_clusters') setCutMode('clusters');
            else if (data.cutCriterion === 'distance') setCutMode('distance');

            if (data.cutValue && data.cutCriterion === 'distance') {
                setDistanceThreshold(data.cutValue);
                setDistanceThresholdInput(data.cutValue.toString());
            }
        }
    }, []);

    // Run Hierarchical Clustering
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

        // Validate cut mode
        if (cutMode === 'clusters') {
            if (!nClusters || nClusters < 2) {
                alert('Please specify number of clusters (minimum 2).');
                return;
            }
        } else if (cutMode === 'distance') {
            if (!distanceThreshold || distanceThreshold <= 0) {
                alert('Please specify a valid distance threshold (greater than 0).');
                return;
            }
        }

        // Validate Ward + Euclidean constraint
        if (linkageMethod === 'ward' && distanceMetric !== 'euclidean') {
            alert('Ward linkage only supports Euclidean distance.');
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

            if (X.length < 2) {
                throw new Error('Need at least 2 valid rows for hierarchical clustering.');
            }

            // Prepare request payload
            const payload: any = {
                X: X,
                linkage_method: linkageMethod,
                distance_metric: distanceMetric
            };

            if (cutMode === 'clusters' && nClusters) {
                payload.n_clusters = nClusters;
            } else if (cutMode === 'distance' && distanceThreshold) {
                payload.distance_threshold = distanceThreshold;
            }

            // Call backend API
            setTrainMsg(`Running Hierarchical Clustering (${linkageMethod} linkage, ${distanceMetric} distance)...`);
            setTrainMsg(`Running Hierarchical Clustering (${linkageMethod} linkage, ${distanceMetric} distance)...`);
            const response = await axios.post(`${API_BASE_URL}/hierarchical-clustering`, payload);

            if (response.data.success) {
                const clusterLabels = response.data.cluster_labels;
                const clusterRepresentatives = response.data.cluster_representatives;

                // Inject preprocessing info if available
                let preprocessing = null;
                if (upstreamData.type === 'pca' && upstreamData.pcaInfo) {
                    preprocessing = { ...upstreamData.pcaInfo, type: 'pca' };
                } else if (upstreamData.type === 'svd' && upstreamData.svdInfo) {
                    preprocessing = { ...upstreamData.svdInfo, type: 'svd' };
                }

                // Add cluster labels to dataset
                // Use X (valid rows) to ensure alignment
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
                            clusterRepresentatives: clusterRepresentatives,
                            clusterSizes: response.data.cluster_sizes,
                            selectedFeatures: selectedFeatures,
                            nClusters: response.data.n_clusters,
                            linkageMethod: linkageMethod,
                            distanceMetric: distanceMetric,
                            cutCriterion: response.data.cut_criterion,
                            cutValue: response.data.cut_value,
                            cutHeight: response.data.cut_height,
                            dendrogram: response.data.dendrogram,
                            linkageMatrix: response.data.linkage_matrix,
                            pcaData: response.data.pca_data,
                            // Store original data for dendrogram tooltips
                            sampleData: rows,
                            headers: headers,
                            // Model data for Model Evaluator
                            model: {
                                selectedFeatures: selectedFeatures,
                                clusterRepresentatives: clusterRepresentatives,
                                nClusters: response.data.n_clusters,
                                distanceMetric: distanceMetric,
                                preprocessing: preprocessing,
                                // Add test_metrics for Model Visualizer
                                test_metrics: {
                                    n_clusters: response.data.n_clusters
                                }
                            }
                        }
                    };
                }));

                setResults(response.data);
                setTrainMsg(`Clustering complete! ${response.data.n_clusters} clusters formed.`);
                alert('Hierarchical clustering finished.');
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

    const linkageOptions = [
        { value: 'ward', label: 'Ward' },
        { value: 'complete', label: 'Complete' },
        { value: 'average', label: 'Average' },
        { value: 'single', label: 'Single' }
    ];

    const distanceMetricOptions = [
        { value: 'euclidean', label: 'Euclidean' },
        { value: 'manhattan', label: 'Manhattan' },
        { value: 'cosine', label: 'Cosine' }
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
            return `${results.n_clusters} clusters | ${linkageMethod} linkage`;
        }
        if (selectedFeatures.length > 0) {
            return `Configured | ${linkageMethod}`;
        }
        return 'Configure clustering';
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                nodeType="hierarchicalClustering"
                category="clustering"
                title={data.label || 'Hierarchical Clustering'}
                icon={<FaLayerGroup />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="hierarchicalClustering" />}
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
                            <label>Linkage Method:</label>
                            <select value={linkageMethod} onChange={(e) => setLinkageMethod(e.target.value)}>
                                {linkageOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="cluster-row">
                            <label>Distance Metric:</label>
                            <select
                                value={distanceMetric}
                                onChange={(e) => setDistanceMetric(e.target.value)}
                                disabled={linkageMethod === 'ward'}
                            >
                                {distanceMetricOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            {linkageMethod === 'ward' && (
                                <div style={{ fontSize: '0.75em', color: '#666', marginTop: '4px' }}>
                                    ⚠️ Ward linkage requires Euclidean distance
                                </div>
                            )}
                        </div>

                        <div className="cluster-row">
                            <label>Cut Dendrogram By:</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="cutMode"
                                        value="clusters"
                                        checked={cutMode === 'clusters'}
                                        onChange={() => setCutMode('clusters')}
                                    />
                                    <span>Number of Clusters</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="cutMode"
                                        value="distance"
                                        checked={cutMode === 'distance'}
                                        onChange={() => setCutMode('distance')}
                                    />
                                    <span>Distance Threshold</span>
                                </label>
                            </div>
                        </div>

                        {cutMode === 'clusters' && (
                            <div className="cluster-row">
                                <label>Number of Clusters:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (nClusters && nClusters > 2) {
                                                const newVal = nClusters - 1;
                                                setNClusters(newVal);
                                                setNClustersInput(newVal.toString());
                                            }
                                        }}
                                        disabled={!nClusters || nClusters <= 2}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid #ccc',
                                            borderRadius: '3px',
                                            background: '#f8f9fa',
                                            cursor: (!nClusters || nClusters <= 2) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="2"
                                        max="50"
                                        step="1"
                                        value={nClustersInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNClustersInput(val);
                                            const numVal = parseInt(val, 10);
                                            if (!isNaN(numVal) && numVal >= 2 && numVal <= 50) {
                                                setNClusters(numVal);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const numVal = parseInt(e.target.value, 10);
                                            if (isNaN(numVal) || numVal < 2 || numVal > 50) {
                                                setNClustersInput(nClusters ? nClusters.toString() : '3');
                                                if (!nClusters) setNClusters(3);
                                            } else {
                                                setNClustersInput(numVal.toString());
                                                setNClusters(numVal);
                                            }
                                        }}
                                        placeholder="e.g., 3"
                                        style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (nClusters && nClusters < 50) {
                                                const newVal = nClusters + 1;
                                                setNClusters(newVal);
                                                setNClustersInput(newVal.toString());
                                            }
                                        }}
                                        disabled={!nClusters || nClusters >= 50}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid #ccc',
                                            borderRadius: '3px',
                                            background: '#f8f9fa',
                                            cursor: (!nClusters || nClusters >= 50) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )}

                        {cutMode === 'distance' && (
                            <div className="cluster-row">
                                <label>Distance Threshold:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (distanceThreshold && distanceThreshold > 0.1) {
                                                const newVal = Math.max(0.1, distanceThreshold - 0.5);
                                                setDistanceThreshold(newVal);
                                                setDistanceThresholdInput(newVal.toFixed(1));
                                            }
                                        }}
                                        disabled={!distanceThreshold || distanceThreshold <= 0.1}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid #ccc',
                                            borderRadius: '3px',
                                            background: '#f8f9fa',
                                            cursor: (!distanceThreshold || distanceThreshold <= 0.1) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={distanceThresholdInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setDistanceThresholdInput(val);
                                            const numVal = parseFloat(val);
                                            if (!isNaN(numVal) && numVal > 0) {
                                                setDistanceThreshold(numVal);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const numVal = parseFloat(e.target.value);
                                            if (isNaN(numVal) || numVal <= 0) {
                                                setDistanceThresholdInput(distanceThreshold ? distanceThreshold.toFixed(1) : '1.0');
                                                if (!distanceThreshold) setDistanceThreshold(1.0);
                                            } else {
                                                setDistanceThresholdInput(numVal.toFixed(1));
                                                setDistanceThreshold(numVal);
                                            }
                                        }}
                                        placeholder="e.g., 4.5"
                                        style={{ width: '80px', padding: '4px', textAlign: 'center' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (distanceThreshold) {
                                                const newVal = distanceThreshold + 0.5;
                                                setDistanceThreshold(newVal);
                                                setDistanceThresholdInput(newVal.toFixed(1));
                                            }
                                        }}
                                        disabled={!distanceThreshold}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            padding: '0',
                                            border: '1px solid #ccc',
                                            borderRadius: '3px',
                                            background: '#f8f9fa',
                                            cursor: !distanceThreshold ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )}

                        {showNormalizerWarning && (
                            <div style={{
                                padding: '8px',
                                background: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                color: '#856404',
                                marginTop: '8px'
                            }}>
                                ⚠️ Hierarchical clustering relies on distance calculations. Feature normalization is recommended.
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
                                <div>Clusters Formed: <strong>{results.n_clusters}</strong></div>
                                <div>Linkage Method: <strong>{linkageOptions.find(o => o.value === results.linkage_method)?.label}</strong></div>
                                <div>Distance Metric: <strong>{distanceMetricOptions.find(o => o.value === results.distance_metric)?.label}</strong></div>
                                <div>
                                    Cut Criterion: <strong>
                                        {results.cut_criterion === 'n_clusters'
                                            ? `${results.cut_value} clusters`
                                            : `Distance threshold ${results.cut_value.toFixed(2)}`}
                                    </strong>
                                </div>
                                <div>Dendrogram Cut Height: <strong>{results.cut_height.toFixed(3)}</strong></div>

                                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    Cluster Sizes
                                </div>
                                {results.cluster_sizes.map((size, idx) => (
                                    <div key={idx} style={{
                                        marginBottom: '4px',
                                        padding: '4px',
                                        borderLeft: `3px solid ${clusterColors[idx % clusterColors.length]}`,
                                        paddingLeft: '8px',
                                        background: '#f7fafc'
                                    }}>
                                        <strong>Cluster {idx}:</strong> {size} samples
                                    </div>
                                ))}

                                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    Cluster Representatives (Mean)
                                </div>
                                {results.cluster_representatives.map((rep, idx) => (
                                    <div key={idx} style={{
                                        marginBottom: '4px',
                                        padding: '4px',
                                        borderLeft: `3px solid ${clusterColors[idx % clusterColors.length]}`,
                                        paddingLeft: '8px',
                                        background: '#f7fafc'
                                    }}>
                                        <strong>Cluster {idx}:</strong> [{rep.map(v => v.toFixed(3)).join(', ')}]
                                    </div>
                                ))}

                                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e1e8f0', fontSize: '0.8rem', color: '#718096' }}>
                                    <div>Total Samples: <strong>{results.cluster_sizes.reduce((a, b) => a + b, 0)}</strong></div>
                                    <div style={{ marginTop: '4px', fontSize: '0.75em', color: '#a0aec0' }}>
                                        💡 Right-click this node to view dendrogram and full dataset
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

export default React.memo(HierarchicalClusteringNode);
