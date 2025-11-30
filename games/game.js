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


// --- 2. 外部 JSONファイルを読み込む関数 (非同期処理) ---
async function loadScore(url) {
    try {
        console.log("スコアファイルを読み込み中...");
        // 外部ファイルを取得
        const response = await fetch(url); 
        // 取得したテキストをJSONオブジェクトに変換
        const data = await response.json(); 
        
        NOTE_DATA = data.notes;
        console.log(`スコアデータ ${NOTE_DATA.length} 件を読み込みました。`);
        
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
function logToScreen(message) {
    const logElement = document.getElementById('log');
    if (logElement) {
        logElement.innerHTML = `<p>${message}</p>`; 
    }
}

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
