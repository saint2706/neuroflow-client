import React from 'react';
import {
  FaTable, FaFileCsv, FaDatabase,
  FaFilter, FaChartLine, FaCogs, FaRandom,
  FaBrain, FaProjectDiagram, FaLayerGroup,
  FaChartBar, FaChartPie,
  FaCog, FaTools
} from 'react-icons/fa';
import { cn } from '../../utils/cn';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';
import { ScrollArea } from "./scroll-area"
import { Separator } from "./separator"
import { Badge } from "./badge"

const Sidebar = ({ className }: { className?: string }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeName: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-name', nodeName);
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeCategories = {
    'File Loading': {
      icon: FaFileCsv,
      nodes: [
        { type: 'csvReader', name: 'CSV Reader', icon: FaTable, description: 'Import CSV data' },
        { type: 'databaseReader', name: 'Database Reader', icon: FaDatabase, description: 'Connect to SQL DB' },
      ],
    },
    'Data Preprocessing': {
      icon: FaFilter,
      nodes: [
        { type: 'dataCleaner', name: 'Data Cleaner', icon: FaCogs, description: 'Handle missing values' },
        { type: 'encoder', name: 'Encoder', icon: FaCogs, description: 'One-hot / Label encoding' },
        { type: 'normalizer', name: 'Normalizer', icon: FaChartLine, description: 'Scale features' },
        { type: 'featureSelector', name: 'Feature Selector', icon: FaTools, description: 'Select best features' },
        { type: 'dataTypeConverter', name: 'Type Converter', icon: FaRandom, description: 'Cast column types' },
      ],
    },
    'Dimensionality Reduction': {
      icon: FaProjectDiagram,
      nodes: [
        { type: 'pca', name: 'PCA', icon: FaProjectDiagram, description: 'Principal Component Analysis' },
        { type: 'svd', name: 'SVD', icon: FaProjectDiagram, description: 'Singular Value Decomposition' },
      ],
    },
    'Regression Models': {
      icon: FaChartLine,
      nodes: [
        { type: 'linearRegression', name: 'Linear Regression', icon: FaChartLine, description: 'Simple linear model' },
        { type: 'multiLinearRegression', name: 'Multi Linear Regression', icon: FaChartLine, description: 'Multiple variables' },
        { type: 'knnRegression', name: 'KNN Regression', icon: FaChartLine, description: 'K-Nearest Neighbors' },
        { type: 'polynomialRegression', name: 'Polynomial Regression', icon: FaChartBar, description: 'Non-linear curve fitting' },
      ],
    },
    'Classification': {
      icon: FaChartPie,
      nodes: [
        { type: 'logisticRegression', name: 'Logistic Regression', icon: FaChartLine, description: 'Binary classification' },
        { type: 'naiveBayes', name: 'Naive Bayes', icon: FaChartPie, description: 'Probabilistic classifier' },
        { type: 'knnClassification', name: 'KNN Classification', icon: FaChartPie, description: 'K-Nearest Neighbors' },
      ],
    },
    'Clustering Models': {
      icon: FaChartPie,
      nodes: [
        { type: 'kMeans', name: 'K-Means', icon: FaChartPie, description: 'Centroid-based clustering' },
        { type: 'hierarchicalClustering', name: 'Hierarchical Clustering', icon: FaLayerGroup, description: 'Tree-based clustering' },
        { type: 'dbscan', name: 'DBSCAN', icon: FaProjectDiagram, description: 'Density-based clustering' },
      ],
    },
    'Neural Networks': {
      icon: FaBrain,
      nodes: [
        { type: 'mlp', name: 'Multi-Layer Perceptron', icon: FaBrain, description: 'Feed-forward neural net' },
      ],
    },
    'Visualization': {
      icon: FaChartBar,
      nodes: [
        { type: 'modelVisualizer', name: 'Model Visualizer', icon: FaChartLine, description: 'Visualize model performance' },
        { type: 'dataVisualizer', name: 'Data Visualizer', icon: FaChartPie, description: 'Histograms & distributions' },
        { type: 'visualizer', name: 'Generic Visualizer', icon: FaChartPie, description: 'General purpose plots' },
      ],
    },
    'Miscellaneous': {
      icon: FaCog,
      nodes: [
        { type: 'describeNode', name: 'Describe Node', icon: FaTable, description: 'Statistical summary' },
        { type: 'evaluator', name: 'Model Evaluator', icon: FaChartBar, description: 'Compare model metrics' },
      ],
    },
  };

  const filteredCategories = React.useMemo(() => {
    if (!searchQuery) return nodeCategories;

    const lowerQuery = searchQuery.toLowerCase();
    const result: Partial<typeof nodeCategories> = {};

    Object.entries(nodeCategories).forEach(([catName, catData]) => {
      const matchingNodes = catData.nodes.filter(node =>
        node.name.toLowerCase().includes(lowerQuery) ||
        (node.description && node.description.toLowerCase().includes(lowerQuery))
      );

      if (matchingNodes.length > 0) {
        // @ts-ignore
        result[catName] = { ...catData, nodes: matchingNodes };
      }
    });

    return result;
  }, [searchQuery]);

  return (
    <aside className={cn("w-72 bg-background border-r border-border h-full flex flex-col transition-all duration-300 ease-in-out z-40 relative", className)}>
      <div className="p-4 border-b border-border space-y-4">
        <div className="relative group">
          <FaFilter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search nodes..."
            className="w-full bg-secondary/50 border border-transparent focus:border-primary/20 hover:bg-secondary/80 rounded-md pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
            onChange={(e) => setSearchQuery(e.target.value)}
            value={searchQuery}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <Accordion type="multiple" defaultValue={['File Loading', 'Data Preprocessing', 'Visualization']} className="w-full space-y-3">
          {Object.keys(filteredCategories).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No nodes found
            </div>
          ) : (
            Object.entries(filteredCategories).map(([categoryName, categoryData]) => (
              <AccordionItem value={categoryName} key={categoryName} className="border-b-0">
                <AccordionTrigger className="hover:no-underline py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors group data-[state=open]:bg-secondary/50 mx-1">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-secondary text-primary group-hover:bg-primary/10 transition-colors">
                      <categoryData.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors">{categoryName}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-1 px-1">
                  <div className="grid grid-cols-1 gap-1.5">
                    {categoryData.nodes.map((node) => (
                      <div
                        key={node.type}
                        className="flex items-start gap-3 p-3 rounded-md border border-transparent hover:border-border hover:bg-white hover:shadow-sm cursor-grab active:cursor-grabbing group/item transition-all duration-200"
                        onDragStart={(event) => onDragStart(event, node.type, node.name)}
                        draggable
                      >
                        <div className="mt-0.5 p-1 rounded bg-secondary text-muted-foreground group-hover/item:text-primary transition-colors">
                          <node.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium leading-none text-foreground/90 group-hover/item:text-primary transition-colors">{node.name}</span>
                          {node.description && (
                            <span className="text-[10px] text-muted-foreground/70 leading-snug line-clamp-2">{node.description}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))
          )}
        </Accordion>
      </ScrollArea>
      <div className="p-4 border-t border-border">
        <Badge variant="secondary" className="w-full justify-between items-center py-1.5 px-3 text-xs font-normal bg-secondary/50 text-muted-foreground">
          <span>v1.0.0 Alpha</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">Online</span>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50 animate-pulse" />
          </div>
        </Badge>
      </div>
    </aside>
  );
};

export default Sidebar;