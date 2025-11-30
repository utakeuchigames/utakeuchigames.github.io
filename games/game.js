// --- 1. 定数とグローバル変数の設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d'); 

// 描画とロジックに関する定数
const LANE_COUNT = 4;           // レーンの数
const JUDGEMENT_LINE_Y = 550;   // 判定ラインのY座標 (Canvasの底に近い位置)
const NOTE_APPEAR_Y = 50;       // ノーツが出現するY座標 (Canvasの上に近い位置)
const NOTE_TRAVEL_TIME = 1.5;   // ノーツが上から下まで移動する時間 (秒)
const JUDGEMENT_TOLERANCE = 0.1; // 判定の許容誤差 (±0.1秒 = 100ms)
const NOTE_SIZE = 50;           // ノーツの一辺の長さ (ピクセル)
const NOTE_HALF_SIZE = NOTE_SIZE / 2;

// ノーツの状態定数 (★ロングノーツ判定のために追加/変更)
const NOTE_STATE = {
    DEFAULT: 0,
    HELD: 1,      // ロングノーツがホールドされている状態
    JUDGED: 2     // 判定済み (タップノーツ成功など)
};

// 状態変数
let NOTE_DATA = [];     // 読み込まれた全ノーツデータ
let activeNotes = [];   // 画面に表示されているノーツ
let nextNoteIndex = 0;  // 次に出現させるノーツデータのインデックス

let isGameRunning = false;
let gameTime = 0;       // ゲームが始まってからの時間 (秒)
let lastTimestamp = 0;  // 前回 gameLoop が呼ばれた時刻 (ミリ秒)
// --- 2. 外部 JSONファイルを読み込む関数 (非同期処理) の前に追記 ---

