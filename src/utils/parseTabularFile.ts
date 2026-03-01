import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface TabularData {
  headers: string[];
  rows: any[][];
}

// Parses a File (CSV or Excel) and returns { headers: string[], rows: any[][] }
// Limited to the first 5 data rows
export async function parseTabularFile(file: File, hasHeaders = true): Promise<TabularData> {
  const fileName = (file?.name || '').toLowerCase();
  const isCsv = fileName.endsWith('.csv');
  const isTsv = fileName.endsWith('.tsv');
  const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

  if (!isCsv && !isTsv && !isExcel) {
    throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
  }

  if (isCsv || isTsv) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: hasHeaders,
        skipEmptyLines: true,
        preview: 5, // first 5 data rows
        complete: (results) => {
          if (hasHeaders) {
            const data = results?.data || [];
            const metaFields = results?.meta?.fields || [];
            const rows = data.map((rowObj: any) => metaFields.map(h => rowObj[h]));
            resolve({ headers: metaFields, rows });
          } else {
            // No headers - generate default column names
            const data = (results?.data as any[][]) || [];
            if (data.length === 0) {
              resolve({ headers: [], rows: [] });
              return;
            }
            const numColumns = data[0]?.length || 0;
            const headers = Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`);
            resolve({ headers, rows: data });
          }
        },
        error: (err) => reject(err),
        delimiter: isTsv ? '\t' : undefined,
      });
    });
  }

  // Excel path
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with headers, then slice first 5 rows
  const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  if (!json.length) {
    return { headers: [], rows: [] };
  }

  if (hasHeaders) {
    const headers = (json[0] || []).map((h: any) => String(h ?? ''));
    const dataRows = json.slice(1, 6); // up to 5 rows
    return { headers, rows: dataRows };
  } else {
    // No headers - generate default column names
    const numColumns = json[0]?.length || 0;
    const headers = Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`);
    const dataRows = json.slice(0, 5); // first 5 rows as data
    return { headers, rows: dataRows };
  }
}

// Parses the entire file and returns all rows (be careful with very large files)
export async function parseFullTabularFile(file: File, hasHeaders = true): Promise<TabularData> {
  const fileName = (file?.name || '').toLowerCase();
  const isCsv = fileName.endsWith('.csv');
  const isTsv = fileName.endsWith('.tsv');
  const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

  if (!isCsv && !isTsv && !isExcel) {
    throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
  }

  if (isCsv || isTsv) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: hasHeaders,
        skipEmptyLines: true,
        complete: (results) => {
          if (hasHeaders) {
            const data = results?.data || [];
            const metaFields = results?.meta?.fields || [];
            const rows = data.map((rowObj: any) => metaFields.map(h => rowObj[h]));
            resolve({ headers: metaFields, rows });
          } else {
            // No headers - generate default column names
            const data = (results?.data as any[][]) || [];
            if (data.length === 0) {
              resolve({ headers: [], rows: [] });
              return;
            }
            const numColumns = data[0]?.length || 0;
            const headers = Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`);
            resolve({ headers, rows: data });
          }
        },
        error: (err) => reject(err),
        delimiter: isTsv ? '\t' : undefined,
      });
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  if (!json.length) {
    return { headers: [], rows: [] };
  }

  if (hasHeaders) {
    const headers = (json[0] || []).map((h: any) => String(h ?? ''));
    const dataRows = json.slice(1);
    return { headers, rows: dataRows };
  } else {
    // No headers - generate default column names
    const numColumns = json[0]?.length || 0;
    const headers = Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`);
    return { headers, rows: json };
  }
}


