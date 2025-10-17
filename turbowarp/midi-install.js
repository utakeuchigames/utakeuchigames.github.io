import { parseMidi } from "https://cdn.jsdelivr.net/npm/midi-file@1.2.3/+esm";

document.body.innerHTML = `
  <h2>MIDI Reader for iPad</h2>
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
  try {
    const arrayBuffer = await file.arrayBuffer();
    status.textContent = "🎵 MIDI解析中...";

    // ✅ Safari対策: ArrayBuffer → Uint8Array
    const midi = parseMidi(new Uint8Array(arrayBuffer));

    if (!midi || !midi.tracks) {
      throw new Error("MIDIの解析に失敗しました（結果がundefined）");
    }

    const notes = [];
    for (const track of midi.tracks) {
      if (!Array.isArray(track)) continue;
      let time = 0;
      for (const event of track) {
        time += event.deltaTime;
        if (event.type === "noteOn" && event.velocity > 0) {
          notes.push({
            time,
            note: event.noteNumber,
            velocity: event.velocity
          });
        }
      }
    }

    output.value = JSON.stringify(notes, null, 2);
    status.textContent = `✅ 完了！ノート数: ${notes.length}`;
  } catch (err) {
    status.textContent = "⚠️ エラー内容: " + JSON.stringify(err, Object.getOwnPropertyNames(err));
  }
};
