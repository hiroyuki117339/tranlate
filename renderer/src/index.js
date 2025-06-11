import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

export function Overlay() {
  const [transcription, setTranscription] = useState('');
  const [finalTranscriptions, setFinalTranscriptions] = useState([]);
  const [translations, setTranslations] = useState([]);

  useEffect(() => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.on('transcription', (_e, data) => {
        if (typeof data === 'string') {
          setTranscription(data);
          return;
        }
        if (!data.isFinal) {
          setTranscription(data.transcription);
        } else {
          setFinalTranscriptions(prev => [...prev, data.transcription]);
          setTranscription('');
        }
      });
      ipcRenderer.on('translation', (_e, text) => {
        setTranslations(prev => [...prev, text]);
      });
      return () => {
        ipcRenderer.removeAllListeners('transcription');
        ipcRenderer.removeAllListeners('translation');
      };
    }
  }, []);

  return (
    <div className="bg-black bg-opacity-60 text-white p-4 rounded-lg shadow-lg flex flex-col items-center justify-center w-full h-full">
      <div className="text-lg font-bold mb-2">Transcription (音声認識)</div>
      {transcription && <span className="interim">{transcription}</span>}
      {finalTranscriptions.map((txt, idx) => <p key={idx}>{txt}</p>)}
      <div className="text-lg font-bold mb-2">Translation (翻訳)</div>
      {translations.map((txt, idx) => <p key={idx}>{txt}</p>)}
    </div>
  );
}

export function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">設定</h1>
      <form>
        <label className="block mb-2">文字の大きさ
          <input type="range" min="12" max="48" className="w-full" />
        </label>
        <label className="block mb-2">表示位置
          <select className="w-full">
            <option>上</option>
            <option>中央</option>
            <option>下</option>
          </select>
        </label>
        <label className="block mb-2">透過率
          <input type="range" min="0" max="1" step="0.01" className="w-full" />
        </label>
        <label className="block mb-2">フォント種類
          <select className="w-full">
            <option>Sans</option>
            <option>Serif</option>
            <option>Monospace</option>
          </select>
        </label>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">保存</button>
      </form>
    </div>
  );
}

export function TranslationWindow() {
  return (
    <div className="flex flex-row w-full h-full p-4 bg-white">
      <div className="flex-1 border-r pr-4">
        <h2 className="font-bold text-lg mb-2">文字起こし</h2>
        <div id="transcription-text">（ここに文字起こしテキスト）</div>
      </div>
      <div className="flex-1 pl-4">
        <h2 className="font-bold text-lg mb-2">翻訳</h2>
        <div id="translation-text">（ここに翻訳テキスト）</div>
      </div>
    </div>
  );
}

// ウィンドウ種別で表示UIを切り替え
function getWindowType() {
  const params = new URLSearchParams(window.location.search);
  return params.get('window') || 'overlay';
}

const windowType = getWindowType();
const container = document.getElementById('root') || document.getElementById('settings-root') || document.getElementById('translation-root');

if (container) {
  if (windowType === 'settings') {
    createRoot(container).render(<Settings />);
  } else if (windowType === 'translation') {
    createRoot(container).render(<TranslationWindow />);
  } else {
    createRoot(container).render(<Overlay />);
  }
}
