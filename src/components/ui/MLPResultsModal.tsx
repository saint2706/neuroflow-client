import React, { useEffect, useState, useMemo } from 'react';
import './MLPResultsModal.css';
import { MdClose } from 'react-icons/md';
import { FaBrain, FaChartLine, FaLayerGroup, FaCog, FaCheckCircle } from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import NeuralNetworkStructure from './NeuralNetworkStructure';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const MLPResultsModal = ({ isOpen, onClose, modelData, initialSection = 'architecture' }) => {
    const [activeSection, setActiveSection] = useState(initialSection);

    // Reset active section when modal opens with a different initialSection
    useEffect(() => {
        if (isOpen) {
            setActiveSection(initialSection);
        }
    }, [isOpen, initialSection]);

    // Safe number formatter
    const safeFixed = (value, digits = 2) => {
        if (value === undefined || value === null || isNaN(value)) {
            return "—";
        }
        return Number(value).toFixed(digits);
    };

    // Extract data from modelData
    const modelResults = modelData?.modelResults;
    const taskType = modelData?.taskType || 'regression';
    const selectedX = modelData?.selectedX || [];
    const yCol = modelData?.yCol || 'Target';

    // Calculate total parameters
    const calculateParameters = useMemo(() => {
        if (!modelResults?.architecture) return null;

        const { input_dim, hidden_layers, output_dim } = modelResults.architecture;
        const layers = [input_dim, ...hidden_layers, output_dim];

        let totalParams = 0;
        const layerParams = [];

        for (let i = 0; i < layers.length - 1; i++) {
            const weights = layers[i] * layers[i + 1];
            const biases = layers[i + 1];
            const params = weights + biases;
            totalParams += params;
            layerParams.push({
                name: i === layers.length - 2 ? 'Output Layer' : `Hidden Layer ${i + 1}`,
                params: params,
                weights: weights,
                biases: biases
            });
        }

        return { totalParams, layerParams };
    }, [modelResults]);

    // Prepare loss chart data
    const lossChartData = useMemo(() => {
        if (!modelResults?.loss_history) return null;

        const epochs = modelResults.loss_history.map((_, idx) => idx + 1);

        const datasets = [{
            label: 'Training Loss',
            data: modelResults.loss_history,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4
        }];

        // Add validation loss if early stopping was enabled
        if (modelResults.val_loss_history && modelResults.val_loss_history.length > 0) {
            datasets.push({
                label: 'Validation Loss',
                data: modelResults.val_loss_history,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4
            });
        }

        return {
            labels: epochs,
            datasets: datasets
        };
    }, [modelResults]);

    // Prepare accuracy chart data (classification only)
    const accuracyChartData = useMemo(() => {
        if (!modelResults?.accuracy_history || taskType === 'regression') return null;

        const epochs = modelResults.accuracy_history.map((_, idx) => idx + 1);

        const datasets = [{
            label: 'Training Accuracy',
            data: modelResults.accuracy_history.map(acc => acc * 100),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4
        }];

        // Add validation accuracy if available
        if (modelResults.val_accuracy_history && modelResults.val_accuracy_history.length > 0) {
            datasets.push({
                label: 'Validation Accuracy',
                data: modelResults.val_accuracy_history.map(acc => acc * 100),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4
            });
        }

        return {
            labels: epochs,
            datasets: datasets
        };
    }, [modelResults, taskType]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 11,
                        family: "'Inter', sans-serif"
                    }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 10,
                cornerRadius: 4,
                titleFont: {
                    size: 12,
                    family: "'Inter', sans-serif"
                },
                bodyFont: {
                    size: 11,
                    family: "'Inter', sans-serif"
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Epoch',
                    font: {
                        size: 11,
                        family: "'Inter', sans-serif",
                        weight: '600'
                    }
                },
                grid: {
                    display: false
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Loss',
                    font: {
                        size: 11,
                        family: "'Inter', sans-serif",
                        weight: '600'
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            }
        }
    };

    const accuracyChartOptions = {
        ...chartOptions,
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                title: {
                    ...chartOptions.scales.y.title,
                    text: 'Accuracy (%)'
                },
                min: 0,
                max: 100
            }
        }
    };

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !modelResults) return null;

    const sections = [
        { id: 'architecture', label: 'Architecture', icon: <FaBrain /> },
        { id: 'learning', label: 'Learning Behavior', icon: <FaChartLine /> },
        { id: 'performance', label: 'Performance', icon: <FaCheckCircle /> },
        { id: 'predictions', label: 'Predictions', icon: <FaLayerGroup /> }
    ];

    return (
        <div className="mlp-results-modal-overlay" onClick={onClose}>
            <div className="mlp-results-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="mlp-results-modal-header">
                    <div className="mlp-results-modal-title">
                        <FaBrain className="mlp-results-title-icon" />
                        <div>
                            <h3>Neural Network Model Details</h3>
                            <span className="mlp-results-subtitle">
                                {modelResults.task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                        </div>
                    </div>
                    <button className="mlp-results-modal-close" onClick={onClose} title="Close (Esc)">
                        <MdClose />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="mlp-results-nav">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            className={`mlp-results-nav-btn ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                        >
                            {section.icon}
                            <span>{section.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="mlp-results-modal-body">
                    {/* 1. Architecture Section */}
                    {activeSection === 'architecture' && (
                        <div className="mlp-results-section">
                            <h4 className="mlp-results-section-title">Network Architecture</h4>

                            {/* Architecture Diagram */}
                            <div className="mlp-architecture-card">
                                <div className="mlp-architecture-diagram" style={{ height: '400px', display: 'block' }}>
                                    <NeuralNetworkStructure
                                        architecture={modelResults.architecture}
                                        taskType={taskType}
                                    />
                                </div>
                            </div>

                            {/* Learning Objective */}
                            <div className="mlp-info-card">
                                <h5 className="mlp-info-card-title">
                                    <FaCog /> Learning Objective
                                </h5>
                                <div className="mlp-info-grid">
                                    <div className="mlp-info-item">
                                        <span className="mlp-info-label">Task Type</span>
                                        <span className="mlp-info-value">
                                            {modelResults.task_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </span>
                                    </div>
                                    <div className="mlp-info-item">
                                        <span className="mlp-info-label">Loss Function</span>
                                        <span className="mlp-info-value">
                                            {taskType === 'regression' ? 'Mean Squared Error (MSE)' : 'Cross Entropy Loss'}
                                        </span>
                                    </div>
                                    <div className="mlp-info-item full-width">
                                        <span className="mlp-info-label">Optimization Method</span>
                                        <span className="mlp-info-value">
                                            The network learns by minimizing the loss function using backpropagation and {modelResults.architecture.optimizer.toUpperCase()} optimizer.
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Model Parameters */}
                            {calculateParameters && (
                                <div className="mlp-info-card">
                                    <h5 className="mlp-info-card-title">
                                        <FaLayerGroup /> Model Parameters
                                    </h5>
                                    <div className="mlp-params-summary">
                                        <div className="mlp-total-params">
                                            <span className="mlp-params-label">Total Trainable Parameters</span>
                                            <span className="mlp-params-value">{calculateParameters.totalParams.toLocaleString()}</span>
                                        </div>
                                        <div className="mlp-params-breakdown">
                                            {calculateParameters.layerParams.map((layer, idx) => (
                                                <div key={idx} className="mlp-param-layer">
                                                    <span className="mlp-param-layer-name">{layer.name}</span>
                                                    <span className="mlp-param-layer-value">
                                                        {layer.params.toLocaleString()}
                                                        <span className="mlp-param-detail">
                                                            ({layer.weights.toLocaleString()} weights + {layer.biases} biases)
                                                        </span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Training Configuration */}
                            <div className="mlp-info-card">
                                <h5 className="mlp-info-card-title">
                                    <FaCog /> Training Configuration
                                </h5>
                                <div className="mlp-config-grid">
                                    <div className="mlp-config-item">
                                        <span className="mlp-config-label">Optimizer</span>
                                        <span className="mlp-config-value">{modelResults.architecture.optimizer.toUpperCase()}</span>
                                    </div>
                                    <div className="mlp-config-item">
                                        <span className="mlp-config-label">Learning Rate</span>
                                        <span className="mlp-config-value">{modelResults.architecture.learning_rate}</span>
                                    </div>
                                    <div className="mlp-config-item">
                                        <span className="mlp-config-label">Epochs</span>
                                        <span className="mlp-config-value">{modelResults.architecture.epochs}</span>
                                    </div>
                                    <div className="mlp-config-item">
                                        <span className="mlp-config-label">Batch Size</span>
                                        <span className="mlp-config-value">{modelResults.architecture.batch_size}</span>
                                    </div>
                                    <div className="mlp-config-item">
                                        <span className="mlp-config-label">Train Size</span>
                                        <span className="mlp-config-value">{modelResults.train_size} samples</span>
                                    </div>
                                    <div className="mlp-config-item">
                                        <span className="mlp-config-label">Test Size</span>
                                        <span className="mlp-config-value">{modelResults.test_size} samples</span>
                                    </div>
                                    {modelResults.architecture.early_stopping && (
                                        <>
                                            <div className="mlp-config-item">
                                                <span className="mlp-config-label">Early Stopping</span>
                                                <span className="mlp-config-value">✓ Enabled</span>
                                            </div>
                                            <div className="mlp-config-item">
                                                <span className="mlp-config-label">Patience</span>
                                                <span className="mlp-config-value">{modelResults.architecture.patience} epochs</span>
                                            </div>
                                            {modelResults.stopped_epoch > 0 && (
                                                <>
                                                    <div className="mlp-config-item">
                                                        <span className="mlp-config-label">Stopped at Epoch</span>
                                                        <span className="mlp-config-value">{modelResults.stopped_epoch}</span>
                                                    </div>
                                                    <div className="mlp-config-item">
                                                        <span className="mlp-config-label">Best Epoch</span>
                                                        <span className="mlp-config-value">{modelResults.best_epoch}</span>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Learning Behavior Section */}
                    {activeSection === 'learning' && (
                        <div className="mlp-results-section">
                            <h4 className="mlp-results-section-title">Training Behavior</h4>

                            {/* Loss Chart */}
                            {lossChartData && (
                                <div className="mlp-chart-card">
                                    <h5 className="mlp-chart-title">Loss vs Epoch</h5>
                                    <div className="mlp-chart-container">
                                        <Line data={lossChartData} options={chartOptions} />
                                    </div>
                                    <p className="mlp-chart-description">
                                        This curve shows how the model's error decreases during training.
                                        A smooth downward trend indicates good convergence.
                                    </p>
                                </div>
                            )}

                            {/* Accuracy Chart (Classification Only) */}
                            {accuracyChartData && taskType !== 'regression' && (
                                <div className="mlp-chart-card">
                                    <h5 className="mlp-chart-title">Accuracy vs Epoch</h5>
                                    <div className="mlp-chart-container">
                                        <Line data={accuracyChartData} options={accuracyChartOptions} />
                                    </div>
                                    <p className="mlp-chart-description">
                                        This curve shows how classification accuracy improves during training.
                                        The gap between training and validation accuracy indicates generalization.
                                    </p>
                                </div>
                            )}

                            {/* Convergence Info */}
                            <div className="mlp-info-card">
                                <h5 className="mlp-info-card-title">Convergence Analysis</h5>
                                <div className="mlp-convergence-info">
                                    <div className="mlp-convergence-item">
                                        <span className="mlp-convergence-label">Final Training Loss</span>
                                        <span className="mlp-convergence-value">
                                            {safeFixed(modelResults.loss_history[modelResults.loss_history.length - 1], 6)}
                                        </span>
                                    </div>
                                    {modelResults.best_val_loss !== undefined && modelResults.best_val_loss !== null && (
                                        <div className="mlp-convergence-item">
                                            <span className="mlp-convergence-label">Best Validation Loss</span>
                                            <span className="mlp-convergence-value">
                                                {safeFixed(modelResults.best_val_loss, 6)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="mlp-convergence-item">
                                        <span className="mlp-convergence-label">Total Epochs Trained</span>
                                        <span className="mlp-convergence-value">
                                            {modelResults.stopped_epoch > 0 ? modelResults.stopped_epoch : modelResults.architecture.epochs}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Performance Section */}
                    {activeSection === 'performance' && (
                        <div className="mlp-results-section">
                            <h4 className="mlp-results-section-title">Model Performance</h4>

                            {/* Metrics Cards */}
                            {taskType === 'regression' ? (
                                <div className="mlp-metrics-section">
                                    <h5 className="mlp-subsection-title">Regression Metrics</h5>
                                    <div className="mlp-metrics-grid-large">
                                        {modelResults.test_metrics?.r2_score !== undefined && (
                                            <div className="mlp-metric-card-large">
                                                <div className="mlp-metric-icon">📊</div>
                                                <div className="mlp-metric-content">
                                                    <div className="mlp-metric-label-large">R² Score</div>
                                                    <div className={`mlp-metric-value-large ${modelResults.test_metrics.r2_score > 0.7 ? 'good' : modelResults.test_metrics.r2_score < 0.3 ? 'poor' : 'medium'}`}>
                                                        {safeFixed(modelResults.test_metrics.r2_score, 4)}
                                                    </div>
                                                    <div className="mlp-metric-description">
                                                        Proportion of variance explained by the model
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {modelResults.test_metrics?.rmse !== undefined && (
                                            <div className="mlp-metric-card-large">
                                                <div className="mlp-metric-icon">📏</div>
                                                <div className="mlp-metric-content">
                                                    <div className="mlp-metric-label-large">RMSE</div>
                                                    <div className="mlp-metric-value-large">
                                                        {safeFixed(modelResults.test_metrics.rmse, 4)}
                                                    </div>
                                                    <div className="mlp-metric-description">
                                                        Root Mean Squared Error
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {modelResults.test_metrics?.mae !== undefined && (
                                            <div className="mlp-metric-card-large">
                                                <div className="mlp-metric-icon">📐</div>
                                                <div className="mlp-metric-content">
                                                    <div className="mlp-metric-label-large">MAE</div>
                                                    <div className="mlp-metric-value-large">
                                                        {safeFixed(modelResults.test_metrics.mae, 4)}
                                                    </div>
                                                    <div className="mlp-metric-description">
                                                        Mean Absolute Error
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {modelResults.test_metrics?.mse !== undefined && (
                                            <div className="mlp-metric-card-large">
                                                <div className="mlp-metric-icon">📉</div>
                                                <div className="mlp-metric-content">
                                                    <div className="mlp-metric-label-large">MSE</div>
                                                    <div className="mlp-metric-value-large">
                                                        {safeFixed(modelResults.test_metrics.mse, 4)}
                                                    </div>
                                                    <div className="mlp-metric-description">
                                                        Mean Squared Error
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="mlp-metrics-section">
                                        <h5 className="mlp-subsection-title">Classification Metrics</h5>
                                        <div className="mlp-metrics-grid-large">
                                            {modelResults.test_metrics?.accuracy !== undefined && (
                                                <div className="mlp-metric-card-large">
                                                    <div className="mlp-metric-icon">🎯</div>
                                                    <div className="mlp-metric-content">
                                                        <div className="mlp-metric-label-large">Accuracy</div>
                                                        <div className={`mlp-metric-value-large ${modelResults.test_metrics.accuracy > 0.8 ? 'good' : modelResults.test_metrics.accuracy < 0.5 ? 'poor' : 'medium'}`}>
                                                            {safeFixed(modelResults.test_metrics.accuracy * 100, 2)}%
                                                        </div>
                                                        <div className="mlp-metric-description">
                                                            Overall classification accuracy
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {modelResults.test_metrics?.precision !== undefined && (
                                                <div className="mlp-metric-card-large">
                                                    <div className="mlp-metric-icon">🔍</div>
                                                    <div className="mlp-metric-content">
                                                        <div className="mlp-metric-label-large">Precision</div>
                                                        <div className="mlp-metric-value-large">
                                                            {safeFixed(modelResults.test_metrics.precision * 100, 2)}%
                                                        </div>
                                                        <div className="mlp-metric-description">
                                                            Positive prediction accuracy
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {modelResults.test_metrics?.recall !== undefined && (
                                                <div className="mlp-metric-card-large">
                                                    <div className="mlp-metric-icon">🔎</div>
                                                    <div className="mlp-metric-content">
                                                        <div className="mlp-metric-label-large">Recall</div>
                                                        <div className="mlp-metric-value-large">
                                                            {safeFixed(modelResults.test_metrics.recall * 100, 2)}%
                                                        </div>
                                                        <div className="mlp-metric-description">
                                                            True positive detection rate
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {modelResults.test_metrics?.f1_score !== undefined && (
                                                <div className="mlp-metric-card-large">
                                                    <div className="mlp-metric-icon">⚖️</div>
                                                    <div className="mlp-metric-content">
                                                        <div className="mlp-metric-label-large">F1 Score</div>
                                                        <div className="mlp-metric-value-large">
                                                            {safeFixed(modelResults.test_metrics.f1_score * 100, 2)}%
                                                        </div>
                                                        <div className="mlp-metric-description">
                                                            Harmonic mean of precision and recall
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Confusion Matrix */}
                                    {modelResults.test_metrics?.confusion_matrix && (
                                        <div className="mlp-metrics-section">
                                            <h5 className="mlp-subsection-title">
                                                Confusion Matrix {taskType === 'multiclass_classification' ? '(Global Sums)' : ''}
                                            </h5>
                                            <div className="mlp-confusion-matrix">
                                                <div className="mlp-confusion-grid">
                                                    <div className="mlp-confusion-cell header"></div>
                                                    <div className="mlp-confusion-cell header">Predicted Negative</div>
                                                    <div className="mlp-confusion-cell header">Predicted Positive</div>

                                                    <div className="mlp-confusion-cell header">Actual Negative</div>
                                                    <div className="mlp-confusion-cell tn">
                                                        <div className="mlp-confusion-label">TN</div>
                                                        <div className="mlp-confusion-value">
                                                            {modelResults.test_metrics.confusion_matrix.true_negatives}
                                                        </div>
                                                    </div>
                                                    <div className="mlp-confusion-cell fp">
                                                        <div className="mlp-confusion-label">FP</div>
                                                        <div className="mlp-confusion-value">
                                                            {modelResults.test_metrics.confusion_matrix.false_positives}
                                                        </div>
                                                    </div>

                                                    <div className="mlp-confusion-cell header">Actual Positive</div>
                                                    <div className="mlp-confusion-cell fn">
                                                        <div className="mlp-confusion-label">FN</div>
                                                        <div className="mlp-confusion-value">
                                                            {modelResults.test_metrics.confusion_matrix.false_negatives}
                                                        </div>
                                                    </div>
                                                    <div className="mlp-confusion-cell tp">
                                                        <div className="mlp-confusion-label">TP</div>
                                                        <div className="mlp-confusion-value">
                                                            {modelResults.test_metrics.confusion_matrix.true_positives}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* 4. Predictions Section */}
                    {activeSection === 'predictions' && (
                        <div className="mlp-results-section">
                            <h4 className="mlp-results-section-title">Model Predictions</h4>

                            {/* Prediction Confidence (Classification) */}
                            {taskType !== 'regression' && modelResults.test_probabilities && (
                                <div className="mlp-info-card">
                                    <h5 className="mlp-info-card-title">Sample Predictions with Confidence</h5>
                                    <div className="mlp-predictions-list">
                                        {modelResults.test_predictions.slice(0, 5).map((pred, idx) => (
                                            <div key={idx} className="mlp-prediction-item">
                                                <div className="mlp-prediction-header">
                                                    <span className="mlp-prediction-label">Sample {idx + 1}</span>
                                                    <span className="mlp-prediction-class">
                                                        Predicted: <strong>{pred}</strong>
                                                    </span>
                                                </div>
                                                {modelResults.test_probabilities[idx] && (
                                                    <div className="mlp-prediction-probs">
                                                        {modelResults.classes.map((cls, clsIdx) => {
                                                            const prob = Array.isArray(modelResults.test_probabilities[idx])
                                                                ? modelResults.test_probabilities[idx][clsIdx]
                                                                : (clsIdx === 0 ? 1 - modelResults.test_probabilities[idx] : modelResults.test_probabilities[idx]);
                                                            return (
                                                                <div key={clsIdx} className="mlp-prob-bar-container">
                                                                    <span className="mlp-prob-label">Class {cls}</span>
                                                                    <div className="mlp-prob-bar-wrapper">
                                                                        <div
                                                                            className="mlp-prob-bar"
                                                                            style={{ width: `${(prob * 100)}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="mlp-prob-value">{safeFixed(prob * 100, 1)}%</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Predictions Table */}
                            <div className="mlp-info-card">
                                <h5 className="mlp-info-card-title">
                                    Test Set Predictions with Complete Data (First 10)
                                </h5>
                                <div className="mlp-predictions-table-container">
                                    <table className="mlp-predictions-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                {/* Input Features */}
                                                {selectedX.map((feature, idx) => (
                                                    <th key={`feature-${idx}`}>{feature}</th>
                                                ))}
                                                {/* Actual Value */}
                                                <th>Actual {yCol}</th>
                                                {/* Predicted Value */}
                                                <th>Predicted {yCol}</th>
                                                {/* Confidence (Classification only) */}
                                                {taskType !== 'regression' && <th>Confidence</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modelResults.test_predictions.slice(0, 10).map((pred, idx) => {
                                                const maxProb = modelResults.test_probabilities?.[idx]
                                                    ? (Array.isArray(modelResults.test_probabilities[idx])
                                                        ? Math.max(...modelResults.test_probabilities[idx])
                                                        : Math.max(modelResults.test_probabilities[idx], 1 - modelResults.test_probabilities[idx]))
                                                    : null;

                                                const inputFeatures = modelResults.test_X?.[idx] || [];
                                                const actualValue = modelResults.test_y_actual?.[idx];

                                                return (
                                                    <tr key={idx}>
                                                        <td>{idx + 1}</td>
                                                        {/* Display input features */}
                                                        {inputFeatures.map((featureVal, fIdx) => (
                                                            <td key={`feat-${idx}-${fIdx}`}>
                                                                {safeFixed(featureVal, 3)}
                                                            </td>
                                                        ))}
                                                        {/* Display actual value */}
                                                        <td className="mlp-actual-value">
                                                            {actualValue !== undefined && actualValue !== null
                                                                ? (taskType === 'regression' ? safeFixed(actualValue, 3) : actualValue)
                                                                : '—'}
                                                        </td>
                                                        {/* Display predicted value */}
                                                        <td className="mlp-pred-value">
                                                            {taskType === 'regression' ? safeFixed(pred, 3) : pred}
                                                        </td>
                                                        {/* Display confidence (classification only) */}
                                                        {taskType !== 'regression' && (
                                                            <td className="mlp-confidence">
                                                                {maxProb !== null ? `${safeFixed(maxProb * 100, 1)}%` : '—'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mlp-table-note">
                                    Showing first 10 of {modelResults.test_predictions.length} test predictions with complete input features and actual values
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MLPResultsModal;
