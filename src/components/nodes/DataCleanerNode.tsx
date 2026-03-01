import React, { useMemo, useState } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './DataCleanerNode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { cleanDataset, isNumeric, isMissing } from '../../utils/dataCleaningUtils';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import { FaBroom } from 'react-icons/fa';

const DataCleanerNode = ({ id, data, isConnectable }) => {
  const { setNodes } = useReactFlow();

  // Configuration state
  const [config, setConfig] = useState({
    // Missing Values
    handleMissing: true,
    missingMethod: 'drop', // 'drop', 'fill_mean', 'fill_median', 'fill_mode'

    // Outliers
    removeOutliers: false,
    outlierMethod: 'iqr', // 'iqr', 'zscore', 'percentile'
    outlierThreshold: 1.5, // 1.5 for IQR, 3 for Z-score, 1 for percentile
    outlierColumns: [], // Selected columns for outlier removal

    // Duplicates
    removeDuplicates: true,
    duplicateKeepOption: 'first' // 'first' or 'last'
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanedData, setCleanedData] = useState(null);
  const [removedRows, setRemovedRows] = useState([]);
  const [showRemovedRows, setShowRemovedRows] = useState(false);
  const [error, setError] = useState('');

  // Find upstream data source (Full list preserved)
  const upstreamData = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
    for (const e of incoming) {
      const src = store.nodeInternals.get(e.source);
      if (src?.type === 'csvReader') {
        return {
          type: 'csv',
          headers: src.data?.headers || [],
          rows: src.data?.rows || [],
          file: src.data?.file
        };
      }
      if (src?.type === 'databaseReader') {
        return {
          type: 'database',
          headers: src.data?.headers || [],
          rows: src.data?.rows || []
        };
      }
      if (src?.type === 'encoder') {
        return {
          type: 'encoded',
          headers: src.data?.headers || [],
          encodedRows: src.data?.encodedRows || []
        };
      }
      if (src?.type === 'normalizer') {
        return {
          type: 'normalized',
          headers: src.data?.headers || [],
          normalizedRows: src.data?.normalizedRows || []
        };
      }
      if (src?.type === 'dataCleaner') {
        return {
          type: 'cleaned',
          headers: src.data?.headers || [],
          cleanedRows: src.data?.cleanedRows || []
        };
      }
      if (src?.type === 'featureSelector') {
        return {
          type: 'featureSelector',
          headers: src.data?.selectedHeaders || [],
          selectedRows: src.data?.selectedRows || []
        };
      }
      if (src?.type === 'dataTypeConverter') {
        return {
          type: 'dataTypeConverter',
          headers: src.data?.headers || [],
          rows: src.data?.convertedRows || []
        };
      }
    }
    return null;
  });

  const headers = useMemo(() => upstreamData?.headers || [], [upstreamData]);

  const toggleOutlierColumn = (colIdx) => {
    setConfig(prev => ({
      ...prev,
      outlierColumns: prev.outlierColumns.includes(colIdx)
        ? prev.outlierColumns.filter(c => c !== colIdx)
        : [...prev.outlierColumns, colIdx]
    }));
  };

  const onClean = async () => {
    if (!upstreamData) {
      setError('Please connect a data source.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      let rows;

      if (upstreamData.type === 'csv') {
        if (upstreamData.rows && upstreamData.rows.length > 0) {
          rows = upstreamData.rows;
        } else {
          const parsed = await parseFullTabularFile(upstreamData.file);
          rows = parsed.rows;
        }
      } else if (upstreamData.type === 'database') {
        rows = upstreamData.rows;
      } else if (upstreamData.type === 'encoded') {
        rows = upstreamData.encodedRows;
      } else if (upstreamData.type === 'normalized') {
        rows = upstreamData.normalizedRows;
      } else if (upstreamData.type === 'cleaned') {
        rows = upstreamData.cleanedRows;
      } else if (upstreamData.type === 'featureSelector') {
        rows = upstreamData.selectedRows;
      } else if (upstreamData.type === 'dataTypeConverter') {
        rows = upstreamData.rows;
      } else {
        throw new Error('Unknown data source type.');
      }

      // Apply cleaning operations
      const result = cleanDataset(rows, headers, config);

      // (Redundant calculation of removed rows logic preserved for safety)
      const cleaningResult = result;

      // ... logic for Removed Rows (simplified or preserved) ...
      // For brevity, I'll rely on the result I get. 
      // But implementation needs the exact logic to populate 'removedRows'.
      // I'll replicate the logic from original file lines 146-170

      const cleanedRowIndices = new Set();
      const cleanedRowMap = new Map();
      result.cleanedRows.forEach(row => {
        const key = JSON.stringify(row);
        cleanedRowMap.set(key, (cleanedRowMap.get(key) || 0) + 1);
      });

      const removed = [];
      const originalRowMap = new Map();

      rows.forEach((row, idx) => {
        const key = JSON.stringify(row);
        const currentCount = originalRowMap.get(key) || 0;
        originalRowMap.set(key, currentCount + 1);
        const cleanedCount = cleanedRowMap.get(key) || 0;

        if (currentCount >= cleanedCount) {
          removed.push(row);
        }
      });

      setRemovedRows(removed);
      setCleanedData({
        headers: headers,
        rows: result.cleanedRows,
        cleaningLog: result.cleaningLog,
        cleaningStats: result.cleaningStats,
        originalRowCount: result.originalRowCount,
        cleanedRowCount: result.cleanedRowCount,
        removedRowCount: result.removedRowCount
      });

      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            headers: headers,
            cleanedRows: result.cleanedRows,
            cleaningStats: result.cleaningStats,
            originalData: upstreamData,
            removedRows: removed
          }
        };
      }));

    } catch (err) {
      setError(err?.message || 'Data cleaning failed.');
      console.error('Cleaning error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const onClear = () => {
    setCleanedData(null);
    setRemovedRows([]);
    setShowRemovedRows(false);
    setError('');
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, headers: [], cleanedRows: [], cleaningStats: {} } } : n
    ));
  };

  const getCollapsedSummary = () => {
    if (cleanedData) {
      return `Cleaned: ${cleanedData.cleanedRowCount} Rows | Removed: ${cleanedData.removedRowCount}`;
    }
    return 'Configure Cleaning';
  };

  const getStatusIndicator = () => {
    if (cleanedData) return <div className="status-dot status-trained" title="Data Cleaned" />;
    if (headers.length > 0) return <div className="status-dot status-configured" title="Ready to Clean" />;
    return <div className="status-dot status-not-configured" title="No Data" />;
  };

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

      <CollapsibleNodeWrapper
        nodeId={id}
        category="preprocessing" nodeType="dataCleaner"
        title={data.label || 'Data Cleaner'}
        icon={<FaBroom />}
        statusIndicator={getStatusIndicator()}
        infoButton={<InfoButton nodeType="dataCleaner" />}
        collapsedSummary={getCollapsedSummary()}
        defaultCollapsed={false}
        className="data-cleaner-node"
      >
        {headers.length > 0 && (
          <div className="cleaner-content">
            {/* Missing Values Section */}
            <div className="config-section">
              <label className="section-header">
                <input
                  type="checkbox"
                  checked={config.handleMissing}
                  onChange={(e) => setConfig({ ...config, handleMissing: e.target.checked })}
                />
                Handle Missing Values
              </label>
              {config.handleMissing && (
                <div className="config-options">
                  <select
                    value={config.missingMethod}
                    onChange={(e) => setConfig({ ...config, missingMethod: e.target.value })}
                  >
                    <option value="drop">Drop Rows</option>
                    <option value="fill_mean">Fill with Mean (numeric)</option>
                    <option value="fill_median">Fill with Median (numeric)</option>
                    <option value="fill_mode">Fill with Mode</option>
                  </select>
                </div>
              )}
            </div>

            {/* Outliers Section */}
            <div className="config-section">
              <label className="section-header">
                <input
                  type="checkbox"
                  checked={config.removeOutliers}
                  onChange={(e) => setConfig({ ...config, removeOutliers: e.target.checked })}
                />
                Remove Outliers
              </label>
              {config.removeOutliers && (
                <div className="config-options">
                  <label>Method:</label>
                  <select
                    value={config.outlierMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      let threshold = 1.5;
                      if (method === 'zscore') threshold = 3;
                      if (method === 'percentile') threshold = 1;
                      setConfig({ ...config, outlierMethod: method, outlierThreshold: threshold });
                    }}
                  >
                    <option value="iqr">IQR Method</option>
                    <option value="zscore">Z-Score Method</option>
                    <option value="percentile">Percentile Clipping</option>
                  </select>

                  <div style={{ marginTop: '8px' }}>
                    <label>Threshold:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.outlierThreshold}
                      onChange={(e) => setConfig({ ...config, outlierThreshold: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <label>Select Numeric Columns:</label>
                    <div className="column-checkboxes">
                      {headers.map((header, idx) => (
                        <label key={idx} className="column-option">
                          <input
                            type="checkbox"
                            checked={config.outlierColumns.includes(idx)}
                            onChange={() => toggleOutlierColumn(idx)}
                          />
                          <span>{header}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Duplicates Section */}
            <div className="config-section">
              <label className="section-header">
                <input
                  type="checkbox"
                  checked={config.removeDuplicates}
                  onChange={(e) => setConfig({ ...config, removeDuplicates: e.target.checked })}
                />
                Remove Duplicates
              </label>
              {config.removeDuplicates && (
                <div className="config-options">
                  <select
                    value={config.duplicateKeepOption}
                    onChange={(e) => setConfig({ ...config, duplicateKeepOption: e.target.value })}
                  >
                    <option value="first">Keep First</option>
                    <option value="last">Keep Last</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="cleaner-actions">
              <button
                className="btn primary"
                onClick={onClean}
                disabled={isProcessing}
                style={{ flex: cleanedData ? 0.6 : 1 }}
              >
                {isProcessing ? 'Cleaning...' : 'Clean Data'}
              </button>
              {cleanedData && (
                <>
                  <button
                    className="btn secondary"
                    onClick={() => setShowRemovedRows(!showRemovedRows)}
                    style={{ flex: 0.8 }}
                  >
                    {showRemovedRows ? 'Hide Removed' : `View Removed (${removedRows.length})`}
                  </button>
                  <button className="btn secondary" onClick={onClear} style={{ flex: 0.4 }}>
                    Clear
                  </button>
                </>
              )}
            </div>

            {error && <div className="error-text">{error}</div>}

            {/* Removed Rows View */}
            {cleanedData && showRemovedRows && removedRows.length > 0 && (
              <div className="removed-preview">
                <div className="preview-title" style={{ color: '#e53e3e', background: '#fff5f5' }}>
                  Removed Rows (showing {Math.min(5, removedRows.length)} of {removedRows.length} rows)
                  {removedRows.length > 5 && (
                    <span style={{ fontSize: '0.75em', color: '#e53e3e', fontWeight: 500, marginLeft: '8px' }}>
                      Right-click node to view all
                    </span>
                  )}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {cleanedData.headers.map((header, idx) => (
                          <th key={idx} style={{ background: '#e53e3e' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {removedRows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {cleanedData.headers.map((_, cIdx) => (
                            <td key={cIdx}>
                              {typeof row[cIdx] === 'number'
                                ? row[cIdx].toFixed(4)
                                : String(row[cIdx] ?? '')
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results Preview */}
            {cleanedData && (
              <div className="cleaned-preview">
                {/* Statistics */}
                <div className="cleaning-stats">
                  <div className="stat-row">
                    <span>Original Rows:</span>
                    <strong>{cleanedData.originalRowCount}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Cleaned Rows:</span>
                    <strong>{cleanedData.cleanedRowCount}</strong>
                  </div>
                  <div className="stat-row removed">
                    <span>Removed:</span>
                    <strong>{cleanedData.removedRowCount}</strong>
                  </div>
                </div>

                {/* Cleaning Log */}
                {cleanedData.cleaningLog.length > 0 && (
                  <div className="cleaning-log">
                    <div className="log-title">Operations:</div>
                    {cleanedData.cleaningLog.map((log, idx) => (
                      <div key={idx} className="log-item">• {log}</div>
                    ))}
                  </div>
                )}

                {/* Data Preview */}
                <div className="preview-title">
                  Cleaned Data Preview (showing {Math.min(5, cleanedData.rows.length)} of {cleanedData.rows.length} rows)
                  {cleanedData.rows.length > 5 && (
                    <span style={{ fontSize: '0.75em', color: '#2563eb', fontWeight: 500, marginLeft: '8px' }}>
                      Right-click node to view all
                    </span>
                  )}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {cleanedData.headers.map((header, idx) => (
                          <th key={idx}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cleanedData.rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {cleanedData.headers.map((_, cIdx) => (
                            <td key={cIdx}>
                              {typeof row[cIdx] === 'number'
                                ? row[cIdx].toFixed(4)
                                : String(row[cIdx] ?? '')
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleNodeWrapper>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
    </>
  );
};

export default DataCleanerNode;
