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
const RECEIVE_LINE_Y = 550; // ノーツを受け取る判定線のY座標
const NOTE_SPEED = 250;     // ノーツ速度 (ピクセル/秒)

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    if (canvas) {
        try {
            ctx = canvas.getContext('2d');
            ctx.font = '30px Arial';
            ctx.fillStyle = '#2c3e50';
            ctx.textAlign = 'center';
            console.log("Canvas context initialized.");
        } catch (e) {
            console.error("Failed to get 2D context:", e);
        }
    } else {
        console.error("Canvas element 'gameCanvas' not found in the DOM.");
        document.getElementById('status').textContent = `致命的なエラー: gameCanvas要素が見つかりません。HTMLファイルを確認してください。`;
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
    if (!ctx) {
        document.getElementById('status').textContent = `エラー: Canvasのコンテキストが初期化されていません。`;
        console.error("Initialization failed: Canvas Context (ctx) is null.");
        return; 
    }
    
    // 画面切り替え
    document.getElementById('loaderArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    document.getElementById('status').textContent = `✅ 譜面と音楽ファイルの読み込みが完了しました！ゲーム開始中...`;
    
    // 音楽再生開始
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = buffer;
    audioSource.connect(audioContext.destination);
    
    // AudioContextがSuspended状態の場合に再開を試みる (ブラウザの自動再生ブロック対策)
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("AudioContext re-enabled.");
            startPlaybackAndLoop(buffer);
        }).catch(err => {
            console.error("AudioContext resume failed:", err);
            document.getElementById('status').textContent = `エラー: AudioContextの再開に失敗しました。ユーザー操作が必要です。`;
        });
    } else {
         startPlaybackAndLoop(buffer);
    }
}

/**
 * 音楽再生とゲームループ開始を分離したヘルパー関数
 */
function startPlaybackAndLoop(buffer) {
    // ゲーム開始時刻を記録し、音楽を再生
    startTime = audioContext.currentTime + 0.5; // 0.5秒のディレイ
    audioSource.start(startTime);
    
    // ゲームループ開始
    requestAnimationFrame(gameLoop);
}


/**
 * ゲームメインループ
 * @param {DOMHighResTimeStamp} timestamp 
 */
function gameLoop(timestamp) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // 6レーンの設定
    const LANE_COUNT = 6;
    const LANE_WIDTH = canvasWidth / LANE_COUNT;
    
    const currentTime = audioContext.currentTime - startTime;

    // 1. 画面クリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 2. レーンと判定線の描画
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    
    // 判定線
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
        
        // 判定線に到達するまでの残り時間 (秒)
        const timeRemaining = note.time - currentTime; 
        
        // 描画が必要なノーツのみ処理
        if (timeRemaining > (RECEIVE_LINE_Y / NOTE_SPEED) + 0.1 || timeRemaining < -0.5) { 
            continue;
        }

        // ノーツのY座標計算
        const pixelsToMove = timeRemaining * NOTE_SPEED; 
        const noteY = RECEIVE_LINE_Y - pixelsToMove; 

        // レーンのX座標
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

            // 描画のY座標の始点 (上端)
            const topY = noteY - longNoteHeight;
            const bottomY = noteY;

            // ロングノーツ本体の描画 (レーン幅いっぱいに描画)
            ctx.fillStyle = 'rgba(52, 152, 219, 0.7)'; 
            ctx.fillRect(noteX - (LANE_WIDTH / 2), topY, LANE_WIDTH, longNoteHeight);

            // ロングノーツの始点 (判定線に近い方) の描画
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
    if (audioSource && musicBuffer && currentTime < musicBuffer.duration + 2) { 
        requestAnimationFrame(gameLoop);
    } else if (audioSource) {
        document.getElementById('status').textContent = `ゲーム終了。ありがとうございました。`;
        audioSource.stop();
    }
}
