// whisper.js: Handles audio recording and transcription via OpenAI Whisper API
const record = require('node-record-lpcm16');
const fs = require('fs');
const { Readable } = require('stream');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

// Load OpenAI API key from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

async function transcribeAudioStream(audioBuffer) {
  // Save buffer to a temp wav file for Whisper API
  const tempPath = './temp_audio.wav';
  fs.writeFileSync(tempPath, audioBuffer);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(tempPath));
  formData.append('model', 'whisper-1');

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        maxBodyLength: Infinity,
      }
    );

    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    return response.data.text || '';
  } catch (error) {
    console.error('Error transcribing audio:', error);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

function startRecording(onTranscription) {
  const recording = record.record({
    sampleRate: 16000,
    threshold: 0.5,
    verbose: false,
    recordProgram: 'sox',
    silence: '5.0'
  });

  recording.stream().on('data', async (chunk) => {
    try {
      const transcription = await transcribeAudioStream(chunk);
      if (transcription) {
        onTranscription(transcription);
      }
    } catch (error) {
      console.error('Error in transcription:', error);
    }
  });

  return recording;
}

module.exports = { startRecording };
