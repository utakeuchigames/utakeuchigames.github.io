// --- 1. 定数とグローバル変数 ---
let scoreData = null;       // 譜面データ (JSONオブジェクト)
let musicBuffer = null;     // 音楽データ (Web Audio APIのAudioBuffer)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

let canvas;
let ctx; 

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        ctx.font = '30px Arial';
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center';
    }
});


/**
 * .nmpackファイル（ZIP）を読み込み、譜面と音楽を抽出する
 * @param {Event} event 
 */
function loadScorePackage(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('status').textContent = `ファイルを読み込み中...`;

    const reader = new FileReader();
    reader.onload = function(e) {
        if (typeof JSZip === 'undefined') {
            document.getElementById('status').textContent = `エラー: JSZipライブラリが読み込まれていません。`;
            return;
        }

        JSZip.loadAsync(e.target.result).then(function(zip) {
            
            // 2. score.json の抽出
            const scoreJsonFile = zip.file("score.json");
            if (!scoreJsonFile) {
                document.getElementById('status').textContent = `エラー: ZIP内に 'score.json' が見つかりません。`;
                return;
            }

            scoreJsonFile.async("string").then(function (jsonString) {
                try {
                    scoreData = JSON.parse(jsonString);
                    document.getElementById('scoreDataOutput').textContent = 
                        `【譜面データ】\n曲名: ${scoreData.song_title}\nBPM: ${scoreData.bpm}\nノーツ数: ${scoreData.notes.length}`;
                    
                    // 3. config.json から音楽ファイル名を取得 (推奨)
                    zip.file("config.json")?.async("string").then(function (configString) {
                        const config = JSON.parse(configString);
                        const musicFileName = config.music_file;
                        loadMusicFile(zip, musicFileName);
                    }).catch(() => {
                        // config.json がない場合、一般的なファイル名で試行
                        console.warn("config.jsonが見つかりません。mp3/oggで試行します。");
                        loadMusicFile(zip, 'music.mp3') || loadMusicFile(zip, 'music.ogg');
                    });

                } catch (parseError) {
                    document.getElementById('status').textContent = `エラー: score.jsonの解析に失敗しました。`;
                    console.error(parseError);
                }
            });

        }).catch(function(err) {
            document.getElementById('status').textContent = `エラー: ZIPファイルのロードに失敗しました。`;
            console.error(err);
        });
    };
    reader.readAsArrayBuffer(file);
}

/**
 * ZIPファイルから音楽ファイルを抽出し、Web Audio APIでデコードする
 * @param {JSZip} zip 
 * @param {string} fileName 
 */
function loadMusicFile(zip, fileName) {
    const musicFile = zip.file(fileName);

    if (!musicFile) {
        if (fileName !== 'music.mp3' && fileName !== 'music.ogg') return false; 
        
        document.getElementById('status').textContent = `エラー: 音楽ファイル '${fileName}' がZIP内に見つかりません。`;
        return false;
    }

    document.getElementById('status').textContent = `音楽ファイル '${fileName}' をデコード中... (Web Audio API)`;

    // 4. 音楽ファイルを ArrayBuffer として抽出し、デコード
    musicFile.async("arraybuffer").then(function (buffer) {
        
        audioContext.decodeAudioData(buffer, function(decodedBuffer) {
            
            musicBuffer = decodedBuffer;
            
            // 💡 読み込み完了後、画面を切り替えてゲームを初期化
            initializeGame(scoreData, musicBuffer); 

        }, function(error) {
            document.getElementById('status').textContent = `エラー: 音楽ファイルのデコードに失敗しました。ファイル形式 (${fileName}) を確認してください。`;
            console.error("Audio Decode Error:", error);
        });

    }).catch(function(err) {
        document.getElementById('status').textContent = `エラー: 音楽ファイルの抽出に失敗しました。`;
        console.error(err);
    });

    return true;
}


/**
 * ロード完了後の画面切り替えとゲーム初期化
 * @param {object} score - 譜面データ
 * @param {AudioBuffer} buffer - デコードされた音楽バッファ
 */
function initializeGame(score, buffer) {
    if (!ctx) return;
    
    // 💡 ファイル選択エリアを非表示にし、ゲームエリアを表示
    document.getElementById('loaderArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    document.getElementById('status').textContent = `✅ 譜面と音楽ファイルの読み込みが完了しました！再生準備OK。`;
    
    // 画面をクリアし、ロードされた情報を描画（初期メッセージ）
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(score.song_title, canvas.width / 2, 100);
    
    ctx.fillStyle = '#3498db';
    ctx.fillText(`BPM: ${score.bpm}`, canvas.width / 2, 150);
    
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`ノーツ数: ${score.notes.length}`, canvas.width / 2, 200);
    
    // ここで requestAnimationFrame を使ったゲームループを開始します
    // startGameLoop(score, buffer); 
}
