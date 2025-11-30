// --- 1. 定数とグローバル変数の設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d'); 

// 描画とロジックに関する定数
const LANE_COUNT = 4;           // レーンの数 (必要に応じて6に変更してください)
const JUDGEMENT_LINE_Y = 550;   // 判定ラインのY座標 
const NOTE_APPEAR_Y = 50;       // ノーツが出現するY座標
const NOTE_TRAVEL_TIME = 1.5;   // ノーツが上から下まで移動する時間 (秒)
const JUDGEMENT_TOLERANCE = 0.1; // 判定の許容誤差 (±0.1秒 = 100ms)
const NOTE_SIZE = 50;           // ノーツの一辺の長さ (ピクセル)
const NOTE_HALF_SIZE = NOTE_SIZE / 2;

// ノーツの状態定数
const NOTE_STATE = {
    DEFAULT: 0,
    HELD: 1,      // ロングノーツがホールドされている状態
    JUDGED: 2     // 判定済み
};

// 状態変数
let NOTE_DATA = [];     
let activeNotes = [];   
let nextNoteIndex = 0;  

let isGameRunning = false;
let gameTime = 0;       
let lastTimestamp = 0;  

let heldLanes = {}; 


// --- 2. 外部 JSONファイルを読み込む関数 (非同期処理) ---
async function loadScore(url) {
    try {
        logToScreen("スコアファイルを読み込み中..."); 
        const response = await fetch(url); 
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json(); 
        
        NOTE_DATA = data.notes;
        logToScreen(`スコアデータ ${NOTE_DATA.length} 件を読み込みました。`);
        
        NOTE_DATA.forEach(note => {
            note.state = NOTE_STATE.DEFAULT;
        });
        
        startGame(); 
        
    } catch (error) {
        logToScreen(`ERROR: [${error.message}] ファイルが見つからないか、JSON形式が不正です。`);
        console.error("スコアファイルの読み込み中にエラーが発生しました:", error); 
    }
}

