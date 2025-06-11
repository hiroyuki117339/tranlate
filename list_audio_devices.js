const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

async function getInputDevices() {
  try {
    // ffmpegで利用可能なオーディオデバイスを取得
    const { stdout, stderr } = await exec('ffmpeg -f avfoundation -list_devices true -i "" 2>&1 || true');
    
    // オーディオデバイスのみを抽出
    const audioDevices = [];
    const lines = (stdout || '').split('\n').concat((stderr || '').split('\n'));
    
    let isAudioSection = false;
    
    lines.forEach(line => {
      if (line.includes('AVFoundation audio devices:')) {
        isAudioSection = true;
        return;
      }
      
      if (isAudioSection) {
        // 例: [AVFoundation indev @ 0x7f...] [0] Built-in Microphone
        const match = line.match(/\[(\d+)\]\s*(.+)$/);
        if (match) {
          audioDevices.push({
            id: match[1],
            name: match[2].trim()
          });
        }
      }
    });
    
    return audioDevices;
  } catch (error) {
    console.error('Error getting audio devices:', error);
    return [];
  }
}

module.exports = { getInputDevices };

// このファイルが直接実行された場合にのみ、デバイスリストをJSONとして出力
if (require.main === module) {
  (async () => {
    console.log(JSON.stringify(await getInputDevices()));
  })();
}
