import React from 'react';
import { createRoot } from 'react-dom/client';

function Overlay() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black/30 text-white text-2xl font-bold">
      <div id="transcription" className="mb-2">（ここに文字起こしテキスト）</div>
      <div id="translation" className="text-lg text-gray-200">（ここに翻訳テキスト）</div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<Overlay />);