// 画面ログ出力関数
function logToScreen(message) {
    const logElement = document.getElementById('log');
    if (logElement) {
        logElement.innerHTML += `<p>${message}</p>`; 
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// --- 3. ゲーム開始と入力イベントの設定 ---
function startGame() {
    isGameRunning = true;
    
    canvas.addEventListener('touchstart', handleStartHold, { passive: false }); 
    canvas.addEventListener('touchend', handleEndHold);
    canvas.addEventListener('mousedown', handleStartHold);
    canvas.addEventListener('mouseup', handleEndHold);
    canvas.addEventListener('contextmenu', e => e.preventDefault()); 
    
    lastTimestamp = performance.now(); 
    requestAnimationFrame(gameLoop);   
}

// どのレーンがタップされたかを計算する補助関数
function getTappedLane(event) {
    event.preventDefault(); 
    const rect = canvas.getBoundingClientRect();
    
    let clientX;
    if (event.touches) {
        clientX = event.touches[0].clientX;
    } else {
        clientX = event.clientX;
    }

    const clickX = clientX - rect.left;
    const laneWidth = canvas.width / LANE_COUNT;
    const tappedLane = Math.floor(clickX / laneWidth) + 1;
    return tappedLane;
}

// タップ/マウスダウン時の処理 (ホールド開始)
function handleStartHold(event) {
    if (!isGameRunning) return;
    const tappedLane = getTappedLane(event);
    heldLanes[tappedLane] = true;
    processJudgement(tappedLane); 
}

// 指を離す/マウスアップ時の処理 (ホールド終了)
function handleEndHold(event) {
    if (!isGameRunning) return;

    const releasedLane = getTappedLane(event);
    delete heldLanes[releasedLane];
    
    for (let i = activeNotes.length - 1; i >= 0; i--) {
        const note = activeNotes[i];
        
        if (note.type === 1 && note.state === NOTE_STATE.HELD && note.lane === releasedLane) {
            const endTime = note.time + (note.duration || 0);
            if (gameTime < endTime) {
                logToScreen(`HOLD FAIL (Released early)! Lane ${releasedLane}`); 
                activeNotes.splice(i, 1);
            }
        }
    }
}


// --- 4. メインループと更新処理 ---

function gameLoop(timestamp) {
    if (!isGameRunning) return;
    
    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// ゲーム状態の更新 (ノーツの出現や判定外れをチェック)
function update(deltaTime) {
    gameTime += deltaTime; 
    
    // 2. ノーツの出現チェックとアクティブ化 (省略)
    while (nextNoteIndex < NOTE_DATA.length) {
        const noteData = NOTE_DATA[nextNoteIndex];
        const appearTime = noteData.time - NOTE_TRAVEL_TIME;

        if (gameTime >= appearTime) {
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

    // 3. ホールドノーツの終了チェックと削除 
    for (let i = activeNotes.length - 1; i >= 0; i--) {
        const note = activeNotes[i];
        
        if (note.state !== NOTE_STATE.HELD) {
            continue;
        }

        const endTime = note.time + (note.duration || 0);
        
        // ホールド成功判定
        if (gameTime >= endTime && heldLanes[note.lane]) {
            logToScreen(`LONG PERFECT! Lane ${note.lane}`); 
            activeNotes.splice(i, 1); 
            delete heldLanes[note.lane];
        }
        
        // MISS判定 (ノーツが判定ラインを大きく過ぎてしまった場合の処理)
        if (note.type === 0 || (note.type === 1 && note.state !== NOTE_STATE.HELD)) {
            if (gameTime > note.time + JUDGEMENT_TOLERANCE * 2) { 
                logToScreen(`MISS! Lane ${note.lane}`);
                activeNotes.splice(i, 1); // ここでミスノーツを削除
            }
        }
    }
}

// --- 5. 判定ロジック ---

function processJudgement(tappedLane) {
    let spliceIndex = -1; 
    let judged = false;
    
    for (let i = 0; i < activeNotes.length; i++) {
        const note = activeNotes[i];
        
        if (note.state === NOTE_STATE.HELD) {
            continue;
        }

        if (note.lane !== tappedLane) {
            continue; 
        }
        
        const timeDifference = Math.abs(note.time - gameTime);
        
        if (timeDifference <= JUDGEMENT_TOLERANCE) {
            
            if (note.type === 0) {
                // タップノーツ: 即座に削除
                spliceIndex = i;
                judged = true;
                logToScreen(`TAP PERFECT! Lane ${tappedLane}`); 
            } else if (note.type === 1) {
                // ロングノーツ: ホールド状態に移行
                activeNotes[i].state = NOTE_STATE.HELD; 
                judged = true;
                logToScreen(`HOLD START! Lane ${tappedLane}`); 
            }
            break; 
        }
    }
    
    if (judged && spliceIndex !== -1) {
        activeNotes.splice(spliceIndex, 1);
    }
}

// --- 6. 描画処理 ---

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // ★描画補助関数の呼び出し
    drawLanes();
    drawJudgementLine();

    activeNotes.forEach(note => {
        drawNote(note);
    });

    // デバッグ情報
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Time: ${gameTime.toFixed(2)}s`, 10, 30);
    ctx.fillText(`Notes: ${activeNotes.length}`, 10, 60);
    ctx.fillText(`Held: ${Object.keys(heldLanes).join(', ')}`, 10, 90); 
}

// =========================================================
// ★★★ 描画補助関数（欠落していた部分） ★★★
// =========================================================

function drawJudgementLine() {
    ctx.strokeStyle = '#00FFFF'; // シアン色
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, JUDGEMENT_LINE_Y);
    ctx.lineTo(canvas.width, JUDGEMENT_LINE_Y);
    ctx.stroke();
}

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

function drawNote(note) {
    // Y座標の計算 (ノーツがどこにあるか)
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
        
        // ロングノーツの本体（線）の描画 
        ctx.fillStyle = (note.state === NOTE_STATE.HELD) ? '#00FF00' : 'blue'; // 緑色 or 青色
        ctx.fillRect(x + NOTE_SIZE / 4, noteY, NOTE_HALF_SIZE, endNoteY - noteY);

        // 終了ノーツ（尾）の描画
        ctx.fillStyle = (note.state === NOTE_STATE.HELD) ? '#00AA00' : 'blue'; // 暗い緑 or 青色
        ctx.fillRect(x, endNoteY - NOTE_HALF_SIZE, NOTE_SIZE, NOTE_SIZE);
    }
    
    // タップノーツまたはロングノーツの頭（開始ノーツ）の描画
    let headColor = '';
    if (note.type === 0) {
        headColor = 'red';
    } else if (note.type === 1) {
        headColor = (note.state === NOTE_STATE.HELD) ? 'cyan' : 'blue';
    }

    ctx.fillStyle = headColor; 
    ctx.fillRect(x, noteY - NOTE_HALF_SIZE, NOTE_SIZE, NOTE_SIZE);
}

// --- 7. ゲームの実行開始 ---
loadScore('score.json');
