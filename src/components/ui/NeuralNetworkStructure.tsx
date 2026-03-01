import React, { useState } from 'react';

const ACTIVATION_COLORS = {
    relu: '#3b82f6', // Blue
    sigmoid: '#10b981', // Green
    tanh: '#8b5cf6', // Purple
    linear: '#9ca3af', // Gray
    softmax: '#f97316', // Orange
    default: '#6366f1' // Indigo
};

const getActivationColor = (act) => ACTIVATION_COLORS[act?.toLowerCase()] || ACTIVATION_COLORS.default;

const NeuralNetworkStructure = ({ architecture, taskType }) => {
    const [structureZoom, setStructureZoom] = useState(1.0);
    const [hoveredNeuron, setHoveredNeuron] = useState(null);

    const isClassifier = taskType !== 'regression';

    if (!architecture) return <div className="mv-empty-state">No architecture data.</div>;

    // Build Layers list
    const layers = [
        { type: 'Input', count: architecture.input_dim || architecture.input_size, activation: 'Linear', color: ACTIVATION_COLORS.linear, index: 0 },
        ...(architecture.hidden_layers || []).map((count, i) => ({
            type: `Hidden ${i + 1}`,
            count,
            activation: architecture.activation || 'ReLU',
            color: getActivationColor(architecture.activation),
            index: i + 1
        })),
        { type: 'Output', count: architecture.output_dim || architecture.output_size, activation: isClassifier ? 'Softmax' : 'Linear', color: isClassifier ? ACTIVATION_COLORS.softmax : ACTIVATION_COLORS.linear, index: (architecture.hidden_layers?.length || 0) + 1 }
    ];

    // Layout Constants
    const LAYER_WIDTH = 200;
    const NEURON_SIZE = 16;
    const NEURON_GAP = 12; // vertical gap
    const NEURON_SPACE = NEURON_SIZE + NEURON_GAP;
    const X_PADDING = 50;
    const Y_PADDING = 60;

    // Calculate SVG Dimensions
    const maxNeurons = Math.max(...layers.map(l => l.count));
    const svgHeightRaw = Math.max(400, maxNeurons * NEURON_SPACE + Y_PADDING * 2);
    const svgWidthRaw = layers.length * LAYER_WIDTH + X_PADDING * 2;

    const zoomedWidth = svgWidthRaw * structureZoom;
    const zoomedHeight = svgHeightRaw * structureZoom;

    // Optimization for huge networks
    let totalConnections = 0;
    for (let i = 0; i < layers.length - 1; i++) totalConnections += layers[i].count * layers[i + 1].count;
    const largeNetwork = totalConnections > 2500;

    return (
        <div className="nn-structure-container" style={{ width: '100%', height: '100%', overflow: 'auto', overflowX: 'scroll', position: 'relative', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {/* Zoom Controls */}
            <div className="nn-zoom-controls" style={{ position: 'sticky', top: 10, right: 10, zIndex: 20, display: 'flex', gap: 5, background: 'white', padding: 4, borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', float: 'right', margin: '10px' }}>
                <button onClick={() => setStructureZoom(z => Math.max(0.1, z - 0.1))} style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: 2 }}>-</button>
                <span style={{ fontSize: '0.8rem', alignSelf: 'center', minWidth: '40px', textAlign: 'center' }}>{Math.round(structureZoom * 100)}%</span>
                <button onClick={() => setStructureZoom(z => Math.min(3, z + 0.1))} style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: 2 }}>+</button>
            </div>

            <div style={{ position: 'relative', width: zoomedWidth, height: zoomedHeight, transformOrigin: '0 0', minHeight: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: svgWidthRaw, height: svgHeightRaw, transform: `scale(${structureZoom})`, transformOrigin: '0 0' }}>

                    {/* SVG for Connections */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                        {layers.map((layer, lIdx) => {
                            if (lIdx === layers.length - 1) return null;
                            const nextLayer = layers[lIdx + 1];

                            const layerHeight = layer.count * NEURON_SPACE;
                            const nextLayerHeight = nextLayer.count * NEURON_SPACE;
                            const startY = (svgHeightRaw - layerHeight) / 2;
                            const nextStartY = (svgHeightRaw - nextLayerHeight) / 2;

                            const x1 = X_PADDING + lIdx * LAYER_WIDTH + NEURON_SIZE / 2;
                            const x2 = X_PADDING + (lIdx + 1) * LAYER_WIDTH + NEURON_SIZE / 2;

                            // Optimization: Only render if hovered or small network
                            if (largeNetwork && !hoveredNeuron) return null;

                            const lines = [];
                            const isRelevantLayer = hoveredNeuron ? (hoveredNeuron.lIdx === lIdx || hoveredNeuron.lIdx === lIdx + 1) : true;
                            if (!isRelevantLayer && largeNetwork) return null;

                            for (let i = 0; i < layer.count; i++) {
                                for (let j = 0; j < nextLayer.count; j++) {
                                    let isHighlighted = false;
                                    let isDimmed = false;

                                    if (hoveredNeuron) {
                                        if (hoveredNeuron.lIdx === lIdx && hoveredNeuron.nIdx === i) isHighlighted = true;
                                        else if (hoveredNeuron.lIdx === lIdx + 1 && hoveredNeuron.nIdx === j) isHighlighted = true;
                                        else isDimmed = true;
                                    } else {
                                        if (largeNetwork) isDimmed = true;
                                    }

                                    // Skip rendering faint lines if network is large (except highlighted)
                                    if (largeNetwork && !isHighlighted) continue;
                                    if (isDimmed && !largeNetwork) {/* render faint */ }

                                    const y1 = startY + i * NEURON_SPACE + NEURON_SIZE / 2;
                                    const y2 = nextStartY + j * NEURON_SPACE + NEURON_SIZE / 2;

                                    // Bezier
                                    const cp1x = x1 + (x2 - x1) * 0.5;
                                    const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp1x} ${y2}, ${x2} ${y2}`;

                                    lines.push(
                                        <path
                                            key={`${lIdx}-${i}-${j}`}
                                            d={d}
                                            fill="none"
                                            stroke={isHighlighted ? layer.color : "#cbd5e1"}
                                            strokeWidth={isHighlighted ? 1.5 : 0.5}
                                            strokeOpacity={isHighlighted ? 0.9 : 0.3}
                                            style={{ transition: 'stroke-opacity 0.15s' }}
                                        />
                                    );
                                }
                            }
                            return <g key={lIdx}>{lines}</g>;
                        })}
                    </svg>

                    {/* Neurons */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                        {layers.map((layer, lIdx) => {
                            const layerHeight = layer.count * NEURON_SPACE;
                            const startY = (svgHeightRaw - layerHeight) / 2;
                            const x = X_PADDING + lIdx * LAYER_WIDTH;

                            return (
                                <div key={lIdx} style={{ position: 'absolute', left: x, top: startY, width: NEURON_SIZE, pointerEvents: 'auto' }}>
                                    {/* Layer Label - Centered over column */}
                                    <div style={{ position: 'absolute', top: -35, left: -40, width: 100, textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem', color: '#475569' }}>
                                        {layer.type}<br /><span style={{ fontWeight: 'normal', fontSize: '0.7rem', color: '#94a3b8' }}>{layer.count} neurons</span>
                                    </div>

                                    {Array.from({ length: layer.count }).map((_, nIdx) => (
                                        <div key={nIdx}
                                            onMouseEnter={() => setHoveredNeuron({ lIdx, nIdx })}
                                            onMouseLeave={() => setHoveredNeuron(null)}
                                            title={`${layer.type} #${nIdx + 1}\n${layer.activation}`}
                                            style={{
                                                position: 'absolute',
                                                top: nIdx * NEURON_SPACE,
                                                left: 0,
                                                width: NEURON_SIZE, height: NEURON_SIZE, borderRadius: '50%',
                                                backgroundColor: 'white',
                                                border: `2px solid ${layer.color}`,
                                                boxShadow: hoveredNeuron?.lIdx === lIdx && hoveredNeuron?.nIdx === nIdx ? `0 0 8px ${layer.color}` : '0 1px 2px rgba(0,0,0,0.1)',
                                                zIndex: 10,
                                                cursor: 'pointer',
                                                transition: 'transform 0.1s, box-shadow 0.1s',
                                                transform: hoveredNeuron?.lIdx === lIdx && hoveredNeuron?.nIdx === nIdx ? 'scale(1.2)' : 'scale(1)'
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NeuralNetworkStructure;
