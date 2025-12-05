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
const NOTE_SPEED = 250;     // ノーツ速度 (ピクセル/秒) を少し上げた
const PRE_RENDER_TIME = 2.0; // ノーツが画面上端に来るまでの時間 (秒)

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
 * .nmpackファイル（ZIP）を読み込み、譜面と音楽を抽出する (省略)
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
 * ZIPファイルから音楽ファイルを抽出し、Web Audio APIでデコードする (省略)
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
 * ロード完了後の画面切り替えとゲーム初期化 (省略)
 * @param {object} score - 譜面データ
 * @param {AudioBuffer} buffer - デコードされた音楽バッファ
 */
function initializeGame(score, buffer) {
    if (!ctx) return;
    
    document.getElementById('loaderArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('status').textContent = `✅ 譜面と音楽ファイルの読み込みが完了しました！ゲーム開始中...`;
    
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = buffer;
    audioSource.connect(audioContext.destination);
    
    startTime = audioContext.currentTime + 0.5; 
    audioSource.start(startTime);
    
    requestAnimationFrame(gameLoop);
}


/**
 * 💡 ゲームメインループ (ノーツ落下ロジック修正済み)
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
        
        // 描画が必要なノーツのみ処理 (画面上端から判定線までの時間 + 判定線通過後の時間)
        // 画面上端 = RECEIVE_LINE_Y / NOTE_SPEED = 550 / 250 = 2.2秒
        if (timeRemaining > (RECEIVE_LINE_Y / NOTE_SPEED) + 0.1 || timeRemaining < -0.5) { 
            continue;
        }

        // 💡 ノーツのY座標計算を修正
        // ノーツは "判定線までの距離 (RECEIVE_LINE_Y)" から、
        // ノーツが "判定線に到達するまでの時間" に応じた移動距離を引いた位置に描画する。
        const pixelsToMove = timeRemaining * NOTE_SPEED; 
        const noteY = RECEIVE_LINE_Y - pixelsToMove; 
        // timeRemainingが2.0秒のとき (判定線から500px上)、noteY = 550 - 500 = 50。
        // timeRemainingが0.0秒のとき (判定線上)、noteY = 550 - 0 = 550。 -> OK

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

            // ロングノーツ本体の描画
            ctx.fillStyle = 'rgba(52, 152, 219, 0.7)'; 
            // 💡 topY (ノーツの上端) は判定線より上 (Y座標が小さい)
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
    if (currentTime < musicBuffer.duration + 2) { 
        requestAnimationFrame(gameLoop);
    } else {
        document.getElementById('status').textContent = `ゲーム終了。ありがとうございました。`;
        audioSource.stop();
    }
}
