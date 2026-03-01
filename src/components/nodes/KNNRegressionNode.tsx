import React, { useMemo, useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './LinearRegressionNode.css';
import { FaChartLine } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { trainKNNRegression, checkApiHealth } from '../../utils/apiClient';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import InfoButton from '../ui/InfoButton';

const KNNRegressionNode = ({ id, data, isConnectable }) => {
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

    // Check API health on mount
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
            alert('Please connect a CSV/Excel node or preprocessing node.');
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
                // Use database data directly
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
                const yv = parseFloat(r[yIdx]);
                if (!Number.isFinite(yv)) valid = false;
                if (!valid) continue;
                X.push(xRow);
                Y.push(yv);
            }
            if (X.length < kValue + 1) throw new Error(`Not enough valid rows. Need at least ${kValue + 1} rows for k=${kValue}.`);

            // Call Python API
            const metricParam = distanceMetric === 'minkowski' ? `${distanceMetric}_p${minkowskiP}` : distanceMetric;
            setTrainMsg(`Training KNN regression model (k=${kValue}, metric=${distanceMetric}${distanceMetric === 'minkowski' ? `, p=${minkowskiP}` : ''})...`);
            const result = await trainKNNRegression(X, Y, trainPercent, kValue, distanceMetric, selectedX, yCol, minkowskiP);

            if (result.success) {
                // Inject preprocessing info if available
                if (upstreamData.type === 'pca' && upstreamData.pcaInfo) {
                    result.preprocessing = { ...upstreamData.pcaInfo, type: 'pca' };
                } else if (upstreamData.type === 'svd' && upstreamData.svdInfo) {
                    result.preprocessing = { ...upstreamData.svdInfo, type: 'svd' };
                }

                setModelResults(result);
                setTrainMsg(`Training complete! Test R²: ${(result.test_metrics.r2_score * 100).toFixed(2)}%`);

                // Store training data for Model Evaluator predictions
                // Split data into train/test based on train_percent
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
                                // Store training data for predictions
                                X_train: X_train,
                                y_train: y_train,
                                preprocessing: result.preprocessing
                            }
                        }
                    };
                }));
                // alert('KNN Regression training finished.');
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

    // Added Logic for Collapsible State
    const getCollapsedSummary = () => {
        if (modelResults) {
            const r2 = (modelResults.test_metrics.r2_score * 100).toFixed(1);
            return `Trained (k=${kValue}) | R²: ${r2}%`;
        }
        if (selectedX.length > 0 && yCol) {
            return `Configured | ${selectedX.length}X → ${yCol}`;
        }
        if (headers.length > 0) {
            return `Ready`;
        }
        return 'Connect data source';
    };

    const getStatusIndicator = () => {
        if (modelResults) {
            return <div className="status-dot status-trained" title="Model trained" />;
        }
        if (isTraining) {
            return <div className="status-dot status-training" title="Training in progress" />;
        }
        if (selectedX.length > 0 && yCol) {
            return <div className="status-dot status-configured" title="Configured" />;
        }
        return <div className="status-dot status-not-configured" title="Not configured" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="regression" nodeType="knnRegression"
                title={data.label || 'KNN Regression'}
                icon={<FaChartLine />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="knnRegression" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                forceExpand={isTraining || apiStatus === false || headers.length === 0}
                showCollapseToggle={true}
                className="linear-regression-node"
            >
                {headers.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: '#94a3b8',
                        fontSize: '13px',
                        lineHeight: '1.6'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📉</div>
                        <div style={{ fontWeight: '600', marginBottom: '8px', color: '#64748b' }}>
                            No Data Source Connected
                        </div>
                        <div>
                            Connect a data source node to configure KNN regression.
                        </div>
                    </div>
                )}
                {headers.length > 0 && (
                    <div className="lr-selects">
                        <div className="lr-row">
                            <label>Independent (X columns):</label>
                            <div className="mlr-columns">
                                {headers.map((h) => (
                                    <label key={h} className="mlr-option">
                                        <input type="checkbox" checked={selectedX.includes(h)} onChange={() => toggleX(h)} />
                                        <span>{h}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="lr-row">
                            <label>Dependent (Y):</label>
                            <select value={yCol} onChange={(e) => setYCol(e.target.value)}>
                                <option value="">Select column</option>
                                {headers.map((h) => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>

                        <div className="lr-row">
                            <label>K (Neighbors):</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (kValue > 1) {
                                            const newVal = kValue - 1;
                                            setKValue(newVal);
                                            setKValueInput(newVal.toString());
                                        }
                                    }}
                                    disabled={kValue <= 1}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: kValue <= 1 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={kValueInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setKValueInput(val);
                                        const numVal = parseInt(val, 10);
                                        if (!isNaN(numVal) && numVal >= 1 && numVal <= 100) {
                                            setKValue(numVal);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const numVal = parseInt(e.target.value, 10);
                                        if (isNaN(numVal) || numVal < 1 || numVal > 100) {
                                            setKValueInput(kValue.toString());
                                        } else {
                                            setKValueInput(numVal.toString());
                                            setKValue(numVal);
                                        }
                                    }}
                                    style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (kValue < 100) {
                                            const newVal = kValue + 1;
                                            setKValue(newVal);
                                            setKValueInput(newVal.toString());
                                        }
                                    }}
                                    disabled={kValue >= 100}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: kValue >= 100 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="lr-row">
                            <label>Distance Metric:</label>
                            <select value={distanceMetric} onChange={(e) => setDistanceMetric(e.target.value)}>
                                {distanceMetricOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Minkowski P-value input - only shown when Minkowski is selected */}
                        {distanceMetric === 'minkowski' && (
                            <div className="lr-row">
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

                        <div className="lr-row">
                            <label>Train Data % (0-99):</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (trainPercent > 0) {
                                            const newVal = trainPercent - 1;
                                            setTrainPercent(newVal);
                                            setTrainPercentInput(newVal.toString());
                                        }
                                    }}
                                    disabled={trainPercent <= 0}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: trainPercent <= 0 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    step="1"
                                    value={trainPercentInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setTrainPercentInput(val);
                                        const numVal = parseInt(val, 10);
                                        if (!isNaN(numVal) && numVal >= 0 && numVal <= 99) {
                                            setTrainPercent(numVal);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const numVal = parseInt(e.target.value, 10);
                                        if (isNaN(numVal) || numVal < 0 || numVal > 99) {
                                            setTrainPercentInput(trainPercent.toString());
                                        } else {
                                            setTrainPercentInput(numVal.toString());
                                            setTrainPercent(numVal);
                                        }
                                    }}
                                    style={{ width: '60px', padding: '4px', textAlign: 'center' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (trainPercent < 99) {
                                            const newVal = trainPercent + 1;
                                            setTrainPercent(newVal);
                                            setTrainPercentInput(newVal.toString());
                                        }
                                    }}
                                    disabled={trainPercent >= 99}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: '0',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        background: '#f8f9fa',
                                        cursor: trainPercent >= 99 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    +
                                </button>
                                <span style={{ marginLeft: '4px', fontSize: '0.85em', color: '#666' }}>
                                    (Test: {100 - trainPercent}%)
                                </span>
                            </div>
                        </div>
                        <div className="lr-actions">
                            <button className="btn primary" onClick={onRun} disabled={isTraining || apiStatus === false}>
                                {isTraining ? 'Training...' : 'Train Model'}
                            </button>
                        </div>
                        {apiStatus === false && (
                            <div style={{
                                background: '#fff3cd',
                                border: '1px solid #ffc107',
                                padding: '4px',
                                marginTop: '4px',
                                fontSize: '0.8em',
                                borderRadius: '3px'
                            }}>
                                ⚠️ API server not running
                            </div>
                        )}
                        {trainMsg && <div className="lr-msg">{trainMsg}</div>}

                        {modelResults && (
                            <div className="model-results">
                                <div style={{ fontWeight: '700', color: '#1a202c', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>
                                    Model Configuration
                                </div>
                                <div>K (Neighbors): <strong>{modelResults.k}</strong></div>
                                <div>Distance Metric: <strong>{distanceMetricOptions.find(o => o.value === modelResults.distance_metric)?.label}</strong></div>

                                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>Train Metrics</div>
                                <div>MSE: <strong>{modelResults.train_metrics.mse.toFixed(4)}</strong></div>
                                <div>RMSE: <strong>{modelResults.train_metrics.rmse.toFixed(4)}</strong></div>
                                <div>MAE: <strong>{modelResults.train_metrics.mae.toFixed(4)}</strong></div>
                                <div>R² Score: <strong>{(modelResults.train_metrics.r2_score * 100).toFixed(2)}%</strong></div>


                                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>Test Metrics</div>
                                <div>MSE: <strong>{modelResults.test_metrics.mse.toFixed(4)}</strong></div>
                                <div>RMSE: <strong>{modelResults.test_metrics.rmse.toFixed(4)}</strong></div>
                                <div>MAE: <strong>{modelResults.test_metrics.mae.toFixed(4)}</strong></div>
                                <div>R² Score: <strong>{(modelResults.test_metrics.r2_score * 100).toFixed(2)}%</strong></div>


                                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e1e8f0', fontSize: '0.8rem', color: '#718096' }}>
                                    <div>Train Size: <strong>{modelResults.train_size}</strong> | Test Size: <strong>{modelResults.test_size}</strong></div>
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

export default React.memo(KNNRegressionNode);
