
export const nodeInfo = {
    // --- Data Input ---
    start: {
        title: 'Start Node',
        description: 'Start here! This is the launchpad for your data journey. Connect this first to get everything moving.',
        usage: [
            'Always place this at the beginning of a pipeline',
            'Connects to your initial data loading nodes'
        ],
        inputs: [],
        outputs: ['CSV Reader Node', 'Database Reader Node'],
        pipelineDetails: 'Think of this as the "On" button. A pipeline without a start is just a sketch; this node brings it to life and tells the system it\'s go-time!',
        exampleOutput: 'A green light that wakes up your data readers.',
        proTip: 'Give your workflow a fun name so you actually remember what "Project 12" does next week!',
        notes: 'Every great journey starts with a single step (and this node).'
    },
    csvReader: {
        title: 'CSV Reader Node',
        description: 'Got a spreadsheet? Drag and drop this node to load your Excel or CSV files into the app without any coding.',
        usage: [
            'Importing raw data from local files',
            'Starting a new analysis pipeline'
        ],
        inputs: ['Start Node'],
        outputs: ['Data Cleaner Node', 'Encoder Node', 'Normalizer Node', 'Describe Node'],
        pipelineDetails: 'Data is the fuel for your AI, and this is the pump. It sucks in your raw spreadsheet so the real magic can begin. It turns a static file into a living stream of info.',
        exampleOutput: 'A neat table showing your file contents (like 100 rows, 5 columns), ready for you to explore.',
        proTip: 'Peek at your file in Excel first—sometimes sneaky invisible symbols hide in the header!',
        notes: 'Double-check that your file actually has a header row'
    },
    databaseReader: {
        title: 'Database Reader Node',
        description: 'Have data stored in a database? Use this to plug directly into your SQL server and pull the data you need.',
        usage: [
            'Importing data from SQL databases',
            'Selecting specific subsets of data via queries'
        ],
        inputs: ['Start Node'],
        outputs: ['Data Cleaner Node', 'Encoder Node', 'Normalizer Node'],
        pipelineDetails: 'Why read yesterday’s paper when you can get the news live? Connecting to a DB means your analysis is always fresh and synced with your company’s latest numbers.',
        exampleOutput: 'A fresh slice of data directly from your SQL server, with rows like "User ID" and "Purchase Date".',
        proTip: 'Try not to pull the *entire* database at once. A little "WHERE" clause goes a long way to keeping things fast!',
        notes: 'You\'ll just need your login credentials to get in.'
    },

    // --- Data Preprocessing ---
    dataCleaner: {
        title: 'Data Cleaner Node',
        description: 'Data can be messy! Use this to fix missing info, remove duplicates, and polish your data so it\'s ready for action.',
        usage: [
            'Filling or dropping missing values (NaN)',
            'Removing duplicate rows',
            'Handling outliers'
        ],
        inputs: ['CSV Reader Node', 'Database Reader Node'],
        outputs: ['Encoder Node', 'Normalizer Node', 'Feature Selector Node'],
        pipelineDetails: 'Garbage in, garbage out! This is your quality assurance team. Before teaching AI anything, you need to make sure the textbook isn\'t missing pages or full of typos.',
        exampleOutput: 'A squeaky-clean table with no empty holes or duplicate mess.',
        proTip: 'Be careful with "Drop Missing Values"—you might accidentally delete half your data! Sometimes filling gaps with the "Average" is safer.',
        notes: 'Clean data is the secret ingredient for good results.'
    },
    dataTypeConverter: {
        title: 'Data Type Converter Node',
        description: 'Sometimes text looks like numbers. This node makes sure everything is labeled correctly so the computer doesn\'t get confused.',
        usage: [
            'Fixing incorrect data types inferred during load',
            'Preparing columns for mathematical operations'
        ],
        inputs: ['CSV Reader Node', 'Data Cleaner Node'],
        outputs: ['Encoder Node', 'Normalizer Node'],
        pipelineDetails: 'Imagine trying to do math with the word "Five" instead of the number 5. Frustrating, right? This node translates those formats so the computer can actually crunch the numbers.',
        exampleOutput: 'Columns that looked like text ("String") are now properly recognized as numbers ("Float" or "Integer").',
        proTip: 'If a number refuses to convert, check for hidden "$" signs or commas that might be confusing the system.',
        notes: 'Double-check these conversions—you don\'t want to lose data by accident.'
    },
    encoder: {
        title: 'Encoder Node',
        description: 'Computers love numbers, not words. This turns categories like "Red" or "Blue" into numbers the system can understand.',
        usage: [
            'Preparing string categories for machine learning',
            'Converting "Yes"/"No" to 1/0'
        ],
        inputs: ['Data Cleaner Node', 'Data Type Converter Node'],
        outputs: ['Normalizer Node', 'Feature Selector Node', 'Regression Nodes'],
        pipelineDetails: 'Models are basically giant calculators—they can\'t multiply "Cat" times "Dog". This translator turns your words into codes (like Cat=1, Dog=0) so the math works out.',
        exampleOutput: 'Your text columns (like "Color") are swapped out for numeric columns (like "Is_Red", "Is_Blue").',
        proTip: 'Watch out if you have a column with 1,000 different cities... encoding that will make your dataset massive!',
        notes: 'This bridges the gap between human language and computer math.'
    },
    normalizer: {
        title: 'Normalizer Node',
        description: 'Imagine comparing apples to watermelons. This node scales everything to the same size so your comparisons are fair and accurate.',
        usage: [
            'Scaling features with different units',
            'Improving convergence speed of algorithms'
        ],
        inputs: ['Encoder Node', 'Data Cleaner Node'],
        outputs: ['Train/Test Split', 'Regression Nodes', 'Classification Nodes'],
        pipelineDetails: 'If one column is "Age" (0-100) and another is "Salary" (0-100,000), the salary will totally bully the age column. This levels the playing field so every feature gets a fair vote.',
        exampleOutput: 'All your numeric data scaled nicely between 0 and 1 (or centered at 0), ready for fair comparison.',
        proTip: 'This is super important for distance-based models like K-Means or KNN. Trees don\'t care as much, but it never hurts!',
        notes: 'Helps models like K-Means learn way faster.'
    },
    featureSelector: {
        title: 'Feature Selector Node',
        description: 'Too much information can be distracting. Pick only the most important columns that actually matter for your goal.',
        usage: [
            'Reducing dimensionality',
            'Focusing on important variables',
            'Removing irrelevant noise'
        ],
        inputs: ['Normalizer Node', 'Encoder Node'],
        outputs: ['Regression Nodes', 'Classification Nodes', 'Clustering Nodes'],
        pipelineDetails: 'Think of this as Marie Kondo-ing your data. You only want to keep the columns that "spark joy" (aka help prediction). Removing the clutter makes your model smarter and faster.',
        exampleOutput: 'A streamlined dataset with just the heavy-hitting columns that actually predict your target.',
        proTip: 'Be ruthless! Drop IDs, Names, or anything that doesn\'t actually help describe the problem.',
        notes: 'Less is often more. Keep the signal, lose the noise.'
    },
    pca: {
        title: 'PCA Node',
        description: 'Simplify your data! It takes a complicated mess of many variables and boils it down to the most important patterns.',
        usage: [
            'Visualizing high-dimensional data in 2D/3D',
            'Reducing features to speed up training'
        ],
        inputs: ['Normalizer Node'],
        outputs: ['K-Means Node', 'Data Visualizer Node'],
        pipelineDetails: 'It\'s like photographing a 3D statue from the perfect angle so the 2D photo shows everything important. You lose a tiny bit of detail, but gain a ton of simplicity.',
        exampleOutput: 'Your messy, complex data transformed into just 2 or 3 "Principal Components" that catch the main trends.',
        proTip: 'This is a lifesaver for visualization! We can\'t graph 10 dimensions, but we can easily graph the top 2 from PCA.',
        notes: 'Works best if you Normalize your data first!'
    },
    svd: {
        title: 'SVD Node',
        description: 'A powerful way to simplify complex data matrixes, often used to find hidden connections in your info.',
        usage: [
            'Matrix decomposition',
            'Latent semantic analysis'
        ],
        inputs: ['Normalizer Node'],
        outputs: ['Regression Nodes', 'Data Visualizer Node'],
        pipelineDetails: 'This breaks down your data into its core DNA. It finds hidden themes underlying the mess, which is why Netflix uses similar math to recommend movies.',
        exampleOutput: 'A simplified matrix that reveals the hidden "topics" or structures living inside your data.',
        proTip: 'Super popular for text analysis—it finds the hidden "concept" connecting different words.',
        notes: 'Strips away the noise to show you the skeleton of your data.'
    },

    // --- Regression Models ---
    linearRegression: {
        title: 'Linear Regression Node Network',
        description: 'The classic predictor. Great for spotting simple trends, like "if X goes up, Y goes up too".',
        usage: [
            'Predicting prices, scores, or trends',
            'Understanding simple relationships'
        ],
        inputs: ['Normalizer Node', 'Feature Selector Node'],
        outputs: ['Model Evaluator Node', 'Model Visualizer Node'],
        pipelineDetails: 'Ready to see the future? This node takes all those dots on your graph and tries to draw a straight line through them. It helps you say, "If you do X, then Y will probably happen."',
        exampleOutput: 'A shiny new model that can predict values (like guessing a house price is $250k).',
        proTip: 'Watch out for "Outliers"—one crazy data point (like a 500-year-old billionaire) can totally confuse this model!',
        notes: 'Works perfectly when things follow a simple, straight-line path.'
    },
    multiLinearRegression: {
        title: 'Multi-Linear Regression Node',
        description: 'Predict a number based on many clues. Perfect for answering "How do price, location, and size all affect house value?"',
        usage: [
            'Predicting complex outcomes with many factors',
            'Sales forecasting, risk assessment'
        ],
        inputs: ['Normalizer Node', 'Feature Selector Node'],
        outputs: ['Model Evaluator Node'],
        pipelineDetails: 'Life is complicated, right? Usually, lots of things affect an outcome. This model juggles multiple clues at once (like Price, Size, AND Location) to give you a much smarter prediction.',
        exampleOutput: 'A smart formula like "Price = 300 * Size + 50 * Location - 10 * Age".',
        proTip: 'Don\'t feed it two clues that say the same thing (like "Temp in Celsius" and "Temp in Fahrenheit"). It gets confused!',
        notes: 'More clues (variables) = smarter predictions, but also more homework for the computer.'
    },
    polynomialRegression: {
        title: 'Polynomial Regression Node',
        description: 'Not everything is a straight line. Use this when your data curves or waves, like tracking seasonal temperatures.',
        usage: [
            'Modeling curved trends',
            'When linear models underfit the data'
        ],
        inputs: ['Normalizer Node', 'Feature Selector Node'],
        outputs: ['Model Evaluator Node', 'Model Visualizer Node'],
        pipelineDetails: 'Not all relationships go in a straight line. Sometimes they curve, like a ball thrown in the air. This model is flexible enough to bend and twist to fit your data\'s actual shape.',
        exampleOutput: 'A flexible prediction line that hugs your data\'s curves instead of forcing a straight line.',
        proTip: 'Careful! If you let it bend TOO much (high degree), it\'ll just memorize your data instead of learning the pattern. That\'s called Overfitting.',
        notes: 'Perfect for patterns that wave, curve, or wobble.'
    },
    knnRegression: {
        title: 'KNN Regression Node',
        description: 'Predicts a value by asking "What are my neighbors doing?" It looks at similar examples to make a guess.',
        usage: [
            'Non-linear prediction without assuming a formula',
            'Localized predictions'
        ],
        inputs: ['Normalizer Node', 'Select Features'],
        outputs: ['Model Evaluator Node'],
        pipelineDetails: 'This uses the "birds of a feather" rule. To guess a price, it just looks at the 5 most similar examples it has seen before and takes their average. Simple, but effective!',
        exampleOutput: 'A prediction based purely on "what did similar ones do?", with no complex formulas needed.',
        proTip: 'This guy gets tired (slow) if you give it millions of rows to check. Keep it for small-ish datasets.',
        notes: 'It assumes similar things behave similarly.'
    },

    // --- Classification Models ---
    logisticRegression: {
        title: 'Logistic Regression Node',
        description: 'The decision maker. Use this to sort things into two piles, like "Yes/No", "Pass/Fail", or "Spam/Not Spam".',
        usage: [
            'Binary classification (Spam/Not Spam)',
            'Probability estimation'
        ],
        inputs: ['Normalizer Node', 'Encoder Node'],
        outputs: ['Model Evaluator Node', 'Model Visualizer Node'],
        pipelineDetails: 'Need a hard "Yes" or "No"? This is your decider. It draws a line in the sand and says, "Everything over here is Safe, everything over there is Risky."',
        exampleOutput: 'A confidence score (e.g., "85% sure this is Spam") and a final label.',
        proTip: 'Confusing name alert! Even though it says "Regression", it\'s built for CLASSIFYING things (categories), not predicting numbers.',
        notes: 'It calculates the odds of something belonging to a group.'
    },
    knnClassification: {
        title: 'KNN Classification Node',
        description: 'Sorts a new item based on who it hangs out with. If its nearest neighbors are "Cats", it\'s probably a "Cat" too.',
        usage: [
            'Simple classification tasks',
            'Multiclass classification'
        ],
        inputs: ['Normalizer Node'],
        outputs: ['Model Evaluator Node'],
        pipelineDetails: 'Imagine walking into a party. To decide if you\'re a "Dancer" or a "Watcher", we just look at what the 5 people standing closest to you are doing. Majority rules!',
        exampleOutput: 'A label based on peer pressure (e.g., "High Risk" because 4 out of 5 similar customers were High Risk).',
        proTip: 'Pick an odd number for "K" (like 3 or 5) so you never get stuck in a tie vote!',
        notes: 'Works best when similar things actually group together.'
    },
    naiveBayes: {
        title: 'Naive Bayes Node',
        description: 'A quick and smart sorter. It uses probability to guess categories, great for sorting text or emails.',
        usage: [
            'Text classification',
            'Spam filtering',
            'Baseline classification'
        ],
        inputs: ['Encoder Node', 'Feature Selector Node'],
        outputs: ['Model Evaluator Node'],
        pipelineDetails: 'An oldie but a goodie! It uses simple probability checks to make surprisingly educated guesses. It\'s like the "Spam" filter in your email—fast, simple, and effective.',
        exampleOutput: 'A super-fast prediction that tells you the most likely category for that email or customer.',
        proTip: 'It pretends every clue is totally unrelated (independent). Spoilers: They aren\'t, but it somehow works great anyway!',
        notes: 'Don\'t underestimate it just because it\'s "Naive".'
    },

    // --- Clustering Models ---
    kMeans: {
        title: 'K-Means Clustering Node',
        description: 'The team builder. It automatically organizes your data into distinct groups or "teams" based on similarities.',
        usage: [
            'Customer segmentation',
            'Image compression',
            'Pattern discovery'
        ],
        inputs: ['Normalizer Node', 'PCA Node'],
        outputs: ['Data Visualizer Node', 'Cluster Analysis'],
        pipelineDetails: 'This is the ultimate team builder. You dump all your data in, and it automatically shuffles everyone into distinct groups (teams) based on who acts the same.',
        exampleOutput: 'Your data splits into groups (Cluster 1, Cluster 2...), revealing hidden segments you didn\'t even know existed.',
        proTip: 'You have to tell it how many teams (K) to form. If you have no idea, check the "Elbow Method" plot for a hint.',
        notes: 'Great for finding customer personas or topics.'
    },
    dbscan: {
        title: 'DBSCAN Node',
        description: 'The shape finder. Excellent for finding weirdly shaped groups and spotting the odd ones out (outliers).',
        usage: [
            'finding clusters of arbitrary shape',
            'Detecting outliers (noise)'
        ],
        inputs: ['Normalizer Node'],
        outputs: ['Data Visualizer Node'],
        pipelineDetails: 'Unlike other nodes that look for neat circles, this one is a shape-shifter. It can trace weird, snake-like patterns and is smart enough to ignore the random noise that doesn\'t fit anywhere.',
        exampleOutput: 'Groups of any size or shape, plus a "Noise" pile for the weird outliers.',
        proTip: 'If your data has thick clumps and thin clumps, this might struggle. It prefers consistent crowds.',
        notes: 'The best friend of messy, noisy datasets.'
    },
    hierarchicalClustering: {
        title: 'Hierarchical Clustering Node',
        description: 'Builds a family tree for your data. It shows you how different groups nest inside each other.',
        usage: [
            'Taxonomy creation',
            'Understanding data hierarchy'
        ],
        inputs: ['Normalizer Node'],
        outputs: ['Dendrogram View'],
        pipelineDetails: 'This builds a giant family tree for your data. You can watch small groups merge into bigger families, giving you a deep look at how everything is related.',
        exampleOutput: 'A "Dendrogram"—basically a genealogy chart showing how every single data point connects to the others.',
        proTip: 'Use that tree chart to decide where to "cut" the branches—that tells you how many clusters you really have.',
        notes: 'It keeps the history of every merge.'
    },

    // --- Visualization & Misc ---
    dataVisualizer: {
        title: 'Data Visualizer Node',
        description: 'A picture is worth a thousand numbers. Create colorful charts like scatter plots and bar graphs to explore your data\'s story.',
        usage: [
            'Exploratory data analysis',
            'Presenting results'
        ],
        inputs: ['Any Data Node'],
        outputs: [],
        pipelineDetails: 'Staring at a 10,000-row spreadsheet works for nobody. This node turns those boring numbers into colorful charts that tell a story in seconds.',
        exampleOutput: 'Instant charts! Scatter plots to see trends, Bar charts to compare groups—take your pick.',
        proTip: 'Use Scatter Plots for two numbers (like Age vs Income) and Bar Charts for categories.',
        notes: 'A picture really is worth 1,000 spreadsheet rows.'
    },
    modelVisualizer: {
        title: 'Model Visualizer Node',
        description: 'Visualize performance, structure, and behavior of trained machine learning models. Get deep insights into how your model works.',
        usage: [
            'Understanding model performance through visual metrics',
            'Interpreting model behavior and predictions',
            'Validating training quality with diagnostic plots',
            'Explaining results during demos, reports, and presentations'
        ],
        inputs: [
            'Regression Models (Linear, Multi-Linear, Polynomial, KNN)',
            'Classification Models (Logistic, Naive Bayes, KNN)',
            'Clustering Models (K-Means, DBSCAN, Hierarchical)',
            'Neural Network Models (MLP)'
        ],
        outputs: [],
        pipelineDetails: 'This is your model\'s X-ray machine! It automatically detects the model type and shows you exactly what\'s happening under the hood. For regression, see how predictions match reality. For classification, examine confusion matrices. For clustering, visualize group formations. For neural networks, track training progress and architecture.',
        exampleOutput: 'Interactive charts showing actual vs predicted values, residual plots, confusion matrices, cluster visualizations, loss curves, and performance metrics—all tailored to your specific model type.',
        proTip: 'Connect this to ANY trained model and it automatically shows the right visualizations. Watch for patterns in residual plots (regression) or check if your confusion matrix is mostly diagonal (classification). For neural networks, look for smooth loss curves without wild jumps!',
        notes: 'Read-only visualization node. Does not modify data or retrain models. Perfect for demos and understanding model internals.'
    },
    heatmap: {
        title: 'Heatmap Node',
        description: 'See the hot spots! A color-coded grid that shows you which data points are strongly connected to each other.',
        usage: [
            'Identifying correlated features',
            'Visualizing density'
        ],
        inputs: ['Data Cleaner Node', 'Normalizer Node'],
        outputs: [],
        pipelineDetails: 'This creates a "hot or cold" grid. Dark red squares mean two things move together perfectly, while blue means they\'re total opposites. Use it to find hidden connections.',
        exampleOutput: 'A colorful grid. Red = Best Friends. Blue = Enemies. White = Strangers.',
        proTip: 'Hunt for the bright red squares that aren\'t on the center diagonal—that\'s where the interesting insights live.',
        notes: 'Your cheat sheet for finding relationships.'
    },
    modelEvaluator: {
        title: 'Model Evaluator Node',
        description: 'The report card. Check your model\'s score to see how accurately it\'s predicting the future.',
        usage: [
            'Comparing model performance',
            'Validating results on test data'
        ],
        inputs: ['Regression/Classification/Clustering Models'],
        outputs: [],
        pipelineDetails: 'You wouldn\'t launch a rocket without testing it first. This node runs your model against a test exam and gives it a grade (like 95% Accuracy) so you know if it\'s ready for the real world.',
        exampleOutput: 'Metrics like "Mean Squared Error" (for regression) or "Accuracy Score" (for classification).',
        proTip: 'Don\'t test on the same data you trained on! That\'s like seeing the answers before the exam.',
        notes: 'Always check your grades to see if you need to study more (retrain).'
    },
    describeNode: {
        title: 'Describe Node',
        description: 'The quick summary. Get instant stats like averages, max, and min values to understand what you\'re working with.',
        usage: [
            'Quick statistical overview',
            'Checking data distribution'
        ],
        inputs: ['Any Data Node'],
        outputs: [],
        pipelineDetails: 'Before you dive deep, get the 30,000-foot view. This tells you the basics—averages, maximums, and minimums—so you know exactly what you\'re dealing with.',
        exampleOutput: 'A quick summary table. "What\'s the average price?" "What\'s the oldest age?" It\'s all here.',
        proTip: 'Check the "Min" and "Max" immediately. If you see an Age of 200, you know you have some broken data to fix.',
        notes: 'Read the back of the book before you start the first chapter.'
    },

    // --- Placeholders/Basics ---
    mlp: {
        title: 'MLP Node (Neural Network)',
        description: 'The brain of the operation! A versatile Multi-Layer Perceptron that mimics how biological neurons learn to recognize complex patterns.',
        usage: [
            'Complex Classification (e.g., Image recognition, detailed categorization)',
            'Non-linear Regression (Predicting values with complex relationships)',
            'Deep Learning experiments'
        ],
        inputs: ['Normalizer Node', 'Encoder Node'],
        outputs: ['Model Evaluator Node', 'Model Visualizer Node'],
        pipelineDetails: 'This uses "Deep Learning" to solve problems that stump simple models. By stacking layers of "neurons", it can learn incredibly complex rules, like recognizing a face or predicting stock movements.',
        exampleOutput: 'A trained neural network ready to make high-level predictions on complex data.',
        proTip: 'Start small! A huge network with 10 hidden layers might just memorize your data (overfit). Try 1 or 2 hidden layers first.',
        notes: 'Powerful but hungry—it needs lots of data to learn well.'
    },
    cnn: { title: 'CNN Node', description: 'Convolutional Neural Network.', usage: [], inputs: [], outputs: [], notes: 'Placeholder.' },
    rnn: { title: 'RNN Node', description: 'Recurrent Neural Network.', usage: [], inputs: [], outputs: [], notes: 'Placeholder.' },
    transformer: { title: 'Transformer Node', description: 'Transformer architecture.', usage: [], inputs: [], outputs: [], notes: 'Placeholder.' },
    visualizer: { title: 'Visualizer Node', description: 'General purpose visualizer.', usage: [], inputs: [], outputs: [], notes: 'Placeholder.' },
    exporter: { title: 'Exporter Node', description: 'Exports data or models.', usage: [], inputs: [], outputs: [], notes: 'Placeholder.' },
    evaluator: {
        title: 'Model Evaluator Node',
        description: 'The report card. Check your model\'s score to see how accurately it\'s predicting the future.',
        usage: [
            'Comparing model performance',
            'Validating results on test data'
        ],
        inputs: ['Regression/Classification/Clustering Models'],
        outputs: [],
        pipelineDetails: 'You wouldn\'t launch a rocket without testing it first. This node runs your model against a test exam and gives it a grade (like 95% Accuracy) so you know if it\'s ready for the real world.',
        exampleOutput: 'Metrics like "Mean Squared Error" (for regression) or "Accuracy Score" (for classification).',
        proTip: 'Don\'t test on the same data you trained on! That\'s like seeing the answers before the exam.',
        notes: 'Always check your grades to see if you need to study more (retrain).'
    },
};
