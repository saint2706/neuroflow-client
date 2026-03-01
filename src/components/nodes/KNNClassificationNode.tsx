import React, { useMemo, useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './KNNClassificationNode.css';
import { FaChartLine } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { trainKNNClassification, checkApiHealth } from '../../utils/apiClient';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';

const KNNClassificationNode = ({ id, data, isConnectable }) => {
    const [selectedX, setSelectedX] = useState([]);
    const [yCol, setYCol] = useState('');
    const [trainPercent, setTrainPercent] = useState(80);
    const [trainPercentInput, setTrainPercentInput] = useState('80');
    const [kValue, setKValue] = useState(5);
    const [kValueInput, setKValueInput] = useState('5');
    const [distanceMetric, setDistanceMetric] = useState('euclidean');
    const [minkowskiP, setMinkowskiP] = useState(3);
    const [minkowskiPInput, setMinkowskiPInput] = useState('3');
    const [isTraining, setIsTraining] = useState(false);
    const [trainMsg, setTrainMsg] = useState('');
    const [modelResults, setModelResults] = useState(null);
    const [apiStatus, setApiStatus] = useState(null);
    const { setNodes } = useReactFlow();

    useEffect(() => {
        checkApiHealth().then(status => {
            setApiStatus(status);
        });
    }, []);

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
            if (src?.type === 'pca') {
                return {
                    type: 'pca',
                    headers: src.data?.pcaHeaders || [],
                    pcaRows: src.data?.pcaRows || [],
                    pcaInfo: src.data?.pcaInfo || {}
                };
            }
            if (src?.type === 'svd') {
                return {
                    type: 'svd',
                    headers: src.data?.svdHeaders || [],
                    svdRows: src.data?.svdRows || [],
                    svdInfo: src.data?.svdInfo || {}
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

    const toggleX = (h) => {
        setSelectedX((prev) => (prev.includes(h) ? prev.filter((c) => c !== h) : [...prev, h]));
    };

    const onRun = async () => {
        setTrainMsg('');
        if (!upstreamData) {
            alert('Please connect a data source.');
            return;
        }
        if (selectedX.length === 0 || !yCol) {
            alert('Please select at least one independent column and one dependent column.');
            return;
        }
        if (kValue < 1) {
            alert('K value must be at least 1.');
            return;
        }
        setIsTraining(true);
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

            const xIdx = selectedX.map((c) => headers.indexOf(c));
            const yIdx = headers.indexOf(yCol);
            if (xIdx.some((i) => i === -1) || yIdx === -1) throw new Error('Selected columns not found.');

            const X = [];
            const Y = [];
            for (const r of rows) {
                const xRow = [];
                let valid = true;
                for (const i of xIdx) {
                    const v = parseFloat(r[i]);
                    if (!Number.isFinite(v)) { valid = false; break; }
                    xRow.push(v);
                }
                const yv = r[yIdx];
                if (yv === undefined || yv === null || yv === '') valid = false;
                if (!valid) continue;
                X.push(xRow);
                Y.push(yv);
            }
            if (X.length < kValue + 1) throw new Error(`Not enough valid rows. Need at least ${kValue + 1} rows.`);

            setTrainMsg(`packet training...`);
            const result = await trainKNNClassification(X, Y, trainPercent, kValue, distanceMetric, selectedX, yCol, minkowskiP);

            if (result.success) {
                // Inject preprocessing info if available
                if (upstreamData.type === 'pca' && upstreamData.pcaInfo) {
                    result.preprocessing = { ...upstreamData.pcaInfo, type: 'pca' };
                } else if (upstreamData.type === 'svd' && upstreamData.svdInfo) {
                    result.preprocessing = { ...upstreamData.svdInfo, type: 'svd' };
                }

                setModelResults(result);
                setTrainMsg(`Training complete! Test Accuracy: ${(result.test_metrics.accuracy * 100).toFixed(2)}%`);

                const trainSize = Math.floor(X.length * (trainPercent / 100));
                const X_train = X.slice(0, trainSize);
                const y_train = Y.slice(0, trainSize);

                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            model: {
                                k: result.k,
                                distance_metric: result.distance_metric,
                                xCols: selectedX,
                                yCol,
                                train_metrics: result.train_metrics,
                                test_metrics: result.test_metrics,
                                test_y_actual: result.test_y_actual,
                                test_predictions: result.test_predictions,
                                X_train: X_train,
                                y_train: y_train,
                                preprocessing: result.preprocessing
                            }
                        }
                    };
                }));
            } else {
                throw new Error(result.error || 'Training failed');
            }
        } catch (err) {
            setTrainMsg(err?.message || 'Training failed.');
        } finally {
            setIsTraining(false);
        }
    };

    const distanceMetricOptions = [
        { value: 'euclidean', label: 'Euclidean Distance' },
        { value: 'manhattan', label: 'Manhattan Distance' },
        { value: 'minkowski', label: 'Minkowski Distance' },
        { value: 'chebyshev', label: 'Chebyshev Distance' },
        { value: 'cosine', label: 'Cosine Similarity Distance' }
    ];

    const getCollapsedSummary = () => {
        if (modelResults) {
            return `Trained (Acc: ${(modelResults.test_metrics.accuracy * 100).toFixed(1)}%)`;
        }
        if (selectedX.length > 0 && yCol) {
            return `Configured | ${selectedX.length}X → Y`;
        }
        return `Configure KNN`;
    };

    const getStatusIndicator = () => {
        if (modelResults) return <div className="status-dot status-trained" title="Model trained" />;
        if (isTraining) return <div className="status-dot status-training" title="Training..." />;
        if (selectedX.length > 0 && yCol) return <div className="status-dot status-configured" title="Configured" />;
        return <div className="status-dot status-not-configured" title="No Data" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="classification" nodeType="knnClassification"
                title={data.label || 'KNN Classification'}
                icon={<FaChartLine />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="knnClassification" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                className="knn-classification-node"
                forceExpand={isTraining || apiStatus === false || headers.length === 0}
            >
                <div className="knn-content">
                    {apiStatus === false && (
                        <div className="msg warning">
                            ⚠️ API server not running
                        </div>
                    )}

                    {headers.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0', fontSize: '12px' }}>
                            Connect data source to configure
                        </div>
                    ) : (
                        <>
                            <div className="knn-section">
                                <div className="section-title">Data Selection</div>
                                <div className="knn-row">
                                    <label>Independent (X):</label>
                                    <div className="column-checkboxes">
                                        {headers.map((h) => (
                                            <label key={h} className="column-option">
                                                <input type="checkbox" checked={selectedX.includes(h)} onChange={() => toggleX(h)} />
                                                <span>{h}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="knn-row">
                                    <label>Dependent (Y):</label>
                                    <select value={yCol} onChange={(e) => setYCol(e.target.value)}>
                                        <option value="">Select column</option>
                                        {headers.map((h) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="knn-section" style={{ marginTop: '8px' }}>
                                <div className="section-title">Parameters</div>
                                <div className="knn-row">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label>K (Neighbors):</label>
                                        <div className="stepper">
                                            <button className="stepper-btn" onClick={() => { if (kValue > 1) { setKValue(kValue - 1); setKValueInput((kValue - 1).toString()); } }} disabled={kValue <= 1}>-</button>
                                            <input className="stepper-input" type="number" value={kValueInput} onChange={(e) => { setKValueInput(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setKValue(v); }} />
                                            <button className="stepper-btn" onClick={() => { setKValue(kValue + 1); setKValueInput((kValue + 1).toString()); }}>+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="knn-row">
                                    <label>Distance Metric:</label>
                                    <select value={distanceMetric} onChange={(e) => setDistanceMetric(e.target.value)}>
                                        {distanceMetricOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                {distanceMetric === 'minkowski' && (
                                    <div className="knn-row">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label>Minkowski P:</label>
                                            <div className="stepper">
                                                <button className="stepper-btn" onClick={() => { if (minkowskiP > 1) { setMinkowskiP(minkowskiP - 0.5); setMinkowskiPInput((minkowskiP - 0.5).toString()); } }} disabled={minkowskiP <= 1}>-</button>
                                                <input className="stepper-input" type="number" value={minkowskiPInput} onChange={(e) => { setMinkowskiPInput(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 1) setMinkowskiP(v); }} />
                                                <button className="stepper-btn" onClick={() => { setMinkowskiP(minkowskiP + 0.5); setMinkowskiPInput((minkowskiP + 0.5).toString()); }}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="knn-row">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label>Train Split (%):</label>
                                        <div className="stepper">
                                            <button className="stepper-btn" onClick={() => { if (trainPercent > 5) { setTrainPercent(trainPercent - 5); setTrainPercentInput((trainPercent - 5).toString()); } }} disabled={trainPercent <= 5}>-</button>
                                            <input className="stepper-input" type="number" value={trainPercentInput} onChange={(e) => { setTrainPercentInput(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0 && v <= 99) setTrainPercent(v); }} />
                                            <button className="stepper-btn" onClick={() => { if (trainPercent < 95) { setTrainPercent(trainPercent + 5); setTrainPercentInput((trainPercent + 5).toString()); } }} disabled={trainPercent >= 95}>+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="knn-actions">
                                <button className="btn primary" onClick={onRun} disabled={isTraining || apiStatus === false}>
                                    {isTraining ? 'Training...' : 'Train Model'}
                                </button>
                            </div>

                            {trainMsg && <div className={`msg ${trainMsg.includes('complete') ? 'success' : ''}`}>{trainMsg}</div>}

                            {modelResults && (
                                <div className="results-section">
                                    <div className="results-header">Results</div>
                                    <div className="metrics-grid">
                                        <div className="metric-item">Accuracy: <strong>{(modelResults.test_metrics.accuracy * 100).toFixed(2)}%</strong></div>
                                        <div className="metric-item">Precision: <strong>{(modelResults.test_metrics.precision * 100).toFixed(2)}%</strong></div>
                                        <div className="metric-item">Recall: <strong>{(modelResults.test_metrics.recall * 100).toFixed(2)}%</strong></div>
                                        <div className="metric-item">F1 Score: <strong>{(modelResults.test_metrics.f1_score * 100).toFixed(2)}%</strong></div>
                                    </div>
                                    <div className="results-footer">
                                        K={modelResults.k}, Metric={modelResults.distance_metric}, Classes={modelResults.classes.length}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </CollapsibleNodeWrapper>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
        </>
    );
};

export default React.memo(KNNClassificationNode);
