import React, { useEffect } from 'react';
import './DataViewModal.css';
import { MdClose } from 'react-icons/md';

const DataViewModal = ({ isOpen, onClose, headers, rows, fileName }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="data-view-modal-overlay" onClick={onClose}>
            <div className="data-view-modal" onClick={(e) => e.stopPropagation()}>
                <div className="data-view-modal-header">
                    <div className="data-view-modal-title">
                        <h3>Full Dataset View</h3>
                        {fileName && <span className="data-view-file-name">{fileName}</span>}
                    </div>
                    <button className="data-view-modal-close" onClick={onClose} title="Close (Esc)">
                        <MdClose />
                    </button>
                </div>

                <div className="data-view-modal-info">
                    <span>{rows.length} rows × {headers.length} columns</span>
                </div>

                <div className="data-view-modal-body">
                    <div className="data-view-table-scroll">
                        <table className="data-view-table">
                            <thead>
                                <tr>
                                    <th className="row-number-header">#</th>
                                    {headers.map((h, idx) => (
                                        <th key={idx}>{String(h || '')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <td className="row-number">{rIdx + 1}</td>
                                        {headers.map((_, cIdx) => (
                                            <td key={cIdx}>{String(row?.[cIdx] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataViewModal;
