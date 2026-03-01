// Encoding utilities for categorical data

// Label Encoding: Maps each unique value to an integer (0, 1, 2, ...)
export function labelEncode(columnData: any[]) {
  const uniqueValues = [...new Set(columnData)];
  const encodingMap: Record<string, number> = {};
  const reverseMap: Record<number, any> = {};

  uniqueValues.forEach((value, index) => {
    const key = String(value);
    encodingMap[key] = index;
    reverseMap[index] = value;
  });

  const encodedData = columnData.map(value => encodingMap[String(value)]);

  return {
    encodedData,
    encodingMap,
    reverseMap,
    type: 'label'
  };
}

// Frequency Encoding: Maps each value to its frequency in the dataset
export function frequencyEncode(columnData: any[]) {
  const frequencyMap: Record<string, number> = {};

  // Count frequencies
  columnData.forEach(value => {
    const key = String(value);
    frequencyMap[key] = (frequencyMap[key] || 0) + 1;
  });

  const encodedData = columnData.map(value => frequencyMap[String(value)]);

  return {
    encodedData,
    encodingMap: frequencyMap,
    reverseMap: null, // Not applicable for frequency encoding
    type: 'frequency'
  };
}

// Apply encoding to multiple columns of a dataset
export function encodeDataset(rows: any[][], headers: string[], encodingConfig: any) {
  // encodingConfig: { columnName: { type: 'label'|'frequency', encoding: {...} } }

  const encodedRows = rows.map(row => [...row]); // Deep copy
  const encodingInfo: Record<string, any> = {};

  // Apply encoding to each selected column
  Object.entries(encodingConfig).forEach(([columnName, config]: [string, any]) => {
    const columnIndex = headers.indexOf(columnName);
    if (columnIndex === -1) return;

    // Extract column data
    const columnData = rows.map(row => row[columnIndex]);

    // Apply encoding
    let encoding;
    if (config.type === 'label') {
      encoding = labelEncode(columnData);
    } else if (config.type === 'frequency') {
      encoding = frequencyEncode(columnData);
    }

    if (encoding) {
      // Replace column data with encoded values
      encodedRows.forEach((row, rowIndex) => {
        row[columnIndex] = encoding.encodedData[rowIndex];
      });

      // Store encoding info for this column
      encodingInfo[columnName] = {
        type: config.type,
        encodingMap: encoding.encodingMap,
        reverseMap: encoding.reverseMap
      };
    }
  });

  return {
    encodedRows,
    encodingInfo,
    headers: [...headers] // Headers remain the same
  };
}




