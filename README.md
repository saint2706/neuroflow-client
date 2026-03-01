# Neuroflow Client (`neuroflow-client`)

The frontend and Electron wrapper for the Neuroflow IDE. This component provides the drag-and-drop interface for building machine learning workflows.

## 🚀 Features

- **Visual Workflow Builder**: Powered by `React Flow`.
- **Real-time Data Visualization**: Integrated `Chart.js` for plotting.
- **Microservices Orchestration**: Seamlessly communicates with the `neuroflow-logic` backend.
- **Cross-Platform Desktop App**: Built with `Electron` for a native experience.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, CSS (Vanilla with modern tokens).
- **Runtime**: Node.js, Electron.
- **Icons**: React Icons (Fa, Md, etc.).

## 📦 Getting Started

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

To start the development server for the client and Electron:
```bash
npm run dev:electron
```

> [!IMPORTANT]
> **Independent Backend**: You must also start the `neuroflow-logic` backend service in a separate terminal. See [neuroflow-logic/README.md](../neuroflow-logic/README.md) for instructions.


### Building for Production

To build a standalone desktop application:
```bash
npm run electron:build
```

## 🤝 Contributing

We welcome contributions! To get started:
1. **Fork** the repository.
2. **Clone** your fork.
3. **Create a branch** for your feature: `git checkout -b feature/amazing-feature`.
4. **Commit** your changes: `git commit -m 'Add amazing feature'`.
5. **Push** to the branch: `git push origin feature/amazing-feature`.
6. **Open a Pull Request**.

### Coding Standards
- Use functional components and hooks for React.
- Follow the established CSS naming conventions in `src/styles`.
- Ensure all new nodes are registered in the `OBJECT_POOL` and documented.

## 📄 License

This project is licensed under the MIT License - see the root LICENSE file for details.
