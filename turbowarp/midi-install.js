document.body.innerHTML = `
  <h2>軽量MIDIリーダー</h2>
  <input id="file" type="file" accept=".mid"><br><br>
  <div id="status">📂 ファイルを選んでください</div>
  <textarea id="output" rows="10" cols="60" placeholder="結果がここに出ます"></textarea>
`;

const fileInput = document.getElementById("file");
const status = document.getElementById("status");
const output = document.getElementById("output");

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  status.textContent = "読み込み中...";
  try {
    const buf = await file.arrayBuffer();
    const notes = parseMIDI(buf);
    output.value = JSON.stringify(notes, null, 2);
    status.textContent = `✅ 完了！ノート数: ${notes.length}`;
  } catch (err) {
    status.textContent = "⚠️ エラー: " + err.message;
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
  const read32 = () => (pos += 4, data.getUint32(pos - 4));
  const read16 = () => (pos += 2, data.getUint16(pos - 2));
  const readVar = () => {
    let v = 0;
    while (true) {
      const b = data.getUint8(pos++);
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };

  // ✅ Header chunk
  if (readStr(4) !== "MThd") throw new Error("MIDIヘッダーが不正です");
  const headerLen = read32();
  const format = read16();
  const tracks = read16();
  const division = read16();
 

  const notes = [];
  for (let t = 0; t < tracks; t++) {
    if (readStr(4) !== "MTrk") throw new Error("トラックが見つかりません");
    const trackEnd = pos + read32();
    let time = 0;
    let runningStatus = 0;

    while (pos < trackEnd) {
      const delta = readVar();
      time += delta;
      let status = data.getUint8(pos++);
      if (status < 0x80) { // running status
        pos--;
        status = runningStatus;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;
      const ch = status & 0x0f;

      if (type === 0x90) { // noteOn
        const note = data.getUint8(pos++);
        const vel = data.getUint8(pos++);
        if (vel > 0) notes.push({ time, ch, note, vel });
      } else if (type === 0x80) { // noteOff
        pos += 2;
      } else if (status === 0xff) { // meta
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
