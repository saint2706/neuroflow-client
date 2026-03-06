import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process'; // Import spawn

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL;
let backendProcess = null;

const logPath = path.join(app.getPath('userData'), 'neuroflow-debug.log');

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFile(logPath, logMessage).catch(console.error);
}

// Function to spawn backend
async function startBackend() {
  logToFile('Starting backend initialization...');
  if (isDev) {
    logToFile('In-dev mode: Backend should be started manually via uv run app.py');
    return;
  }

  const backendName = process.platform === 'win32' ? 'neuroflow-backend.exe' : 'neuroflow-backend';
  const backendPath = path.join(process.resourcesPath, 'neuroflow-backend', backendName);
  logToFile(`Looking for backend executable at: ${backendPath}`);

  try {
    const accessMode = process.platform === 'win32'
      ? fsConstants.F_OK
      : fsConstants.F_OK | fsConstants.X_OK;
    await fs.access(backendPath, accessMode);
  } catch (err) {
    logToFile(`Backend executable is missing or not accessible at: ${backendPath}. ${err.message}`);
    return;
  }

  logToFile(`Launching backend executable: ${backendPath}`);

  backendProcess = spawn(backendPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'], // Pipe stdout and stderr
    env: { ...process.env, FLASK_PORT: '5050', PYTHONUNBUFFERED: '1' }
  });

  backendProcess.stdout.on('data', (data) => {
    logToFile(`BACKEND STDOUT (${backendPath}): ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    logToFile(`BACKEND STDERR (${backendPath}): ${data}`);
  });

  backendProcess.on('error', (err) => {
    logToFile(`Failed to start backend from ${backendPath}: ${err.message}`);
    dialog.showErrorBox(
      'Backend Startup Failed',
      `Neuroflow could not start its backend service.\n\nExpected backend executable:\n${backendPath}\n\nError: ${err.message}`
    );
  });

  backendProcess.on('close', (code) => {
    logToFile(`Backend process exited with code ${code}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
}

let mainWindow = null;

async function createWindow() {
  await startBackend(); // Start backend when window creates (or app ready)

  // hiddenInset is a macOS-only title bar style; keep native defaults on other platforms.
  const titleBarOptions = process.platform === 'darwin'
    ? { titleBarStyle: 'hiddenInset' }
    : {};

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for some preload scripts to work correctly with Vite in dev
    },
    ...titleBarOptions,
  });

  console.log('Preload path:', path.join(__dirname, 'preload.js'));

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const isAppUrl = url.startsWith('http://localhost') || url.startsWith('file:');
    if (!isAppUrl) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    await mainWindow.loadFile(indexPath);
  }
}

app.disableHardwareAcceleration();
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend(); // Ensure backend is killed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});


ipcMain.handle('save-project', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: 'project.nf',
    filters: [{ name: 'Neuroflow Project', extensions: ['nf'] }]
  });

  if (canceled || !filePath) {
    return { success: false, reason: 'canceled' };
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Project',
    properties: ['openFile'],
    filters: [{ name: 'Neuroflow Project', extensions: ['nf'] }]
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, reason: 'canceled' };
  }

  try {
    const content = await fs.readFile(filePaths[0], 'utf-8');
    return { success: true, data: JSON.parse(content), filePath: filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
