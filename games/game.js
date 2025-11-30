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
    PERFECT: 0.015,
    BRILLIANT: 0.030,
    GREAT: 0.060,
    BAD: 0.120
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

let currentCombo = 0;  
let maxCombo = 0;     

let judgementTimeout = null; 


// --- ユーティリティ関数: 判定スコア変換 (変更なし) ---

// 判定名を数値スコアに変換
function getJudgmentScore(judgmentName) {
    switch (judgmentName) {
        case 'PERFECT!!!': return 4;
        case 'BRILLIANT!!': return 3;
        case 'GREAT!': return 2;
        case 'BAD': return 1;
        case 'MISS': 
        case 'FAIL': return 0;
        default: return 0;
    }
}

// 数値スコアを判定名に変換
function getJudgmentNameFromScore(score) {
    // スコアを丸め、0から4の範囲に収める
    const roundedScore = Math.min(4, Math.max(0, Math.round(score)));
    
    switch (roundedScore) {
        case 4: return 'PERFECT!!!';
        case 3: return 'BRILLIANT!!';
        case 2: return 'GREAT!';
        case 1: return 'BAD';
        case 0: return 'MISS';
        default: return 'MISS';
    }
}


// --- 2. 外部 JSONファイルを読み込む関数 (変更なし) ---
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
            note.tapScore = 0; 
        });
        
        startGame(); 
        
    } catch (error) {
        logToScreen(`ERROR: [${error.message}] ファイルが見つからないか、JSON形式が不正です。`);
        console.error("スコアファイルの読み込み中にエラーが発生しました:", error); 
    }
}

// 画面ログ出力関数 (変更なし)
function logToScreen(message) {
    const logElement = document.getElementById('log');
    if (logElement) {
        logElement.innerHTML += `<p>${message}</p>`; 
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// 判定テキストを画面右に出力 (変更なし)
function showJudgementText(judgment) {
    const textElement = document.getElementById('judgementText');
    if (!textElement) return;

    if (judgementTimeout) {
        clearTimeout(judgementTimeout);
    }

    textElement.textContent = judgment;
    textElement.style.opacity = 1;
    
    let color = 'white';
    if (judgment.includes('PERFECT')) color = '#FFD700';
    else if (judgment.includes('BRILLIANT')) color = '#00FFFF';
    else if (judgment.includes('GREAT')) color = '#FF69B4';
    else if (judgment.includes('BAD')) color = '#ADD8E6';
    else if (judgment.includes('MISS') || judgment.includes('FAIL')) color = '#FF4500';
    
    textElement.style.color = color;

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

// タップ/マウスダウン時の処理 (ホールド開始) (変更なし)
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
            
            // 早期リリース
            if (gameTime < endTime) {
                
                const tapScore = note.tapScore;
                const holdScore = 1; 
                
                const finalScore = (tapScore + holdScore) / 2;
                const finalJudgment = getJudgmentNameFromScore(finalScore);
                
                // ★修正点: 早期リリース時は画面に評価テキストを表示
                showJudgementText(`LONG ${finalJudgment} (Early Release)`); 
                logToScreen(`LONG ${finalJudgment} (Early Release)! Lane ${releasedLane}`); 
                
                if (finalJudgment !== 'BAD' && finalJudgment !== 'MISS') {
                    currentCombo++;
                    maxCombo = Math.max(maxCombo, currentCombo);
                } else {
                    if (currentCombo > 0) {
                        logToScreen(`COMBO BREAK: EARLY RELEASE (${currentCombo})`);
                    }
                    currentCombo = 0;
                }

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

// ゲーム状態の更新
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
                state: noteData.state,
                tapScore: noteData.tapScore 
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
                showJudgementText(`MISS (Too Late)`); 
                logToScreen(`MISS! Lane ${note.lane} (Too Late)`);
                
                if (currentCombo > 0) {
                    logToScreen(`COMBO BREAK: MISS (${currentCombo})`);
                }
                currentCombo = 0; 

                activeNotes.splice(i, 1); 
            }
            continue;
        }

        const endTime = note.time + (note.duration || 0);
        
        // ホールド成功判定 (終了時刻に達し、まだホールドが続いている)
        if (gameTime >= endTime && heldLanes[note.lane]) {
            
            const tapScore = note.tapScore;
            const holdScore = 4;
            
            const finalScore = (tapScore + holdScore) / 2;
            const finalJudgment = getJudgmentNameFromScore(finalScore);
            
            // ★修正点: ホールド完了時のみ画面に評価テキストを表示
            showJudgementText(`LONG ${finalJudgment} COMPLETE!`);
            logToScreen(`LONG ${finalJudgment} COMPLETE! Lane ${note.lane}`); 
            
            if (finalJudgment !== 'BAD' && finalJudgment !== 'MISS') {
                currentCombo++;
                maxCombo = Math.max(maxCombo, currentCombo);
            }
            
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

        // 判定ウィンドウのチェック (TAP判定もここで決定)
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

        if (judgment) {
            const tapScore = getJudgmentScore(judgment);

            if (note.type === 0) {
                // タップノーツ
                // ★修正点: タップノーツの場合のみ画面に評価テキストを表示
                showJudgementText(judgment); 
                
                if (judgment !== 'BAD') {
                    currentCombo++;
                    maxCombo = Math.max(maxCombo, currentCombo);
                } else {
                    if (currentCombo > 0) {
                        logToScreen(`COMBO BREAK: BAD (${currentCombo})`);
                    }
                    currentCombo = 0;
                }
                spliceIndex = i;
                judged = true;
                logToScreen(`TAP ${judgment} Lane ${tappedLane}`); 
            } else if (note.type === 1) {
                // ロングノーツ: 初期判定スコアを保存
                activeNotes[i].tapScore = tapScore; 
                
                activeNotes[i].state = NOTE_STATE.HELD; 
                judged = true;
                logToScreen(`HOLD START (${judgment})! Lane ${tappedLane}`); 
                
                // ★修正点: ロングノーツは開始時は画面に評価テキストを表示しない

                // ロングノーツのタップ開始時がBADの場合、コンボをリセット
                if (judgment === 'BAD') {
                    if (currentCombo > 0) {
                        logToScreen(`COMBO BREAK: BAD START (${currentCombo})`);
                    }
                    currentCombo = 0;
                }
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

    // コンボ数表示 (変更なし)
    if (currentCombo > 0) {
        ctx.font = '70px Arial'; 
        ctx.fillStyle = '#FFD700'; 
        ctx.textAlign = 'center';
        ctx.fillText(`${currentCombo}`, canvas.width / 2, 230);
        
        ctx.font = '30px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(`COMBO`, canvas.width / 2, 270);
    }

    // デバッグ情報 (変更なし)
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${gameTime.toFixed(2)}s`, 10, 30);
    ctx.fillText(`Notes: ${activeNotes.length}`, 10, 60);
    ctx.fillText(`Held: ${Object.keys(heldLanes).join(', ')}`, 10, 90); 
}

// =========================================================
// 描画補助関数 (LANE_COUNT=6に対応済み)
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
