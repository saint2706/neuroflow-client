import React, { useState, useRef, useEffect } from 'react';
import './ClickToEditInput.css';

const ClickToEditInput = ({
    value,
    onChange,
    placeholder = "Enter value...",
    label,
    type = "text"
}) => {
    const [isEditing, setIsEditing] = useState(false);
    // Local state for immediate typing feedback before syncing up
    const [localValue, setLocalValue] = useState(value);
    const inputRef = useRef(null);

    // Sync local value if prop changes externally (except when editing)
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value);
        }
    }, [value, isEditing]);

    const handleStartEdit = (e) => {
        // Prevent event from bubbling to node drag handlers
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleChange = (e) => {
        setLocalValue(e.target.value);
        if (onChange) onChange(e.target.value);
    };

    const handleBlur = () => {
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
        }
        // Stop propagation of keys to prevent canvas shortcuts (like Backspace deleting node)
        e.stopPropagation();
    };

    // Focus effect
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    return (
        <div className="cte-container nodrag" onMouseDown={(e) => e.stopPropagation()}>
            {label && <label className="cte-label" title={label}>{label}</label>}

            {isEditing ? (
                <input
                    ref={inputRef}
                    type={type}
                    className="cte-input nodrag"
                    value={localValue || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus // Redundant with useEffect but good fallback
                />
            ) : (
                <div
                    className={`cte-display ${!localValue ? 'empty' : ''}`}
                    onClick={handleStartEdit}
                    title="Click to edit"
                >
                    {localValue || placeholder}
                </div>
            )}
        </div>
    );
};

export default ClickToEditInput;
