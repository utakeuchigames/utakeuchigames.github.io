// --- 1. 定数とグローバル変数の設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d'); 

// 描画とロジックに関する定数 (省略)
const LANE_COUNT = 4;           
const JUDGEMENT_LINE_Y = 550;   
const NOTE_APPEAR_Y = 50;       
const NOTE_TRAVEL_TIME = 1.5;   
const JUDGEMENT_TOLERANCE = 0.1; 
const NOTE_SIZE = 50;           
const NOTE_HALF_SIZE = NOTE_SIZE / 2;

// ノーツの状態定数 (省略)
const NOTE_STATE = {
    DEFAULT: 0,
    HELD: 1,      
    JUDGED: 2     
};

// 状態変数 (省略)
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
        // ★修正: JSON読み込みエラーをlogToScreenに出力し、console.errorは残す
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

// --- 3. ゲーム開始と入力イベントの設定 (省略) ---
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

// どのレーンがタップされたかを計算する補助関数 (省略)
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
                // ★修正: console.log を logToScreen に変更
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
        
        // MISS判定 (判定ラインを大きく過ぎてしまったタップノーツ/未ホールドのロングノーツの処理)
        if (note.type === 0 || note.type === 1) {
            if (gameTime > note.time + JUDGEMENT_TOLERANCE * 2) { 
                // ★修正: MISS判定ログをlogToScreenに出力 (ここではノーツ削除は行わない)
                logToScreen(`MISS! Lane ${note.lane}`);
                // activeNotes.splice(i, 1); // 簡略化のため削除は一旦保留
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
                // ★修正: logToScreenに出力
                logToScreen(`TAP PERFECT! Lane ${tappedLane}`); 
            } else if (note.type === 1) {
                // ロングノーツ: ホールド状態に移行
                activeNotes[i].state = NOTE_STATE.HELD; 
                judged = true;
                // ★修正: logToScreen
