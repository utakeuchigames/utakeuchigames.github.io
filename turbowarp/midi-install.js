document.body.innerHTML = `
  <h2>Pure JS MIDI Reader</h2>
  <p>① .midファイルを選択 → ② 結果が下に出る</p>
  <input id="file" type="file" accept=".mid"><br><br>
  <div id="status" style="
    border: 1px solid #888;
    padding: 6px;
    margin-bottom: 8px;
    background: #f0f0f0;
    font-family: monospace;
  ">準備完了 ✅</div>
  <textarea id="output" rows="10" cols="60" placeholder="ここに結果が出ます"></textarea>
`;

const fileInput = document.getElementById("file");
const status = document.getElementById("status");
const output = document.getElementById("output");

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) {
    status.textContent = "❌ ファイルが選択されていません";
    return;
  }

  status.textContent = "📥 ファイル読み込み中...";
  const buffer = await file.arrayBuffer();
  status.textContent = "🎵 解析中...";

  try {
    const data = new DataView(buffer);
    let pos = 0;

    function readStr(len) {
      let s = "";
      for (let i = 0; i < len; i++) s += String.fromCharCode(data.getUint8(pos++));
      return s;
    }

    function read32() {
      const v = data.getUint32(pos);
      pos += 4;
      return v;
    }

    function read16() {
      const v = data.getUint16(pos);
      pos += 2;
      return v;
    }

    function readVar() {
      let value = 0;
      while (true) {
        const b = data.getUint8(pos++);
        value = (value << 7) | (b & 0x7f);
        if ((b & 0x80) === 0) break;
      }
      return value;
    }

    // ---- ヘッダー確認 ----
    if (readStr(4) !== "MThd") throw new Error("Invalid MIDI header");
    const headerLen = read32();
    const format = read16();
    const ntrks = read16();
    const division = read16();
    pos += headerLen - 6;

    const notes = [];

    for (let t = 0; t < ntrks; t++) {
      if (readStr(4) !== "MTrk") throw new Error("Missing MTrk");
      const trackEnd = pos + read32();
      let time = 0;
      let runningStatus = 0;

      while (pos < trackEnd) {
        const delta = readVar();
        time += delta;
        let statusByte = data.getUint8(pos++);

        if (statusByte < 0x80) {
          // running status
          pos--;
          statusByte = runningStatus;
        } else {
          runningStatus = statusByte;
        }

        const type = statusByte & 0xf0;

        if (type === 0x90) {
          const note = data.getUint8(pos++);
          const velocity = data.getUint8(pos++);
          if (velocity > 0) notes.push({ time, note, velocity });
        } else if (type === 0x80) {
          pos += 2; // noteOff
        } else if (statusByte === 0xff) {
          const metaType = data.getUint8(pos++);
          const len = readVar();
          pos += len;
        } else {
          if (type === 0xc0 || type === 0xd0) pos += 1;
          else pos += 2;
        }
      }
    }

    output.value = JSON.stringify(notes, null, 2);
    status.textContent = `✅ 完了！ノート数: ${notes.length}`;
  } catch (err) {
    status.textContent = "⚠️ エラー: " + err.message;
  }
};
