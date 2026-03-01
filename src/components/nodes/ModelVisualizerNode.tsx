import React, { useMemo, useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import { Scatter, Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import './ModelVisualizerNode.css';
import {
    FaChartLine,
    FaChartPie,
    FaBrain,
    FaLayerGroup,
    FaProjectDiagram,
    FaCheckCircle,
    FaExclamationCircle,
    FaNetworkWired,
    FaCog
} from 'react-icons/fa';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import InfoButton from '../ui/InfoButton';
import NeuralNetworkStructure from '../ui/NeuralNetworkStructure'; // Import the new component

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

const ModelVisualizerNode = ({ id, data, isConnectable }) => {
    const [activeTab, setActiveTab] = useState('performance');
    const [activeVisual, setActiveVisual] = useState(0);
    const [curveVisibility, setCurveVisibility] = useState({ train: true, val: true });
    // Remove local state for structure since it's now in the component
    // const [structureZoom, setStructureZoom] = useState(1.0);
    // const [hoveredNeuron, setHoveredNeuron] = useState(null);

    // Find upstream trained model
    const upstreamModel = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        if (incoming.length === 0) return null;

        // Find the source node
        const e = incoming[0];
        const src = store.nodeInternals.get(e.source);

        // Check if it's a trained model node
        if (src?.data?.model) {
            // Merge model specific data with root node data (for clustering visuals)
            const modelData = {
                ...src.data.model,
                pcaData: src.data.pcaData,
                clusteredData: src.data.clusteredData,
                clusteredHeaders: src.data.clusteredHeaders,
                clusterLabels: src.data.clusterLabels,
                // DBSCAN specific
                coreSamples: src.data.coreSamples,
                n_noise: src.data.n_noise,
                // Hierarchical specific
                dendrogram: src.data.dendrogram
            };

            return {
                type: src.type,
                data: modelData,
                nodeLabel: src.data.label || src.data.title || src.type
            };
        }
        return null;
    });

    const modelData = upstreamModel?.data;
    const modelType = upstreamModel?.type;

    // Helpers to categorize models
    const isRegression = ['linearRegression', 'multiLinearRegression', 'polynomialRegression', 'knnRegression'].includes(modelType);
    const isClassification = ['logisticRegression', 'naiveBayes', 'knnClassification'].includes(modelType);
    const isClustering = ['kMeans', 'dbscan', 'hierarchicalClustering'].includes(modelType);
    const isNeuralNetwork = ['mlp'].includes(modelType);

    // Get model category name
    const getModelCategory = () => {
        if (isRegression) return 'Regression';
        if (isClassification) return 'Classification';
        if (isClustering) return 'Clustering';
        if (isNeuralNetwork) return 'Neural Network';
        return 'Unknown';
    };

    // Get key metric for header
    const getKeyMetric = () => {
        if (!modelData?.test_metrics) return null;

        if (isRegression) {
            const r2 = modelData.test_metrics.r2_score;
            return { label: 'R² Score', value: `${(r2 * 100).toFixed(1)}%`, good: r2 > 0.7 };
        }

        if (isClassification) {
            const acc = modelData.test_metrics.accuracy;
            return { label: 'Accuracy', value: `${(acc * 100).toFixed(1)}%`, good: acc > 0.8 };
        }

        if (isClustering) {
            if (modelData.test_metrics.silhouette_score !== undefined) {
                const sil = modelData.test_metrics.silhouette_score;
                return { label: 'Silhouette', value: sil.toFixed(3), good: sil > 0.5 };
            }
            if (modelData.test_metrics.inertia !== undefined) {
                return { label: 'Inertia', value: modelData.test_metrics.inertia.toFixed(2), good: true };
            }
        }

        if (isNeuralNetwork) {
            if (modelData.test_metrics.accuracy !== undefined) {
                const acc = modelData.test_metrics.accuracy;
                return { label: 'Accuracy', value: `${(acc * 100).toFixed(1)}%`, good: acc > 0.8 };
            }
            if (modelData.test_metrics.loss !== undefined) {
                const loss = modelData.test_metrics.loss;
                return { label: 'Loss', value: loss.toFixed(4), good: loss < 0.5 };
            }
        }

        return null;
    };

    // --- REGRESSION VISUALIZATIONS ---
    const renderRegressionVisuals = () => {
        if (!modelData.test_y_actual || !modelData.test_predictions) {
            return <div className="mv-empty-state">Regression data missing (re-train model).</div>;
        }

        const actual = modelData.test_y_actual;
        const predicted = modelData.test_predictions;
        const residuals = actual.map((y, i) => y - predicted[i]);

        // 1. Actual vs Predicted Scatter
        const scatterData = {
            datasets: [
                {
                    label: 'Predictions',
                    data: actual.map((y, i) => ({ x: y, y: predicted[i] })),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                },
                {
                    label: 'Perfect Fit',
                    data: [
                        { x: Math.min(...actual), y: Math.min(...actual) },
                        { x: Math.max(...actual), y: Math.max(...actual) }
                    ],
                    type: 'line',
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    borderWidth: 2,
                    fill: false
                }
            ],
        };

        // 2. Residuals Plot
        const residualData = {
            datasets: [
                {
                    label: 'Residuals',
                    data: predicted.map((p, i) => ({ x: p, y: residuals[i] })),
                    backgroundColor: residuals.map(r => r > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                    pointRadius: 5,
                    pointHoverRadius: 7,
                },
                {
                    label: 'Zero Line',
                    data: [
                        { x: Math.min(...predicted), y: 0 },
                        { x: Math.max(...predicted), y: 0 }
                    ],
                    type: 'line',
                    borderColor: '#64748b',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        };

        // 3. Error Distribution Histogram
        const bins = 20;
        const minRes = Math.min(...residuals);
        const maxRes = Math.max(...residuals);
        const binWidth = (maxRes - minRes) / bins;
        const histogram = new Array(bins).fill(0);

        residuals.forEach(r => {
            const binIndex = Math.min(Math.floor((r - minRes) / binWidth), bins - 1);
            histogram[binIndex]++;
        });

        const histogramData = {
            labels: histogram.map((_, i) => {
                const binStart = minRes + i * binWidth;
                return binStart.toFixed(2);
            }),
            datasets: [{
                label: 'Frequency',
                data: histogram,
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1
            }]
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top' as const,
                    labels: { font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 }
                }
            }
        };

        return (
            <div className="mv-visuals-container">
                <div className="mv-visual-tabs">
                    <button
                        className={`mv-visual-tab ${activeVisual === 0 ? 'active' : ''}`}
                        onClick={() => setActiveVisual(0)}
                    >
                        Actual vs Predicted
                    </button>
                    <button
                        className={`mv-visual-tab ${activeVisual === 1 ? 'active' : ''}`}
                        onClick={() => setActiveVisual(1)}
                    >
                        Residuals Plot
                    </button>
                    <button
                        className={`mv-visual-tab ${activeVisual === 2 ? 'active' : ''}`}
                        onClick={() => setActiveVisual(2)}
                    >
                        Error Distribution
                    </button>
                </div>

                <div className="mv-chart-container">
                    {activeVisual === 0 && (
                        <Scatter
                            data={scatterData}
                            options={{
                                ...chartOptions,
                                scales: {
                                    x: {
                                        title: { display: true, text: 'Actual Values', font: { size: 12, weight: 'bold' } },
                                        grid: { color: 'rgba(0,0,0,0.05)' }
                                    },
                                    y: {
                                        title: { display: true, text: 'Predicted Values', font: { size: 12, weight: 'bold' } },
                                        grid: { color: 'rgba(0,0,0,0.05)' }
                                    }
                                }
                            }}
                        />
                    )}
                    {activeVisual === 1 && (
                        <Scatter
                            data={residualData}
                            options={{
                                ...chartOptions,
                                scales: {
                                    x: {
                                        title: { display: true, text: 'Predicted Values', font: { size: 12, weight: 'bold' } },
                                        grid: { color: 'rgba(0,0,0,0.05)' }
                                    },
                                    y: {
                                        title: { display: true, text: 'Residual (Error)', font: { size: 12, weight: 'bold' } },
                                        grid: { color: 'rgba(0,0,0,0.05)' }
                                    }
                                }
                            }}
                        />
                    )}
                    {activeVisual === 2 && (
                        <Bar
                            data={histogramData}
                            options={{
                                ...chartOptions,
                                scales: {
                                    x: {
                                        title: { display: true, text: 'Residual Value', font: { size: 12, weight: 'bold' } },
                                        grid: { display: false }
                                    },
                                    y: {
                                        title: { display: true, text: 'Frequency', font: { size: 12, weight: 'bold' } },
                                        grid: { color: 'rgba(0,0,0,0.05)' }
                                    }
                                }
                            }}
                        />
                    )}
                </div>

                {/* Additional info for specific regression types */}
                {modelType === 'polynomialRegression' && modelData.degree && (
                    <div className="mv-info-badge">
                        <FaCog /> Polynomial Degree: {modelData.degree}
                    </div>
                )}
                {modelType === 'knnRegression' && modelData.k && (
                    <div className="mv-info-badge">
                        <FaNetworkWired /> K Neighbors: {modelData.k}
                    </div>
                )}
            </div>
        );
    };

    // --- CLASSIFICATION VISUALIZATIONS ---
    const renderClassificationVisuals = () => {
        const actual = modelData.test_y_actual;
        const predicted = modelData.test_predictions;

        if (!actual || !predicted) {
            return <div className="mv-empty-state">Classification data missing.</div>;
        }

        // Compute Confusion Matrix
        // Prefer model classes if available to ensure full matrix is shown
        let uniqueClasses = modelData.classes || [...new Set([...actual, ...predicted])].sort();
        // Ensure classes are primitive values for comparison/keys
        uniqueClasses = uniqueClasses.map(c => c);

        const confMatrix = {};
        uniqueClasses.forEach(c1 => {
            uniqueClasses.forEach(c2 => {
                confMatrix[`${c1}-${c2}`] = 0;
            });
        });

        actual.forEach((act, i) => {
            const pred = predicted[i];
            confMatrix[`${act}-${pred}`] = (confMatrix[`${act}-${pred}`] || 0) + 1;
        });

        // Class distribution
        const classCounts = {};
        predicted.forEach(p => {
            classCounts[p] = (classCounts[p] || 0) + 1;
        });

        const distributionData = {
            labels: Object.keys(classCounts),
            datasets: [{
                label: 'Predictions per Class',
                data: Object.values(classCounts),
                backgroundColor: Object.keys(classCounts).map((_, i) =>
                    `hsl(${i * 137.5 % 360}, 70%, 60%)`
                ),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };

        const renderConfusionMatrix = () => {
            const maxVal = Math.max(...Object.values(confMatrix));

            return (
                <div className="mv-confusion-wrapper">
                    <h4 className="mv-section-title">Confusion Matrix</h4>
                    <div
                        className="mv-confusion-matrix"
                        style={{ gridTemplateColumns: `80px repeat(${uniqueClasses.length}, 1fr)` }}
                    >
                        <div className="mv-cm-corner"></div>
                        {uniqueClasses.map(c => (
                            <div key={c} className="mv-cm-header">Pred {c}</div>
                        ))}

                        {uniqueClasses.map(rowClass => (
                            <React.Fragment key={rowClass}>
                                <div className="mv-cm-row-header">Actual {rowClass}</div>
                                {uniqueClasses.map(colClass => {
                                    const val = confMatrix[`${rowClass}-${colClass}`];
                                    const opacity = maxVal > 0 ? val / maxVal : 0;
                                    const isCorrect = rowClass == colClass; // Loose equality for potential string/number mismatch
                                    const isZero = val === 0;

                                    // Determine background color
                                    let bgColor = '#fff'; // Default/Zero
                                    if (!isZero) {
                                        if (isCorrect) {
                                            // Green for correct
                                            bgColor = `rgba(16, 185, 129, ${Math.max(0.2, opacity)})`;
                                        } else {
                                            // Red for errors
                                            bgColor = `rgba(239, 68, 68, ${Math.max(0.1, opacity * 0.5)})`;
                                        }
                                    } else if (isCorrect) {
                                        // Zero on diagonal (rare/bad?) -> Light gray to show it exists
                                        bgColor = 'rgba(16, 185, 129, 0.05)';
                                    }

                                    return (
                                        <div
                                            key={`${rowClass}-${colClass}`}
                                            className={`mv-cm-cell ${!isZero && isCorrect ? 'correct' : ''} ${!isZero && !isCorrect ? 'incorrect' : ''}`}
                                            style={{
                                                backgroundColor: bgColor,
                                                color: !isZero && opacity > 0.5 ? '#fff' : '#0f172a',
                                                border: isZero ? '1px solid #f1f5f9' : undefined
                                            }}
                                        >
                                            {val}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            );
        };

        return (
            <div className="mv-visuals-container">
                <div className="mv-visual-tabs">
                    <button
                        className={`mv-visual-tab ${activeVisual === 0 ? 'active' : ''}`}
                        onClick={() => setActiveVisual(0)}
                    >
                        Confusion Matrix
                    </button>
                    <button
                        className={`mv-visual-tab ${activeVisual === 1 ? 'active' : ''}`}
                        onClick={() => setActiveVisual(1)}
                    >
                        Class Distribution
                    </button>
                </div>

                <div className="mv-chart-container">
                    {activeVisual === 0 && renderConfusionMatrix()}
                    {activeVisual === 1 && (
                        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '80%', height: '80%' }}>
                                <Doughnut
                                    data={distributionData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'bottom' as const },
                                            tooltip: {
                                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                padding: 12
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Additional info for specific classification types */}
                {modelType === 'knnClassification' && modelData.k && (
                    <div className="mv-info-badge">
                        <FaNetworkWired /> K Neighbors: {modelData.k}
                    </div>
                )}
            </div>
        );
    };

    // --- CLUSTERING VISUALIZATIONS ---
    const renderClusteringVisuals = () => {
        // K-Means specific
        if (modelType === 'kMeans') {
            if (!modelData.pcaData?.coords || !modelData.clusterLabels) {
                return (
                    <div className="mv-empty-state">
                        <FaLayerGroup size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <p>K-Means visualization requires PCA data.</p>
                    </div>
                );
            }

            const coords = modelData.pcaData.coords;
            const labels = modelData.clusterLabels;
            const centroids = modelData.centroids;

            console.log('DEBUG_MV_KMEANS:', {
                hasClusteredData: !!modelData.clusteredData,
                dataLength: modelData.clusteredData?.length,
                hasHeaders: !!modelData.clusteredHeaders,
                headers: modelData.clusteredHeaders,
                firstRow: modelData.clusteredData?.[0]
            });

            // Group by cluster
            const clusters = {};
            coords.forEach((point, i) => {
                const label = labels[i];
                if (!clusters[label]) clusters[label] = [];
                clusters[label].push({
                    x: point[0],
                    y: point[1],
                    originalData: modelData.clusteredData ? modelData.clusteredData[i] : null,
                    originalIndex: i
                });
            });

            // Generate datasets
            const datasets = Object.keys(clusters).map(label => ({
                label: `Cluster ${label}`,
                data: clusters[label],
                backgroundColor: `hsl(${label * 137.5 % 360}, 70%, 50%)`,
                pointRadius: 5,
                pointHoverRadius: 7
            }));

            // Add centroids if available
            if (centroids && centroids.length > 0) {
                datasets.push({
                    label: 'Centroids',
                    data: centroids.map(c => ({ x: c[0], y: c[1] })),
                    backgroundColor: '#000',
                    pointRadius: 10,
                    pointStyle: 'star',
                    pointHoverRadius: 12
                });
            }

            // Cluster size distribution
            const clusterSizes = Object.keys(clusters).map(k => clusters[k].length);
            const sizeData = {
                labels: Object.keys(clusters).map(k => `Cluster ${k}`),
                datasets: [{
                    label: 'Cluster Size',
                    data: clusterSizes,
                    backgroundColor: Object.keys(clusters).map((k) =>
                        `hsl(${k * 137.5 % 360}, 70%, 60%)`
                    ),
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            };

            return (
                <div className="mv-visuals-container">
                    <div className="mv-visual-tabs">
                        <button
                            className={`mv-visual-tab ${activeVisual === 0 ? 'active' : ''}`}
                            onClick={() => setActiveVisual(0)}
                        >
                            Cluster Scatter (PCA)
                        </button>
                        <button
                            className={`mv-visual-tab ${activeVisual === 1 ? 'active' : ''}`}
                            onClick={() => setActiveVisual(1)}
                        >
                            Cluster Sizes
                        </button>
                    </div>

                    <div className="mv-chart-container">
                        {activeVisual === 0 && (
                            <>
                                <Scatter
                                    data={{ datasets }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        scales: {
                                            x: {
                                                title: { display: true, text: 'PCA Component 1', font: { size: 12, weight: 'bold' } },
                                                grid: { color: 'rgba(0,0,0,0.05)' }
                                            },
                                            y: {
                                                title: { display: true, text: 'PCA Component 2', font: { size: 12, weight: 'bold' } },
                                                grid: { color: 'rgba(0,0,0,0.05)' }
                                            }
                                        },
                                        plugins: {
                                            legend: { position: 'bottom' as const },
                                            tooltip: {
                                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                padding: 10,
                                                callbacks: {
                                                    label: (context) => {
                                                        const point = context.raw;
                                                        if (context.dataset.label === 'Centroids') {
                                                            return `Centroid (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
                                                        }

                                                        {
                                                            const lines = [];
                                                            if (point.originalIndex !== undefined) lines.push(`Sample: #${point.originalIndex + 1}`);
                                                            if (context.dataset.label) lines.push(`Cluster: ${context.dataset.label.replace('Cluster ', '')}`);

                                                            if (point.originalData && modelData.clusteredHeaders) {
                                                                lines.push('');
                                                                const headers = modelData.clusteredHeaders;
                                                                const values = point.originalData;
                                                                const limit = Math.min(10, headers.length - 1);
                                                                for (let k = 0; k < limit; k++) {
                                                                    let val = values[k];
                                                                    if (typeof val === 'number') val = Number.isInteger(val) ? val : val.toFixed(3);
                                                                    else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                                                                        const num = parseFloat(val);
                                                                        val = Number.isInteger(num) ? num : num.toFixed(3);
                                                                    }
                                                                    lines.push(`${headers[k] || `Feature ${k + 1}`}: ${val}`);
                                                                }
                                                                if (headers.length - 1 > limit) lines.push(`... (+${headers.length - 1 - limit} more)`);
                                                            } else {
                                                                lines.push('');
                                                                lines.push('(Run model to see features)');
                                                            }

                                                            lines.push('');
                                                            lines.push(`PC1: ${point.x.toFixed(2)}`);
                                                            lines.push(`PC2: ${point.y.toFixed(2)}`);
                                                            return lines;
                                                        }

                                                        if (!point.originalData || !modelData.clusteredHeaders) {
                                                            // Fallback if data is missing (likely needs re-run)
                                                            return [`(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`, '(Re-run model to view features)'];
                                                        }

                                                        const headers = modelData.clusteredHeaders;
                                                        const values = point.originalData;
                                                        const lines = [];

                                                        // Show top 5 features (exclude cluster_label at the end)
                                                        const featureCount = headers.length - 1;
                                                        const limit = Math.min(5, featureCount);

                                                        for (let k = 0; k < limit; k++) {
                                                            let val = values[k];
                                                            if (typeof val === 'number') val = val.toFixed(2);
                                                            else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                                                                const num = parseFloat(val);
                                                                // Check if it's an integer-like float
                                                                val = Number.isInteger(num) ? num : num.toFixed(2);
                                                            }
                                                            lines.push(`${headers[k]}: ${val}`);
                                                        }

                                                        if (featureCount > limit) {
                                                            lines.push(`... (+${featureCount - limit} more)`);
                                                        }

                                                        return lines;
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                                {modelData.pcaData.variance_ratio && (
                                    <div className="mv-info-text">
                                        Explained Variance: {(modelData.pcaData.variance_ratio * 100).toFixed(1)}%
                                    </div>
                                )}
                            </>
                        )}
                        {/* DEBUG DATA AVAILABILITY */}
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '5px', textAlign: 'center' }}>
                            Debug: Data Rows: {modelData.clusteredData?.length || 'None'}, Headers: {modelData.clusteredHeaders?.length || 'None'}
                        </div>
                        {activeVisual === 1 && (
                            <Bar
                                data={sizeData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        y: {
                                            title: { display: true, text: 'Number of Points', font: { size: 12, weight: 'bold' } },
                                            beginAtZero: true,
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        },
                                        x: {
                                            grid: { display: false }
                                        }
                                    },
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                            padding: 12
                                        }
                                    }
                                }}
                            />
                        )}
                    </div>

                    <div className="mv-info-badge">
                        <FaLayerGroup /> Number of Clusters: {Object.keys(clusters).length}
                    </div>
                </div >
            );
        }

        // DBSCAN specific
        if (modelType === 'dbscan') {
            if (!modelData.pcaData?.coords || !modelData.clusterLabels) {
                return (
                    <div className="mv-empty-state">
                        <FaLayerGroup size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <p>DBSCAN visualization requires PCA data.</p>
                    </div>
                );
            }

            const coords = modelData.pcaData.coords;
            const labels = modelData.clusterLabels;

            // Group by cluster
            const clusters = {};
            coords.forEach((point, i) => {
                const label = labels[i];
                if (!clusters[label]) clusters[label] = [];
                clusters[label].push({
                    x: point[0],
                    y: point[1],
                    originalData: modelData.clusteredData ? modelData.clusteredData[i] : null,
                    originalIndex: i
                });
            });

            // Generate datasets
            const datasets = Object.keys(clusters).map(label => ({
                label: parseInt(label) === -1 ? 'Noise' : `Cluster ${label}`,
                data: clusters[label],
                backgroundColor: parseInt(label) === -1 ? '#94a3b8' : `hsl(${label * 137.5 % 360}, 70%, 50%)`,
                pointRadius: parseInt(label) === -1 ? 3 : 5,
                pointHoverRadius: parseInt(label) === -1 ? 5 : 7
            }));

            const numClusters = Object.keys(clusters).filter(k => parseInt(k) !== -1).length;
            const noiseCount = clusters['-1']?.length || 0;

            // Cluster size distribution for DBSCAN
            const sortedLabels = Object.keys(clusters).sort((a, b) => parseInt(a) - parseInt(b));
            const clusterSizes = sortedLabels.map(k => clusters[k].length);

            const sizeData = {
                labels: sortedLabels.map(k => parseInt(k) === -1 ? 'Noise' : `Cluster ${k}`),
                datasets: [{
                    label: 'Cluster Size',
                    data: clusterSizes,
                    backgroundColor: sortedLabels.map((k) =>
                        parseInt(k) === -1 ? '#94a3b8' : `hsl(${k * 137.5 % 360}, 70%, 60%)`
                    ),
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            };

            return (
                <div className="mv-visuals-container">
                    <div className="mv-visual-tabs">
                        <button
                            className={`mv-visual-tab ${activeVisual === 0 ? 'active' : ''}`}
                            onClick={() => setActiveVisual(0)}
                        >
                            Cluster Scatter (PCA)
                        </button>
                        <button
                            className={`mv-visual-tab ${activeVisual === 1 ? 'active' : ''}`}
                            onClick={() => setActiveVisual(1)}
                        >
                            Cluster Sizes
                        </button>
                    </div>

                    <div className="mv-chart-container">
                        {activeVisual === 0 && (
                            <Scatter
                                data={{ datasets }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        x: {
                                            title: { display: true, text: 'PCA Component 1', font: { size: 12, weight: 'bold' } },
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        },
                                        y: {
                                            title: { display: true, text: 'PCA Component 2', font: { size: 12, weight: 'bold' } },
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        }
                                    },
                                    plugins: {
                                        legend: { position: 'bottom' as const },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                            padding: 10,
                                            callbacks: {
                                                label: (context) => {
                                                    const point = context.raw;
                                                    {
                                                        const lines = [];
                                                        if (point.originalIndex !== undefined) lines.push(`Sample: #${point.originalIndex + 1}`);
                                                        const labelStr = context.dataset.label.toString();
                                                        lines.push(labelStr.includes('Noise') ? 'Noise Point' : `Cluster: ${labelStr.replace('Cluster ', '')}`);

                                                        if (point.originalData && modelData.clusteredHeaders) {
                                                            lines.push('');
                                                            const headers = modelData.clusteredHeaders;
                                                            const values = point.originalData;
                                                            const limit = Math.min(10, headers.length - 1);
                                                            for (let k = 0; k < limit; k++) {
                                                                let val = values[k];
                                                                if (typeof val === 'number') val = Number.isInteger(val) ? val : val.toFixed(3);
                                                                else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                                                                    const num = parseFloat(val);
                                                                    val = Number.isInteger(num) ? num : num.toFixed(3);
                                                                }
                                                                lines.push(`${headers[k] || `Feature ${k + 1}`}: ${val}`);
                                                            }
                                                            if (headers.length - 1 > limit) lines.push(`... (+${headers.length - 1 - limit} more)`);
                                                        } else {
                                                            lines.push('');
                                                            lines.push('(Run model to see features)');
                                                        }

                                                        lines.push('');
                                                        lines.push(`PC1: ${point.x.toFixed(2)}`);
                                                        lines.push(`PC2: ${point.y.toFixed(2)}`);
                                                        return lines;
                                                    }

                                                    // Noise points or missing data
                                                    if (!point.originalData || !modelData.clusteredHeaders) {
                                                        return [`${context.dataset.label}: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`, '(Re-run model to view features)'];
                                                    }

                                                    const headers = modelData.clusteredHeaders;
                                                    const values = point.originalData;
                                                    const lines = [];

                                                    // Show top 5 features (exclude cluster_label)
                                                    const featureCount = headers.length - 1;
                                                    const limit = Math.min(5, featureCount);

                                                    for (let k = 0; k < limit; k++) {
                                                        let val = values[k];
                                                        if (typeof val === 'number') val = val.toFixed(2);
                                                        else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                                                            const num = parseFloat(val);
                                                            val = Number.isInteger(num) ? num : num.toFixed(2);
                                                        }
                                                        lines.push(`${headers[k]}: ${val}`);
                                                    }

                                                    if (featureCount > limit) {
                                                        lines.push(`... (+${featureCount - limit} more)`);
                                                    }

                                                    return lines;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        )}
                        {activeVisual === 1 && (
                            <Bar
                                data={sizeData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        y: {
                                            title: { display: true, text: 'Number of Points', font: { size: 12, weight: 'bold' } },
                                            beginAtZero: true,
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        },
                                        x: {
                                            grid: { display: false }
                                        }
                                    },
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                            padding: 12
                                        }
                                    }
                                }}
                            />
                        )}
                    </div>

                    <div className="mv-dbscan-info">
                        <div className="mv-info-badge">
                            <FaLayerGroup /> Clusters Found: {numClusters}
                        </div>
                        <div className="mv-info-badge">
                            <FaExclamationCircle /> Noise Points: {noiseCount}
                        </div>
                    </div>

                    <div className="mv-info-text" style={{ marginTop: 10, fontStyle: 'italic' }}>
                        ⚠️ DBSCAN does not compute centroids.
                    </div>
                </div>
            );
        }

        // Hierarchical Clustering
        if (modelType === 'hierarchicalClustering') {
            if (!modelData.pcaData?.coords || !modelData.clusterLabels) {
                return (
                    <div className="mv-empty-state">
                        <FaLayerGroup size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <p>Model requires re-run to generate visualization data.</p>
                    </div>
                );
            }

            const coords = modelData.pcaData.coords;
            const labels = modelData.clusterLabels;

            // Group by cluster
            const clusters = {};
            coords.forEach((point, i) => {
                const label = labels[i];
                if (!clusters[label]) clusters[label] = [];
                clusters[label].push({
                    x: point[0],
                    y: point[1],
                    originalData: modelData.clusteredData ? modelData.clusteredData[i] : null,
                    originalIndex: i
                });
            });

            // Generate datasets
            const datasets = Object.keys(clusters).map(label => ({
                label: `Cluster ${label}`,
                data: clusters[label],
                backgroundColor: `hsl(${label * 137.5 % 360}, 70%, 50%)`,
                pointRadius: 5,
                pointHoverRadius: 7
            }));

            // Cluster size distribution for Hierarchical
            const sortedLabels = Object.keys(clusters).sort((a, b) => parseInt(a) - parseInt(b));
            const clusterSizes = sortedLabels.map(k => clusters[k].length);

            const sizeData = {
                labels: sortedLabels.map(k => `Cluster ${k}`),
                datasets: [{
                    label: 'Cluster Size',
                    data: clusterSizes,
                    backgroundColor: sortedLabels.map((k) =>
                        `hsl(${k * 137.5 % 360}, 70%, 60%)`
                    ),
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            };

            return (
                <div className="mv-visuals-container">
                    <div className="mv-visual-tabs">
                        <button
                            className={`mv-visual-tab ${activeVisual === 0 ? 'active' : ''}`}
                            onClick={() => setActiveVisual(0)}
                        >
                            Cluster Scatter (PCA)
                        </button>
                        <button
                            className={`mv-visual-tab ${activeVisual === 1 ? 'active' : ''}`}
                            onClick={() => setActiveVisual(1)}
                        >
                            Cluster Sizes
                        </button>
                    </div>

                    <div className="mv-chart-container">
                        {activeVisual === 0 && (
                            <Scatter
                                data={{ datasets }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        x: {
                                            title: { display: true, text: 'PCA Component 1', font: { size: 12, weight: 'bold' } },
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        },
                                        y: {
                                            title: { display: true, text: 'PCA Component 2', font: { size: 12, weight: 'bold' } },
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        }
                                    },
                                    plugins: {
                                        legend: { position: 'bottom' as const },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                            padding: 10,
                                            callbacks: {
                                                label: (context) => {
                                                    const point = context.raw;
                                                    const lines = [];
                                                    if (point.originalIndex !== undefined) lines.push(`Sample: #${point.originalIndex + 1}`);
                                                    lines.push(`Cluster: ${context.dataset.label.replace('Cluster ', '')}`);

                                                    if (point.originalData && modelData.clusteredHeaders) {
                                                        lines.push('');
                                                        const headers = modelData.clusteredHeaders;
                                                        const values = point.originalData;
                                                        const limit = Math.min(10, headers.length - 1);
                                                        for (let k = 0; k < limit; k++) {
                                                            let val = values[k];
                                                            if (typeof val === 'number') val = Number.isInteger(val) ? val : val.toFixed(3);
                                                            else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                                                                const num = parseFloat(val);
                                                                val = Number.isInteger(num) ? num : num.toFixed(3);
                                                            }
                                                            lines.push(`${headers[k] || `Feature ${k + 1}`}: ${val}`);
                                                        }
                                                        if (headers.length - 1 > limit) lines.push(`... (+${headers.length - 1 - limit} more)`);
                                                    } else {
                                                        lines.push('');
                                                        lines.push('(Run model to see features)');
                                                    }

                                                    lines.push('');
                                                    lines.push(`PC1: ${point.x.toFixed(2)}`);
                                                    lines.push(`PC2: ${point.y.toFixed(2)}`);
                                                    return lines;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        )}
                        {activeVisual === 1 && (
                            <Bar
                                data={sizeData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        y: {
                                            title: { display: true, text: 'Number of Points', font: { size: 12, weight: 'bold' } },
                                            beginAtZero: true,
                                            grid: { color: 'rgba(0,0,0,0.05)' }
                                        },
                                        x: {
                                            grid: { display: false }
                                        }
                                    },
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                            padding: 12
                                        }
                                    }
                                }}
                            />
                        )}
                    </div>

                    <div className="mv-info-badge">
                        <FaLayerGroup /> Clusters: {Object.keys(clusters).length}
                    </div>
                </div>
            );
        }

        return <div className="mv-empty-state">Clustering visualization not available.</div>;
    };

    // --- NEURAL NETWORK VISUALIZATIONS ---
    const renderNeuralNetworkVisuals = () => {
        // Extract Data
        const { loss_history, val_loss_history, accuracy_history, val_accuracy_history, architecture, weights, test_probabilities, test_metrics } = modelData;
        const lossHistory = loss_history;
        const valLossHistory = val_loss_history;
        const taskType = modelData.task_type || 'regression';
        const isClassifier = taskType !== 'regression';

        if (!lossHistory) {
            return <div className="mv-empty-state">No training history available.</div>;
        }

        // Constants for Visualization
        const ACTIVATION_COLORS = {
            relu: '#3b82f6', // Blue
            sigmoid: '#10b981', // Green
            tanh: '#8b5cf6', // Purple
            linear: '#9ca3af', // Gray
            softmax: '#f97316', // Orange
            default: '#6366f1' // Indigo
        };
        const getActivationColor = (act) => ACTIVATION_COLORS[act?.toLowerCase()] || ACTIVATION_COLORS.default;

        // --- SUB-RENDERERS ---

        const renderTrainingCurves = () => {
            // Using curveVisibility from parent scope
            const epochs = loss_history.map((_, i) => i + 1);

            // Loss Chart
            const lossData = {
                labels: epochs,
                datasets: [
                    ...(curveVisibility.train ? [{
                        label: 'Training Loss',
                        data: lossHistory,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4
                    }] : []),
                    ...(curveVisibility.val && valLossHistory ? [{
                        label: 'Validation Loss',
                        data: valLossHistory,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.3, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4
                    }] : [])
                ]
            };

            // Accuracy Chart (if classification)
            const accData = isClassifier && accuracy_history ? {
                labels: epochs,
                datasets: [
                    ...(curveVisibility.train ? [{
                        label: 'Training Accuracy',
                        data: accuracy_history,
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.3, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4
                    }] : []),
                    ...(curveVisibility.val && val_accuracy_history ? [{
                        label: 'Validation Accuracy',
                        data: val_accuracy_history,
                        borderColor: 'rgb(139, 92, 246)',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.3, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4
                    }] : [])
                ]
            } : null;

            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%', overflowY: 'auto', padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={curveVisibility.train} onChange={e => setCurveVisibility({ ...curveVisibility, train: e.target.checked })} /> Show Training
                        </label>
                        {valLossHistory && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                                <input type="checkbox" checked={curveVisibility.val} onChange={e => setCurveVisibility({ ...curveVisibility, val: e.target.checked })} /> Show Validation
                            </label>
                        )}
                    </div>

                    <div style={{ height: '300px', flexShrink: 0 }}>
                        <h5 style={{ textAlign: 'center', marginBottom: '10px', color: '#64748b' }}>Loss vs Epochs</h5>
                        <Line data={lossData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'top' as const } }, scales: { x: { title: { display: true, text: 'Epoch' } }, y: { title: { display: true, text: 'Loss' } } } }} />
                    </div>
                    {accData && (
                        <div style={{ height: '300px', flexShrink: 0 }}>
                            <h5 style={{ textAlign: 'center', marginBottom: '10px', color: '#64748b' }}>Accuracy vs Epochs</h5>
                            <Line data={accData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'top' as const } }, scales: { x: { title: { display: true, text: 'Epoch' } }, y: { title: { display: true, text: 'Accuracy' } } } }} />
                        </div>
                    )}
                </div>
            );
        };

        const renderNetworkStructure = () => {
            if (!architecture) return <div className="mv-empty-state">No architecture data.</div>;

            // Reuse the shared component which now has the scrollbar fix
            return (
                <div style={{ width: '100%', height: '100%' }}>
                    <NeuralNetworkStructure
                        architecture={architecture}
                        taskType={taskType}
                    />
                </div>
            );
        };

        const renderInsights = () => {
            // Helper to flatten and bin data
            const computeHistogram = (dataFlat, binCount = 15) => {
                if (!dataFlat || dataFlat.length === 0) return null;
                const min = Math.min(...dataFlat);
                const max = Math.max(...dataFlat);
                const range = max - min || 1;
                const step = range / binCount;

                const bins = new Array(binCount).fill(0);
                const labels = new Array(binCount).fill(0).map((_, i) => (min + i * step).toFixed(2));

                dataFlat.forEach(v => {
                    let idx = Math.floor((v - min) / step);
                    if (idx >= binCount) idx = binCount - 1;
                    bins[idx]++;
                });
                return { labels, data: bins };
            };
            const flatten = (arr) => arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);

            let confHist = null;
            // Robust check for probability data
            if (isClassifier && test_probabilities && test_probabilities.length > 0) {
                // Handle different prob formats (list of list vs list of scalers if binary?)
                // Sklearn predict_proba returns [ [p0, p1], ... ] for binary
                const maxProbs = test_probabilities.map(row => Array.isArray(row) ? Math.max(...row) : row);
                const hist = computeHistogram(maxProbs, 10);
                if (hist) {
                    confHist = {
                        labels: hist.labels,
                        datasets: [{ label: 'Confidence', data: hist.data, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderRadius: 4 }]
                    };
                }
            }

            // Confusion Matrix Heatmap
            const cm = test_metrics?.confusion_matrix;

            // Weight Distribution
            const weightPlots = (weights || []).map((layerW, i) => {
                const flat = flatten(layerW);
                const hist = computeHistogram(flat, 20);
                if (!hist) return null;
                return {
                    label: `Layer ${i + 1}`,
                    stats: { min: Math.min(...flat).toFixed(3), max: Math.max(...flat).toFixed(3) },
                    data: {
                        labels: hist.labels,
                        datasets: [{ label: 'Weights', data: hist.data, backgroundColor: 'rgba(99, 102, 241, 0.5)' }]
                    }
                };
            }).filter(Boolean);

            return (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '30px', overflowY: 'auto', height: '100%' }}>
                    {/* Prediction Confidence (Only if available) */}
                    {confHist ? (
                        <div style={{ height: '250px', flexShrink: 0 }}>
                            <h5 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>🔥 Prediction Confidence Distribution</h5>
                            <Bar data={confHist} options={{ maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Confidence (0-1)' } }, y: { title: { display: true, text: 'Count' } } }, plugins: { legend: { display: false } } }} />
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Higher peaks on the right indicate the model is confident in its predictions.</p>
                        </div>
                    ) : (
                        isClassifier ?
                            <div className="mv-empty-state" style={{ flexShrink: 0, height: 'auto', padding: 20 }}>
                                <FaExclamationCircle size={24} style={{ color: '#f59e0b', marginBottom: 10 }} />
                                <p>Confidence data not available.</p>
                            </div> : null
                    )}

                    {/* Confusion Matrix (Heatmap style) */}
                    {cm && (
                        <div>
                            <h5 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>📊 Confusion Matrix</h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '10px', maxWidth: '300px', fontSize: '0.9rem' }}>
                                <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#166534' }}>{cm.true_positives}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#166534' }}>True Positives</div>
                                </div>
                                <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#991b1b' }}>{cm.false_positives}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#991b1b' }}>False Positives</div>
                                </div>
                                <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#991b1b' }}>{cm.false_negatives}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#991b1b' }}>False Negatives</div>
                                </div>
                                <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#166534' }}>{cm.true_negatives}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#166534' }}>True Negatives</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Advanced Weight Distribution */}
                    {weightPlots.length > 0 && (
                        <details style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px' }} open={!confHist && !cm}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', color: '#475569' }}>Weight Distribution (Network Dynamics)</summary>
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {weightPlots.map((wp, i) => (
                                    <div key={i} style={{ height: '150px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: 5 }}>{wp.label} (Value Range: {wp.stats.min} to {wp.stats.max})</div>
                                        <Bar data={wp.data} options={{ maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false } } }} />
                                    </div>
                                ))}
                                <p style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    <strong>Interpretation:</strong> Weights centered around zero indicate stable training.
                                    Broader distributions in earlier layers often suggest active feature extraction, while narrower distributions in later layers indicate fine-tuning.
                                </p>
                            </div>
                        </details>
                    )}
                </div>
            );
        };

        const hasProbabilities = isClassifier && test_probabilities && test_probabilities.length > 0;
        const hasWeights = weights && weights.length > 0;
        const hasInsights = hasProbabilities || hasWeights;

        return (
            <div className="mv-visuals-container">
                <div className="mv-visual-tabs">
                    <button className={`mv-visual-tab ${activeVisual === 0 ? 'active' : ''}`} onClick={() => setActiveVisual(0)}>Training Curves</button>
                    <button className={`mv-visual-tab ${activeVisual === 1 ? 'active' : ''}`} onClick={() => setActiveVisual(1)}>Structure</button>
                    {hasInsights && (
                        <button className={`mv-visual-tab ${activeVisual === 2 ? 'active' : ''}`} onClick={() => setActiveVisual(2)}>Insights</button>
                    )}
                </div>
                <div className="mv-chart-container" style={{ position: 'relative' }}>
                    {activeVisual === 0 && renderTrainingCurves()}
                    {activeVisual === 1 && renderNetworkStructure()}
                    {activeVisual === 2 && hasInsights && renderInsights()}
                </div>

                {architecture && (
                    <div className="mv-nn-metadata">
                        <div className="mv-info-badge">
                            <FaBrain /> Opt: {architecture.optimizer || 'Adam'}
                        </div>
                        <div className="mv-info-badge">
                            <FaCog /> LR: {architecture.learning_rate || 0.001}
                        </div>
                        <div className="mv-info-badge">
                            <FaLayerGroup /> Epochs: {architecture.epochs || (lossHistory ? lossHistory.length : 'N/A')}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Main render function for visuals
    const renderVisuals = () => {
        if (!modelData) {
            return <div className="mv-empty-state">No model data available. Train the connected model.</div>;
        }

        if (isRegression) return renderRegressionVisuals();
        if (isClassification) return renderClassificationVisuals();
        if (isClustering) return renderClusteringVisuals();
        if (isNeuralNetwork) return renderNeuralNetworkVisuals();

        return <div className="mv-empty-state">Model type not supported for visualization.</div>;
    };

    // Performance metrics display
    const renderPerformanceMetrics = () => {
        if (!modelData?.test_metrics) {
            return <div className="mv-empty-state">No metrics available.</div>;
        }

        const metrics = modelData.test_metrics;
        const metricsList = [];

        // Regression metrics
        if (isRegression) {
            if (metrics.mse !== undefined) metricsList.push({ label: 'MSE', value: metrics.mse.toFixed(4) });
            if (metrics.rmse !== undefined) metricsList.push({ label: 'RMSE', value: metrics.rmse.toFixed(4) });
            if (metrics.mae !== undefined) metricsList.push({ label: 'MAE', value: metrics.mae.toFixed(4) });
            if (metrics.r2_score !== undefined) metricsList.push({ label: 'R² Score', value: (metrics.r2_score * 100).toFixed(2) + '%', highlight: true });
        }

        // Classification metrics
        if (isClassification) {
            if (metrics.accuracy !== undefined) metricsList.push({ label: 'Accuracy', value: (metrics.accuracy * 100).toFixed(2) + '%', highlight: true });
            if (metrics.precision !== undefined) metricsList.push({ label: 'Precision', value: (metrics.precision * 100).toFixed(2) + '%' });
            if (metrics.recall !== undefined) metricsList.push({ label: 'Recall', value: (metrics.recall * 100).toFixed(2) + '%' });
            if (metrics.f1_score !== undefined) metricsList.push({ label: 'F1-Score', value: (metrics.f1_score * 100).toFixed(2) + '%' });

            if (metrics.confusion_matrix) {
                const cm = metrics.confusion_matrix;
                metricsList.push({ label: 'True Positives', value: cm.true_positives || 0 });
                metricsList.push({ label: 'True Negatives', value: cm.true_negatives || 0 });
                metricsList.push({ label: 'False Positives', value: cm.false_positives || 0 });
                metricsList.push({ label: 'False Negatives', value: cm.false_negatives || 0 });
            }
        }

        // Clustering metrics
        if (isClustering) {
            if (metrics.silhouette_score !== undefined) metricsList.push({ label: 'Silhouette Score', value: metrics.silhouette_score.toFixed(4), highlight: true });
            if (metrics.inertia !== undefined) metricsList.push({ label: 'Inertia', value: metrics.inertia.toFixed(2) });
            if (metrics.n_clusters !== undefined) metricsList.push({ label: 'Number of Clusters', value: metrics.n_clusters });
            if (modelData.n_noise !== undefined) metricsList.push({ label: 'Noise Points', value: modelData.n_noise });
        }

        // Neural Network metrics
        if (isNeuralNetwork) {
            if (metrics.loss !== undefined) metricsList.push({ label: 'Final Loss', value: metrics.loss.toFixed(4), highlight: true });
            if (metrics.accuracy !== undefined) metricsList.push({ label: 'Accuracy', value: (metrics.accuracy * 100).toFixed(2) + '%', highlight: true });
            if (metrics.r2_score !== undefined) metricsList.push({ label: 'R² Score', value: (metrics.r2_score * 100).toFixed(2) + '%' });
            if (metrics.mse !== undefined) metricsList.push({ label: 'MSE', value: metrics.mse.toFixed(4) });
            if (metrics.mae !== undefined) metricsList.push({ label: 'MAE', value: metrics.mae.toFixed(4) });
        }

        return (
            <div className="mv-metrics-grid">
                {metricsList.map((metric, idx) => (
                    <div key={idx} className={`mv-metric-card ${metric.highlight ? 'highlight' : ''}`}>
                        <div className="mv-metric-label">{metric.label}</div>
                        <div className="mv-metric-value">{metric.value}</div>
                    </div>
                ))}
            </div>
        );
    };

    const keyMetric = getKeyMetric();

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="visualization"
                nodeType="modelVisualizer"
                title="Model Visualizer"
                icon={<FaChartLine />}
                infoButton={<InfoButton nodeType="modelVisualizer" />}
                statusIndicator={
                    modelData ? (
                        <div className="mv-status trained">
                            <FaCheckCircle /> Connected
                        </div>
                    ) : (
                        <div className="mv-status untrained">No Model</div>
                    )
                }
                className="model-visualizer-node"
            >
                <div className="mv-container">
                    {modelData ? (
                        <>
                            {/* Model Info Header */}
                            <div className="mv-model-header">
                                <div className="mv-model-info">
                                    <div className="mv-model-icon">
                                        {isRegression && <FaChartLine />}
                                        {isClassification && <FaBrain />}
                                        {isClustering && <FaLayerGroup />}
                                        {isNeuralNetwork && <FaNetworkWired />}
                                    </div>
                                    <div>
                                        <div className="mv-model-name">{upstreamModel?.nodeLabel || 'Model'}</div>
                                        <div className="mv-model-category">{getModelCategory()}</div>
                                    </div>
                                </div>
                                {keyMetric && (
                                    <div className={`mv-key-metric ${keyMetric.good ? 'good' : 'poor'}`}>
                                        <div className="mv-key-metric-label">{keyMetric.label}</div>
                                        <div className="mv-key-metric-value">{keyMetric.value}</div>
                                    </div>
                                )}
                            </div>

                            {/* Tabs */}
                            <div className="mv-tabs">
                                <div
                                    className={`mv-tab ${activeTab === 'performance' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('performance')}
                                >
                                    Performance Metrics
                                </div>
                                <div
                                    className={`mv-tab ${activeTab === 'visuals' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('visuals')}
                                >
                                    Visualizations
                                </div>
                            </div>

                            {/* Content */}
                            <div className="mv-content">
                                {activeTab === 'performance' && renderPerformanceMetrics()}
                                {activeTab === 'visuals' && renderVisuals()}
                            </div>
                        </>
                    ) : (
                        <div className="mv-empty-state">
                            <FaProjectDiagram size={50} style={{ opacity: 0.15, marginBottom: 15 }} />
                            <h4>No Model Connected</h4>
                            <p>Connect a trained model node to visualize its performance and behavior.</p>
                            <div className="mv-supported-models">
                                <strong>Supported Models:</strong>
                                <ul>
                                    <li>Regression: Linear, Multi-Linear, Polynomial, KNN</li>
                                    <li>Classification: Logistic, Naive Bayes, KNN</li>
                                    <li>Clustering: K-Means, DBSCAN, Hierarchical</li>
                                    <li>Neural Networks: MLP</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </CollapsibleNodeWrapper>

            {/* No output handle as this is a sink node */}
        </>
    );
};

export default React.memo(ModelVisualizerNode);
