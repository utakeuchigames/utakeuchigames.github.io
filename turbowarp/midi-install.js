document.body.innerHTML = `
  <h2>デバッグ付きMIDIリーダー</h2>
  <input id="file" type="file" accept=".mid"><br><br>
  <div id="status">📂 ファイルを選んでください</div>
  <pre id="log" style="background:#eee;padding:8px;white-space:pre-wrap;"></pre>
`;

const status = document.getElementById("status");
const log = document.getElementById("log");

document.getElementById("file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  status.textContent = "読み込み中...";
  try {
    const buf = await file.arrayBuffer();
    const notes = parseMIDI(buf);
    status.textContent = `✅ 完了！ノート数: ${notes.length}`;
    log.textContent += "\n✅ ノート一覧:\n" + JSON.stringify(notes.slice(0, 10), null, 2);
  } catch (err) {
    status.textContent = "⚠️ エラー: " + err.message;
    log.textContent += "\n❌ エラー詳細:\n" + err.stack;
  }
};

function parseMIDI(buffer) {
  const data = new DataView(buffer);
  let pos = 0;
  const readStr = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(data.getUint8(pos++));
    return s;
  };
  const read32 = () => {
    const v = data.getUint32(pos, false); // ✅ ビッグエンディアン明示
    pos += 4;
    return v;
  };
  const read16 = () => {
    const v = data.getUint16(pos, false);
    pos += 2;
    return v;
  };
  const readVar = () => {
    let v = 0;
    while (true) {
      const b = data.getUint8(pos++);
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };

  // --- ヘッダー解析 ---
  const header = readStr(4);
  if (header !== "MThd") throw new Error("MIDIヘッダーが不正です: " + header);
  const headerLen = read32();
  const format = read16();
  const tracks = read16();
  const division = read16();

  log.textContent = `Header=${header}, Len=${headerLen}, Format=${format}, Tracks=${tracks}, Division=${division}\npos=${pos}\n`;

  // 🩹 ここはズレないよう headerLen-6 を削除
  const notes = [];

  // --- トラック解析 ---
  for (let t = 0; t < tracks; t++) {
    const chunk = readStr(4);
    log.textContent += `Track[${t}] chunk=${chunk}\npos=${pos}\n`;
    if (chunk !== "MTrk") throw new Error(`トラックが見つかりません (chunk=${chunk})`);

    const trackEnd = pos + read32();
    let time = 0;
    let runningStatus = 0;

    while (pos < trackEnd) {
      const delta = readVar();
      time += delta;
      let status = data.getUint8(pos++);
      if (status < 0x80) {
        pos--;
        status = runningStatus;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;
      const ch = status & 0x0f;

      if (type === 0x90) {
        const note = data.getUint8(pos++);
        const vel = data.getUint8(pos++);
        if (vel > 0) notes.push({ time, ch, note, vel });
      } else if (type === 0x80) {
        pos += 2;
      } else if (status === 0xff) {
        const metaType = data.getUint8(pos++);
        const len = readVar();
        pos += len;
      } else if (type === 0xc0 || type === 0xd0) {
        pos++;
      } else {
        pos += 2;
      }
    }
  }

  return notes;
}
