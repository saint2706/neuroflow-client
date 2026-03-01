import { useCallback } from 'react';
import { ReactFlowInstance, Node, Edge, Viewport } from 'reactflow';

export interface ProjectData {
    nodes: Node[];
    edges: Edge[];
    viewport: Viewport;
}

export const useProjectPersistence = (
    reactFlowInstance: ReactFlowInstance | null,
    setNodes: (nodes: Node[]) => void,
    setEdges: (edges: Edge[]) => void,
    setProjectTitle: (title: string) => void,
    resetHistory: (nodes: Node[], edges: Edge[]) => void
) => {
    const handleSaveProject = useCallback(async () => {
        if (!reactFlowInstance) return;
        const flowObject = reactFlowInstance.toObject();
        const projectData = {
            ...flowObject,
            version: '1.0.0',
            timestamp: new Date().toISOString(),
        };

        try {
            if (window.app && window.app.saveProject) {
                const result = await window.app.saveProject(projectData);
                if (result.success) {
                    console.log('Project saved to:', result.filePath);
                    const fileName = result.filePath.split(/[/\\]/).pop();
                    if (fileName) setProjectTitle(fileName.replace('.nf', ''));
                } else if (result.error) {
                    alert('Failed to save project: ' + result.error);
                }
            } else {
                alert('Save project is only available in the desktop app.');
            }
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Error saving project');
        }
    }, [reactFlowInstance, setProjectTitle]);

    const handleLoadProject = useCallback(async () => {
        try {
            if (window.app && window.app.loadProject) {
                const result = await window.app.loadProject();
                if (result.success && result.data) {
                    const { nodes: loadedNodes, edges: loadedEdges, viewport } = result.data;

                    const safeNodes = loadedNodes || [];
                    const safeEdges = loadedEdges || [];

                    setNodes(safeNodes);
                    setEdges(safeEdges);

                    if (viewport && reactFlowInstance) {
                        reactFlowInstance.setViewport(viewport);
                    }

                    // Reset history with new state
                    resetHistory(safeNodes, safeEdges);

                    const fileName = result.filePath.split(/[/\\]/).pop();
                    if (fileName) setProjectTitle(fileName.replace('.nf', ''));
                } else if (result.error) {
                    alert('Failed to load project: ' + result.error);
                }
            } else {
                alert('Load project is only available in the desktop app.');
            }
        } catch (error) {
            console.error('Error loading project:', error);
            alert('Error loading project');
        }
    }, [reactFlowInstance, setNodes, setEdges, setProjectTitle, resetHistory]);

    return { handleSaveProject, handleLoadProject };
};
