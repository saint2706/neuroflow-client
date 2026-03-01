import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './CsvReaderNode.css';
import { parseFullTabularFile } from '../../utils/parseTabularFile';
import { FaTable } from 'react-icons/fa';
import InfoButton from '../ui/InfoButton';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';

function CsvReaderNode({ id, data, isConnectable }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sample, setSample] = useState({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasHeaders, setHasHeaders] = useState(true);
  const { setNodes } = useReactFlow();

  const label = useMemo(() => data.label || 'CSV/Excel Reader', [data.label]);

  // Sync filtered data from node.data to local state
  useEffect(() => {
    if (data.isFiltered && data.rows && data.headers) {
      setSample({
        headers: data.headers,
        rows: data.rows
      });
      setSelectedFile(data.file);
    }
  }, [data.isFiltered, data.rows, data.headers, data.file]);

  // Determine if this node has an incoming edge from a Start node
  const allowUpload = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
    if (incoming.length === 0) return false;
    return incoming.some((e) => {
      const src = store.nodeInternals.get(e.source);
      return src?.type === 'start';
    });
  });

  const onPickFile = () => {
    setError('');
    if (inputRef.current) inputRef.current.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setIsLoading(true);
    setError('');
    try {
      const parsed = await parseFullTabularFile(file, hasHeaders);
      setSample(parsed);
      // persist headers, rows, and file on the node data so downstream nodes can use it
      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          data: {
            ...n.data,
            headers: parsed.headers,
            rows: parsed.rows,  // Store rows so downstream nodes don't need to re-parse
            file,
            isFiltered: false  // Reset filtered flag when new file is uploaded
          }
        };
      }));
    } catch (err) {
      setError(err?.message || 'Failed to parse file');
      setSelectedFile(null);
      setSample({ headers: [], rows: [] });
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, headers: [], file: undefined } } : n)));
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteFile = () => {
    setSelectedFile(null);
    setSample({ headers: [], rows: [] });
    setError('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, headers: [], file: undefined } } : n)));
  };

  // Handler for when hasHeaders checkbox changes
  const onHeadersToggle = async (e) => {
    const newHasHeaders = e.target.checked;
    setHasHeaders(newHasHeaders);

    // If a file is already loaded, re-parse it with the new setting
    if (selectedFile) {
      setIsLoading(true);
      setError('');
      try {
        const parsed = await parseFullTabularFile(selectedFile, newHasHeaders);
        setSample(parsed);
        setNodes((nds) => nds.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              headers: parsed.headers,
              rows: parsed.rows  // Update rows when re-parsing
            }
          };
        }));
      } catch (err) {
        setError(err?.message || 'Failed to parse file');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Get first 5 rows for preview
  const previewRows = useMemo(() => {
    return sample.rows.slice(0, 5);
  }, [sample.rows]);

  const getCollapsedSummary = () => {
    if (selectedFile) {
      return `${selectedFile.name} | ${sample.rows.length} rows`;
    }
    return allowUpload ? 'Ready to upload' : 'Connect Start node';
  };

  const getStatusIndicator = () => {
    if (selectedFile) return <div className="status-dot status-trained" title="File loaded" />;
    if (allowUpload) return <div className="status-dot status-configured" title="Ready" />;
    return <div className="status-dot status-not-configured" title="Waiting for connection" />;
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="custom-handle" id="a" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} className="custom-handle" id="b" isConnectable={isConnectable} />

      <CollapsibleNodeWrapper
        nodeId={id}
        category="data-source" nodeType="csvReader"
        title={label}
        icon={<FaTable />}
        statusIndicator={getStatusIndicator()}
        infoButton={<InfoButton nodeType="csvReader" />}
        collapsedSummary={getCollapsedSummary()}
        defaultCollapsed={false}
        className="csv-reader-node"
      >
        <div className="node-content">
          {allowUpload && (
            <div className="checkbox-container" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasHeaders}
                  onChange={onHeadersToggle}
                  disabled={isLoading}
                  style={{ cursor: 'pointer' }}
                />
                <span>First row contains headers</span>
              </label>
            </div>
          )}

          {allowUpload && !selectedFile && (
            <button className="btn primary" onClick={onPickFile} disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? 'Loading…' : 'Upload CSV/Excel'}
            </button>
          )}

          {allowUpload && (
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          )}

          {allowUpload && selectedFile && (
            <div className="file-info" style={{ marginBottom: '8px' }}>
              <div className="file-name" title={selectedFile.name} style={{ fontWeight: '500' }}>{selectedFile.name}</div>
              <div className="file-actions">
                <button className="btn" onClick={onPickFile} disabled={isLoading}>Replace</button>
                <button className="btn danger" onClick={onDeleteFile} disabled={isLoading}>Delete</button>
              </div>
            </div>
          )}

          {allowUpload && error && <div className="error-text">{error}</div>}

          {allowUpload && sample?.headers?.length > 0 && (
            <div className="sample-table">
              <div className="sample-title">
                Data Preview
                {data.isFiltered && (
                  <span className="filtered-badge" title={`Filtered from ${data.originalRowCount} rows`}>
                    Filtered
                  </span>
                )}
                <span style={{ fontSize: '0.8em', color: '#666', fontWeight: 'normal' }}>
                  ({sample.rows.length} x {sample.headers.length})
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {sample.headers.map((h, idx) => (
                        <th key={idx}>{String(h || '')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {sample.headers.map((_, cIdx) => (
                          <td key={cIdx}>{String(row?.[cIdx] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!allowUpload && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
              Please connect a Start node to enable upload.
            </div>
          )}
        </div>
      </CollapsibleNodeWrapper>

      <Handle type="source" position={Position.Bottom} className="custom-handle" id="c" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} className="custom-handle" id="d" isConnectable={isConnectable} />
    </>
  );
}

export default React.memo(CsvReaderNode);