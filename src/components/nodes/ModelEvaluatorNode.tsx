import React, { useMemo, useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import './ModelEvaluatorNode.css';
import ClickToEditInput from '../ui/ClickToEditInput';
import InfoButton from '../ui/InfoButton';
import { FaCalculator, FaChartLine, FaTag, FaProjectDiagram, FaNetworkWired, FaPlay, FaArrowRight, FaLightbulb, FaCheck, FaExclamationTriangle, FaBrain, FaLayerGroup, FaChevronDown, FaChevronUp, FaInfoCircle } from 'react-icons/fa';

// Sigmoid function for logistic regression
function sigmoid(z) {
  // Clip z to prevent overflow
  z = Math.max(-500, Math.min(500, z));
  return 1 / (1 + Math.exp(-z));
}

// Distance calculation functions for KNN
function euclideanDistance(x1, x2) {
  return Math.sqrt(x1.reduce((sum, val, i) => sum + Math.pow(val - x2[i], 2), 0));
}

function manhattanDistance(x1, x2) {
  return x1.reduce((sum, val, i) => sum + Math.abs(val - x2[i]), 0);
}

function minkowskiDistance(x1, x2, p = 3) {
  return Math.pow(x1.reduce((sum, val, i) => sum + Math.pow(Math.abs(val - x2[i]), p), 0), 1 / p);
}

function chebyshevDistance(x1, x2) {
  return Math.max(...x1.map((val, i) => Math.abs(val - x2[i])));
}

function cosineSimilarityDistance(x1, x2) {
  const dotProduct = x1.reduce((sum, val, i) => sum + val * x2[i], 0);
  const norm1 = Math.sqrt(x1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(x2.reduce((sum, val) => sum + val * val, 0));



  if (norm1 === 0 || norm2 === 0) return 1.0;

  const cosineSim = dotProduct / (norm1 * norm2);
  return 1 - cosineSim;
}

// Helper for dimensionality reduction (PCA/SVD)
function applyPreprocessing(rawInputs, preprocessing) {
  if (!preprocessing || !preprocessing.mean || !preprocessing.components) return [];

  // 1. Convert object { "FeatA": 10, "FeatB": 20 } to array based on originalFeatures order
  const inputVector = preprocessing.originalFeatures.map(feat => {
    const val = rawInputs[feat];
    if (val === undefined || val === null || val === '') throw new Error(`Missing value for ${feat}`);
    const num = parseFloat(val);
    if (isNaN(num)) throw new Error(`Value for ${feat} exists but is not a valid number`);
    return num;
  });

  // 2. Standardize: (x - mean) / std
  const mean = preprocessing.mean;
  const std = preprocessing.std; // Optional, might be null/empty if standardize=false

  // Check if std is valid array
  const useStd = std && std.length === inputVector.length;

  const standardized = inputVector.map((val, i) => {
    const m = mean[i] || 0;
    let s = 1;
    if (useStd) s = std[i];

    if (s === 0 || s === null) return val - m;
    return (val - m) / s;
  });

  // 3. Project: Dot product with components
  // components is array of arrays (n_components x n_features)
  // transformed[j] = sum(standardized[i] * components[j][i])
  const transformed = preprocessing.components.map(componentVector => {
    return standardized.reduce((sum, val, i) => sum + val * componentVector[i], 0);
  });

  return transformed;
}
const ModelEvaluatorNode = ({ id, data, isConnectable }) => {
  const [inputValues, setInputValues] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState('');

  // Find upstream model node
  const upstreamModel = useStore(
    (store) => {
      const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
      for (const e of incoming) {
        const src = store.nodeInternals.get(e.source);
        if (src?.type === 'linearRegression' ||
          src?.type === 'multiLinearRegression' ||
          src?.type === 'polynomialRegression' ||
          src?.type === 'logisticRegression' ||
          src?.type === 'knnRegression' ||
          src?.type === 'knnClassification' ||
          src?.type === 'naiveBayes' ||
          src?.type === 'kMeans' ||
          src?.type === 'hierarchicalClustering' ||
          src?.type === 'dbscan' ||
          src?.type === 'mlp' ||
          src?.type === 'dataTypeConverter') {
          const modelData = src.data?.model;
          // Return the model data even if it's null/undefined, so we can detect when it changes
          return {
            type: src.type,
            model: modelData,
            nodeId: src.id,
            // Include a hash of model data to force re-render when model changes
            modelHash: modelData ? JSON.stringify(modelData) : null
          };
        }
      }
      return null;
    },
    // Custom equality function to prevent re-renders when the object content hasn't changed
    (prev, next) => {
      if (prev === next) return true;
      if (!prev || !next) return false;
      return prev.type === next.type &&
        prev.nodeId === next.nodeId &&
        prev.modelHash === next.modelHash;
    }
  );

  // Determine model type and extract feature names
  // This will re-compute whenever upstreamModel changes (including modelHash)
  const modelInfo = useMemo(() => {
    if (!upstreamModel) return null;

    const { type, model } = upstreamModel;

    // If model is not available yet, return null
    if (!model) return null;

    if (type === 'linearRegression') {
      // Simple linear regression: one X variable
      // Validate that required model properties exist
      if (model.slope === undefined || model.intercept === undefined || !model.xCol) {
        return null;
      }

      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = [model.xCol || 'X'];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'linear',
        featureNames: displayFeatures, // Show original features to user
        model: {
          slope: model.slope,
          intercept: model.intercept,
          preprocessing: model.preprocessing,
          // We need to know which PC corresponds to xCol ('PC1' -> index 0)
          // Assuming xCol is like "PC1", "Component_1"
          targetPCIndex: (model.xCol.toLowerCase().startsWith('pc') || model.xCol.toLowerCase().startsWith('component'))
            ? parseInt(model.xCol.replace(/[^0-9]/g, '')) - 1
            : 0
        }
      };
    } else if (type === 'multiLinearRegression') {
      // Multi linear regression: multiple X variables
      // Validate that required model properties exist
      if (!model.coefficients || !Array.isArray(model.coefficients) ||
        model.coefficients.length === 0 || model.intercept === undefined ||
        !model.xCols || model.xCols.length === 0) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'multiLinear',
        featureNames: displayFeatures, // Show original features to user
        model: {
          coefficients: model.coefficients || [],
          intercept: model.intercept,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'logisticRegression') {
      // Logistic regression: multiple X variables
      // Validate that required model properties exist
      if (!model.coefficients || !Array.isArray(model.coefficients) ||
        model.coefficients.length === 0 || model.intercept === undefined ||
        !model.xCols || model.xCols.length === 0) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'logistic',
        featureNames: displayFeatures, // Show original features to user
        model: {
          coefficients: model.coefficients || [],
          intercept: model.intercept,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'knnRegression') {
      // KNN regression: requires training data for predictions
      // Validate that required model properties exist
      if (!model.k || !model.distance_metric ||
        !model.xCols || model.xCols.length === 0 ||
        !model.X_train || !model.y_train) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'knn',
        featureNames: displayFeatures, // Show original features to user
        model: {
          k: model.k,
          distance_metric: model.distance_metric,
          yCol: model.yCol,
          X_train: model.X_train,
          y_train: model.y_train,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'polynomialRegression') {
      // Polynomial regression: multiple X variables with polynomial features
      // Validate that required model properties exist
      if (!model.coefficients || !Array.isArray(model.coefficients) ||
        model.coefficients.length === 0 || model.intercept === undefined ||
        !model.xCols || model.xCols.length === 0 ||
        model.degree === undefined) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'polynomial',
        featureNames: displayFeatures, // Show original features to user
        model: {
          coefficients: model.coefficients || [],
          intercept: model.intercept,
          degree: model.degree,
          n_features_original: model.n_features_original,
          n_features_poly: model.n_features_poly,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'knnClassification') {
      // KNN classification: requires training data for predictions
      if (!model.k || !model.distance_metric ||
        !model.xCols || model.xCols.length === 0 ||
        !model.X_train || !model.y_train) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'knnClassification',
        featureNames: displayFeatures, // Show original features to user
        model: {
          k: model.k,
          distance_metric: model.distance_metric,
          yCol: model.yCol,
          X_train: model.X_train,
          y_train: model.y_train,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'naiveBayes') {
      // Naive Bayes classification: requires class statistics
      if (!model.xCols || model.xCols.length === 0 ||
        !model.class_means || !model.class_vars || !model.class_priors ||
        !model.classes) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'naiveBayes',
        featureNames: displayFeatures, // Show original features to user
        model: {
          yCol: model.yCol,
          classes: model.classes,
          class_means: model.class_means,
          class_vars: model.class_vars,
          class_priors: model.class_priors,
          alpha: model.alpha,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'kMeans') {
      // K-Means clustering
      if (!model.selectedFeatures || model.selectedFeatures.length === 0 ||
        !model.clusterCenters || !model.nClusters) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.selectedFeatures || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'kMeans',
        featureNames: displayFeatures, // Show original features to user
        model: {
          clusterCenters: model.clusterCenters,
          nClusters: model.nClusters,
          distanceMetric: model.distanceMetric || 'euclidean',
          X_mean: model.X_mean,
          X_std: model.X_std,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'hierarchicalClustering') {
      // Hierarchical Clustering
      if (!model.selectedFeatures || model.selectedFeatures.length === 0 ||
        !model.clusterRepresentatives || !model.nClusters) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.selectedFeatures || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'hierarchicalClustering',
        featureNames: displayFeatures, // Show original features to user
        model: {
          clusterRepresentatives: model.clusterRepresentatives,
          nClusters: model.nClusters,
          distanceMetric: model.distanceMetric || 'euclidean',
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'dbscan') {
      // DBSCAN Clustering
      if (!model.selectedFeatures || model.selectedFeatures.length === 0 ||
        !model.coreSamples || model.eps === undefined) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.selectedFeatures || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'dbscan',
        featureNames: displayFeatures, // Show original features to user
        model: {
          coreSamples: model.coreSamples,
          coreSampleLabels: model.coreSampleLabels,
          eps: model.eps,
          minSamples: model.minSamples,
          distanceMetric: model.distanceMetric || 'euclidean',
          X_mean: model.X_mean,
          X_std: model.X_std,
          minkowskiP: model.minkowskiP,
          preprocessing: model.preprocessing
        }
      };
    } else if (type === 'mlp') {
      // MLP (Multi-Layer Perceptron)
      if (!model.xCols || model.xCols.length === 0 ||
        !model.architecture || !model.weights || !model.biases ||
        !model.task_type) {
        return null;
      }
      // Handle preprocessing pipeline (PCA/SVD)
      let displayFeatures = model.xCols || [];
      if (model.preprocessing && model.preprocessing.originalFeatures) {
        displayFeatures = model.preprocessing.originalFeatures;
      }
      return {
        type: 'mlp',
        featureNames: displayFeatures, // Show original features to user
        model: {
          task_type: model.task_type,
          architecture: model.architecture,
          weights: model.weights,
          biases: model.biases,
          yCol: model.yCol,
          classes: model.classes,
          preprocessing: model.preprocessing
        }
      };
    }

    return null;
  }, [upstreamModel]);

  // Initialize input values when model changes or is retrained
  // This effect runs whenever modelInfo changes (which happens when modelHash changes)
  React.useEffect(() => {
    if (modelInfo && modelInfo.featureNames) {
      setInputValues(prev => {
        const initialValues = {};
        const currentFeatureNames = modelInfo.featureNames;

        // Check if feature names have changed (model retrained with different features)
        const featureNamesChanged = currentFeatureNames.some(f => !(f in prev)) ||
          Object.keys(prev).some(f => !currentFeatureNames.includes(f));

        if (featureNamesChanged) {
          // If features changed, clear all inputs
          currentFeatureNames.forEach(feature => {
            initialValues[feature] = '';
          });
        } else {
          // If features are the same, preserve existing values
          currentFeatureNames.forEach(feature => {
            initialValues[feature] = prev[feature] || '';
          });
        }
        return initialValues;
      });
      // Clear prediction when model changes
      setPrediction(null);
      setError('');
    } else if (upstreamModel && !upstreamModel.model) {
      // Model node exists but model is not trained yet
      setInputValues({});
      setPrediction(null);
      setError('');
    }
  }, [modelInfo, upstreamModel]);

  const numericRegex = /^-?\d*\.?\d*$/;

  const handleInputChange = (feature, value) => {
    // Allow empty, "-", ".", "-.", or any partial numeric input
    if (value === "" || numericRegex.test(value)) {
      setInputValues(prev => ({
        ...prev,
        [feature]: value
      }));
    }
  };

  const calculatePrediction = () => {
    if (!modelInfo) {
      setError('No model connected. Please connect a trained model node.');
      return;
    }

    try {
      const { type, featureNames, model } = modelInfo;

      // Validate all inputs are provided
      // Validate and prepare inputs
      let values;

      if (model.preprocessing) {
        // PIPELINE MODE: Inputs are Original Features
        const rawInputs = {};
        modelInfo.featureNames.forEach(feature => { // featureNames are Original Features
          const val = inputValues[feature];
          if (val === '' || val === null || val === undefined) {
            throw new Error(`Please enter a value for ${feature}`);
          }
          rawInputs[feature] = val; // ApplyPreprocessing does parsing
        });

        // Apply transformation (Standardize + Project)
        // Returns [PC1, PC2, ...]
        values = applyPreprocessing(rawInputs, model.preprocessing);

      } else {
        // DIRECT MODE: Inputs are model features
        values = featureNames.map(feature => {
          const value = inputValues[feature];
          if (value === '' || value === null || value === undefined) {
            throw new Error(`Please enter a value for ${feature}`);
          }
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            throw new Error(`${feature} must be a valid number`);
          }
          return numValue;
        });
      }

      let result;

      if (type === 'linear') {
        // Simple linear regression: y = slope * x + intercept
        // If preprocessing, values is [PC1, PC2...]. We need the specific PC used for training.
        let x = values[0];
        if (model.preprocessing) {
          // Use the target PC index we calculated in modelInfo
          // Default to 0 if undefined
          const idx = model.targetPCIndex || 0;
          if (idx < values.length) x = values[idx];
        } else {
          x = values[0];
        }
        result = {
          type: 'linear',
          prediction: model.slope * x + model.intercept,
          equation: `y = ${model.slope.toFixed(4)} × ${x} + ${model.intercept.toFixed(4)} = ${(model.slope * x + model.intercept).toFixed(4)}`
        };
      } else if (type === 'multiLinear') {
        // Multi linear regression: y = intercept + sum(coefficients[i] * x[i])
        // When preprocessing: values = [PC1, PC2, ...], coefficients match PCs
        // When no preprocessing: values = original features, coefficients match features

        // Validate intercept
        if (model.intercept === undefined || model.intercept === null || !Number.isFinite(model.intercept)) {
          throw new Error('Model intercept is invalid');
        }

        let sum = model.intercept;
        const terms = [`${model.intercept.toFixed(4)}`];

        // Iterate over coefficients (not featureNames) to handle preprocessing correctly
        for (let i = 0; i < model.coefficients.length && i < values.length; i++) {
          const term = model.coefficients[i] * values[i];
          sum += term;
          terms.push(`${model.coefficients[i].toFixed(4)} × ${values[i].toFixed(4)}`);
        }

        result = {
          type: 'multiLinear',
          prediction: sum,
          equation: `y = ${terms.join(' + ')} = ${sum.toFixed(4)}`
        };
      } else if (type === 'logistic') {
        // Logistic regression: probability = sigmoid(intercept + sum(coefficients[i] * x[i]))
        // When preprocessing: values = [PC1, PC2, ...], coefficients match PCs
        // When no preprocessing: values = original features, coefficients match features
        let linearSum = model.intercept;

        // Iterate over coefficients (not featureNames) to handle preprocessing correctly
        for (let i = 0; i < model.coefficients.length && i < values.length; i++) {
          linearSum += model.coefficients[i] * values[i];
        }
        const probability = sigmoid(linearSum);
        const prediction = probability >= 0.5 ? 1 : 0;
        result = {
          type: 'logistic',
          prediction: prediction,
          probability: probability,
          equation: `P(y=1) = sigmoid(${linearSum.toFixed(4)}) = ${probability.toFixed(4)}`,
          interpretation: `Predicted class: ${prediction} (${(probability * 100).toFixed(2)}% probability)`
        };
      } else if (type === 'polynomial') {
        // Polynomial regression: generate polynomial features and compute prediction
        // Generate polynomial features from input values
        const generatePolynomialFeatures = (X, degree) => {
          const features = [1]; // bias term
          const n = X.length;

          // Add original features (degree 1)
          for (let i = 0; i < n; i++) {
            features.push(X[i]);
          }

          // Generate higher degree features
          if (degree > 1) {
            for (let d = 2; d <= degree; d++) {
              // Generate all combinations with replacement
              const generateCombinations = (arr, size, start = 0, current = []) => {
                if (current.length === size) {
                  // Calculate product of features
                  let product = 1;
                  for (const idx of current) {
                    product *= arr[idx];
                  }
                  features.push(product);
                  return;
                }
                for (let i = start; i < arr.length; i++) {
                  generateCombinations(arr, size, i, [...current, i]);
                }
              };
              generateCombinations(X, d);
            }
          }

          return features;
        };

        const polyFeatures = generatePolynomialFeatures(values, model.degree);

        // Compute prediction: sum of (coefficient * feature)
        let sum = 0;
        for (let i = 0; i < model.coefficients.length && i < polyFeatures.length; i++) {
          sum += model.coefficients[i] * polyFeatures[i];
        }

        result = {
          type: 'polynomial',
          prediction: sum,
          degree: model.degree,
          n_features_original: model.n_features_original,
          n_features_poly: model.n_features_poly
        };
      } else if (type === 'knn') {
        // KNN regression: find K nearest neighbors and average their values
        const inputPoint = values; // User's input values (transformed if preprocessing)

        console.log('[KNN Debug] Input point:', inputPoint);
        console.log('[KNN Debug] X_train sample:', model.X_train.slice(0, 3));
        console.log('[KNN Debug] y_train sample:', model.y_train.slice(0, 10));
        console.log('[KNN Debug] K:', model.k);
        console.log('[KNN Debug] Distance metric:', model.distance_metric);

        // Select distance function based on metric
        const distanceFunctions = {
          'euclidean': euclideanDistance,
          'manhattan': manhattanDistance,
          'minkowski': minkowskiDistance,
          'chebyshev': chebyshevDistance,
          'cosine': cosineSimilarityDistance
        };

        const distanceFunc = distanceFunctions[model.distance_metric] || euclideanDistance;

        // Calculate distances to all training points
        const distances = model.X_train.map((trainPoint, idx) => ({
          distance: distanceFunc(inputPoint, trainPoint),
          yValue: model.y_train[idx]
        }));

        console.log('[KNN Debug] First 5 distances:', distances.slice(0, 5));

        // Sort by distance and get K nearest neighbors
        distances.sort((a, b) => a.distance - b.distance);
        const kNearest = distances.slice(0, model.k);

        console.log('[KNN Debug] K nearest:', kNearest);

        // Average the y values of K nearest neighbors
        const prediction = kNearest.reduce((sum, neighbor) => sum + neighbor.yValue, 0) / model.k;

        console.log('[KNN Debug] Final prediction:', prediction);

        result = {
          type: 'knn',
          prediction: prediction,
          yCol: model.yCol,
          k: model.k,
          distance_metric: model.distance_metric,
          nearestDistances: kNearest.map(n => n.distance.toFixed(4))
        };
      } else if (type === 'knnClassification') {
        // KNN classification: find K nearest neighbors and use majority vote
        const inputPoint = values; // User's input values

        // Select distance function based on metric
        const distanceFunctions = {
          'euclidean': euclideanDistance,
          'manhattan': manhattanDistance,
          'minkowski': minkowskiDistance,
          'chebyshev': chebyshevDistance,
          'cosine': cosineSimilarityDistance
        };

        const distanceFunc = distanceFunctions[model.distance_metric] || euclideanDistance;

        // Calculate distances to all training points
        const distances = model.X_train.map((trainPoint, idx) => ({
          distance: distanceFunc(inputPoint, trainPoint),
          classLabel: model.y_train[idx]
        }));

        // Sort by distance and get K nearest neighbors
        distances.sort((a, b) => a.distance - b.distance);
        const kNearest = distances.slice(0, model.k);

        // Majority vote - count occurrences of each class
        const classCounts: Record<string, number> = {};
        kNearest.forEach(neighbor => {
          const label = neighbor.classLabel;
          classCounts[label] = (classCounts[label] || 0) + 1;
        });

        // Find the class with the most votes
        let predictedClass = null;
        let maxVotes = 0;
        for (const [classLabel, count] of Object.entries(classCounts)) {
          if (count > maxVotes) {
            maxVotes = count;
            predictedClass = parseFloat(classLabel);
          }
        }

        result = {
          type: 'knnClassification',
          prediction: predictedClass,
          yCol: model.yCol,
          k: model.k,
          distance_metric: model.distance_metric,
          votes: classCounts,
          confidence: (maxVotes / model.k * 100).toFixed(1)
        };
      } else if (type === 'naiveBayes') {
        // Naive Bayes classification: calculate probabilities for each class
        const inputPoint = values;

        // Calculate log probability for each class
        const logProbs: Record<string, number> = {};
        const probs: Record<string, number> = {};

        model.classes.forEach(cls => {
          // Start with log prior
          let logProb = Math.log(model.class_priors[cls]);

          // Add log likelihood for each feature
          inputPoint.forEach((value, idx) => {
            const mean = model.class_means[cls][idx];
            const variance = Math.max(model.class_vars[cls][idx], 1e-10);

            // Log of Gaussian PDF
            logProb += -0.5 * Math.log(2 * Math.PI * variance);
            logProb += -0.5 * Math.pow(value - mean, 2) / variance;
          });

          logProbs[cls] = logProb;
        });

        // Convert log probabilities to probabilities using softmax
        const maxLogProb = Math.max(...Object.values(logProbs));
        let sumExp = 0;

        model.classes.forEach(cls => {
          const shifted = logProbs[cls] - maxLogProb;
          probs[cls] = Math.exp(shifted);
          sumExp += probs[cls];
        });

        // Normalize probabilities
        model.classes.forEach(cls => {
          probs[cls] = probs[cls] / sumExp;
        });

        // Find class with highest probability
        let predictedClass = null;
        let maxProb = 0;

        for (const [cls, prob] of Object.entries(probs)) {
          if (prob > maxProb) {
            maxProb = prob;
            predictedClass = parseFloat(cls);
          }
        }

        result = {
          type: 'naiveBayes',
          prediction: predictedClass,
          yCol: model.yCol,
          probabilities: probs,
          confidence: (maxProb * 100).toFixed(1),
          alpha: model.alpha
        };
      } else if (type === 'kMeans') {
        // K-Means clustering prediction
        // 1. Normalize input if scaling parameters exist
        let processedValues = [...values];

        if (model.X_mean && model.X_std) {
          processedValues = values.map((val, i) => {
            if (model.X_std[i] === 0) return val - model.X_mean[i];
            return (val - model.X_mean[i]) / model.X_std[i];
          });
        }

        // 2. Calculate distance to each centroid
        const distanceFunctions = {
          'euclidean': euclideanDistance,
          'manhattan': manhattanDistance,
          'minkowski': (x1, x2) => minkowskiDistance(x1, x2, model.minkowskiP || 3),
          'chebyshev': chebyshevDistance,
          'cosine': cosineSimilarityDistance
        };
        const distanceFunc = distanceFunctions[model.distance_metric] || euclideanDistance;

        let minDistance = Infinity;
        let closestCluster = -1;
        const distances = [];

        model.clusterCenters.forEach((center, idx) => {
          const dist = distanceFunc(processedValues, center);
          distances.push(dist);
          if (dist < minDistance) {
            minDistance = dist;
            closestCluster = idx;
          }
        });

        result = {
          type: 'kMeans',
          prediction: closestCluster,
          distances: distances,
          closestDistance: minDistance,
          representative: model.clusterCenters[closestCluster]
        };
      } else if (type === 'dbscan') {
        // DBSCAN Prediction
        // We need to compare to core samples

        // 1. Process/Scale input
        let xToCheck = [...values];
        if (model.X_mean && model.X_std) {
          xToCheck = values.map((val, idx) => {
            const mean = model.X_mean[idx] || 0;
            const std = model.X_std[idx] || 1;
            return (val - mean) / std;
          });
        }

        // 3. Scale core samples (they are stored in original scale)
        const coreSamplesScaled = model.coreSamples.map(sample => {
          return sample.map((val, idx) => {
            const mean = model.X_mean[idx] || 0;
            const std = model.X_std[idx] || 1;
            return (val - mean) / std;
          });
        });

        // 4. Find closest core sample
        let minDistance = Infinity;
        let closestCoreIndex = -1;

        let distFunc = euclideanDistance;
        if (model.distanceMetric === 'manhattan') distFunc = manhattanDistance;
        else if (model.distanceMetric === 'chebyshev') distFunc = chebyshevDistance;
        else if (model.distanceMetric === 'cosine') distFunc = cosineSimilarityDistance;
        else if (model.distanceMetric === 'minkowski') distFunc = (a, b) => minkowskiDistance(a, b, model.minkowskiP || 3);

        const clusterDistances = {};

        for (let i = 0; i < coreSamplesScaled.length; i++) {
          const dist = distFunc(xToCheck, coreSamplesScaled[i]);
          const label = model.coreSampleLabels[i];

          if (label !== -1) {
            if (clusterDistances[label] === undefined || dist < clusterDistances[label]) {
              clusterDistances[label] = dist;
            }
          }

          if (dist < minDistance) {
            minDistance = dist;
            closestCoreIndex = i;
          }
        }

        // 5. Check epsilon
        let prediction = -1; // Noise
        if (minDistance <= model.eps) {
          prediction = model.coreSampleLabels[closestCoreIndex];
        }

        result = {
          type: 'dbscan',
          prediction: prediction,
          closestDistance: minDistance,
          closestCoreSample: closestCoreIndex !== -1 ? model.coreSamples[closestCoreIndex] : null,
          eps: model.eps,
          clusterDistances: clusterDistances
        };
      } else if (type === 'hierarchicalClustering') {
        // Hierarchical Clustering prediction
        // Calculate distance to each cluster representative (mean)
        const distanceFunctions = {
          'euclidean': euclideanDistance,
          'manhattan': manhattanDistance,
          'cosine': cosineSimilarityDistance
        };
        const distanceFunc = distanceFunctions[model.distanceMetric] || euclideanDistance;

        let minDistance = Infinity;
        let closestCluster = -1;
        const distances = [];

        model.clusterRepresentatives.forEach((representative, idx) => {
          const dist = distanceFunc(values, representative);
          distances.push(dist);
          if (dist < minDistance) {
            minDistance = dist;
            closestCluster = idx;
          }
        });

        result = {
          type: 'hierarchicalClustering',
          prediction: closestCluster,
          distances: distances,
          closestDistance: minDistance,
          representative: model.clusterRepresentatives[closestCluster]
        };
      } else if (type === 'mlp') {
        // MLP (Multi-Layer Perceptron) prediction
        // Implement forward pass through the network

        // Helper functions for activations
        const relu = (z) => Math.max(0, z);
        const tanh = (z) => Math.tanh(z);
        const sigmoidActivation = (z) => sigmoid(z);

        const softmax = (z) => {
          const maxZ = Math.max(...z);
          const expZ = z.map(val => Math.exp(val - maxZ));
          const sumExpZ = expZ.reduce((a, b) => a + b, 0);
          return expZ.map(val => val / sumExpZ);
        };

        const applyActivation = (z, activationName) => {
          if (activationName === 'relu') return relu(z);
          if (activationName === 'tanh') return tanh(z);
          if (activationName === 'sigmoid') return sigmoidActivation(z);
          return z;
        };

        // Forward pass
        let activations = values; // Input layer

        // Pass through hidden layers
        for (let i = 0; i < model.weights.length - 1; i++) {
          const weights = model.weights[i];
          const biases = model.biases[i];

          // Compute z = W * a + b
          const z = [];
          for (let j = 0; j < weights[0].length; j++) {
            let sum = biases[0][j];
            for (let k = 0; k < activations.length; k++) {
              sum += activations[k] * weights[k][j];
            }
            z.push(sum);
          }

          // Apply activation function
          activations = z.map(val => applyActivation(val, model.architecture.activation));
        }

        // Output layer
        const lastWeights = model.weights[model.weights.length - 1];
        const lastBiases = model.biases[model.biases.length - 1];

        const outputZ = [];
        for (let j = 0; j < lastWeights[0].length; j++) {
          let sum = lastBiases[0][j];
          for (let k = 0; k < activations.length; k++) {
            sum += activations[k] * lastWeights[k][j];
          }
          outputZ.push(sum);
        }

        // Apply output activation based on task type
        let output;
        let predictedValue;
        let probabilities = null;

        if (model.task_type === 'regression') {
          // Linear output for regression
          output = outputZ[0];
          predictedValue = output;
        } else if (model.task_type === 'binary_classification') {
          // Sigmoid for binary classification
          output = sigmoid(outputZ[0]);
          predictedValue = output >= 0.5 ? 1 : 0;
          probabilities = [1 - output, output];
          if (model.classes) {
            predictedValue = model.classes[predictedValue];
          }
        } else if (model.task_type === 'multiclass_classification') {
          // Softmax for multiclass
          probabilities = softmax(outputZ);
          const predictedIndex = probabilities.indexOf(Math.max(...probabilities));
          predictedValue = model.classes ? model.classes[predictedIndex] : predictedIndex;
        }

        result = {
          type: 'mlp',
          prediction: predictedValue,
          yCol: model.yCol,
          task_type: model.task_type,
          architecture: model.architecture,
          probabilities: probabilities
        };
      }

      setShowDetails(true);
      setPrediction(result);
      setError('');
    } catch (err) {
      setError(err.message);
      setPrediction(null);
    }
  };


  // Determine icon and color based on model type
  const getHeaderInfo = () => {
    if (!modelInfo) return { icon: <FaCalculator />, color: '#6366f1', label: 'Model Evaluator' };

    switch (modelInfo.type) {
      case 'linear':
      case 'multiLinear':
      case 'polynomial':
        return { icon: <FaChartLine />, color: '#3b82f6', label: 'Regression Model' };
      case 'logistic':
      case 'knnClassification':
      case 'naiveBayes':
        return { icon: <FaTag />, color: '#8b5cf6', label: 'Classification Model' };
      case 'kMeans':
      case 'hierarchicalClustering':
      case 'dbscan':
        return { icon: <FaLayerGroup />, color: '#ec4899', label: 'Clustering Model' };
      case 'mlp':
        return { icon: <FaBrain />, color: '#f59e0b', label: 'Neural Network' };
      default:
        return { icon: <FaCalculator />, color: '#6366f1', label: 'Model Evaluator' };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="model-evaluator-node">
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />

      {/* 1. Header Section */}
      <div className="me-header" style={{ background: `linear-gradient(135deg, ${header.color} 0%, ${header.color}dd 100%)` }}>
        <div className="me-header-main">
          <div className="me-header-icon">
            {header.icon}
          </div>
          <div className="me-header-info">
            <span className="me-title">{data.label || header.label}</span>
            <span className="me-subtitle">
              {upstreamModel ? 'Ready to Predict' : 'Waiting for Model'}
            </span>
          </div>
        </div>
        {upstreamModel && <div className="me-status-dot" title="Model Connected"></div>}
      </div>

      {!upstreamModel ? (
        <div className="me-placeholder">
          <div>Connect a trained model node to start evaluating predictions</div>
        </div>
      ) : !modelInfo ? (
        <div className="me-error">
          Model is connected but not trained yet. Please run the training node first.
        </div>
      ) : (
        <>
          {/* 2. Input Section */}
          <div className="me-input-section">
            <div className="me-section-title">
              <FaLightbulb color="#f59e0b" /> Input Features
            </div>
            <div className="me-input-grid">
              {modelInfo.featureNames.map((feature) => (
                <div key={feature} className="me-input-field">
                  <ClickToEditInput
                    label={feature}
                    value={inputValues[feature] || ''}
                    onChange={(val) => handleInputChange(feature, val)}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Pipeline Indicator (Only if preprocessing exists) */}
          {modelInfo.model.preprocessing && (
            <div className="me-pipeline">
              <div className="me-pipeline-step">Input</div>
              <FaArrowRight className="me-pipeline-arrow" />
              <div className="me-pipeline-step" title="Standardization applied">Standardize</div>
              <FaArrowRight className="me-pipeline-arrow" />
              <div className="me-pipeline-step" title={`${modelInfo.model.preprocessing.type.toUpperCase()} Projection applied`}>
                {modelInfo.model.preprocessing.type.toUpperCase()}
              </div>
              <FaArrowRight className="me-pipeline-arrow" />
              <div className="me-pipeline-step">Model</div>
            </div>
          )}

          {/* 4. Action Area */}
          <div className="me-actions">
            <button className="me-compute-btn" onClick={calculatePrediction}>
              <FaPlay style={{ fontSize: '0.8em' }} /> Compute Prediction
            </button>
          </div>

          {/* 5. Error Display */}
          {error && <div className="me-error">{error}</div>}

          {/* 6. Result Hero Section */}
          {/* 6. Result Hero Section (Always Visible) & 7. Details Panel (Collapsible) */}
          {prediction && (
            <>
              <div className="me-result-hero">
                {/* REGRESSION HERO */}
                {(prediction.type === 'linear' || prediction.type === 'multiLinear' || prediction.type === 'polynomial' || prediction.type === 'knn') && (
                  <>
                    <div className="me-result-label">Predicted Target</div>
                    <div className="me-result-value">
                      {prediction.prediction.toFixed(4)}
                    </div>
                  </>
                )}

                {/* CLASSIFICATION HERO */}
                {(prediction.type === 'logistic' || prediction.type === 'knnClassification' || prediction.type === 'naiveBayes') && (
                  <>
                    <div className="me-result-label">Predicted Class</div>
                    <div className="me-result-pill" style={{
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0'
                    }}>
                      Class {prediction.prediction}
                    </div>
                    {(prediction.confidence || prediction.probability) && (
                      <div className="me-hero-metric">
                        Confidence: <strong>{prediction.confidence || (prediction.probability * 100).toFixed(1)}%</strong>
                      </div>
                    )}
                  </>
                )}

                {/* CLUSTERING HERO */}
                {(prediction.type === 'kMeans' || prediction.type === 'hierarchicalClustering' || prediction.type === 'dbscan') && (
                  <>
                    <div className="me-result-label">Assigned Cluster</div>
                    {prediction.prediction === -1 ? (
                      <div className="me-result-pill" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>
                        Noise (-1)
                      </div>
                    ) : (
                      <div className="me-result-pill" style={{
                        background: `hsl(${(prediction.prediction * 137) % 360}, 70%, 95%)`,
                        color: `hsl(${(prediction.prediction * 137) % 360}, 70%, 40%)`,
                        border: `1px solid hsl(${(prediction.prediction * 137) % 360}, 70%, 85%)`
                      }}>
                        Cluster {prediction.prediction}
                      </div>
                    )}
                    <div className="me-hero-metric">
                      Dist to Centroid: <strong>{prediction.closestDistance.toFixed(4)}</strong>
                    </div>
                  </>
                )}

                {/* MLP HERO */}
                {prediction.type === 'mlp' && (
                  <>
                    <div className="me-result-label">
                      {prediction.task_type === 'regression' ? 'Predicted Value (MLP)' : 'Predicted Class (MLP)'}
                    </div>
                    {prediction.task_type === 'regression' ? (
                      <div className="me-result-value">{prediction.prediction.toFixed(4)}</div>
                    ) : (
                      <div className="me-result-pill" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                        Class {prediction.prediction}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* DETAILS PANEL */}
              <div className={`me-details-panel ${showDetails ? 'open' : ''}`}>
                <div className="me-details-header" onClick={() => setShowDetails(!showDetails)}>
                  <div className="me-details-title">
                    <FaInfoCircle /> Prediction Details
                  </div>
                  {showDetails ? <FaChevronUp /> : <FaChevronDown />}
                </div>

                <div className="me-details-content">
                  {/* REGRESSION DETAILS */}
                  {(prediction.type === 'linear' || prediction.type === 'multiLinear' || prediction.type === 'polynomial' || prediction.type === 'knn') && (
                    <div className="me-insight-grid">
                      <div className="me-insight-card">
                        <div className="me-insight-label">Method</div>
                        <div className="me-insight-value" style={{ fontSize: '0.9rem' }}>
                          {prediction.type === 'knn' ? `KNN (k=${prediction.k})` : 'Equation'}
                        </div>
                      </div>
                      {prediction.degree && (
                        <div className="me-insight-card">
                          <div className="me-insight-label">Degree</div>
                          <div className="me-insight-value">{prediction.degree}</div>
                        </div>
                      )}
                      {prediction.type === 'knn' && (
                        <div className="me-insight-card">
                          <div className="me-insight-label">Metric</div>
                          <div className="me-insight-value" style={{ fontSize: '0.85rem' }}>{prediction.distance_metric}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CLASSIFICATION DETAILS */}
                  {(prediction.type === 'logistic' || prediction.type === 'knnClassification' || prediction.type === 'naiveBayes') && (
                    <>
                      {(prediction.probabilities || prediction.votes) && (
                        <div className="me-probs-list">
                          <div className="me-insight-label" style={{ marginBottom: '8px' }}>
                            {prediction.votes ? 'Neighbor Votes' : 'Class Probabilities'}
                          </div>
                          {prediction.probabilities && Object.entries(prediction.probabilities as Record<string, number>).map(([key, val]) => (
                            <div key={key} className={`me-prob-row ${parseFloat(key) === prediction.prediction ? 'active' : ''}`}>
                              <span>Class {key}</span>
                              <span style={{ fontWeight: 600 }}>{(val * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                          {prediction.votes && Object.entries(prediction.votes as Record<string, number>).map(([key, val]) => (
                            <div key={key} className={`me-prob-row ${parseFloat(key) === prediction.prediction ? 'active' : ''}`}>
                              <span>Class {key}</span>
                              <span style={{ fontWeight: 600 }}>{val} votes</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {prediction.type === 'knnClassification' && (
                        <div className="me-insight-grid" style={{ marginTop: '12px' }}>
                          <div className="me-insight-card">
                            <div className="me-insight-label">K Neighbors</div>
                            <div className="me-insight-value">{prediction.k}</div>
                          </div>
                          <div className="me-insight-card">
                            <div className="me-insight-label">Metric</div>
                            <div className="me-insight-value" style={{ fontSize: '0.8rem' }}>{prediction.distance_metric}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* CLUSTERING DETAILS */}
                  {(prediction.type === 'kMeans' || prediction.type === 'hierarchicalClustering' || prediction.type === 'dbscan') && (
                    <>
                      {/* Cluster Profile */}
                      {(prediction.representative || prediction.closestCoreSample) && (
                        <div style={{ marginBottom: '20px' }}>
                          <div className="me-insight-label" style={{ marginBottom: '8px' }}>
                            {prediction.type === 'dbscan' ? 'Nearest Core Sample (Features)' : 'Cluster Profile (Centroid Features)'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                            {modelInfo.featureNames.map((feature, idx) => {
                              const val = prediction.representative ? prediction.representative[idx] : (prediction.closestCoreSample ? prediction.closestCoreSample[idx] : null);
                              return (
                                <div key={feature} className="me-insight-card" style={{ padding: '8px', alignItems: 'flex-start', textAlign: 'left' }}>
                                  <div style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={feature}>
                                    {feature}
                                  </div>
                                  <div style={{ fontWeight: '700', color: '#334155', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {val !== null && val !== undefined ? val.toFixed(4) : '-'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Distance to Other Clusters */}
                      {(prediction.distances || prediction.clusterDistances) && (
                        <div>
                          <div className="me-insight-label" style={{ marginBottom: '8px' }}>Distance to Other Clusters</div>
                          <div className="me-dist-bar-container">
                            {/* KMEANS / HIERARCHICAL LOGIC */}
                            {prediction.distances && prediction.distances.map((dist, idx) => {
                              const maxDist = Math.max(...prediction.distances) || 1;
                              const widthPerc = Math.max(5, (1 - (dist / (maxDist * 1.2))) * 100);
                              const isSelected = idx === prediction.prediction;
                              return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSelected ? 1 : 0.7 }}>
                                  <div style={{
                                    minWidth: '24px', height: '24px', borderRadius: '50%',
                                    backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'][idx % 10],
                                    color: 'white', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>{idx}</div>

                                  <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${widthPerc}%`, height: '100%', background: isSelected ? '#10b981' : '#cbd5e1' }}></div>
                                  </div>

                                  <div style={{ width: '50px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: isSelected ? '700' : '400' }}>
                                    {dist.toFixed(4)}
                                  </div>
                                </div>
                              );
                            })}

                            {/* DBSCAN LOGIC */}
                            {prediction.clusterDistances && Object.entries(prediction.clusterDistances as Record<string, number>)
                              .sort((a, b) => a[1] - b[1])
                              .slice(0, 5)
                              .map(([labelStr, dist]) => {
                                const label = parseInt(labelStr);
                                const maxDist = Math.max(...(Object.values(prediction.clusterDistances) as number[])) || 1;
                                const widthPerc = Math.max(5, (1 - (dist / (maxDist * 1.2))) * 100);
                                const isSelected = label === prediction.prediction;
                                return (
                                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSelected ? 1 : 0.7 }}>
                                    <div style={{
                                      minWidth: '24px', height: '24px', borderRadius: '50%',
                                      backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'][label % 10],
                                      color: 'white', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>{label}</div>
                                    <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${widthPerc}%`, height: '100%', background: isSelected ? '#10b981' : '#cbd5e1' }}></div>
                                    </div>
                                    <div style={{ width: '50px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: isSelected ? '700' : '400' }}>
                                      {dist.toFixed(4)}
                                    </div>
                                  </div>
                                );
                              })
                            }
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* MLP DETAILS */}
                  {prediction.type === 'mlp' && (
                    <>
                      {prediction.probabilities && (
                        <div className="me-probs-list" style={{ marginBottom: '16px' }}>
                          <div className="me-insight-label" style={{ marginBottom: '8px' }}>Class Probabilities</div>
                          {prediction.probabilities.map((prob, idx) => {
                            const className = prediction.task_type === 'binary_classification'
                              ? idx
                              : (modelInfo.model.classes ? modelInfo.model.classes[idx] : idx);
                            const isMax = prob === Math.max(...prediction.probabilities);
                            return (
                              <div key={idx} className={`me-prob-row ${isMax ? 'active' : ''}`}>
                                <span>Class {className}</span>
                                <span style={{ fontWeight: 600 }}>{(prob * 100).toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="me-insight-grid">
                        <div className="me-insight-card">
                          <div className="me-insight-label">Architecture</div>
                          <div className="me-insight-value" style={{ fontSize: '0.8rem' }}>{prediction.architecture.hidden_layers.join('-')}</div>
                        </div>
                        <div className="me-insight-card">
                          <div className="me-insight-label">Activation</div>
                          <div className="me-insight-value" style={{ fontSize: '0.8rem' }}>{prediction.architecture.activation}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

        </>
      )}

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
      <InfoButton nodeType="modelEvaluator" style={{ zIndex: 10 }} />
    </div>
  );
};

export default React.memo(ModelEvaluatorNode);