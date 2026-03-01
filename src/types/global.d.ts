export { };

declare global {
    interface Window {
        app: {
            saveProject: (data: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
            loadProject: () => Promise<{ success: boolean; data?: any; filePath?: string; error?: string }>;
            // Add other IPC methods here if needed
        };
    }
}
