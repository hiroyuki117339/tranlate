require('dotenv').config();
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { execFileSync } = require('child_process');
const { getInputDevices } = require('./list_audio_devices');

const store = new Store();
let tray = null;
let overlayWindow = null;
let settingsWindow = null;
let translationWindow = null;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 600,
    height: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true, // リサイズ可能に
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  overlayWindow.loadFile(path.join(__dirname, 'renderer/build/index.html'), { query: { window: 'overlay' } });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'renderer/build/index.html'), { query: { window: 'settings' } });
  settingsWindow.on('closed', () => (settingsWindow = null));
}

function createTranslationWindow() {
  if (translationWindow) {
    translationWindow.focus();
    return;
  }
  // 画面サイズの50%（横）・65%（縦）で中央に配置
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const winW = Math.floor(screenW * 0.5);
  const winH = Math.floor(screenH * 0.65); // 高さを65%に拡大
  const winX = Math.floor((screenW - winW) / 2);
  const winY = Math.floor((screenH - winH) / 2);
  translationWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: winX,
    y: winY,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  translationWindow.loadFile(path.join(__dirname, 'renderer/public/translation.html'));
  translationWindow.on('closed', () => {
    translationWindow = null;
  });
  const { Menu } = require('electron');
  const menu = Menu.buildFromTemplate([
    {
      label: '編集',
      submenu: [
        { role: 'copy', label: 'コピー' },
        { type: 'separator' },
        { label: 'クリア', click: () => {
          translationWindow.webContents.send('clear-all');
        }},
        { type: 'separator' },
        { role: 'quit', label: '終了' }
      ]
    }
  ]);
  translationWindow.setMenu(menu);
}

async function createTray() {
  let iconPath = path.join(__dirname, 'renderer/public/icon.png');
  const fs = require('fs');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, 'renderer/public/icon.svg');
  }

  const image = nativeImage.createFromPath(iconPath);
  const resizedImage = image.resize({ width: 16 });

  tray = new Tray(resizedImage);

  const devices = await getInputDevices();
  const selectedDevice = store.get('device') || (devices.length > 0 ? devices[0].name : 'default');
  if (!store.get('device')) store.set('device', selectedDevice);

  const deviceMenu = devices.length ? {
    label: '音声デバイス',
    submenu: devices.map((dev) => ({
      label: dev.name,
      type: 'radio',
      checked: dev.name === selectedDevice,
      click: () => {
        console.log('[main] device menu clicked:', dev.name);
        store.set('device', dev.name);
        startRecordingWithDevice(dev.name);
      }
    }))
  } : { label: '音声デバイス（未検出）', enabled: false };

  const contextMenu = Menu.buildFromTemplate([
    { label: '翻訳ウィンドウ', click: createTranslationWindow },
    { type: 'separator' },
    deviceMenu,
    { type: 'separator' },
    { label: '設定', click: createSettingsWindow },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
  tray.setToolTip('Voice Transcriber Overlay');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(async () => {
  await createTray();
  createTranslationWindow();
  startRecordingWithDevice(store.get('device'));
});

app.on('window-all-closed', () => {});

const { startRecording } = require('./speech');
let isRestarting = false;
let restartTimer = null;

function startRecordingWithDevice(device) {
  // デバイスが指定されていない場合はデフォルトの入力デバイスを使用
  const deviceToUse = device || '0'; // デフォルトは最初のデバイス
  console.log(`[main] startRecordingWithDevice called with device: ${deviceToUse}`);
  
  // 既存のストップ関数とタイマーをクリア
  if (global.stopRecording) {
    console.log('[main] Stopping existing recording...');
    global.stopRecording();
    global.stopRecording = null;
  }
  
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  console.log('[main] Starting new recording...');
  global.stopRecording = startRecording((event) => {
    console.log(`[main] Received event:`, event.type);
    
    try {
      switch (event.type) {
        case 'data':
          const data = event.payload;
          console.log(`[main] Sending transcription data to renderer`);
          if (translationWindow && !translationWindow.isDestroyed()) {
            translationWindow.webContents.send('transcription', {
              transcript: data.transcript,
              translation: data.translation || '',
              isFinal: data.isFinal,
              language: data.language || 'en-US'
            });
          }
          break;
          
        case 'error':
          console.error('[main] Error from speech recognition:', event.payload);
          // エラーが発生した場合も再起動を試みる
        case 'end':
          if (!isRestarting) {
            isRestarting = true;
            console.log(`[main] Stream ${event.type} event received. Restarting recording...`);
            
            // 即座に再起動を試みる
            restartTimer = setTimeout(() => {
              console.log('[main] Attempting to restart recording...');
              isRestarting = false;
              startRecordingWithDevice(deviceToUse); // 変更: device の代わりに deviceToUse を使用
            }, 100);
          }
          break;
      }
    } catch (e) {
      console.error('[main] Error in event handler:', e);
    }
  }, device);
}

app.on('before-quit', () => {
  if (global.stopRecording) {
    global.stopRecording();
  }
});
