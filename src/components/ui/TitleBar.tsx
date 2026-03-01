import React from 'react';

interface TitleBarProps {
    title?: string;
}

const TitleBar = ({ title = "Untitled Project" }: TitleBarProps) => {
    return (
        <div className="h-10 w-full bg-background/80 backdrop-blur-md flex items-center px-4 fixed top-0 left-0 z-[100] border-b border-border/40 select-none app-region-drag">
            <div className="flex-1 text-center text-xs font-medium text-muted-foreground/50">
                Neuroflow - {title}
            </div>
            {/* Title can go here if needed, but keeping it clean for now */}
        </div>
    );
};

export default TitleBar;
