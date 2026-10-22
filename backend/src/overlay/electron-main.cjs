const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('node:path');
const readline = require('node:readline');

// Disable hardware acceleration issues for transparent overlays on Windows
app.disableHardwareAcceleration();

let mainWindow = null;
let isStopping = false;
let hasReportedReady = false;

function emitOutbound(message) {
  if (typeof process.send === 'function') {
    try {
      process.send(message);
    } catch {}
  }
  try {
    process.stdout.write(JSON.stringify(message) + '\n');
  } catch {}
}

function handleStop(reason = 'escape_pressed') {
  if (isStopping) return;
  isStopping = true;

  emitOutbound({
    type: 'stop',
    reason,
    timestamp: Date.now(),
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:update-status', {
      type: 'status',
      state: 'stopped',
      action: 'Stopping automation...',
    });

    // Provide visual feedback before closing window
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    }, 700);
  }
}

function handleInbound(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'status' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:update-status', msg);
  } else if (msg.type === 'close') {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    } else {
      app.quit();
    }
  }
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: true,
    show: false, // show once ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Windows-specific: ensure overlay sits above all normal windows including Playwright
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Default: pass all mouse clicks through to the underlying desktop/browser
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  const reportReady = () => {
    if (hasReportedReady) return;
    hasReportedReady = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
    emitOutbound({
      type: 'ready',
      display: { width, height },
    });
  };

  mainWindow.once('ready-to-show', reportReady);
  mainWindow.webContents.once('did-finish-load', reportReady);

  // Update bounds if screen resolution changes
  const updateBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const current = screen.getPrimaryDisplay().bounds;
    mainWindow.setBounds(current);
  };
  screen.on('display-metrics-changed', updateBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

// IPC: Renderer requests mouse events toggle (e.g. mouse hover over status bar or stop button)
ipcMain.on('overlay:set-interactive', (_event, interactive) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (interactive) {
      mainWindow.setIgnoreMouseEvents(false);
    } else {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }
});

// IPC: Stop requested from renderer Stop button
ipcMain.on('overlay:request-stop', (_event, reason) => {
  handleStop(reason || 'button_clicked');
});

// IPC: Explicit close from renderer
ipcMain.on('overlay:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

app.whenReady().then(() => {
  createOverlayWindow();

  // Register global Escape key to request cancellation
  try {
    globalShortcut.register('Escape', () => {
      handleStop('escape_pressed');
    });
  } catch (err) {
    console.error('Failed to register global Escape shortcut:', err);
  }

  // Listen to IPC messages from parent process
  if (typeof process.on === 'function') {
    process.on('message', (msg) => {
      handleInbound(msg);
    });
  }

  // Listen to stdin lines for status updates from parent automation process
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      handleInbound(msg);
    } catch (err) {
      // Ignore invalid JSON lines
    }
  });

  // If parent process disconnects, quit immediately to prevent orphans
  if (typeof process.on === 'function') {
    process.on('disconnect', () => {
      app.quit();
    });
  }
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {}
});

app.on('window-all-closed', () => {
  app.quit();
});
