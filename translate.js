// translate.js: Handles translation using OpenAI API
const OpenAI = require('openai');

// OpenAI APIキーは環境変数 OPENAI_API_KEY から自動で読み込まれます
const openai = new OpenAI();

async function translateText(text, target = 'ja') {
  if (!text || text.trim() === '') {
    return '';
  }

  const targetLanguage = target === 'ja' ? 'Japanese' : 'English';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // 最新の高性能モデルを利用
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following English text to ${targetLanguage}. Please provide only the translated text, without any additional explanations or pleasantries.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0, // 翻訳の再現性を高めるために0に設定
      max_tokens: 1000,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    return '[翻訳エラー]';
  }
}

module.exports = { translateText };
