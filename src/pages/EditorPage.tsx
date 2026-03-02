import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useProjectPersistence } from '../hooks/useProjectPersistence';

import ReactFlow, {
  MiniMap,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  SmoothStepEdge,
  useViewport,
  Node,
  Edge,
  ConnectionMode,
  MarkerType,
  ReactFlowInstance,
  NodeChange,
  EdgeChange,
  Connection,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import TopToolbar from '../components/ui/TopToolbar';
import TitleBar from '../components/ui/TitleBar';
import BottomToolbar from '../components/ui/BottomToolbar';
import Sidebar from '../components/ui/Sidebar';
import ContextMenu from '../components/ui/ContextMenu';
import DataViewModal from '../components/ui/DataViewModal';
import AdvancedDataAnalyticsModal from '../components/ui/AdvancedDataAnalyticsModal';
import ClusterVisualizerModal from '../components/ui/ClusterVisualizerModal';
import DendrogramModal from '../components/ui/DendrogramModal';
import MLPResultsModal from '../components/ui/MLPResultsModal';
import './EditorPage.css';
import NodeInfoPanel from '../components/ui/NodeInfoPanel';
import FloatingEdge from '../components/edges/FloatingEdge';
import { MdVisibility } from 'react-icons/md';
import { FaProjectDiagram, FaBrain } from 'react-icons/fa';
import GameOfLifeLoading from '../components/ui/GameOfLifeLoading';

// Eager load node components to prevent full screen suspenses when dragging new nodes
import CsvReaderNode from '../components/nodes/CsvReaderNode';
import DatabaseReaderNode from '../components/nodes/DatabaseReaderNode';
import LinearRegressionNode from '../components/nodes/LinearRegressionNode';
import MultiLinearRegressionNode from '../components/nodes/MultiLinearRegressionNode';
import PolynomialRegressionNode from '../components/nodes/PolynomialRegressionNode';
import KNNRegressionNode from '../components/nodes/KNNRegressionNode';
import KNNClassificationNode from '../components/nodes/KNNClassificationNode';
import DataCleanerNode from '../components/nodes/DataCleanerNode';
import ModelVisualizerNode from '../components/nodes/ModelVisualizerNode';
import EncoderNode from '../components/nodes/EncoderNode';
import NormalizerNode from '../components/nodes/NormalizerNode';
import LogisticRegressionNode from '../components/nodes/LogisticRegressionNode';
import NaiveBayesNode from '../components/nodes/NaiveBayesNode';
import DataVisualizerNode from '../components/nodes/DataVisualizerNode';
import ModelEvaluatorNode from '../components/nodes/ModelEvaluatorNode';
import SettingsModal from '../components/ui/SettingsModal';
import useFontLoader from '../hooks/useFontLoader';
import FeatureSelectorNode from '../components/nodes/FeatureSelectorNode';
import PCANode from '../components/nodes/PCANode';
import SVDNode from '../components/nodes/SVDNode';
import DescribeNode from '../components/nodes/DescribeNode';
import DataTypeConverterNode from '../components/nodes/DataTypeConverterNode';
import KMeansNode from '../components/nodes/KMeansNode';
import DBSCANNode from '../components/nodes/DBSCANNode';
import HierarchicalClusteringNode from '../components/nodes/HierarchicalClusteringNode';
import MLPNode from '../components/nodes/MLPNode';
import GenericVisualizerNode from '../components/nodes/GenericVisualizerNode';
import StartNode from '../components/nodes/StartNode';

let id = 1;
const getId = () => `node_${id++}`;

interface ContextMenuState {
  x: number;
  y: number;
  node: Node;
}

interface EdgeContextMenuState {
  x: number;
  y: number;
  edgeId: string;
}

const EditorPage = () => {
  const { edgeType } = useAppStore();

  const nodeTypes = useMemo(() => ({
    // Existing specialized nodes
    start: StartNode,
    csvReader: CsvReaderNode,
    databaseReader: DatabaseReaderNode,
    linearRegression: LinearRegressionNode,
    multiLinearRegression: MultiLinearRegressionNode,
    polynomialRegression: PolynomialRegressionNode,
    knnRegression: KNNRegressionNode,
    knnClassification: KNNClassificationNode,
    dataCleaner: DataCleanerNode,
    modelVisualizer: ModelVisualizerNode,
    encoder: EncoderNode,
    normalizer: NormalizerNode,
    logisticRegression: LogisticRegressionNode,
    naiveBayes: NaiveBayesNode,
    dataVisualizer: DataVisualizerNode,
    featureSelector: FeatureSelectorNode,
    pca: PCANode,
    svd: SVDNode,
    dataTypeConverter: DataTypeConverterNode,
    // Generic/basic nodes for all other sidebar items

    kMeans: KMeansNode,
    hierarchicalClustering: HierarchicalClusteringNode,
    dbscan: DBSCANNode,
    mlp: MLPNode,
    evaluator: ModelEvaluatorNode,
    visualizer: GenericVisualizerNode,
    describeNode: DescribeNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    floating: FloatingEdge,
  }), []);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'node_0',
      type: 'start',
      position: { x: 300, y: 300 },
      data: { label: 'Start' },
    },
  ]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [activeTool, setActiveTool] = useState('select');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Initialize global fonts
  useFontLoader();
  const [isBooting, setIsBooting] = useState(true);
  const [showFlow, setShowFlow] = useState(false);

  // Manual boot sequence triggered by GameOfLifeLoading Start button
  const handleStart = useCallback(() => {
    setIsBooting(false);
    // Give time for fade out animation before showing flow
    setTimeout(() => setShowFlow(true), 800);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null);

  // Data view modal state
  const [dataViewModal, setDataViewModal] = useState<any>(null);
  const [advancedAnalyticsModal, setAdvancedAnalyticsModal] = useState<any>(null);
  const [clusterVisualizerModal, setClusterVisualizerModal] = useState<any>(null);
  const [dendrogramModal, setDendrogramModal] = useState<any>(null);
  const [mlpResultsModal, setMlpResultsModal] = useState<any>(null);

  // Undo/Redo history
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Project Title State
  const [projectTitle, setProjectTitle] = useState('Untitled Project');

  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  // Initialize history with initial state
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      const initialNodes = [
        {
          id: 'node_0',
          type: 'start',
          position: { x: 300, y: 300 },
          data: { label: 'Start' },
        },
      ];
      historyRef.current = [{
        nodes: structuredClone(initialNodes),
        edges: structuredClone([]),
      }];
      historyIndexRef.current = 0;
      initializedRef.current = true;
    }
  }, []);

  // Save state to history
  const saveToHistory = useCallback((nodesState: Node[], edgesState: Edge[], debounce = false) => {
    if (debounce && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const saveHistory = () => {
      const currentIndex = historyIndexRef.current;
      historyRef.current = historyRef.current.slice(0, currentIndex + 1);

      historyRef.current.push({
        nodes: structuredClone(nodesState),
        edges: structuredClone(edgesState),
      });

      if (historyRef.current.length > 50) {
        historyRef.current.shift();
      } else {
        historyIndexRef.current = historyRef.current.length - 1;
      }

      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    };

    if (debounce) {
      saveTimeoutRef.current = setTimeout(saveHistory, 1000);
    } else {
      saveHistory();
    }
  }, []);

  // Update edges when edgeType changes
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        type: edgeType,
      }))
    );
  }, [edgeType, setEdges]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const previousState = historyRef.current[historyIndexRef.current];
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
    }
  }, []);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextState = historyRef.current[historyIndexRef.current];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const isValidConnection = useCallback((connection) => {
    if (connection.source === connection.target) return false;
    return true;
  }, []);

  const nodeColors = {
    csvReader: '#f59e0b',
    databaseReader: '#f59e0b',
    start: '#64748b',
    linearRegression: '#5a67d8',
    multiLinearRegression: '#5a67d8',
    knnRegression: '#5a67d8',
    polynomialRegression: '#5a67d8',
    logisticRegression: '#FF0080',
    naiveBayes: '#FF0080',
    knnClassification: '#FF0080',
    kMeans: '#FF0080',
    hierarchicalClustering: '#FF0080',
    dbscan: '#FF0080',
    mlp: '#FF0080',
    cnn: '#FF0080',
    rnn: '#FF0080',
    transformer: '#FF0080',
    dataCleaner: '#00b09b',
    normalizer: '#00b09b',
    encoder: '#00b09b',
    pca: '#8b5cf6',
    svd: '#8b5cf6',
    featureSelector: '#00b09b',
    heatmap: '#00b09b',
    dataTypeConverter: '#00b09b',
    modelVisualizer: '#fda085',
    dataVisualizer: '#fda085',
    visualizer: '#fda085',
    evaluator: '#f5576c',
    describeNode: '#718096',
    default: '#6a1b9a'
  };

  const onConnect: OnConnect = useCallback((params) => {
    setEdges((eds) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const nodeType = sourceNode?.type || 'default';
      const edgeColor = nodeColors[nodeType] || nodeColors.default;
      const currentEdgeType = useAppStore.getState().edgeType;

      const newEdge = {
        ...params,
        type: currentEdgeType,
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color: edgeColor },
      };

      const newEdges = addEdge(newEdge, eds);
      setTimeout(() => saveToHistory(nodes, newEdges), 100);
      return newEdges;
    });
  }, [nodes, saveToHistory]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      const nodeName = event.dataTransfer.getData('application/reactflow-name');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode = {
        id: getId(),
        type,
        position,
        data: {
          label: nodeName || `New Node`,
          nodeType: type
        }
      };
      setNodes((nds) => {
        const newNodes = nds.concat(newNode);
        setTimeout(() => saveToHistory(newNodes, edges), 100);
        return newNodes;
      });
    },
    [reactFlowInstance, edges, saveToHistory]
  );

  const onNodesChangeCallback: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const filteredChanges = changes.filter(change => {
        if (change.type === 'remove') {
          const node = nds.find(n => n.id === change.id);
          if (node && node.type === 'start') {
            return false;
          }
        }
        return true;
      });

      const newNodes = applyNodeChanges(filteredChanges, nds);
      const isDragEnd = filteredChanges.some(change => change.type === 'position' && change.dragging === false);
      const isRemove = filteredChanges.some(change => change.type === 'remove');
      const isAdd = filteredChanges.some(change => change.type === 'add');

      if (isDragEnd) {
        saveToHistory(newNodes, edges, true);
      } else if (isRemove || isAdd) {
        saveToHistory(newNodes, edges, false);
      }
      return newNodes;
    });
  }, [edges, saveToHistory]);

  const onEdgesChangeCallback: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      const newEdges = applyEdgeChanges(changes, eds);
      const isRemove = changes.some(change => change.type === 'remove');
      if (isRemove) {
        setTimeout(() => saveToHistory(nodes, newEdges), 100);
      }
      return newEdges;
    });
  }, [nodes, saveToHistory]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (node.type === 'start') {
      return;
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node: node,
    });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, []);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setEdgeContextMenu(null);
    };

    if (contextMenu || edgeContextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, edgeContextMenu]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const newNodes = nds.filter((node) => node.id !== nodeId);
      setEdges((eds) => {
        const newEdges = eds.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        );
        setTimeout(() => saveToHistory(newNodes, newEdges), 100);
        return newEdges;
      });
      return newNodes;
    });
    setContextMenu(null);
  }, [saveToHistory]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => {
      const newEdges = eds.filter((edge) => edge.id !== edgeId);
      setTimeout(() => saveToHistory(nodes, newEdges), 100);
      return newEdges;
    });
    setEdgeContextMenu(null);
  }, [nodes, saveToHistory]);

  const resetHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    historyRef.current = [{
      nodes: structuredClone(newNodes),
      edges: structuredClone(newEdges),
    }];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const { handleSaveProject, handleLoadProject } = useProjectPersistence(
    reactFlowInstance,
    setNodes,
    setEdges,
    setProjectTitle,
    resetHistory
  );

  const defaultEdgeOptions = useMemo(() => ({
    type: edgeType,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6a1b9a' },
    style: { stroke: '#6a1b9a', strokeWidth: 2 },
  }), [edgeType]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      {isBooting && <GameOfLifeLoading onStart={handleStart} fadeOut={showFlow} />}
      <TitleBar title={projectTitle} />
      <div className="flex-1 flex relative overflow-hidden mt-10">
        <div
          className={`transition-all duration-300 ease-in-out h-full z-40 ${isSidebarOpen ? 'w-80 opacity-100 translate-x-0 ml-4' : 'w-0 opacity-0 -translate-x-full ml-0'
            }`}
        >
          <div className="h-full w-72">
            <Sidebar className="w-full" />
          </div>
        </div>

        <div className="flex-grow h-full relative" ref={reactFlowWrapper}>
          <TopToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onSave={handleSaveProject}
            onLoad={handleLoadProject}
            onMenuClick={toggleSidebar}
          />
          <div className={`reactflow-wrapper-new w-full h-full transition-opacity duration-700 ${showFlow ? 'opacity-100' : 'opacity-0'}`}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChangeCallback}
              onEdgesChange={onEdgesChangeCallback}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              isValidConnection={isValidConnection}
              fitView
              fitViewOptions={{ maxZoom: 0.75 }}
              proOptions={proOptions}
              connectionMode={ConnectionMode.Loose}
              defaultEdgeOptions={defaultEdgeOptions}
              panOnDrag={activeTool === 'pan'}
              selectionOnDrag={activeTool === 'select'}
            >
              <MiniMap
                style={{
                  bottom: 60,
                  right: 15,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}
                nodeColor="#888"
                maskColor="rgba(255, 255, 255, 0.7)"
              />
            </ReactFlow>

            {contextMenu && (() => {
              const node = contextMenu.node;
              const customActions = [];

              // Only define configuration, avoid expensive closures if possible
              const getNodeConfig = (nodeType: string, nodeData: any) => {
                const configs: Record<string, {
                  condition: boolean;
                  getData: () => Promise<{ headers: string[]; rows: any[][]; fileName: string }>;
                  useAdvancedAnalytics?: boolean;
                }> = {
                  csvReader: {
                    condition: !!(nodeData?.headers && nodeData?.file),
                    getData: async () => {
                      const { parseFullTabularFile } = await import('../utils/parseTabularFile');
                      const parsed = await parseFullTabularFile(nodeData.file, true);
                      return {
                        headers: parsed.headers,
                        rows: parsed.rows,
                        fileName: nodeData.file.name,
                      };
                    },
                    useAdvancedAnalytics: true,
                  },
                  databaseReader: {
                    condition: !!(nodeData?.headers && nodeData?.rows && nodeData.rows.length > 0),
                    getData: async () => ({
                      headers: nodeData.headers,
                      rows: nodeData.rows,
                      fileName: `Database Query (${nodeData.rows.length} rows)`,
                    }),
                    useAdvancedAnalytics: true,
                  },
                  dataCleaner: {
                    condition: !!(nodeData?.cleanedRows && nodeData.cleanedRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.headers,
                      rows: nodeData.cleanedRows,
                      fileName: `Cleaned Data (${nodeData.cleanedRows.length} rows)`,
                    }),
                  },
                  encoder: {
                    condition: !!(nodeData?.encodedRows && nodeData.encodedRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.headers,
                      rows: nodeData.encodedRows,
                      fileName: `Encoded Data (${nodeData.encodedRows.length} rows)`,
                    }),
                  },
                  normalizer: {
                    condition: !!(nodeData?.normalizedRows && nodeData.normalizedRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.headers,
                      rows: nodeData.normalizedRows,
                      fileName: `Normalized Data (${nodeData.normalizedRows.length} rows)`,
                    }),
                  },
                  featureSelector: {
                    condition: !!(nodeData?.selectedHeaders && nodeData?.selectedRows && nodeData.selectedRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.selectedHeaders,
                      rows: nodeData.selectedRows,
                      fileName: `Selected Features (${nodeData.selectedRows.length} rows)`,
                    }),
                  },
                  pca: {
                    condition: !!(nodeData?.pcaHeaders && nodeData?.pcaRows && nodeData.pcaRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.pcaHeaders,
                      rows: nodeData.pcaRows,
                      fileName: `PCA Transformed Data (${nodeData.pcaRows.length} rows)`,
                    }),
                  },
                  svd: {
                    condition: !!(nodeData?.svdHeaders && nodeData?.svdRows && nodeData.svdRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.svdHeaders,
                      rows: nodeData.svdRows,
                      fileName: `SVD Transformed Data (${nodeData.svdRows.length} rows)`,
                    }),
                  },
                  dataTypeConverter: {
                    condition: !!(nodeData?.convertedRows && nodeData.convertedRows.length > 0),
                    getData: async () => ({
                      headers: nodeData.headers,
                      rows: nodeData.convertedRows,
                      fileName: `Converted Data (${nodeData.convertedRows.length} rows)`,
                    }),
                  },
                  kMeans: {
                    condition: !!(nodeData?.clusteredData && nodeData.clusteredData.length > 0),
                    getData: async () => ({
                      headers: nodeData.clusteredHeaders,
                      rows: nodeData.clusteredData,
                      fileName: `Clustered Data (${nodeData.clusteredData.length} rows)`,
                    }),
                  },
                  dbscan: {
                    condition: !!(nodeData?.clusteredData && nodeData.clusteredData.length > 0),
                    getData: async () => ({
                      headers: nodeData.clusteredHeaders,
                      rows: nodeData.clusteredData,
                      fileName: `DBSCAN Clustered Data (${nodeData.clusteredData.length} rows)`,
                    }),
                  },
                  hierarchicalClustering: {
                    condition: !!(nodeData?.clusteredData && nodeData.clusteredData.length > 0),
                    getData: async () => ({
                      headers: nodeData.clusteredHeaders,
                      rows: nodeData.clusteredData,
                      fileName: `Hierarchical Clustered Data (${nodeData.clusteredData.length} rows)`,
                    }),
                  },
                };
                return configs[nodeType];
              };

              const nodeConfig = getNodeConfig(node.type, node.data);
              if (nodeConfig && nodeConfig.condition) {
                customActions.push({
                  label: 'View Full Dataset',
                  icon: <MdVisibility />,
                  className: 'view',
                  onClick: async () => {
                    try {
                      const data = await nodeConfig.getData();
                      if (nodeConfig.useAdvancedAnalytics) {
                        setAdvancedAnalyticsModal({
                          ...data,
                          nodeType: node.type,
                          nodeId: node.id
                        });
                      } else {
                        setDataViewModal(data);
                      }
                    } catch (err) {
                      console.error('Failed to load dataset for viewing:', err);
                    }
                  },
                });
              }

              if ((node.type === 'kMeans' || node.type === 'dbscan') && node.data?.clusteredData && node.data.clusteredData.length > 0) {
                customActions.push({
                  label: 'View Cluster Graph',
                  icon: <FaProjectDiagram />,
                  className: 'view',
                  onClick: () => {
                    setClusterVisualizerModal({
                      rows: node.data.clusteredData,
                      headers: node.data.clusteredHeaders,
                      features: node.data.selectedFeatures,
                      centers: node.data.clusterCenters
                    });
                  }
                });
              }

              if (node.type === 'hierarchicalClustering' && node.data?.clusteredData && node.data.clusteredData.length > 0) {
                customActions.push({
                  label: 'View Dendrogram',
                  icon: <FaProjectDiagram />,
                  className: 'view',
                  onClick: () => {
                    setDendrogramModal({
                      data: node.data.clusteredData,
                    });
                  }
                });
              }

              if (node.type === 'mlp' && node.data?.trainingHistory) {
                customActions.push({
                  label: 'View Model Details',
                  icon: <FaBrain />, // You might need to import this icon
                  className: 'view',
                  onClick: () => {
                    setMlpResultsModal({
                      trainingHistory: node.data.trainingHistory,
                      metrics: node.data.metrics,
                      modelStructure: node.data.modelStructure,
                      parameters: node.data.parameters
                    });
                  }
                });
              }

              return (
                <ContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  onClose={() => setContextMenu(null)}
                  onDelete={() => handleDeleteNode(node.id)}
                  onDuplicate={() => {
                    const duplicateNode = {
                      ...node,
                      id: getId(),
                      position: { x: node.position.x + 20, y: node.position.y + 20 },
                      data: { ...node.data, label: `${node.data.label} (Copy)` }
                    };
                    setNodes((nds) => {
                      const newNodes = nds.concat(duplicateNode);
                      setTimeout(() => saveToHistory(newNodes, edges), 100);
                      return newNodes;
                    });
                    setContextMenu(null);
                  }}
                  customActions={customActions}
                />
              );
            })()}

            {edgeContextMenu && (
              <ContextMenu
                x={edgeContextMenu.x}
                y={edgeContextMenu.y}
                onClose={() => setEdgeContextMenu(null)}
                onDelete={() => handleDeleteEdge(edgeContextMenu.edgeId)}
                isEdge={true}
              />
            )}
          </div>
        </div>
      </div>

      <BottomToolbar
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        fitView={fitView}
        zoomLevel={zoom}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <NodeInfoPanel />

      {dataViewModal && (
        <DataViewModal
          isOpen={!!dataViewModal}
          onClose={() => setDataViewModal(null)}
          headers={dataViewModal?.headers || []}
          rows={dataViewModal?.rows || []}
          fileName={dataViewModal?.fileName || 'Dataset'}
        />
      )}

      {advancedAnalyticsModal && (
        <AdvancedDataAnalyticsModal
          isOpen={!!advancedAnalyticsModal}
          onClose={() => setAdvancedAnalyticsModal(null)}
          headers={advancedAnalyticsModal?.headers || []}
          rows={advancedAnalyticsModal?.rows || []}
          fileName={advancedAnalyticsModal?.fileName || 'Dataset'}
          onLoadFilteredData={null}
        />
      )}

      {clusterVisualizerModal && (
        <ClusterVisualizerModal
          isOpen={!!clusterVisualizerModal}
          onClose={() => setClusterVisualizerModal(null)}
          data={clusterVisualizerModal}
        />
      )}

      {dendrogramModal && (
        <DendrogramModal
          isOpen={!!dendrogramModal}
          onClose={() => setDendrogramModal(null)}
          data={dendrogramModal}
        />
      )}

      {mlpResultsModal && (
        <MLPResultsModal
          isOpen={!!mlpResultsModal}
          onClose={() => setMlpResultsModal(null)}
          modelData={mlpResultsModal}
        />
      )}

      <SettingsModal />
    </div>
  );
};

export default EditorPage;