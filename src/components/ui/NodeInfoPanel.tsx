
import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { nodeInfo } from '../../data/nodeInfo';
import './NodeInfoPanel.css';
import { MdClose } from 'react-icons/md';

const NodeInfoPanel = () => {
    const { isNodeInfoOpen: isOpen, nodeInfo: activeNodeId, closeNodeInfo: closeInfoPanel } = useAppStore();

    // Look up the node info object based on the ID string from the store
    const activeNodeInfo = activeNodeId ? nodeInfo[activeNodeId] : null;

    if (!isOpen || !activeNodeInfo) return null;

    return (
        <div className="node-info-panel-overlay" onClick={closeInfoPanel}>
            <div className="node-info-panel" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={closeInfoPanel} aria-label="Close panel">
                    <MdClose />
                </button>

                <div className="panel-header">
                    <h2>{activeNodeInfo.title}</h2>
                </div>

                <div className="panel-content">
                    <section className="info-section">
                        <h3>What this node does</h3>
                        <p>{activeNodeInfo.description}</p>
                    </section>

                    <section className="info-section">
                        <h3>When to use this node</h3>
                        <ul>
                            {(activeNodeInfo.usage || []).map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section className="info-section">
                        <h3>Accepts input from</h3>
                        <ul>
                            {(activeNodeInfo.inputs || []).length > 0 ? (
                                (activeNodeInfo.inputs || []).map((item, index) => <li key={index}>{item}</li>)
                            ) : (
                                <li><i>None / Starting Node</i></li>
                            )}
                        </ul>
                    </section>

                    <section className="info-section">
                        <h3>Can connect to</h3>
                        <ul>
                            {(activeNodeInfo.outputs || []).length > 0 ? (
                                (activeNodeInfo.outputs || []).map((item, index) => <li key={index}>{item}</li>)
                            ) : (
                                <li><i>None / Terminal Node</i></li>
                            )}
                        </ul>
                    </section>

                    {activeNodeInfo.pipelineDetails && (
                        <section className="info-section">
                            <h3>The Big Picture</h3>
                            <p>{activeNodeInfo.pipelineDetails}</p>
                        </section>
                    )}

                    {activeNodeInfo.exampleOutput && (
                        <section className="info-section">
                            <h3>Expected Result</h3>
                            <p>{activeNodeInfo.exampleOutput}</p>
                        </section>
                    )}

                    {activeNodeInfo.proTip && (
                        <section className="info-section">
                            <h3>Pro Tip</h3>
                            <p>{activeNodeInfo.proTip}</p>
                        </section>
                    )}

                    {activeNodeInfo.notes && (
                        <section className="info-section">
                            <h3>Important Notes</h3>
                            <p className="note-text">{activeNodeInfo.notes}</p>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NodeInfoPanel;
