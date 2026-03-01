import React, { useMemo, useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './LinearRegressionNode.css';
import { FaCog } from 'react-icons/fa';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { trainLogisticRegression, checkApiHealth } from '../../utils/apiClient';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';

const LogisticRegressionNode = ({ id, data, isConnectable }) => {
  const [selectedX, setSelectedX] = useState([]);
  const [yCol, setYCol] = useState('');
  const [trainPercent, setTrainPercent] = useState(80);
  const [trainPercentInput, setTrainPercentInput] = useState('80');
  const [isTraining, setIsTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState('');
  const [modelResults, setModelResults] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = useState({
    learningRate: 0.01,
    maxIterations: 1000
  });
  const { setNodes } = useReactFlow();

  // Check API health on mount
  useEffect(() => {
    checkApiHealth().then(status => {
      setApiStatus(status);
      if (!status) {
        setTrainMsg('Warning: Python API server is not running. Please start the backend server.');
      }
    });
  }, []);

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

  const toggleConfig = () => {
    setIsConfigOpen(!isConfigOpen);
  };

  const onRun = async () => {
    setTrainMsg('');
    setModelResults(null);

    if (!upstreamData) {
      alert('Please connect a CSV/Excel node, Encoder node, or Normalizer node.');
      return;
    }
    if (selectedX.length === 0 || !yCol) {
      alert('Please select at least one independent column and one dependent column.');
      return;
    }
    if (apiStatus === false) {
      alert('Python API server is not running. Please start the backend server (python neuroflow-logic/app.py)');

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

      if (xIdx.some((i) => i === -1) || yIdx === -1) {
        throw new Error('Selected columns not found.');
      }

      // Extract X and y data
      const X = [];
      const Y = [];

      for (const r of rows) {
        const xRow = [];
        let valid = true;

        for (const i of xIdx) {
          const v = parseFloat(r[i]);
          if (!Number.isFinite(v)) {
            valid = false;
            break;
          }
          xRow.push(v);
        }

        const yv = r[yIdx];
        if (yv === undefined || yv === null || yv === '') {
          valid = false;
        }

        if (!valid) continue;

        X.push(xRow);
        Y.push(yv);
      }

      if (X.length < selectedX.length + 1) {
        throw new Error('Not enough valid rows to fit the model.');
      }

      // Check if Y is binary
      const uniqueY = [...new Set(Y)];
      if (uniqueY.length > 2) {
        throw new Error('Logistic regression requires binary classification. Please ensure the dependent variable has only 2 unique values.');
      }

      // Call Python API
      setTrainMsg('Training logistic regression model...');
      const result = await trainLogisticRegression(X, Y, trainPercent, selectedX, yCol, {
        learningRate: config.learningRate,
        maxIterations: config.maxIterations
      });

      if (result.success) {
        // Inject preprocessing info if available
        if (upstreamData.type === 'pca' && upstreamData.pcaInfo) {
          result.preprocessing = { ...upstreamData.pcaInfo, type: 'pca' };
        } else if (upstreamData.type === 'svd' && upstreamData.svdInfo) {
          result.preprocessing = { ...upstreamData.svdInfo, type: 'svd' };
        }

        setModelResults(result);
        setTrainMsg(`Training complete! Test Accuracy: ${(result.test_metrics.accuracy * 100).toFixed(2)}%`);

        // Store model in node data
        setNodes((nds) => nds.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              model: {
                coefficients: result.coefficients,
                intercept: result.intercept,
                train_metrics: result.train_metrics,
                test_metrics: result.test_metrics,
                test_y_actual: result.test_y_actual,
                test_predictions: result.test_predictions,
                xCols: selectedX,
                yCol,
                train_predictions: result.train_predictions,
                test_predictions: result.test_predictions,
                test_probabilities: result.test_probabilities,
                preprocessing: result.preprocessing
              }
            }
          };
        }));

        // alert('Logistic Regression training finished successfully!');
      } else {
        throw new Error(result.error || 'Training failed');
      }

    } catch (err) {
      setTrainMsg(err?.message || 'Training failed.');
      setModelResults(null);
    } finally {
      setIsTraining(false);
    }
  };

  const getCollapsedSummary = () => {
    if (modelResults) {
      return `Trained | Acc: ${(modelResults.test_metrics.accuracy * 100).toFixed(1)}%`;
    }
    if (selectedX.length > 0 && yCol) {
      return `Configured | ${selectedX.length}X → ${yCol}`;
    }
    if (headers.length > 0) {
      return `Ready to configure`;
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
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

      <CollapsibleNodeWrapper
        nodeId={id}
        category="classification" nodeType="logisticRegression"
        title={data.label || 'Logistic Regression'}
        icon={<div className="node-icon-text">LR</div>}
        statusIndicator={getStatusIndicator()}
        infoButton={<InfoButton nodeType="logisticRegression" />}
        collapsedSummary={getCollapsedSummary()}
        defaultCollapsed={false}
        className="linear-regression-node"
        forceExpand={isTraining || apiStatus === false || headers.length === 0}
      >
        <div style={{ position: 'absolute', top: '10px', right: '40px', zIndex: 10 }}>
          <button className="config-button" onClick={toggleConfig} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <FaCog className={`gear-icon ${isConfigOpen ? 'rotating' : ''}`} />
          </button>
        </div>

        {apiStatus === false && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fbbf24',
            padding: '8px 12px',
            marginBottom: '8px',
            fontSize: '0.8rem',
            borderRadius: '6px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: '16px'
          }}>
            <span>⚠️</span>
            <span>API server not running</span>
          </div>
        )}

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
              Connect a data source node to configure logistic regression.
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
                    <input
                      type="checkbox"
                      checked={selectedX.includes(h)}
                      onChange={() => toggleX(h)}
                    />
                    <span>{h}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="lr-row">
              <label>Dependent (Y - Binary):</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)}>
                <option value="">Select column</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="lr-row">
              <label>Train Data % (0-99):</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                >
                  −
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
                  style={{ width: '70px', textAlign: 'center' }}
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
                >
                  +
                </button>
                <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>
                  Test: {100 - trainPercent}%
                </span>
              </div>
            </div>
            <div className="lr-actions">
              <button
                className="btn primary"
                onClick={onRun}
                disabled={isTraining || apiStatus === false}
              >
                {isTraining ? 'Training...' : 'Train Model'}
              </button>
            </div>
            {trainMsg && (
              <div className={`lr-msg ${trainMsg.includes('complete') ? 'success' : ''}`}>
                {trainMsg}
              </div>
            )}

            {modelResults && (
              <div className="model-results">
                <div style={{ fontWeight: '700', color: '#1a202c', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>Train Metrics</div>
                <div>Accuracy: <strong>{(modelResults.train_metrics.accuracy * 100).toFixed(2)}%</strong></div>
                <div>Precision: <strong>{(modelResults.train_metrics.precision * 100).toFixed(2)}%</strong></div>
                <div>Recall: <strong>{(modelResults.train_metrics.recall * 100).toFixed(2)}%</strong></div>
                <div>F1-Score: <strong>{(modelResults.train_metrics.f1_score * 100).toFixed(2)}%</strong></div>

                <div style={{ fontWeight: '700', color: '#1a202c', marginTop: '12px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e1e8f0' }}>Test Metrics</div>
                <div>Accuracy: <strong>{(modelResults.test_metrics.accuracy * 100).toFixed(2)}%</strong></div>
                <div>Precision: <strong>{(modelResults.test_metrics.precision * 100).toFixed(2)}%</strong></div>
                <div>Recall: <strong>{(modelResults.test_metrics.recall * 100).toFixed(2)}%</strong></div>
                <div>F1-Score: <strong>{(modelResults.test_metrics.f1_score * 100).toFixed(2)}%</strong></div>

                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e1e8f0', fontSize: '0.8rem', color: '#718096' }}>
                  <div style={{ marginBottom: '4px' }}>
                    Confusion Matrix: TN=<strong>{modelResults.test_metrics.confusion_matrix.true_negatives}</strong>,
                    FP=<strong>{modelResults.test_metrics.confusion_matrix.false_positives}</strong>,
                    FN=<strong>{modelResults.test_metrics.confusion_matrix.false_negatives}</strong>,
                    TP=<strong>{modelResults.test_metrics.confusion_matrix.true_positives}</strong>
                  </div>
                  <div>Train Size: <strong>{modelResults.train_size}</strong> | Test Size: <strong>{modelResults.test_size}</strong></div>
                </div>

                {/* Logistic Regression Equation with hover tooltip */}
                <div className="equation-container">
                  <div className="equation-display">
                    P(y=1) = 1 / (1 + e^-({modelResults.intercept.toFixed(4)} + {modelResults.coefficients.map((c, i) => `${c.toFixed(4)}*${selectedX[i]}`).join(' + ')}))
                  </div>
                  <div className="equation-tooltip">
                    <div className="equation-tooltip-content">
                      P(y=1) = 1 / (1 + e^-({modelResults.intercept.toFixed(4)} + {modelResults.coefficients.map((c, i) => `${c.toFixed(4)}*${selectedX[i]}`).join(' + ')}))
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isConfigOpen && (
          <div className="config-panel">
            <div className="config-section">
              <label>Learning Rate:</label>
              <input
                type="number"
                value={config.learningRate}
                onChange={(e) => setConfig({ ...config, learningRate: parseFloat(e.target.value) })}
                step="0.001"
                min="0"
                max="1"
              />
            </div>

            <div className="config-section">
              <label>Max Iterations:</label>
              <input
                type="number"
                value={config.maxIterations}
                onChange={(e) => setConfig({ ...config, maxIterations: parseInt(e.target.value) })}
                min="1"
                max="10000"
              />
            </div>
          </div>
        )}
      </CollapsibleNodeWrapper>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
    </>
  );
};

export default React.memo(LogisticRegressionNode);