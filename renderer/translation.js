import React from 'react';
import { createRoot } from 'react-dom/client';

function TranslationWindow() {
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

const root = createRoot(document.getElementById('translation-root'));
root.render(<TranslationWindow />);
