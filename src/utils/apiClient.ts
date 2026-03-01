// API client for backend communication

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

async function fetchWithRetry(url: string, options: any = {}, retries = 3, timeout = 30000) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Don't retry for client errors (4xx) except Too Many Requests (429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        // Throw for 5xx or 429 to trigger retry
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      const isRetryable =
        error.name === 'AbortError' || // Timeout
        error.message.includes('NetworkError') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('HTTP error! status: 5') ||
        error.message.includes('HTTP error! status: 429');

      if (!isRetryable || i === retries - 1) {
        throw new Error(`API call failed: ${error.message}`);
      }

      // Exponential backoff: 1s, 2s, 3s...
      console.warn(`Attempt ${i + 1} failed. Retrying in ${(i + 1) * 1000}ms...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

export async function trainLogisticRegression(X: any[], y: any[], trainPercent: number, featureNames: string[] = [], targetName = 'target', options: any = {}) {
  return await fetchWithRetry(`${API_BASE_URL}/logistic-regression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      learning_rate: options.learningRate,
      n_iterations: options.maxIterations,
      feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function trainLinearRegression(X: any[], y: any[], trainPercent: number, featureName = 'X', targetName = 'y', options: any = {}) {
  return await fetchWithRetry(`${API_BASE_URL}/linear-regression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      learning_rate: options.learningRate,
      n_iterations: options.maxIterations,
      feature_name: featureName,
      target_name: targetName
    })
  });
}

export async function trainMultiLinearRegression(X: any[], y: any[], trainPercent: number, featureNames: string[] = [], targetName = 'y', options: any = {}) {
  return await fetchWithRetry(`${API_BASE_URL}/multi-linear-regression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      learning_rate: options.learningRate,
      n_iterations: options.maxIterations,
      feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function trainKNNRegression(X: any[], y: any[], trainPercent: number, k: number, distanceMetric: string, featureNames: string[] = [], targetName = 'y', minkowskiP = 3) {
  return await fetchWithRetry(`${API_BASE_URL}/knn-regression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      k, distance_metric: distanceMetric,
      minkowski_p: minkowskiP,
      feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function trainKNNClassification(X: any[], y: any[], trainPercent: number, k: number, distanceMetric: string, featureNames: string[] = [], targetName = 'y', minkowskiP = 3) {
  return await fetchWithRetry(`${API_BASE_URL}/knn-classification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      k, distance_metric: distanceMetric,
      minkowski_p: minkowskiP,
      feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function trainNaiveBayes(X: any[], y: any[], trainPercent: number, alpha = 1.0, featureNames: string[] = [], targetName = 'y') {
  return await fetchWithRetry(`${API_BASE_URL}/naive-bayes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      alpha, feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function trainPolynomialRegression(X: any[], y: any[], trainPercent: number, degree: number, includeBias: boolean, interactionOnly: boolean, featureNames: string[] = [], targetName = 'y') {
  return await fetchWithRetry(`${API_BASE_URL}/polynomial-regression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      degree, include_bias: includeBias,
      interaction_only: interactionOnly,
      feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function applyPCA(data: any[], headers: string[], config: any, fullRows: any[] | null = null, allHeaders: string[] | null = null, selectedIndices: number[] | null = null) {
  const requestBody: any = {
    data, headers,
    n_components: config.n_components,
    variance_threshold: config.variance_threshold,
    standardize: config.standardize !== undefined ? config.standardize : true,
    return_loadings: config.return_loadings || false,
    return_explained_variance: config.return_explained_variance !== undefined ? config.return_explained_variance : true
  };

  if (fullRows !== null && allHeaders !== null && selectedIndices !== null) {
    requestBody.full_rows = fullRows;
    requestBody.all_headers = allHeaders;
    requestBody.selected_indices = selectedIndices;
  }

  return await fetchWithRetry(`${API_BASE_URL}/pca`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
}

export async function applySVD(data: any[], headers: string[], config: any, fullRows: any[] | null = null, allHeaders: string[] | null = null, selectedIndices: number[] | null = null) {
  const requestBody: any = {
    data, headers,
    n_components: config.n_components,
    variance_threshold: config.variance_threshold,
    standardize: config.standardize !== undefined ? config.standardize : true,
    return_loadings: config.return_loadings || false,
    return_explained_variance: config.return_explained_variance !== undefined ? config.return_explained_variance : true
  };

  if (fullRows !== null && allHeaders !== null && selectedIndices !== null) {
    requestBody.full_rows = fullRows;
    requestBody.all_headers = allHeaders;
    requestBody.selected_indices = selectedIndices;
  }

  return await fetchWithRetry(`${API_BASE_URL}/svd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
}

// Database Reader API functions
export async function testDatabaseConnection(params: any) {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/database/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }, 1, 10000); // Less retries/timeout for test connection
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchDatabaseTables(params: any) {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/database/fetch-tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function previewDatabaseData(params: any) {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/database/preview-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function loadDatabaseData(params: any) {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/database/load-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function describeData(data: any[], headers: string[], selectedColumns: string[] = []) {
  return await fetchWithRetry(`${API_BASE_URL}/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, headers, selected_columns: selectedColumns })
  });
}

export async function convertDataTypes(data: any[], headers: string[], conversions: any, dateFormats: any = {}) {
  return await fetchWithRetry(`${API_BASE_URL}/convert_dtypes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, headers, conversions, date_formats: dateFormats })
  });
}

export async function trainMLP(X: any[], y: any[], trainPercent: number, taskType: string, hiddenLayers: number[], activation: string, optimizer: string, learningRate: number, epochs: number, batchSize: number, featureNames: string[] = [], targetName = 'target', earlyStoppingOptions: any = {}) {
  return await fetchWithRetry(`${API_BASE_URL}/mlp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      X, y, train_percent: trainPercent,
      task_type: taskType,
      hidden_layers: hiddenLayers,
      activation, optimizer,
      learning_rate: learningRate,
      epochs, batch_size: batchSize,
      early_stopping: earlyStoppingOptions.enabled || false,
      patience: earlyStoppingOptions.patience || 10,
      min_delta: earlyStoppingOptions.minDelta || 0.0001,
      validation_split: earlyStoppingOptions.validationSplit || 0.2,
      feature_names: featureNames,
      target_name: targetName
    })
  });
}

export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}
