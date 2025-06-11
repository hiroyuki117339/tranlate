import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function Settings() {
  const [fontSize, setFontSize] = useState(24);
  const [position, setPosition] = useState('top');
  const [opacity, setOpacity] = useState(0.8);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  useEffect(() => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('get-audio-devices').then((list) => {
        setDevices(list);
        if (list.length > 0) setSelectedDevice(list[0].name);
      });
    }
  }, []);

  const saveSettings = () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('save-settings', {
        fontSize, position, opacity, fontFamily, device: selectedDevice
      });
    }
    alert('設定を保存しました');
  };

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">設定</h1>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <label className="w-32">文字の大きさ</label>
          <input
            type="range"
            min="16"
            max="64"
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="w-32">表示位置</label>
          <select value={position} onChange={e => setPosition(e.target.value)} className="border rounded px-2 py-1">
            <option value="top">上</option>
            <option value="bottom">下</option>
          </select>
          <label className="ml-4 w-24">透過率</label>
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.01"
            value={opacity}
            onChange={e => setOpacity(Number(e.target.value))}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="w-32">フォント種類</label>
          <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="border rounded px-2 py-1">
            <option value="sans-serif">Sans</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
          </select>
          <button onClick={saveSettings} className="ml-4 px-4 py-2 bg-blue-500 text-white rounded">保存</button>
        </div>
        <div className="flex items-center gap-4">
          <strong>選択中のデバイス:</strong>
          <span>{selectedDevice || '未選択'}</span>
        </div>
        <div className="flex items-center gap-4">
          <label className="w-32">録音デバイス</label>
          <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} className="border rounded px-2 py-1">
            <option value="">デバイスを選択</option>
            {devices.map(device => (
              <option key={device} value={device}>{device}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('settings-root'));
root.render(<Settings />);
