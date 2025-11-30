// --- 1. 定数とグローバル変数の設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d'); 

// 描画とロジックに関する定数
const LANE_COUNT = 6;           
const JUDGEMENT_LINE_Y = 550;   
const NOTE_APPEAR_Y = 50;       
const NOTE_TRAVEL_TIME = 1.5;   
const NOTE_SIZE = 50;           
const NOTE_HALF_SIZE = NOTE_SIZE / 2;

// 判定のタイミングウィンドウ (秒単位)
const JUDGEMENT_WINDOW = {
    PERFECT: 0.015,   // ± 15ミリ秒 (最も厳しい)
    BRILLIANT: 0.030, // ± 30ミリ秒
    GREAT: 0.060,     // ± 60ミリ秒
    BAD: 0.120        // ± 120ミリ秒 (BAD判定)
};
const MAX_JUDGEMENT_TIME = JUDGEMENT_WINDOW.BAD; 

// ノーツの状態定数
const NOTE_STATE = {
    DEFAULT: 0,
    HELD: 1,      
    JUDGED: 2     
};

// 状態変数
let NOTE_DATA = [];     
let activeNotes = [];   
let nextNoteIndex = 0;  

let isGameRunning = false;
let gameTime = 0;       
let lastTimestamp = 0;  

let heldLanes = {}; 

let judgementTimeout = null; // ★新規追加: 判定テキスト表示管理用


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

// 画面ログ出力関数 (デバッグ用)
function logToScreen(message) {
    const logElement = document.getElementById('log');
    if (logElement) {
        logElement.innerHTML += `<p>${message}</p>`; 
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// ★新規関数: 判定テキストを画面右に出力
function showJudgementText(judgment) {
    const textElement = document.getElementById('judgementText');
    if (!textElement) return;

    // 前のタイマーをクリア
    if (judgementTimeout) {
        clearTimeout(judgementTimeout);
    }

    // テキストと色を設定
    textElement.textContent = judgment;
    textElement.style.opacity = 1;
    
    let color = 'white';
    switch (judgment.split(' ')[0]) { // スペースで区切って最初の単語をチェック
        case 'PERFECT!!!': color = '#FFD700'; break; // ゴールド
        case 'BRILLIANT!!': color = '#00FFFF'; break; // シアン
        case 'GREAT!': color = '#FF69B4'; break; // ホットピンク
        case 'BAD': color = '#ADD8E6'; break; // ライトブルー
        case 'MISS': color = '#FF4500'; break; // オレンジレッド
    }
    textElement.style.color = color;


    // 0.5秒後にテキストをクリア（アニメーション効果）
    judgementTimeout = setTimeout(() => {
        textElement.style.opacity = 0;
        textElement.textContent = '---';
    }, 500); 
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
                // ホールド失敗時はMISSとして扱う
                showJudgementText(`MISS (HOLD FAIL)`); 
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
            
            // MISS判定 (ノーツが判定ラインを大きく過ぎてしまった場合の処理)
            if (gameTime > note.time + MAX_JUDGEMENT_TIME * 2) { 
                showJudgementText(`MISS (Too Late)`); // 画面にMISS表示
                logToScreen(`MISS! Lane ${note.lane} (Too Late)`);
                activeNotes.splice(i, 1); 
            }
            continue;
        }

        const endTime = note.time + (note.duration || 0);
        
        // ホールド成功判定
        if (gameTime >= endTime && heldLanes[note.lane]) {
            showJudgementText(`LONG PERFECT!!!`); // 画面にLONG PERFECT!!!表示
            logToScreen(`LONG PERFECT! Lane ${note.lane}`); 
            activeNotes.splice(i, 1); 
            delete heldLanes[note.lane];
        }
    }
}

// --- 5. 判定ロジック ---

function processJudgement(tappedLane) {
    let spliceIndex = -1; 
    let judged = false;
    
    for (let i = 0; i < activeNotes.length; i++) {
        const note = activeNotes[i];
        
        if (note.state === NOTE_STATE.HELD || note.lane !== tappedLane) {
            continue; 
        }
        
        const timeDifference = Math.abs(note.time - gameTime);
        let judgment = null; 

        // 判定ウィンドウのチェック
        if (timeDifference <= JUDGEMENT_WINDOW.PERFECT) {
            judgment = 'PERFECT!!!';
        } else if (timeDifference <= JUDGEMENT_WINDOW.BRILLIANT) {
            judgment = 'BRILLIANT!!';
        } else if (timeDifference <= JUDGEMENT_WINDOW.GREAT) {
            judgment = 'GREAT!';
        } else if (timeDifference <= JUDGEMENT_WINDOW.BAD) {
            judgment = 'BAD';
        } else {
            continue; 
        }

        // 判定が成功した場合
        if (judgment) {
            // 判定テキストを画面に表示
            showJudgementText(judgment); 

            if (note.type === 0) {
                // タップノーツ
                spliceIndex = i;
                judged = true;
                logToScreen(`TAP ${judgment} Lane ${tappedLane}`); 
            } else if (note.type === 1) {
                // ロングノーツ
                activeNotes[i].state = NOTE_STATE.HELD; 
                judged = true;
                logToScreen(`HOLD START (${judgment})! Lane ${tappedLane}`); 
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
// 描画補助関数
// =========================================================

function drawJudgementLine() {
    ctx.strokeStyle = '#00FFFF'; 
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
    const timeRemaining = note.time - gameTime; 
    const travelDistance = JUDGEMENT_LINE_Y - NOTE_APPEAR_Y; 
    let noteY = NOTE_APPEAR_Y + travelDistance * (NOTE_TRAVEL_TIME - timeRemaining) / NOTE_TRAVEL_TIME;

    const laneWidth = canvas.width / LANE_COUNT;
    const x = (note.lane - 1) * laneWidth + (laneWidth - NOTE_SIZE) / 2;

    // ロングノーツの描画
    if (note.type === 1) {
        const duration = note.duration || 1.0; 
        const endTime = note.time + duration;
        const endTimeRemaining = endTime - gameTime;
        
        let endNoteY = NOTE_APPEAR_Y + travelDistance * (NOTE_TRAVEL_TIME - endTimeRemaining) / NOTE_TRAVEL_TIME;
        
        ctx.fillStyle = (note.state === NOTE_STATE.HELD) ? '#00FF00' : 'blue'; 
        ctx.fillRect(x + NOTE_SIZE / 4, noteY, NOTE_HALF_SIZE, endNoteY - noteY);

        ctx.fillStyle = (note.state === NOTE_STATE.HELD) ? '#00AA00' : 'blue'; 
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
