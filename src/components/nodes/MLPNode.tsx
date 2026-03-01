import React, { useMemo, useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './MLPNode.css';
import { FaBrain, FaChartLine, FaChartPie, FaLayerGroup, FaCog, FaRocket, FaCheckCircle, FaExclamationTriangle, FaChevronDown, FaPlus, FaTimes } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { trainMLP, checkApiHealth } from '../../utils/apiClient';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';

const MLPNode = ({ id, data, isConnectable }) => {
    // Safe number formatter to prevent toFixed errors
    const safeFixed = (value, digits = 2) => {
        if (value === undefined || value === null || isNaN(value)) {
            return "—";
        }
        return Number(value).toFixed(digits);
    };

    // Feature selection
    const [selectedX, setSelectedX] = useState([]);
    const [yCol, setYCol] = useState('');

    // Task configuration
    const [taskType, setTaskType] = useState('regression');
    const [classificationSubtype, setClassificationSubtype] = useState('binary');

    // Layer configuration - visual builder
    const [layers, setLayers] = useState([
        { id: 1, neurons: 64 },
        { id: 2, neurons: 32 }
    ]);
    const [nextLayerId, setNextLayerId] = useState(3);

    // Activation function
    const [activation, setActivation] = useState('relu');

    // Training settings
    const [optimizer, setOptimizer] = useState('adam');
    const [learningRate, setLearningRate] = useState(0.001);
    const [epochs, setEpochs] = useState(100);
    const [batchSize, setBatchSize] = useState(32);
    const [trainPercent, setTrainPercent] = useState(80);

    // Early stopping settings
    const [earlyStoppingEnabled, setEarlyStoppingEnabled] = useState(false);
    const [patience, setPatience] = useState(10);
    const [minDelta, setMinDelta] = useState(0.0001);
    const [validationSplit, setValidationSplit] = useState(20);

    // UI state
    const [expandedSections, setExpandedSections] = useState({
        task: true,
        features: true,
        architecture: true,
        training: true
    });
    const [activeTab, setActiveTab] = useState('summary');

    // Training state
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
                    encodedRows: src.data?.encodedRows || []
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

    // Check if normalizer is in the pipeline
    const hasNormalizer = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        for (const e of incoming) {
            const src = store.nodeInternals.get(e.source);
            if (src?.type === 'normalizer') return true;
            // Check upstream of the source
            const upstreamEdges = Array.from(store.edges.values()).filter((edge) => edge.target === e.source);
            for (const upEdge of upstreamEdges) {
                const upSrc = store.nodeInternals.get(upEdge.source);
                if (upSrc?.type === 'normalizer') return true;
            }
        }
        return false;
    });

    const toggleX = (h) => {
        setSelectedX((prev) => (prev.includes(h) ? prev.filter((c) => c !== h) : [...prev, h]));
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const addLayer = () => {
        if (layers.length < 3) {
            setLayers([...layers, { id: nextLayerId, neurons: 32 }]);
            setNextLayerId(nextLayerId + 1);
        }
    };

    const removeLayer = (layerId) => {
        if (layers.length > 1) {
            setLayers(layers.filter(l => l.id !== layerId));
        }
    };

    const updateLayerNeurons = (layerId, neurons) => {
        setLayers(layers.map(l => l.id === layerId ? { ...l, neurons: parseInt(neurons) || 0 } : l));
    };

    // Determine node status
    const getNodeStatus = () => {
        if (modelResults) return 'trained';
        if (selectedX.length > 0 && yCol && layers.every(l => l.neurons > 0)) return 'configured';
        return 'not-configured';
    };

    // Check if ready to train
    const isReadyToTrain = () => {
        return selectedX.length > 0 && yCol && layers.every(l => l.neurons > 0) && !isTraining && apiStatus !== false;
    };

    const onRun = async () => {
        setTrainMsg('');
        if (!upstreamData) {
            alert('Please connect a data source or preprocessing node.');
            return;
        }

        const neurons = layers.map(l => l.neurons);
        if (neurons.some(n => n <= 0)) {
            alert('All layers must have at least 1 neuron');
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
                let yv;
                if (taskType === 'regression') {
                    yv = parseFloat(r[yIdx]);
                    if (!Number.isFinite(yv)) valid = false;
                } else {
                    yv = r[yIdx];
                    if (yv === undefined || yv === null || yv === '') valid = false;
                }

                if (!valid) continue;
                X.push(xRow);
                Y.push(yv);
            }
            if (X.length < 2) throw new Error(`Not enough valid rows. Need at least 2 rows.`);

            // Determine actual task type
            let actualTaskType = taskType;
            if (taskType === 'classification') {
                actualTaskType = classificationSubtype === 'binary' ? 'binary_classification' : 'multiclass_classification';
            }

            // Call Python API
            setTrainMsg(`Training neural network...`);
            const result = await trainMLP(
                X, Y, trainPercent, actualTaskType, neurons, activation, optimizer,
                learningRate, epochs, batchSize, selectedX, yCol,
                {
                    enabled: earlyStoppingEnabled,
                    patience: patience,
                    minDelta: minDelta,
                    validationSplit: validationSplit / 100
                }
            );

            if (result.success) {
                // Inject preprocessing info if available
                if (upstreamData.type === 'pca' && upstreamData.pcaInfo) {
                    result.preprocessing = { ...upstreamData.pcaInfo, type: 'pca' };
                } else if (upstreamData.type === 'svd' && upstreamData.svdInfo) {
                    result.preprocessing = { ...upstreamData.svdInfo, type: 'svd' };
                }

                setModelResults(result);
                setActiveTab('summary');

                if (taskType === 'regression') {
                    const r2Value = result.test_metrics?.r2_score;
                    setTrainMsg(`Training complete! Test R²: ${safeFixed(r2Value, 4)}`);
                } else {
                    const accValue = result.test_metrics?.accuracy;
                    setTrainMsg(`Training complete! Test Accuracy: ${safeFixed(accValue * 100, 2)}%`);
                }

                // Store model data for Model Evaluator and Results Modal
                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            model: {
                                type: 'mlp',
                                task_type: result.task_type,
                                architecture: result.architecture,
                                weights: result.weights,
                                biases: result.biases,
                                xCols: selectedX,
                                yCol,
                                train_metrics: result.train_metrics,
                                test_metrics: result.test_metrics,
                                test_y_actual: result.test_y_actual,
                                test_predictions: result.test_predictions,
                                classes: result.classes,
                                preprocessing: result.preprocessing,
                                loss_history: result.loss_history,
                                val_loss_history: result.val_loss_history,
                                accuracy_history: result.accuracy_history,
                                val_accuracy_history: result.val_accuracy_history
                            },
                            // Store for Results Modal (context menu)
                            modelResults: result,
                            taskType: taskType,
                            selectedX: selectedX,
                            yCol: yCol
                        }
                    };
                }));
            } else {
                throw new Error(result.error || 'Training failed');
            }
        } catch (err) {
            setTrainMsg(err?.message || 'Training failed.');
            alert(err?.message || 'Training failed.');
        } finally {
            setIsTraining(false);
        }
    };

    // Architecture preview
    const getArchitecturePreview = () => {
        const inputDim = selectedX.length || '?';
        const hiddenLayers = layers.map(l => l.neurons).join(' → ');
        const outputDim = taskType === 'regression' ? '1' : '?';
        return `${inputDim} → ${hiddenLayers} → ${outputDim}`;
    };

    const activationOptions = [
        { value: 'relu', label: 'ReLU', icon: '⚡', tooltip: 'Fast and effective for most cases. Good default choice.' },
        { value: 'tanh', label: 'Tanh', icon: '🔄', tooltip: 'Smooth activation, outputs between -1 and 1.' },
        { value: 'sigmoid', label: 'Sigmoid', icon: '🔵', tooltip: 'Smooth S-curve, outputs between 0 and 1.' }
    ];

    // Helpers for CollapsibleNodeWrapper
    const getCollapsedSummary = () => {
        if (modelResults) {
            const accuracy = modelResults.test_metrics?.accuracy
                ? `Acc: ${(modelResults.test_metrics.accuracy * 100).toFixed(1)}%`
                : `Loss: ${modelResults.test_metrics.loss?.toFixed(4) || '?'}`;
            return `Trained (${modelResults.task_type}) | ${accuracy}`;
        }
        if (selectedX.length > 0 && yCol) {
            return `Configured | ${selectedX.length} In → ${layers.map(l => l.neurons).join('-')} → Out`;
        }
        if (headers.length > 0) {
            return 'Ready to configure';
        }
        return 'Connect data source';
    };

    const getStatusIndicator = () => {
        if (modelResults) return <div className="status-dot status-trained" title="Model trained" />;
        if (isTraining) return <div className="status-dot status-training" title="Training in progress" />;
        if (selectedX.length > 0 && yCol) return <div className="status-dot status-configured" title="Configured" />;
        return <div className="status-dot status-not-configured" title="Not configured" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#6366f1' }} />
            <CollapsibleNodeWrapper
                nodeId={id}
                category="neural-network" nodeType="mlp"
                title={data.label || 'Feedforward Neural Network (MLP)'}
                icon={<FaBrain />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="mlp" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                className="mlp-node-wrapper"
                forceExpand={isTraining || apiStatus === false || headers.length === 0}
            >
                <div className="mlp-content">
                    {/* Show message when no data source is connected */}
                    {headers.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: '#94a3b8',
                            fontSize: '13px',
                            lineHeight: '1.6'
                        }}>
                            <FaBrain style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#64748b' }}>
                                No Data Source Connected
                            </div>
                            <div>
                                Connect a data source node (CSV Reader, Database Reader, Data Cleaner, Encoder, Normalizer, Feature Selector, PCA, SVD, or Data Type Converter) to configure the neural network.
                            </div>
                        </div>
                    )}

                    {/* Show full configuration when data source is connected */}
                    {headers.length > 0 && (
                        <>
                            {/* Warning Banner */}
                            {!hasNormalizer && (
                                <div className="mlp-warning-banner">
                                    <FaExclamationTriangle className="mlp-warning-icon" />
                                    <span>Normalizer recommended before neural networks for better performance</span>
                                </div>
                            )}

                            {/* Task Selection Section */}
                            <div className="mlp-section">
                                <div className="mlp-section-header" onClick={() => toggleSection('task')}>
                                    <div className="mlp-section-header-left">
                                        <FaChartLine className="mlp-section-icon" />
                                        <span className="mlp-section-title">Task Type</span>
                                    </div>
                                    <FaChevronDown className={`mlp-section-chevron ${expandedSections.task ? 'expanded' : ''}`} />
                                </div>
                                <div className={`mlp-section-content ${expandedSections.task ? 'expanded' : ''}`}>
                                    <div className="mlp-task-toggle">
                                        <div
                                            className={`mlp-task-card ${taskType === 'regression' ? 'selected' : ''}`}
                                            onClick={() => setTaskType('regression')}
                                        >
                                            <div className="mlp-task-card-icon">📈</div>
                                            <div className="mlp-task-card-label">Regression</div>
                                        </div>
                                        <div
                                            className={`mlp-task-card ${taskType === 'classification' ? 'selected' : ''}`}
                                            onClick={() => setTaskType('classification')}
                                        >
                                            <div className="mlp-task-card-icon">🎯</div>
                                            <div className="mlp-task-card-label">Classification</div>
                                        </div>
                                    </div>

                                    {taskType === 'classification' && (
                                        <div className="mlp-subtask-toggle">
                                            <button
                                                className={`mlp-subtask-btn ${classificationSubtype === 'binary' ? 'selected' : ''}`}
                                                onClick={() => setClassificationSubtype('binary')}
                                            >
                                                Binary
                                            </button>
                                            <button
                                                className={`mlp-subtask-btn ${classificationSubtype === 'multiclass' ? 'selected' : ''}`}
                                                onClick={() => setClassificationSubtype('multiclass')}
                                            >
                                                Multi-Class
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Feature Selection Section */}
                            <div className="mlp-section">
                                <div className="mlp-section-header" onClick={() => toggleSection('features')}>
                                    <div className="mlp-section-header-left">
                                        <FaLayerGroup className="mlp-section-icon" />
                                        <span className="mlp-section-title">Feature Selection</span>
                                    </div>
                                    <FaChevronDown className={`mlp-section-chevron ${expandedSections.features ? 'expanded' : ''}`} />
                                </div>
                                <div className={`mlp-section-content ${expandedSections.features ? 'expanded' : ''}`}>
                                    <label className="mlp-label">Select Input Features (X)</label>
                                    <div className="mlp-feature-list">
                                        {headers.map((h) => (
                                            <div key={h} className="mlp-feature-item">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedX.includes(h)}
                                                    onChange={() => toggleX(h)}
                                                />
                                                <span className="mlp-feature-label">{h}</span>
                                            </div>
                                        ))}
                                        {headers.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>
                                                Connect a data source to select features
                                            </div>
                                        )}
                                    </div>

                                    <label className="mlp-label" style={{ marginTop: '12px' }}>Select Target Column (y)</label>
                                    <select className="mlp-select" value={yCol} onChange={(e) => setYCol(e.target.value)}>
                                        <option value="">Choose target...</option>
                                        {headers.map((h) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Network Architecture Section */}
                            <div className="mlp-section">
                                <div className="mlp-section-header" onClick={() => toggleSection('architecture')}>
                                    <div className="mlp-section-header-left">
                                        <FaBrain className="mlp-section-icon" />
                                        <span className="mlp-section-title">Network Architecture</span>
                                    </div>
                                    <FaChevronDown className={`mlp-section-chevron ${expandedSections.architecture ? 'expanded' : ''}`} />
                                </div>
                                <div className={`mlp-section-content ${expandedSections.architecture ? 'expanded' : ''}`}>
                                    <label className="mlp-label">Hidden Layers</label>
                                    <div className="mlp-layer-builder">
                                        {layers.map((layer, index) => (
                                            <div key={layer.id} className="mlp-layer-card">
                                                <div className="mlp-layer-number">{index + 1}</div>
                                                <div className="mlp-layer-input-group">
                                                    <div className="mlp-layer-input-label">Neurons</div>
                                                    <input
                                                        type="number"
                                                        className="mlp-layer-input nodrag"
                                                        value={layer.neurons}
                                                        onChange={(e) => updateLayerNeurons(layer.id, e.target.value)}
                                                        min="1"
                                                        max="512"
                                                    />
                                                </div>
                                                {layers.length > 1 && (
                                                    <div className="mlp-layer-remove" onClick={() => removeLayer(layer.id)}>
                                                        <FaTimes />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            className="mlp-add-layer-btn"
                                            onClick={addLayer}
                                            disabled={layers.length >= 3}
                                        >
                                            <FaPlus /> Add Hidden Layer {layers.length >= 3 && '(Max 3)'}
                                        </button>
                                    </div>

                                    <label className="mlp-label" style={{ marginTop: '14px' }}>Activation Function</label>
                                    <div className="mlp-activation-grid">
                                        {activationOptions.map(option => (
                                            <div
                                                key={option.value}
                                                className={`mlp-activation-btn mlp-tooltip ${activation === option.value ? 'selected' : ''}`}
                                                onClick={() => setActivation(option.value)}
                                            >
                                                <div className="mlp-activation-icon">{option.icon}</div>
                                                <div className="mlp-activation-label">{option.label}</div>
                                                <span className="mlp-tooltip-text">{option.tooltip}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mlp-architecture-preview">
                                        <div className="mlp-preview-label">Architecture Preview</div>
                                        <div className="mlp-preview-diagram">
                                            <span>{selectedX.length || '?'}</span>
                                            <span className="mlp-preview-arrow">→</span>
                                            {layers.map((layer, idx) => (
                                                <React.Fragment key={layer.id}>
                                                    <span>{layer.neurons}</span>
                                                    {idx < layers.length - 1 && <span className="mlp-preview-arrow">→</span>}
                                                </React.Fragment>
                                            ))}
                                            <span className="mlp-preview-arrow">→</span>
                                            <span>{taskType === 'regression' ? '1' : '?'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Training Settings Section */}
                            <div className="mlp-section">
                                <div className="mlp-section-header" onClick={() => toggleSection('training')}>
                                    <div className="mlp-section-header-left">
                                        <FaCog className="mlp-section-icon" />
                                        <span className="mlp-section-title">Training Settings</span>
                                    </div>
                                    <FaChevronDown className={`mlp-section-chevron ${expandedSections.training ? 'expanded' : ''}`} />
                                </div>
                                <div className={`mlp-section-content ${expandedSections.training ? 'expanded' : ''}`}>
                                    <div className="mlp-training-panel">
                                        <div className="mlp-param-row">
                                            <label className="mlp-label">Optimizer</label>
                                            <select className="mlp-select" value={optimizer} onChange={(e) => setOptimizer(e.target.value)}>
                                                <option value="adam">Adam (Recommended)</option>
                                                <option value="sgd">SGD</option>
                                            </select>
                                        </div>

                                        <div className="mlp-param-row">
                                            <label className="mlp-label">Learning Rate</label>
                                            <input
                                                type="number"
                                                className="mlp-input-number nodrag"
                                                value={learningRate}
                                                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                                                step="0.0001"
                                                min="0.0001"
                                                max="1"
                                            />
                                        </div>

                                        <div className="mlp-param-row">
                                            <label className="mlp-label">Epochs: {epochs}</label>
                                            <div className="mlp-slider-container">
                                                <input
                                                    type="range"
                                                    className="mlp-slider nodrag"
                                                    value={epochs}
                                                    onChange={(e) => setEpochs(parseInt(e.target.value))}
                                                    min="10"
                                                    max="500"
                                                    step="10"
                                                />
                                                <span className="mlp-slider-value">{epochs}</span>
                                            </div>
                                        </div>

                                        <div className="mlp-param-row">
                                            <label className="mlp-label">Batch Size</label>
                                            <select className="mlp-select" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value))}>
                                                <option value={16}>16</option>
                                                <option value={32}>32</option>
                                                <option value={64}>64</option>
                                                <option value={128}>128</option>
                                            </select>
                                        </div>

                                        <div className="mlp-param-row">
                                            <label className="mlp-label">Train / Test Split: {trainPercent}% / {100 - trainPercent}%</label>
                                            <div className="mlp-slider-container">
                                                <input
                                                    type="range"
                                                    className="mlp-slider nodrag"
                                                    value={trainPercent}
                                                    onChange={(e) => setTrainPercent(parseInt(e.target.value))}
                                                    min="50"
                                                    max="95"
                                                    step="5"
                                                />
                                                <span className="mlp-slider-value">{trainPercent}%</span>
                                            </div>
                                        </div>

                                        {/* Early Stopping Controls */}
                                        <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <label className="mlp-label" style={{ margin: 0 }}>Early Stopping</label>
                                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={earlyStoppingEnabled}
                                                        onChange={(e) => setEarlyStoppingEnabled(e.target.checked)}
                                                        style={{ marginRight: '6px', cursor: 'pointer', width: '16px', height: '16px', accentColor: '#6366f1' }}
                                                    />
                                                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>Enable</span>
                                                </label>
                                            </div>

                                            {earlyStoppingEnabled && (
                                                <>
                                                    <div className="mlp-param-row">
                                                        <label className="mlp-label">Patience: {patience}</label>
                                                        <div className="mlp-slider-container">
                                                            <input
                                                                type="range"
                                                                className="mlp-slider nodrag"
                                                                value={patience}
                                                                onChange={(e) => setPatience(parseInt(e.target.value))}
                                                                min="3"
                                                                max="50"
                                                                step="1"
                                                            />
                                                            <span className="mlp-slider-value">{patience}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mlp-param-row">
                                                        <label className="mlp-label">Min Delta</label>
                                                        <input
                                                            type="number"
                                                            className="mlp-input-number nodrag"
                                                            value={minDelta}
                                                            onChange={(e) => setMinDelta(parseFloat(e.target.value))}
                                                            step="0.00001"
                                                            min="0.00001"
                                                            max="0.01"
                                                        />
                                                    </div>

                                                    <div className="mlp-param-row">
                                                        <label className="mlp-label">Validation Split: {validationSplit}%</label>
                                                        <div className="mlp-slider-container">
                                                            <input
                                                                type="range"
                                                                className="mlp-slider nodrag"
                                                                value={validationSplit}
                                                                onChange={(e) => setValidationSplit(parseInt(e.target.value))}
                                                                min="10"
                                                                max="40"
                                                                step="5"
                                                            />
                                                            <span className="mlp-slider-value">{validationSplit}%</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Train Button */}
                            <button
                                className={`mlp-train-button ${isTraining ? 'training' : ''}`}
                                onClick={onRun}
                                disabled={!isReadyToTrain()}
                            >
                                {isTraining ? (
                                    <>
                                        <span>Training...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaRocket /> Train Neural Network
                                    </>
                                )}
                            </button>

                            {apiStatus === false && (
                                <div className="mlp-warning-banner" style={{ marginTop: '12px' }}>
                                    <FaExclamationTriangle className="mlp-warning-icon" />
                                    <span>API server not running</span>
                                </div>
                            )}

                            {trainMsg && !modelResults && (
                                <div style={{ marginTop: '12px', padding: '10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '12px', color: '#0369a1', textAlign: 'center' }}>
                                    {trainMsg}
                                </div>
                            )}

                            {/* Results Section */}
                            {modelResults && (
                                <div style={{ marginTop: '16px' }}>
                                    <div className="mlp-results-tabs">
                                        <button className={`mlp-tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                                            Summary
                                        </button>
                                        <button className={`mlp-tab ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => setActiveTab('metrics')}>
                                            Metrics
                                        </button>
                                    </div>

                                    <div className="mlp-tab-content">
                                        {activeTab === 'summary' && (
                                            <div>
                                                <div className="mlp-success-banner">
                                                    <FaCheckCircle style={{ color: '#10b981', fontSize: '20px' }} />
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Training Complete!</div>
                                                        <div style={{ fontSize: '11px', color: '#047857' }}>{trainMsg}</div>
                                                    </div>
                                                </div>
                                                <div className="mlp-summary-details">
                                                    <div><strong>Task:</strong> {modelResults.task_type.replace('_', ' ')}</div>
                                                    <div><strong>Architecture:</strong> {modelResults.architecture.hidden_layers.join('-')}</div>
                                                    <div><strong>Activation:</strong> {modelResults.architecture.activation}</div>
                                                    <div><strong>Optimizer:</strong> {modelResults.architecture.optimizer}</div>
                                                    <div><strong>Epochs:</strong> {modelResults.architecture.epochs}</div>
                                                    <div><strong>Batch Size:</strong> {modelResults.architecture.batch_size}</div>
                                                    <div><strong>Train Size:</strong> {modelResults.train_size} | <strong>Test Size:</strong> {modelResults.test_size}</div>
                                                    {modelResults.architecture.early_stopping && (
                                                        <>
                                                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #cbd5e1' }}>
                                                                <strong>Early Stopping:</strong> Enabled
                                                            </div>
                                                            {modelResults.stopped_epoch > 0 && (
                                                                <div><strong>Stopped at Epoch:</strong> {modelResults.stopped_epoch} (Best: {modelResults.best_epoch})</div>
                                                            )}
                                                            {modelResults.best_val_loss !== undefined && modelResults.best_val_loss !== null && (
                                                                <div><strong>Best Val Loss:</strong> {safeFixed(modelResults.best_val_loss, 6)}</div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'metrics' && (
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '10px' }}>Test Performance</div>
                                                {modelResults.task_type === 'regression' ? (
                                                    <div className="mlp-metrics-grid">
                                                        {modelResults.test_metrics?.r2_score !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">R² Score</div>
                                                                <div className={`mlp-metric-value ${modelResults.test_metrics.r2_score > 0.7 ? 'good' : modelResults.test_metrics.r2_score < 0.3 ? 'poor' : ''}`}>
                                                                    {safeFixed(modelResults.test_metrics.r2_score, 3)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {modelResults.test_metrics?.rmse !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">RMSE</div>
                                                                <div className="mlp-metric-value">
                                                                    {safeFixed(modelResults.test_metrics.rmse, 3)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {modelResults.test_metrics?.mae !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">MAE</div>
                                                                <div className="mlp-metric-value">
                                                                    {safeFixed(modelResults.test_metrics.mae, 3)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {modelResults.test_metrics?.mse !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">MSE</div>
                                                                <div className="mlp-metric-value">
                                                                    {safeFixed(modelResults.test_metrics.mse, 3)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="mlp-metrics-grid">
                                                        {modelResults.test_metrics?.accuracy !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">Accuracy</div>
                                                                <div className={`mlp-metric-value ${modelResults.test_metrics.accuracy > 0.8 ? 'good' : modelResults.test_metrics.accuracy < 0.5 ? 'poor' : ''}`}>
                                                                    {safeFixed(modelResults.test_metrics.accuracy * 100, 1)}%
                                                                </div>
                                                            </div>
                                                        )}
                                                        {modelResults.test_metrics?.precision !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">Precision</div>
                                                                <div className="mlp-metric-value">
                                                                    {safeFixed(modelResults.test_metrics.precision * 100, 1)}%
                                                                </div>
                                                            </div>
                                                        )}
                                                        {modelResults.test_metrics?.recall !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">Recall</div>
                                                                <div className="mlp-metric-value">
                                                                    {safeFixed(modelResults.test_metrics.recall * 100, 1)}%
                                                                </div>
                                                            </div>
                                                        )}
                                                        {modelResults.test_metrics?.f1_score !== undefined && (
                                                            <div className="mlp-metric-card">
                                                                <div className="mlp-metric-label">F1 Score</div>
                                                                <div className="mlp-metric-value">
                                                                    {safeFixed(modelResults.test_metrics.f1_score * 100, 1)}%
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </CollapsibleNodeWrapper>
            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#6366f1' }} />
        </>
    );
};

export default React.memo(MLPNode);
