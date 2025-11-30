// --- 1. 初期設定 ---

// HTMLのCanvas要素を取得
const canvas = document.getElementById('gameCanvas');

// Canvasに描画するための2Dコンテキスト（道具）を取得
// これを使って、Canvasに線や図形、画像を描画します。
const ctx = canvas.getContext('2d'); 

// ノーツの速度や出現位置などの定数（設定値）を定義
const NOTE_SPEED = 200; // 1秒間にノーツが移動するピクセル数
const LANE_COUNT = 4;   // レーンの数
let gameTime = 0;       // ゲームが始まってからの時間（ミリ秒）を保持

// --- 2. ゲームループの定義 ---
// ゲームループは、画面をスムーズに更新し続ける心臓部です。

function gameLoop(timestamp) {
    // requestAnimationFrame(rAF)が提供する、高精度な現在時刻（ミリ秒）を取得
    
    // 前回の描画からの経過時間を計算（ゲーム時間の更新に使用）
    // ※ 初回実行時は前フレームがないため、ここでは割愛し、単純な時間経過を想定
    
    // 1. ゲーム状態の更新 (ノーツの位置計算、判定チェックなど)
    update(timestamp);
    
    // 2. 画面の描画
    draw();
    
    // 次の描画タイミングで、再びこの gameLoop 関数を呼び出す予約をする
    requestAnimationFrame(gameLoop);
}

// --- 3. 更新処理 (ノーツの動きなどを計算) ---
function update(timestamp) {
    // 実際の開発では、ここで楽曲の再生時間に合わせて gameTime を更新します。
    // 例: gameTime = Web Audio APIで取得した楽曲の再生時間(ms)
    
    // ★ここでは動作確認のため、ノーツが移動する仮のロジックを入れます。
    // 簡略化のため、ここではゲーム時間を単純に加算する例は省略します。
}

// --- 4. 描画処理 ---
function draw() {
    // 画面を一度クリアする (前のフレームの描画を消去)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // レーンの描画
    drawLanes();
    
    // ノーツの描画（今は仮のノーツを描画します）
    drawDummyNote(); 
}

// --- 5. 描画補助関数 ---

function drawLanes() {
    const laneWidth = canvas.width / LANE_COUNT;
    ctx.strokeStyle = '#555'; // レーンの線の色
    ctx.lineWidth = 2;         // 線の太さ

    for (let i = 1; i < LANE_COUNT; i++) {
        const x = i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);             // 画面の上端
        ctx.lineTo(x, canvas.height); // 画面の下端
        ctx.stroke();
    }
}

function drawDummyNote() {
    // 画面中央付近、レーン2に仮のノーツを描画
    const laneWidth = canvas.width / LANE_COUNT;
    const laneIndex = 2; 
    const x = (laneIndex - 1) * laneWidth + laneWidth / 2 - 25; // ノーツの中心X座標
    const y = canvas.height / 2; // 画面の真ん中

    ctx.fillStyle = 'red'; // ノーツの色
    ctx.fillRect(x, y, 50, 50); // ノーツを四角形で描画 (幅50px, 高さ50px)
}

// --- 6. ゲーム開始 ---
console.log("ゲームの準備を開始します...");
// 最初のゲームループを呼び出すことで、ゲームがスタートする
requestAnimationFrame(gameLoop);
