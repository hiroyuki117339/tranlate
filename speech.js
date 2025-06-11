const { spawn } = require('child_process');
const { SpeechClient } = require('@google-cloud/speech').v1p1beta1;
const { translateText } = require('./translate');
const { Transform } = require('stream');

function startRecording(onEvent, device) {
  console.log(`[speech.js] startRecording called with device: ${device || 'default'}`);
  const client = new SpeechClient();
  console.log('[speech.js] Created SpeechClient');

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      useEnhanced: true,
    },
    interimResults: true,
  };

  console.log('[speech.js] Creating streamingRecognize');
  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', (err) => {
      console.error('[speech.js] Error in recognizeStream:', err);
      onEvent({ type: 'error', payload: err });
    })
    .on('data', async (data) => {
      const isFinal = data.results[0]?.isFinal;
      const transcript = data.results[0]?.alternatives[0]?.transcript;
      if (transcript) {
        let translation = '';
        
        // 確定したテキストのみ翻訳を実行
        if (isFinal) {
          try {
            translation = await translateText(transcript, 'ja');
            console.log(`[speech.js] Translated: ${transcript} -> ${translation}`);
          } catch (error) {
            console.error('[speech.js] Translation error:', error);
            translation = '[翻訳エラー]';
          }
        }
        
        onEvent({
          type: 'data',
          payload: {
            transcript,
            translation,
            isFinal,
            language: 'en-US',
          },
        });
      }
    })
    .on('end', () => {
      console.log('[speech.js] Google API stream ended.');
      onEvent({ type: 'end' });
    });

  // ffmpeg の引数を設定
  // LG UltraFine Display Audio のデバイスIDを2に設定
  const deviceId = '2'; // LG UltraFine Display Audio のID
  
  const ffmpegArgs = [
    '-loglevel', 'error',        // エラーログのみ表示
    '-f', 'avfoundation',       // macOSのオーディオキャプチャに使用
    '-pix_fmt', 'uyvy422',      // サポートされているピクセルフォーマットを指定
    '-i', `:${deviceId}`,       // オーディオデバイスのみを指定（ビデオなし）
    '-ar', '16000',            // サンプルレート 16kHz
    '-ac', '1',                 // モノラル
    '-f', 's16le',              // 16-bit little-endian PCM
    '-acodec', 'pcm_s16le',     // コーデック
    '-bufsize', '1024k',        // バッファサイズを大きくする
    '-thread_queue_size', '1024', // スレッドキューサイズを大きくする
    '-'                         // 標準出力に出力
  ];
  
  console.log('[speech.js] Using ffmpeg with device ID:', deviceId);

  console.log(`[speech.js] Spawning ffmpeg with args: ${ffmpegArgs.join(' ')}`);
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  console.log('[speech.js] ffmpeg process spawned');

  // バッファリング用のTransformストリーム
  const bufferStream = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk);
      callback();
    },
    highWaterMark: 1024 * 1024 // 1MBのバッファ
  });

  // ストリームをパイプ接続
  ffmpeg.stdout.pipe(bufferStream).pipe(recognizeStream);
  console.log('[speech.js] Piped ffmpeg.stdout to recognizeStream with buffering');

  // エラー処理
  ffmpeg.stderr.on('data', (data) => {
    console.error(`[speech.js] ffmpeg stderr: ${data}`);
  });

  ffmpeg.on('close', (code, signal) => {
    console.log(`[speech.js] ffmpeg process closed with code ${code} and signal ${signal}`);
  });

  ffmpeg.on('exit', (code, signal) => {
    console.log(`[speech.js] ffmpeg process exited with code ${code} and signal ${signal}`);
  });

  return () => {
    console.log('[speech.js] Stopping recording...');
    try {
      if (ffmpeg) {
        ffmpeg.stdin && ffmpeg.stdin.pause();
        ffmpeg.stdout && ffmpeg.stdout.pause();
        ffmpeg.stderr && ffmpeg.stderr.pause();
        ffmpeg.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[speech.js] Error stopping ffmpeg process:', e);
    }
  };
}

module.exports = { startRecording };
