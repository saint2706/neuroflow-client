import React, { useMemo, useState } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './NormalizerNode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { normalizeDataset } from '../../utils/normalizationUtils';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import { FaSlidersH } from 'react-icons/fa';

const NormalizerNode = ({ id, data, isConnectable }) => {
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [normalizationType, setNormalizationType] = useState('minmax');
  const [isProcessing, setIsProcessing] = useState(false);
  interface NormalizationInfo {
    [col: string]: {
      type: string;
      min?: number;
      max?: number;
      mean?: number;
      stdDev?: number;
    }
  }
  interface NormalizedData {
    headers: string[];
    rows: any[][];
    normalizationInfo: NormalizationInfo;
  }
  const [normalizedData, setNormalizedData] = useState<NormalizedData | null>(null);
  const [error, setError] = useState('');
  const { setNodes } = useReactFlow();

  // Find upstream CSV or Encoder node
  const upstreamData = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
    for (const e of incoming) {
      const src = store.nodeInternals.get(e.source);
      if (src?.type === 'csvReader') {
        return {
          type: 'csv',
          headers: src.data?.headers || [],
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
      if (src?.type === 'dataCleaner') {
        return {
          type: 'cleaned',
          headers: src.data?.headers || [],
          cleanedRows: src.data?.cleanedRows || []
        };
      }
      if (src?.type === 'encoder') {
        return {
          type: 'encoded',
          headers: src.data?.headers || [],
          encodedRows: src.data?.encodedRows || [],
          encodingInfo: src.data?.encodingInfo || {}
        };
      }
      if (src?.type === 'normalizer') {
        return {
          type: 'normalized',
          headers: src.data?.headers || [],
          normalizedRows: src.data?.normalizedRows || [],
          normalizationInfo: src.data?.normalizationInfo || {}
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

  const toggleColumn = (header) => {
    setSelectedColumns(prev =>
      prev.includes(header)
        ? prev.filter(col => col !== header)
        : [...prev, header]
    );
  };

  const onNormalize = async () => {
    if (!upstreamData) {
      setError('Please connect a data source.');
      return;
    }
    if (selectedColumns.length === 0) {
      setError('Please select at least one column to normalize.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      let rows;

      if (upstreamData.type === 'csv') {
        const parsed = await parseFullTabularFile(upstreamData.file);
        rows = parsed.rows;
      } else if (upstreamData.type === 'database') {
        rows = upstreamData.rows;
      } else if (upstreamData.type === 'cleaned') {
        rows = upstreamData.cleanedRows;
      } else if (upstreamData.type === 'encoded') {
        rows = upstreamData.encodedRows;
      } else if (upstreamData.type === 'normalized') {
        rows = upstreamData.normalizedRows;
      } else if (upstreamData.type === 'featureSelector') {
        rows = upstreamData.selectedRows;
      } else if (upstreamData.type === 'dataTypeConverter') {
        rows = upstreamData.rows;
      } else {
        throw new Error('Unknown data source type.');
      }

      const normalizationConfig = {};
      selectedColumns.forEach(col => {
        normalizationConfig[col] = { type: normalizationType };
      });

      const result = normalizeDataset(rows, headers, normalizationConfig);

      setNormalizedData({
        headers: result.headers,
        rows: result.normalizedRows,
        normalizationInfo: result.normalizationInfo
      });

      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            headers: result.headers,
            normalizedRows: result.normalizedRows,
            normalizationInfo: result.normalizationInfo,
            originalData: upstreamData
          }
        };
      }));

    } catch (err) {
      setError(err?.message || 'Normalization failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onClear = () => {
    setNormalizedData(null);
    setSelectedColumns([]);
    setError('');
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, headers: [], normalizedRows: [], normalizationInfo: {} } } : n
    ));
  };

  const getCollapsedSummary = () => {
    if (normalizedData && normalizedData.normalizationInfo) {
      const count = Object.keys(normalizedData.normalizationInfo).length;
      return `Normalized ${count} Columns`;
    }
    return `Configure Scaling`;
  };

  const getStatusIndicator = () => {
    if (normalizedData) return <div className="status-dot status-trained" title="Normalized" />;
    if (headers.length > 0) return <div className="status-dot status-configured" title="Ready" />;
    return <div className="status-dot status-not-configured" title="No Data" />;
  };

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

      <CollapsibleNodeWrapper
        nodeId={id}
        category="preprocessing" nodeType="normalizer"
        title={data.label || 'Normalizer'}
        icon={<FaSlidersH />}
        statusIndicator={getStatusIndicator()}
        infoButton={<InfoButton nodeType="normalizer" />}
        collapsedSummary={getCollapsedSummary()}
        defaultCollapsed={false}
        className="normalizer-node"
      >
        {headers.length > 0 && (
          <div className="normalizer-content">
            <div className="normalization-type-section">
              <label>Normalization Type:</label>
              <select value={normalizationType} onChange={(e) => setNormalizationType(e.target.value)}>
                <option value="minmax">Min-Max Normalization (0-1)</option>
                <option value="zscore">Z-Score Normalization (μ=0, σ=1)</option>
              </select>
            </div>

            <div className="columns-section">
              <label>Select Columns to Normalize:</label>
              <div className="column-checkboxes">
                {headers.map((header) => (
                  <label key={header} className="column-option">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(header)}
                      onChange={() => toggleColumn(header)}
                    />
                    <span>{header}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="normalizer-actions">
              <button
                className="btn primary"
                onClick={onNormalize}
                disabled={isProcessing || selectedColumns.length === 0}
              >
                {isProcessing ? 'Normalizing...' : 'Normalize'}
              </button>
              {normalizedData && (
                <button className="btn secondary" onClick={onClear}>
                  Clear
                </button>
              )}
            </div>

            {error && <div className="error-text">{error}</div>}

            {normalizedData && (
              <div className="normalized-preview">
                <div className="preview-title">
                  Normalized Data Preview (showing {Math.min(5, normalizedData.rows.length)} of {normalizedData.rows.length} rows)
                  {normalizedData.rows.length > 5 && (
                    <span style={{ fontSize: '0.75em', color: '#2563eb', fontWeight: 500, marginLeft: '8px' }}>
                      Right-click node to view all
                    </span>
                  )}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {normalizedData.headers.map((header, idx) => (
                          <th key={idx}>
                            {header}
                            {normalizedData.normalizationInfo[header] && (
                              <span className="normalization-badge">
                                {normalizedData.normalizationInfo[header].type}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedData.rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {normalizedData.headers.map((_, cIdx) => (
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

                {/* Show normalization statistics */}
                <div className="normalization-stats">
                  <div className="stats-title">Normalization Statistics:</div>
                  {Object.entries(normalizedData.normalizationInfo).map(([colName, info]) => (
                    <div key={colName} className="stat-item">
                      <strong>{colName}</strong> ({info.type}):
                      {info.type === 'minmax' && (
                        <span> Min: {info.min.toFixed(2)}, Max: {info.max.toFixed(2)}</span>
                      )}
                      {info.type === 'zscore' && (
                        <span> Mean: {info.mean.toFixed(2)}, Std: {info.stdDev.toFixed(2)}</span>
                      )}
                    </div>
                  ))}
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

export default NormalizerNode;
