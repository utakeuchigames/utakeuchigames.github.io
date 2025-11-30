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

// 状態変数
let NOTE_DATA = [];     // 読み込まれた全ノーツデータ
let activeNotes = [];   // 画面に表示されているノーツ
let nextNoteIndex = 0;  // 次に出現させるノーツデータのインデックス

let isGameRunning = false;
let gameTime = 0;       // ゲームが始まってからの時間 (秒)
let lastTimestamp = 0;  // 前回 gameLoop が呼ばれた時刻 (ミリ秒)

// --- 2. 外部 JSONファイルを読み込む関数 ---
// サーバーから譜面データ 'score.json' を非同期で取得する
async function loadScore(url) {
    try {
        console.log("スコアファイルを読み込み中...");
        const response = await fetch(url); 
        const data = await response.json(); 
        
        // 外部JSONの "notes" 配列を NOTE_DATA に格納
        NOTE_DATA = data.notes;
        console.log(`スコアデータ ${NOTE_DATA.length} 件を読み込みました。`);
        
        startGame(); // データ読み込み後にゲームを開始
        
    } catch (error) {
        console.error("スコアファイルの読み込み中にエラーが発生しました:", error);
    }
}

// --- 3. ゲーム開始と入力イベントの設定 ---

function startGame() {
    isGameRunning = true;
    
    // 入力イベントリスナーを設定
    canvas.addEventListener('click', handleTap);
    
    lastTimestamp = performance.now(); // 最初の時刻を記録
    requestAnimationFrame(gameLoop);   // ゲームループ開始
}

// タップ（クリック）イベント処理
function handleTap(event) {
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
    
    // 次の描画タイミングで再度 gameLoop を呼び出す
    requestAnimationFrame(gameLoop);
}

// ゲーム状態の更新 (ノーツの出現や判定外れをチェック)
function update(deltaTime) {
    // 1. ゲーム時間の更新
    gameTime += deltaTime; 
    
    // 2. ノーツの出現チェックとアクティブ化
    while (nextNoteIndex < NOTE_DATA.length) {
        const noteData = NOTE_DATA[nextNoteIndex];
        // ノーツは、判定ラインまでの移動時間分だけ早く出現させる必要がある
        const appearTime = noteData.time - NOTE_TRAVEL_TIME;

        if (gameTime >= appearTime) {
            // ノーツをアクティブリストに追加
            activeNotes.push({
                time: noteData.time,
                lane: noteData.lane,
                type: noteData.type,
                duration: noteData.duration || 0 // durationがない場合は0をセット
            });
            nextNoteIndex++;
        } else {
            break; // 時間順なので、次のノーツはまだ早い
        }
    }

    // 3. 判定ラインを遥かに超えたノーツを削除（MISS判定処理はここでは省略）
    for (let i = activeNotes.length - 1; i >= 0; i--) {
        const note = activeNotes[i];
        // ノーツの目標時間から許容誤差の時間を引いた時間が過ぎたらアウト
        if (gameTime > note.time + JUDGEMENT_TOLERANCE) {
            // activeNotes.splice(i, 1); // 削除 (ここでは処理をシンプルにするため、一旦保留)
            // console.log("MISS判定 (削除処理は保留)"); 
        }
    }
}

// --- 5. 判定ロジック ---

function processJudgement(tappedLane) {
    let spliceIndex = -1; // 削除するノーツのインデックス
    
    // 判定ラインに近いノーツから順にチェック (activeNotesは出現順なので、i=0が最も近い)
    for (let i = 0; i < activeNotes.length; i++) {
        const note = activeNotes[i];
        
        // レーンが一致しているか
        if (note.lane !== tappedLane) {
            continue; 
        }

        // 時間的に判定範囲内か (絶対値で許容誤差をチェック)
        const timeDifference = Math.abs(note.time - gameTime);
        
        if (timeDifference <= JUDGEMENT_TOLERANCE) {
            // PERFECT判定成功！
            console.log(`PERFECT! Lane ${tappedLane}, Diff: ${timeDifference.toFixed(3)}s`);
            spliceIndex = i;
            break; 
        }
    }
    
    // 判定成功した場合、ノーツをリストから削除
    if (spliceIndex !== -1) {
        activeNotes.splice(spliceIndex, 1);
        // ★ここに必要なのは、ゲーム内のノーツと音楽の同期です。 
        // スコア加算やエフェクト再生などの処理を入れる
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

// 描画補助関数: ノーツ (位置計算が最も重要)
function drawNote(note) {
    // ノーツの目標時間と現在の時間の差 (秒)
    const timeRemaining = note.time - gameTime; 

    // ノーツが判定ラインに到達するまでの距離（ピクセル）
    const travelDistance = JUDGEMENT_LINE_Y - NOTE_APPEAR_Y; 

    // ノーツの現在のY座標を計算
    let noteY = NOTE_APPEAR_Y + travelDistance * (NOTE_TRAVEL_TIME - timeRemaining) / NOTE_TRAVEL_TIME;

    // --- ノーツの描画位置X座標を計算 ---
    const laneWidth = canvas.width / LANE_COUNT;
    // ノーツの中心X座標を計算 
    const x = (note.lane - 1) * laneWidth + (laneWidth - NOTE_SIZE) / 2;

    // ロングノーツの描画
    if (note.type === 1) {
        const duration = note.duration || 1.0; 
        const endTime = note.time + duration;
        const endTimeRemaining = endTime - gameTime;
        
        let endNoteY = NOTE_APPEAR_Y + travelDistance * (NOTE_TRAVEL_TIME - endTimeRemaining) / NOTE_TRAVEL_TIME;
        
        // ロングノーツの本体（線）
        ctx.fillStyle = 'blue'; 
        ctx.fillRect(x + NOTE_SIZE / 4, noteY, NOTE_HALF_SIZE, endNoteY - noteY);

        // 終了ノーツ（尾）
        ctx.fillStyle = 'blue';
        ctx.fillRect(x, endNoteY - NOTE_HALF_SIZE, NOTE_SIZE, NOTE_SIZE);
    }
    
    // タップノーツまたはロングノーツの頭（開始ノーツ）の描画
    ctx.fillStyle = (note.type === 0) ? 'red' : 'cyan'; 
    ctx.fillRect(x, noteY - NOTE_HALF_SIZE, NOTE_SIZE, NOTE_SIZE);
}

// --- 7. ゲームの実行開始 ---
// スコアファイルの読み込みから全てが始まる
loadScore('score.json');
