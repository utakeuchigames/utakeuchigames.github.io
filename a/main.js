// 各要素を取得
const videoFileInput = document.getElementById('videoFileInput');
const videoPlayer = document.getElementById('videoPlayer');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// ファイル選択時のイベントリスナー
videoFileInput.addEventListener('change', function(event) {
    // 選択されたファイルを取得
    const files = event.target.files;

    if (files && files.length > 0) {
        const file = files[0];

        // ファイル名を取得して表示
        fileNameDisplay.textContent = file.name;
        document.title = file.name;

        // 古いオブジェクトURLを開放（メモリリーク防止）
        if (videoPlayer.src) {
            URL.revokeObjectURL(videoPlayer.src);
        }

        // createObjectURLで一時URLを作成
        const blobURL = URL.createObjectURL(file);

        // videoタグに反映
        videoPlayer.src = blobURL;
       setTimeout(() => {
  videoPlayer.load();
  // videoPlayer.play(); // 必要なら
}, 200);

        // 必要なら自動再生
        // videoPlayer.play();
    } else {
        fileNameDisplay.textContent = 'ファイルが選択されていません';
        videoPlayer.src = '';
    }
});