// 画面ログ出力関数 (iPad単体デバッグ用)
// 画面上の <div id="log"> にメッセージを追加します
function logToScreen(message) {
    const logElement = document.getElementById('log');
    if (logElement) {
        // 現在のログに新しいメッセージを追加し、HTMLタグを無視して表示
        logElement.innerHTML += `<p>${message}</p>`; 
        // ログが画面外に流れた場合、一番下にスクロールする
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// --- 2. 外部 JSONファイルを読み込む関数 (非同期処理) ---
async function loadScore(url) {
    try {
        console.log("スコアファイルを読み込み中...");
        // 外部ファイルを取得
        const response = await fetch(url); 
        // 取得したテキストをJSONオブジェクトに変換
        const data = await response.json(); 
        
        NOTE_DATA = data.notes;
        logToScreen(`スコアデータ ${NOTE_DATA.length} 件を読み込みました。`);
        
        // ノーツの状態を初期化してstartGameを呼び出す
        NOTE_DATA.forEach(note => {
            note.state = NOTE_STATE.DEFAULT;
        });
        
        startGame(); 
        
    } catch (error) {
        // iPad単体デバッグ用: 画面にエラーを表示する
        logToScreen(`ERROR: ファイルが見つからないか、JSON形式が不正です。`);
        console.error("スコアファイルの読み込み中にエラーが発生しました:", error);
    }
}

// 画面ログ出力 (iPad単体デバッグ用)


// --- 3. ゲーム開始と入力イベントの設定 ---

function startGame() {
    isGameRunning = true;
    
    // 入力イベントリスナーを設定 (テキスト選択防止のため、preventDefaultはhandleTap内で実行)
    canvas.addEventListener('click', handleTap);
    
    lastTimestamp = performance.now(); // 最初の時刻を記録
    requestAnimationFrame(gameLoop);   // ゲームループ開始
}

// タップ（クリック）イベント処理
function handleTap(event) {
    // ブラウザの標準動作（テキスト選択、メニュー表示など）をキャンセル
    event.preventDefault(); 
    
    if (!isGameRunning) return;

    // クリック位置からどのレーンがタップされたか計算
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const laneWidth = canvas.width / LANE_COUNT;
    const tappedLane = Math.floor(clickX / laneWidth) + 1;
    
    // 判定ロジックを呼び出す
    processJudgement(tappedLane); 
}

// --- 4. メインループと更新処理 ---

function gameLoop(timestamp) {
    if (!isGameRunning) return;
    
    // 経過時間 (deltaTime) の計算 (秒単位)
    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// ゲーム状態の更新 (ノーツの出現や判定外れをチェック)
function update(deltaTime) {
    // 1. ゲーム時間の更新
    gameTime += deltaTime; 
    
    // 2. ノーツの出現チェックとアクティブ化
    while (nextNoteIndex < NOTE_DATA.length) {
        const noteData = NOTE_DATA[nextNoteIndex];
        const appearTime = noteData.time - NOTE_TRAVEL_TIME;

        if (gameTime >= appearTime) {
            // ノーツをアクティブリストに追加 (元のNOTE_DATAのstateをコピー)
            activeNotes.push({
                time: noteData.time,
                lane: noteData.lane,
                type: noteData.type,
                duration: noteData.duration || 0,
                state: noteData.state 
            });
            nextNoteIndex++;
        } else {
            break; 
        }
    }

    // 3. ホールドノーツの終了チェックと削除 (★ロングノーツ判定の継続ロジック)
    for (let i = activeNotes.length - 1; i >= 0; i--) {
        const note = activeNotes[i];
        
        // ホールド中ではないノーツはスキップ
        if (note.state !== NOTE_STATE.HELD) {
            continue;
        }

        // ロングノーツの終了時間
        const endTime = note.time + (note.duration || 0);
        
        if (gameTime >= endTime) {
            // 終了時間に達した！ (ホールド成功とみなし削除)
            logToScreen("HOLD END! 成功として削除");
            activeNotes.splice(i, 1); 
        }
    }
}

// --- 5. 判定ロジック ---

function processJudgement(tappedLane) {
    let spliceIndex = -1; 
    let judged = false;
    
    // 判定ラインに近いノーツから順にチェック
    for (let i = 0; i < activeNotes.length; i++) {
        const note = activeNotes[i];
        
        // すでにホールド中のノーツは無視 (開始タップのみを処理するため)
        if (note.state === NOTE_STATE.HELD) {
            continue;
        }

        // レーンが一致しているか
        if (note.lane !== tappedLane) {
            continue; 
        }
        
        // 時間的に判定範囲内か 
        const timeDifference = Math.abs(note.time - gameTime);
        
        if (timeDifference <= JUDGEMENT_TOLERANCE) {
            
            if (note.type === 0) {
                // タップノーツ: 即座に削除
                spliceIndex = i;
                judged = true;
                logToScreen(`TAP PERFECT!`);
            } else if (note.type === 1) {
                // ロングノーツ: ホールド状態に移行し、即座に削除しない
                activeNotes[i].state = NOTE_STATE.HELD; 
                judged = true;
                logToScreen(`HOLD START!`);
            }
            break; 
        }
    }
    
    // タップノーツが成功した場合のみ削除
    if (judged && spliceIndex !== -1) {
        activeNotes.splice(spliceIndex, 1);
    }
}


// --- 6. 描画処理 ---

function draw() {
    // 画面全体をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // レーンと判定ラインの描画
    drawLanes();
    drawJudgementLine();

    // アクティブなノーツを一つずつ描画
    activeNotes.forEach(note => {
        drawNote(note);
    });

    // デバッグ情報
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Time: ${gameTime.toFixed(2)}s`, 10, 30);
    ctx.fillText(`Notes: ${activeNotes.length}`, 10, 60);
}

// 描画補助関数: 判定ライン
function drawJudgementLine() {
    ctx.strokeStyle = '#00FFFF'; // シアン色
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, JUDGEMENT_LINE_Y);
    ctx.lineTo(canvas.width, JUDGEMENT_LINE_Y);
    ctx.stroke();
}

// 描画補助関数: レーン
function drawLanes() {
    const laneWidth = canvas.width / LANE_COUNT;
    ctx.strokeStyle = '#555'; 
    ctx.lineWidth = 2;         

    for (let i = 1; i < LANE_COUNT; i++) {
        const x = i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

// 描画補助関数: ノーツ
function drawNote(note) {
    // Y座標の計算 (ロジックの核)
    const timeRemaining = note.time - gameTime; 
    const travelDistance = JUDGEMENT_LINE_Y - NOTE_APPEAR_Y; 
    let noteY = NOTE_APPEAR_Y + travelDistance * (NOTE_TRAVEL_TIME - timeRemaining) / NOTE_TRAVEL_TIME;

    // X座標の計算
    const laneWidth = canvas.width / LANE_COUNT;
    const x = (note.lane - 1) * laneWidth + (laneWidth - NOTE_SIZE) / 2;

    // ロングノーツの描画
    if (note.type === 1) {
        const duration = note.duration || 1.0; 
        const endTime = note.time + duration;
        const endTimeRemaining = endTime - gameTime;
        
        let endNoteY = NOTE_APPEAR_Y + travelDistance * (NOTE_TRAVEL_TIME - endTimeRemaining) / NOTE_TRAVEL_TIME;
        
        // ロングノーツの本体（線）の描画 (★ホールド中は緑色)
        ctx.fillStyle = (note.state === NOTE_STATE.HELD) ? '#00FF00' : 'blue'; 
        ctx.fillRect(x + NOTE_SIZE / 4, noteY, NOTE_HALF_SIZE, endNoteY - noteY);

        // 終了ノーツ（尾）の描画
        ctx.fillStyle = (note.state === NOTE_STATE.HELD) ? '#00AA00' : 'blue'; 
        ctx.fillRect(x, endNoteY - NOTE_HALF_SIZE, NOTE_SIZE, NOTE_SIZE);
    }
    
    // タップノーツまたはロングノーツの頭（開始ノーツ）の描画
    let headColor = '';
    if (note.type === 0) {
        headColor = 'red';
    } else if (note.type === 1) {
        // ★ホールド中はシアン（水色）にする
        headColor = (note.state === NOTE_STATE.HELD) ? 'cyan' : 'blue';
    }

    ctx.fillStyle = headColor; 
    ctx.fillRect(x, noteY - NOTE_HALF_SIZE, NOTE_SIZE, NOTE_SIZE);
}

// --- 7. ゲームの実行開始 ---
// スコアファイルの読み込みから全てが始まる
loadScore('score.json');
