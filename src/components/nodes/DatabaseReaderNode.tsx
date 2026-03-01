import React, { useMemo, useState, useEffect } from 'react';
import InfoButton from '../ui/InfoButton';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import CollapsibleNodeWrapper from '../ui/CollapsibleNodeWrapper';
import { FaDatabase } from 'react-icons/fa';
import './DatabaseReaderNode.css';
import { testDatabaseConnection, fetchDatabaseTables, previewDatabaseData, loadDatabaseData } from '../../utils/apiClient';

function DatabaseReaderNode({ id, data, isConnectable }) {
    const [dbType, setDbType] = useState('sqlite');
    const [connectionParams, setConnectionParams] = useState({
        // SQLite
        filePath: '',
        // PostgreSQL/MySQL
        host: 'localhost',
        port: '5432',
        database: '',
        username: '',
        password: ''
    });

    const [connectionStatus, setConnectionStatus] = useState(null); // null, 'success', 'error'
    const [connectionMessage, setConnectionMessage] = useState('');
    const [isTestingConnection, setIsTestingConnection] = useState(false);

    const [fetchMode, setFetchMode] = useState('table'); // 'table' or 'query'
    const [availableTables, setAvailableTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [customQuery, setCustomQuery] = useState('');

    const [previewData, setPreviewData] = useState({ headers: [], rows: [] });
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [previewError, setPreviewError] = useState('');

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dataStats, setDataStats] = useState({ rows: 0, columns: 0 });
    const [isLoadingData, setIsLoadingData] = useState(false);

    const { setNodes } = useReactFlow();

    const label = useMemo(() => data.label || 'Database Reader', [data.label]);

    // Loaded data sync
    const [loadedData, setLoadedData] = useState({ headers: [], rows: [] });

    // Sync filtered data from node.data to local state
    useEffect(() => {
        if (data.isFiltered && data.rows && data.headers) {
            setPreviewData({
                headers: data.headers,
                rows: data.rows
            });
            setIsDataLoaded(true);
            setLoadedData({
                headers: data.headers,
                rows: data.rows
            });
            setDataStats({
                rows: data.rows.length,
                columns: data.headers.length
            });
        }
    }, [data.isFiltered, data.rows, data.headers]);


    // Determine if this node has an incoming edge from a Start node
    const allowConnection = useStore((store) => {
        const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
        if (incoming.length === 0) return false;
        return incoming.some((e) => {
            const src = store.nodeInternals.get(e.source);
            return src?.type === 'start';
        });
    });

    // Update port based on database type
    useEffect(() => {
        if (dbType === 'postgresql') {
            setConnectionParams(prev => ({ ...prev, port: '5432' }));
        } else if (dbType === 'mysql') {
            setConnectionParams(prev => ({ ...prev, port: '3306' }));
        }
    }, [dbType]);

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        setConnectionStatus(null);
        setConnectionMessage('');
        setAvailableTables([]);
        setSelectedTable('');

        try {
            const params = dbType === 'sqlite'
                ? { db_type: dbType, file_path: connectionParams.filePath }
                : {
                    db_type: dbType,
                    host: connectionParams.host,
                    port: parseInt(connectionParams.port),
                    database: connectionParams.database,
                    username: connectionParams.username,
                    password: connectionParams.password
                };

            const result = await testDatabaseConnection(params);

            if (result.success) {
                setConnectionStatus('success');
                setConnectionMessage('Connection successful');

                // Fetch available tables
                const tablesResult = await fetchDatabaseTables(params);
                if (tablesResult.success) {
                    setAvailableTables(tablesResult.tables || []);
                }
            } else {
                setConnectionStatus('error');
                setConnectionMessage(result.error || 'Connection failed');
            }
        } catch (error) {
            setConnectionStatus('error');
            setConnectionMessage(error.message || 'Connection failed');
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handlePreviewData = async () => {
        setIsLoadingPreview(true);
        setPreviewError('');
        setPreviewData({ headers: [], rows: [] });

        try {
            const params = dbType === 'sqlite'
                ? { db_type: dbType, file_path: connectionParams.filePath }
                : {
                    db_type: dbType,
                    host: connectionParams.host,
                    port: parseInt(connectionParams.port),
                    database: connectionParams.database,
                    username: connectionParams.username,
                    password: connectionParams.password
                };

            const queryParams = {
                ...params,
                fetch_mode: fetchMode,
                table_name: fetchMode === 'table' ? selectedTable : undefined,
                query: fetchMode === 'query' ? customQuery : undefined,
                preview_rows: 10
            };

            const result = await previewDatabaseData(queryParams);

            if (result.success) {
                setPreviewData({
                    headers: result.headers || [],
                    rows: result.rows || []
                });
            } else {
                setPreviewError(result.error || 'Failed to preview data');
            }
        } catch (error) {
            setPreviewError(error.message || 'Failed to preview data');
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleLoadData = async () => {
        setIsLoadingData(true);

        try {
            const params = dbType === 'sqlite'
                ? { db_type: dbType, file_path: connectionParams.filePath }
                : {
                    db_type: dbType,
                    host: connectionParams.host,
                    port: parseInt(connectionParams.port),
                    database: connectionParams.database,
                    username: connectionParams.username,
                    password: connectionParams.password
                };

            const queryParams = {
                ...params,
                fetch_mode: fetchMode,
                table_name: fetchMode === 'table' ? selectedTable : undefined,
                query: fetchMode === 'query' ? customQuery : undefined
            };

            const result = await loadDatabaseData(queryParams);

            if (result.success) {
                setIsDataLoaded(true);
                setDataStats({
                    rows: result.row_count || 0,
                    columns: result.column_count || 0
                });

                // Store data in node for downstream nodes
                setNodes((nds) => nds.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            headers: result.headers || [],
                            rows: result.rows || [],
                            rowCount: result.row_count || 0,
                            columnCount: result.column_count || 0
                        }
                    };
                }));
            } else {
                setPreviewError(result.error || 'Failed to load data');
            }
        } catch (error) {
            setPreviewError(error.message || 'Failed to load data');
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleResetData = () => {
        setIsDataLoaded(false);
        setDataStats({ rows: 0, columns: 0 });
        // Also clear from node data
        setNodes((nds) => nds.map((n) => {
            if (n.id !== id) return n;
            return {
                ...n,
                data: {
                    ...n.data,
                    headers: [],
                    rows: [],
                    rowCount: 0,
                    columnCount: 0
                }
            };
        }));
    };

    const getCollapsedSummary = () => {
        if (isDataLoaded) {
            return `${dbType === 'sqlite' ? 'SQLite' : dbType} | ${fetchMode === 'table' ? (selectedTable || 'Table') : 'SQL'} | ${dataStats.rows} rows`;
        }
        if (connectionStatus === 'success') {
            return `Connected: ${dbType}`;
        }
        return allowConnection ? 'Configure Connection' : 'Connect Start Node';
    };

    const getStatusIndicator = () => {
        if (isDataLoaded) return <div className="status-dot status-trained" title="Data Loaded" />;
        if (connectionStatus === 'success') return <div className="status-dot status-configured" title="Connected" />;
        if (connectionStatus === 'error') return <div className="status-dot status-error" title="Connection Failed" />;
        return <div className="status-dot status-not-configured" title="Not Configured" />;
    };

    return (
        <>
            <Handle type="target" position={Position.Top} className="custom-handle" id="a" isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} className="custom-handle" id="b" isConnectable={isConnectable} />

            <CollapsibleNodeWrapper
                nodeId={id}
                category="data-source" nodeType="databaseReader"
                title={label}
                icon={<FaDatabase />}
                statusIndicator={getStatusIndicator()}
                infoButton={<InfoButton nodeType="databaseReader" />}
                collapsedSummary={getCollapsedSummary()}
                defaultCollapsed={false}
                className="database-reader-node"
            >
                <div className="node-content">
                    {allowConnection ? (
                        <>
                            {isDataLoaded ? (
                                <div className="success-card">
                                    <div className="card-header">
                                        <div className="card-tag">Dataset Ready</div>
                                        <div className="status-icon">⠿</div>
                                    </div>

                                    <div className="card-stats">
                                        <div className="stat-box">
                                            <span className="stat-label">Total Rows</span>
                                            <span className="stat-value">{dataStats.rows.toLocaleString()}</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="stat-label">Columns</span>
                                            <span className="stat-value">{dataStats.columns}</span>
                                        </div>
                                    </div>

                                    {/* Dataset Preview */}
                                    {previewData.headers.length > 0 && (
                                        <div className="preview-container" style={{ marginTop: '12px' }}>
                                            <div className="section-title">
                                                Preview
                                                {data.isFiltered && (
                                                    <span className="filtered-badge">Filtered</span>
                                                )}
                                            </div>
                                            <div className="table-wrapper">
                                                <table className="premium-table">
                                                    <thead>
                                                        <tr>
                                                            {previewData.headers.map((h, idx) => (
                                                                <th key={idx}>{String(h || '')}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {previewData.rows.slice(0, 5).map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                {previewData.headers.map((_, cIdx) => (
                                                                    <td key={cIdx}>{String(row?.[cIdx] ?? '')}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        className="btn danger"
                                        onClick={handleResetData}
                                        style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <span>🗑️</span> Delete Loaded Data
                                    </button>
                                </div>
                            ) : (
                                <div className="config-sections">
                                    {/* Step 1: Connection */}
                                    <div className="config-section active">
                                        <div className="section-title">Step 1: Database Connection</div>

                                        <div className="form-group">
                                            <label>Database Type</label>
                                            <select
                                                value={dbType}
                                                onChange={(e) => {
                                                    setDbType(e.target.value);
                                                    setConnectionStatus(null);
                                                    setAvailableTables([]);
                                                    setPreviewData({ headers: [], rows: [] });
                                                }}
                                                className="form-select"
                                            >
                                                <option value="sqlite">SQLite</option>
                                                <option value="postgresql">PostgreSQL</option>
                                                <option value="mysql">MySQL</option>
                                            </select>
                                        </div>

                                        {/* Connection Details */}
                                        <div className="details-container">
                                            {dbType === 'sqlite' ? (
                                                <div className="form-group">
                                                    <label>Database File Path</label>
                                                    <input
                                                        type="text"
                                                        value={connectionParams.filePath}
                                                        onChange={(e) => setConnectionParams({ ...connectionParams, filePath: e.target.value })}
                                                        placeholder="/path/to/database.db"
                                                        className="form-input"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="db-fields-grid">
                                                    <div className="form-group">
                                                        <label>Host</label>
                                                        <input
                                                            type="text"
                                                            value={connectionParams.host}
                                                            onChange={(e) => setConnectionParams({ ...connectionParams, host: e.target.value })}
                                                            placeholder="localhost"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Port</label>
                                                        <input
                                                            type="text"
                                                            value={connectionParams.port}
                                                            onChange={(e) => setConnectionParams({ ...connectionParams, port: e.target.value })}
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group full-width">
                                                        <label>Database</label>
                                                        <input
                                                            type="text"
                                                            value={connectionParams.database}
                                                            onChange={(e) => setConnectionParams({ ...connectionParams, database: e.target.value })}
                                                            placeholder="my_database"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Username</label>
                                                        <input
                                                            type="text"
                                                            value={connectionParams.username}
                                                            onChange={(e) => setConnectionParams({ ...connectionParams, username: e.target.value })}
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Password</label>
                                                        <input
                                                            type="password"
                                                            value={connectionParams.password}
                                                            onChange={(e) => setConnectionParams({ ...connectionParams, password: e.target.value })}
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            className="btn primary action-btn"
                                            onClick={handleTestConnection}
                                            disabled={isTestingConnection || (dbType === 'sqlite' && !connectionParams.filePath) ||
                                                (dbType !== 'sqlite' && (!connectionParams.host || !connectionParams.database))}
                                            style={{ marginTop: '12px' }}
                                        >
                                            {isTestingConnection ? (
                                                <span className="loading-state">Testing...</span>
                                            ) : 'Verify Connection'}
                                        </button>

                                        {connectionStatus && (
                                            <div className={`status-badge ${connectionStatus}`} style={{ marginTop: '8px' }}>
                                                <span className="status-icon">
                                                    {connectionStatus === 'success' ? '✅' : '❌'}
                                                </span>
                                                <span className="status-text">{connectionMessage}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2: Selection */}
                                    {connectionStatus === 'success' && (
                                        <div className="config-section active highlight">
                                            <div className="section-title">Step 2: Table Selection</div>

                                            <div className="form-group">
                                                <div className="mode-toggle">
                                                    <button
                                                        className={`toggle-btn ${fetchMode === 'table' ? 'active' : ''}`}
                                                        onClick={() => setFetchMode('table')}
                                                    >
                                                        Table
                                                    </button>
                                                    <button
                                                        className={`toggle-btn ${fetchMode === 'query' ? 'active' : ''}`}
                                                        onClick={() => setFetchMode('query')}
                                                    >
                                                        SQL Query
                                                    </button>
                                                </div>
                                            </div>

                                            {fetchMode === 'table' ? (
                                                <div className="form-group">
                                                    <select
                                                        value={selectedTable}
                                                        onChange={(e) => setSelectedTable(e.target.value)}
                                                        className="form-select premium-select"
                                                    >
                                                        <option value="">Choose a table...</option>
                                                        {availableTables.map((table) => (
                                                            <option key={table} value={table}>{table}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="form-group">
                                                    <textarea
                                                        value={customQuery}
                                                        onChange={(e) => setCustomQuery(e.target.value)}
                                                        placeholder="Enter SQL (e.g. SELECT * FROM data...)"
                                                        className="form-textarea code-font"
                                                        rows={3}
                                                    />
                                                </div>
                                            )}

                                            <div className="button-group-row">
                                                <button
                                                    className="btn secondary flex-btn"
                                                    onClick={handlePreviewData}
                                                    disabled={isLoadingPreview || (fetchMode === 'table' && !selectedTable) ||
                                                        (fetchMode === 'query' && !customQuery)}
                                                >
                                                    {isLoadingPreview ? '...' : 'Preview'}
                                                </button>

                                                {previewData.headers.length > 0 && (
                                                    <button
                                                        className="btn primary flex-btn"
                                                        onClick={handleLoadData}
                                                        disabled={isLoadingData}
                                                    >
                                                        {isLoadingData ? '...' : 'Load All'}
                                                    </button>
                                                )}
                                            </div>

                                            {previewError && <div className="error-badge">{previewError}</div>}
                                        </div>
                                    )}

                                    {/* Preview Table for Config only shown when previewing but not loaded */}
                                    {previewData.headers.length > 0 && !isDataLoaded && (
                                        <div className="preview-container">
                                            <div className="section-title">
                                                Data Preview ({previewData.rows.length} rows)
                                            </div>
                                            <div className="table-wrapper">
                                                <table className="premium-table">
                                                    <thead>
                                                        <tr>
                                                            {previewData.headers.map((h, idx) => (
                                                                <th key={idx}>{String(h || '')}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {previewData.rows.slice(0, 5).map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                {previewData.headers.map((_, cIdx) => (
                                                                    <td key={cIdx}>{String(row?.[cIdx] ?? '')}</td>
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
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">🪪</div>
                            <div className="empty-text">Please connect to a Start node to begin.</div>
                        </div>
                    )}
                </div>
            </CollapsibleNodeWrapper>

            <Handle type="source" position={Position.Bottom} className="custom-handle" id="c" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} className="custom-handle" id="d" isConnectable={isConnectable} />
        </>
    );
}

export default React.memo(DatabaseReaderNode);
