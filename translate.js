// translate.js: Handles translation using OpenAI API
const OpenAI = require('openai');

// OpenAI APIキーは環境変数 OPENAI_API_KEY から自動で読み込まれます
const openai = new OpenAI();

// 文脈の履歴を保持する（最大5つまで）
const contextHistory = {
  originals: [], // 英語の原文履歴
  translations: [] // 対応する日本語訳履歴
};

// 履歴の最大保持数
const MAX_HISTORY_LENGTH = 5;

// 履歴に文脈を追加する関数
function addToHistory(originalText, translatedText) {
  if (originalText && translatedText) {
    contextHistory.originals.push(originalText.trim());
    contextHistory.translations.push(translatedText.trim());
    
    // 履歴の長さが上限を超えたら、古いものを削除
    if (contextHistory.originals.length > MAX_HISTORY_LENGTH) {
      contextHistory.originals.shift();
      contextHistory.translations.shift();
    }
  }
}

// 履歴をクリアする関数（新しいセッションや話題の変更時に使用）
function clearHistory() {
  contextHistory.originals = [];
  contextHistory.translations = [];
}

// テキストから性別を検出する関数 (OpenAI APIを使用)
async function detectGender(text) {
  try {
    // 文脈の履歴からコンテキストを取得
    let contextText = '';
    
    // 過去の原文履歴があれば結合して利用
    if (contextHistory.originals.length > 0) {
      contextText = contextHistory.originals.join(' ') + ' ' + text;
      console.log(`性別判定: 文脈履歴を含めたテキストを使用 (履歴数: ${contextHistory.originals.length})`);
    } else {
      contextText = text;
      console.log('性別判定: 現在のテキストのみを使用');
    }
    
    // 簡易的な判定を自前で行う（代名詞ベース）
    const malePronouns = ['he', 'him', 'his', 'himself'];
    const femalePronouns = ['she', 'her', 'hers', 'herself'];
    
    // テキストと文脈全体を小文字に変換して単語に分割
    const words = contextText.toLowerCase().split(/\s+/);
    
    // 代名詞の出現回数をカウント
    let maleCount = 0;
    let femaleCount = 0;
    
    words.forEach(word => {
      if (malePronouns.includes(word)) {
        maleCount++;
      } else if (femalePronouns.includes(word)) {
        femaleCount++;
      }
    });
    
    // 簡易判定の結果
    let simpleGender = 'unknown';
    if (maleCount > femaleCount) {
      simpleGender = 'male';
    } else if (femaleCount > maleCount) {
      simpleGender = 'female';
    }
    
    // AIによる判定を追加（より高度な判定）
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // より軽量で高速なモデルを使用
      messages: [
        {
          role: 'system',
          content: `与えられたテキストを分析し、話者の性別を判定してください。代名詞や内容の文脈から判断してください。回答は「male」「female」「unknown」のいずれかのみを返してください。他の説明は不要です。`
        },
        {
          role: 'user',
          content: contextText
        }
      ],
      temperature: 0,
      max_tokens: 10,
    });
    
    const aiGender = response.choices[0].message.content.trim().toLowerCase();
    
    // 最終的な性別判定（AIの結果を優先するが、明確でない場合は簡易判定を使用）
    let finalGender = 'unknown';
    if (aiGender === 'male' || aiGender === 'female') {
      finalGender = aiGender;
    } else if (simpleGender !== 'unknown') {
      finalGender = simpleGender;
    }
    
    // 検出された性別をコンソールに詳細な情報とともに出力
    const historyInfo = contextHistory.originals.length > 0 ? 
      `文脈履歴使用: ${contextHistory.originals.length}文` : 
      '文脈履歴なし';
    
    console.log(`性別判定結果: ${finalGender} (テキスト長: ${contextText.length}文字, ${historyInfo})`);
    console.log(`詳細: AI判定=${aiGender}, 代名詞判定=${simpleGender}, 男性指標=${maleCount}, 女性指標=${femaleCount}`);
    
    return finalGender;
  } catch (error) {
    console.error('Gender detection error:', error);
    return 'unknown';
  }
}

// 文脈を含めた翻訳を行う関数
async function translateText(text, target = 'ja', isFinal = false) {
  if (!text || text.trim() === '') {
    return '';
  }

  // テキストから性別を検出
  const gender = await detectGender(text);
  
  const targetLanguage = target === 'ja' ? 'Japanese' : 'English';
  
  // 性別情報を含むシステムプロンプト
  let genderContext = '';
  if (gender === 'male') {
    genderContext = '話者は男性です。男性的な話し方に留意して翻訳してください。';
  } else if (gender === 'female') {
    genderContext = '話者は女性です。女性的な話し方に留意して翻訳してください。';
  }
  
  // 基本的なシステムプロンプト
  let systemPrompt = `英語を自然で意図を込めた日本語に翻訳します。読みやすい表現を心がけ、難しい表現はさけてください。口語的表現にしてください。文脈を考慮して、一貫性のある翻訳をしてください。${genderContext}翻訳文のみを返し、追加の説明や挨拶は不要です。`;

  // 確定（final）の場合は校正も行う
  if (isFinal) {
    systemPrompt = `英語を自然で意図を込めた日本語に翻訳します。読みやすい表現を心がけ、難しい表現はさけてください。口語的表現にしてください。文脈を考慮して、一貫性のある翻訳をしてください。${genderContext}翻訳後は文章を校正して、より自然で読みやすい表現にしてください。翻訳文のみを返し、追加の説明や挨拶は不要です。`;
  }
  
  // 文脈がある場合、メッセージに追加
  const messages = [];
  messages.push({ role: 'system', content: systemPrompt });
  
  // 過去の文脈を含める
  if (contextHistory.originals.length > 0) {
    // コンテキスト情報を準備
    const contextInfo = contextHistory.originals.map((original, index) => {
      return `過去の文: "${original}"
翻訳: "${contextHistory.translations[index]}"\n`;
    }).join('\n');
    
    messages.push({
      role: 'system',
      content: `これは過去の文脈情報です。これを参考にして、一貫性のある翻訳をしてください:\n${contextInfo}`
    });
  }

  try {
    // ユーザーメッセージを追加
    messages.push({
      role: 'user',
      content: text,
    });
    
    console.log(`翻訳コンテキスト付きリクエスト (性別判定: ${gender}, 文脈履歴数: ${contextHistory.originals.length}):`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // 最新の高性能モデルを利用
      messages: messages,
      temperature: 1.0, // 表現の多様性を高めるために1.0に設定
      max_tokens: 1000,
    });
    
    const translatedText = response.choices[0].message.content.trim();
    
    // 確定の場合のみ履歴に追加（途中の翻訳は追加しない）
    if (isFinal) {
      addToHistory(text, translatedText);
    }
    
    return translatedText;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return '[翻訳エラー]';
  }
}

module.exports = { 
  translateText,
  clearHistory, // 履歴をクリアする機能をエクスポート
  addToHistory  // テスト用に手動で履歴を追加する機能をエクスポート
};
