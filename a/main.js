// 各要素を取得
const videoFileInput = document.getElementById('videoFileInput');
const videoPlayer = document.getElementById('videoPlayer');
const fileNameDisplay = document.getElementById('fileNameDisplay');
let baseName = "no data";

// ファイル選択時のイベントリスナー
videoFileInput.addEventListener('change', function(event) {
    const file = event.target.files?.[0];
    if (!file) {
        fileNameDisplay.textContent = 'ファイルが選択されていません';
        videoPlayer.src = '';
        return;
    }

    // ファイル名を表示
    fileNameDisplay.textContent = file.name;

    // デバッグ出力（確認用）
    console.log("file.name =", JSON.stringify(file.name));

    // ファイル名から拡張子を除いたタイトルを設定（大文字・空白対応）
    baseName = file.name.replace(/\.[^/.]+$/i, "").trim();
    document.title = baseName;

    // 古いオブジェクトURLを破棄
    if (videoPlayer.src) {
        URL.revokeObjectURL(videoPlayer.src);
    }

    // createObjectURLで一時URLを作成
    const blobURL = URL.createObjectURL(file);

    // videoタグに反映（iOS対策：遅延ロード）
    videoPlayer.src = blobURL;
    setTimeout(() => {
        videoPlayer.load();
    }, 200);
});
