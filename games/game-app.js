// --- 1. 定数とグローバル変数 ---
let scoreData = null;       // 譜面データ (JSONオブジェクト)
let musicBuffer = null;     // 音楽データ (Web Audio APIのAudioBuffer)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSource = null;     // 再生用のAudioBufferSourceNode

let canvas;
let ctx; 

// ゲームプレイ用変数
let startTime = 0;          // 音楽再生開始時刻 (秒)
let currentNoteIndex = 0;   // 処理中のノーツインデックス
// 💡 6レーンに対応するため、レーン計算を変更
const RECEIVE_LINE_Y = 550; // ノーツを受け取る判定線のY座標
const NOTE_SPEED = 200;     // ノーツ速度 (ピクセル/秒)

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
 * .nmpackファイル（ZIP）を読み込み、譜面と音楽を抽出する (省略なし)
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
                    
                    zip.file("config.json")?.async("string").then(function (configString) {
                        const config = JSON.parse(configString);
                        const musicFileName = config.music_file;
                        loadMusicFile(zip, musicFileName);
                    }).catch(() => {
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
 * ZIPファイルから音楽ファイルを抽出し、Web Audio APIでデコードする (省略なし)
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

    musicFile.async("arraybuffer").then(function (buffer) {
        
        audioContext.decodeAudioData(buffer, function(decodedBuffer) {
            
            musicBuffer = decodedBuffer;
            
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
    
    // 画面切り替え
    document.getElementById('loaderArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    // Web Audio APIの仕様で、最初のクリックがないと再生できないことがあるため、
    // ここでは自動再生せず、メッセージを表示してクリックを促すのが安全だが、
    // 開発用途のため自動で開始する
    document.getElementById('status').textContent = `✅ 譜面と音楽ファイルの読み込みが完了しました！ゲーム開始中...`;
    
    // 音楽再生開始
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = buffer;
    audioSource.connect(audioContext.destination);
    
    // ゲーム開始時刻を記録し、音楽を再生
    startTime = audioContext.currentTime + 0.5; // 0.5秒のディレイ
    audioSource.start(startTime);
    
    // ゲームループ開始
    requestAnimationFrame(gameLoop);
}


/**
 * 💡 ゲームメインループ (6レーン対応)
 * @param {DOMHighResTimeStamp} timestamp 
 */
function gameLoop(timestamp) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // 💡 6レーンの設定
    const LANE_COUNT = 6;
    const LANE_WIDTH = canvasWidth / LANE_COUNT;
    
    // 現在の曲の再生時刻を計算
    const currentTime = audioContext.currentTime - startTime;

    // 1. 画面クリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 2. レーンと判定線の描画
    
    // 判定線
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, RECEIVE_LINE_Y);
    ctx.lineTo(canvasWidth, RECEIVE_LINE_Y);
    ctx.stroke();

    // レーンガイド (5本の縦線)
    ctx.lineWidth = 1;
    for (let i = 1; i < LANE_COUNT; i++) {
        const x = LANE_WIDTH * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    
    // 3. ノーツの描画
    const notes = scoreData.notes;
    
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        
        // 判定線に到達する時間 (note.time) からの差分
        const timeRemaining = note.time - currentTime; 
        
        // 描画が必要なノーツのみ処理
        if (timeRemaining > 2.5 || timeRemaining < -0.5) { 
            continue;
        }

        // 判定線 (Y=RECEIVE_LINE_Y) に到達するために、ノーツが移動すべき距離
        const distanceToReceiver = timeRemaining * NOTE_SPEED; 
        
        // ノーツの現在のY座標
        const noteY = RECEIVE_LINE_Y - distanceToReceiver;

        // 💡 レーンのX座標 (note.laneは1〜6。0〜5に変換して中央座標を計算)
        const laneIndex = note.lane - 1; 
        const noteX = (laneIndex * LANE_WIDTH) + (LANE_WIDTH / 2);
        const noteRadius = 15;

        // ノーツの描画
        if (note.type === 0) { // Tap
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(noteX, noteY, noteRadius, 0, Math.PI * 2);
            ctx.fill();
        } else if (note.type === 1) { // Long
            const duration_sec = note.duration || 0.5;

            // ロングノーツのピクセルでの長さ
            const longNoteHeight = duration_sec * NOTE_SPEED;

            // 描画のY座標の始点と終点
            const topY = noteY - longNoteHeight;
            const bottomY = noteY;

            // ロングノーツ本体の描画 (レーン幅いっぱいに描画)
            ctx.fillStyle = 'rgba(52, 152, 219, 0.7)'; 
            ctx.fillRect(noteX - (LANE_WIDTH / 2), topY, LANE_WIDTH, longNoteHeight);

            // ロングノーツの始点の描画 (Tapと同じ円)
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.arc(noteX, bottomY, noteRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 画面上部に現在の時間と情報を表示 (デバッグ用)
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText(`Time: ${currentTime.toFixed(2)}s`, 10, 30);
    }

    // 4. 再帰的なループ呼び出し
    if (currentTime < musicBuffer.duration + 2) { 
        requestAnimationFrame(gameLoop);
    } else {
        document.getElementById('status').textContent = `ゲーム終了。ありがとうございました。`;
        audioSource.stop();
    }
}
