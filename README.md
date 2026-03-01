# Neuroflow Client (`neuroflow-client`)

The frontend and Electron wrapper for the Neuroflow IDE. This component provides the drag-and-drop interface for building machine learning workflows, visualizing data, and orchestrating models.

## Features

- **Visual Workflow Builder**: Powered by `React Flow`, allowing users to construct complex ML pipelines visually.
- **Extensive Node Library**: Supports various nodes including readers (CSV, DB), cleaners, visualizers, regression, classification, clustering, and neural networks.
- **Real-time Data Visualization**: Integrated `Chart.js` for plotting data distributions, evaluation metrics, and model results (e.g., Dendrograms, Cluster Scatter Plots, MLP Loss Curves).
- **Modern UI Components**: Styled using `Tailwind CSS` and `shadcn/ui` for a sleek, responsive, and accessible interface.
- **Cross-Platform Desktop App**: Built with `Electron` for a native, standalone experience with local file persistence (`.nf` files).

## Technology Stack

- **Framework**: React 19, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Flow Engine**: React Flow
- **Icons**: React Icons (Fa, Md, etc.)
- **Desktop Wrapper**: Electron, Node.js

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

### Installation

1. Navigate to the client directory:
   ```bash
   cd neuroflow-client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the development server for the client and Electron simultaneously:
```bash
npm run electron:dev
```

> **Note on Vite Aliases**: The project uses relative paths (e.g., `../../utils/cn`) instead of Vite aliases (`@/utils/cn`) for internal imports to ensure compatibility with the Electron build process.

> [!IMPORTANT]
> **Independent Backend**: You must also start the `neuroflow-logic` backend service in a separate terminal for the ML nodes to execute. See [neuroflow-logic/README.md](../neuroflow-logic/README.md) for instructions.

### Building for Production

To build a standalone desktop application for your operating system:
```bash
npm run electron:build
```

<<<<<<< HEAD
The compiled application will be generated in the `dist-electron/` directory.

=======
>>>>>>> c52d6256553c63dd01090a9dc1a498fb9b7ead22
## Contributing

We welcome contributions! To get started:
1. **Fork** the repository.
2. **Clone** your fork.
3. **Create a branch** for your feature: `git checkout -b feature/amazing-feature`.
4. **Commit** your changes: `git commit -m 'Add amazing feature'`.
5. **Push** to the branch: `git push origin feature/amazing-feature`.
6. **Open a Pull Request**.

### Coding Standards
- Use functional components and hooks for React.
- When creating new UI components, prefer utilizing or extending the existing `shadcn/ui` components found in `src/components/ui/`.
- Ensure all new nodes are properly registered in `src/pages/EditorPage.tsx` and documented in `src/data/nodeInfo.ts`.

## License

This project is licensed under the MIT License - see the root LICENSE file for details.
