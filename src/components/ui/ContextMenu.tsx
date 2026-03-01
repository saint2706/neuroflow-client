import React from 'react';
import './ContextMenu.css';
import { MdDelete, MdContentCopy } from 'react-icons/md';

interface CustomAction {
  label: string;
  icon: React.ReactNode;
  className?: string;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId?: string;
  nodeType?: string;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
  customActions?: CustomAction[];
  isEdge?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  nodeId,
  nodeType,
  onDelete,
  onDuplicate,
  onClose,
  customActions = [],
  isEdge = false
}) => {
  // Don't show delete option for start node
  const showDelete = nodeType !== 'start' && !!onDelete;
  const showDuplicate = !!onDuplicate;

  const handleDelete = () => {
    if (showDelete && onDelete) {
      onDelete();
    }
    onClose();
  };

  const handleDuplicate = () => {
    if (showDuplicate && onDuplicate) {
      onDuplicate();
    }
    onClose();
  };

  const handleCustomAction = (action: CustomAction) => {
    if (action.onClick) {
      action.onClick();
    }
    onClose();
  };

  // If no delete, no duplicate and no custom actions, don't show menu
  if (!showDelete && !showDuplicate && customActions.length === 0) return null;

  return (
    <div
      className="context-menu"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {customActions.map((action, idx) => (
        <button
          key={idx}
          className={`context-menu-item ${action.className || ''}`}
          onClick={() => handleCustomAction(action)}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}

      {showDuplicate && (
        <button className="context-menu-item" onClick={handleDuplicate}>
          <MdContentCopy />
          <span>Duplicate</span>
        </button>
      )}

      {showDelete && (
        <button className="context-menu-item delete" onClick={handleDelete}>
          <MdDelete />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
};

export default ContextMenu;

