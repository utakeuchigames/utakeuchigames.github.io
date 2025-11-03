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
        
        // FileReaderを使用して動画ファイルを読み込み、video要素のsrcに設定
        const reader = new FileReader();
        reader.onload = function(e) {
            videoPlayer.src = e.target.result;
            videoPlayer.load(); // 動画をロード
            // videoPlayer.play(); // 必要であれば自動再生
        };
        reader.readAsDataURL(file); // ファイルをDataURLとして読み込む
      document.title = file.name;

    } else {
        fileNameDisplay.textContent = 'ファイルが選択されていません';
        videoPlayer.src = '';
    }
});
