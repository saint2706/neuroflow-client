import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MdInfoOutline } from 'react-icons/md';
import './InfoButton.css';

interface InfoButtonProps {
    nodeType: string;
    style?: React.CSSProperties;
    className?: string;
}

const InfoButton: React.FC<InfoButtonProps> = ({ nodeType, style, className }) => {
    const { setNodeInfo } = useAppStore();

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setNodeInfo(nodeType);
            }}
            className={`node-info-button ${className || ''}`}
            style={style}
            title="What does this node do?"
        >
            <MdInfoOutline />
        </button>
    );
};

export default InfoButton;
