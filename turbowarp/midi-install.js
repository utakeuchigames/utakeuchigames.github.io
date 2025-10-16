// midi-reader-page.js
import { parseMidi } from "https://cdn.jsdelivr.net/npm/midi-file@1.2.3/+esm";

document.body.innerHTML = `
  <h2>MIDI Reader for iPad</h2>
  <p>① .midファイルを選択 → ② TurboWarp に貼り付け</p>
  <input id="file" type="file" accept=".mid"><br><br>
  <textarea id="output" rows="10" cols="60" placeholder="ここに結果が出ます"></textarea>
`;

const input = document.getElementById("file");
const output = document.getElementById("output");

input.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  const midi = parseMidi(buf);

  const notes = [];
  for (const track of midi.tracks) {
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
};
