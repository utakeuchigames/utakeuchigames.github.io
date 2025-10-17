import { parseMidi } from "https://cdn.jsdelivr.net/npm/midi-file@1.2.3/+esm";

class MidiReader {
  constructor() {
    this.notes = [];
    this.status = "未読み込み";
  }

  getInfo() {
    return {
      id: "midireader",
      name: "MIDI Reader",
      blocks: [
        {
          opcode: "loadMIDIFile",
          blockType: "command",
          text: "MIDIファイルを読み込む",
        },
        {
          opcode: "getNotes",
          blockType: "reporter",
          text: "ノート一覧",
        },
        {
          opcode: "getStatus",
          blockType: "reporter",
          text: "読み込みステータス",
        },
      ],
    };
  }

  async loadMIDIFile() {
    try {
      const [fileHandle] = await Scratch.FilePicker.prompt({
        types: ["mid", "midi"],
      });
      if (!fileHandle) {
        this.status = "❌ ファイルが選択されませんでした";
        return;
      }

      this.status = "読み込み中…";

      const arrayBuffer = await fileHandle.arrayBuffer(); // ← await 重要！！
      const parsed = parseMidi(new Uint8Array(arrayBuffer));

      this.notes = [];
      for (const track of parsed.tracks) {
        let time = 0;
        for (const e of track) {
          time += e.deltaTime;
          if (e.type === "noteOn" && e.velocity > 0) {
            this.notes.push({
              pitch: e.noteNumber,
              time,
              velocity: e.velocity,
            });
          }
        }
      }

      this.status = `✅ 完了: ${this.notes.length} ノート`;
    } catch (err) {
      this.status = `⚠️ エラー: ${err.message}`;
      console.error(err);
    }
  }

  getNotes() {
    return JSON.stringify(this.notes, null, 2);
  }

  getStatus() {
    return this.status;
  }
}

Scratch.extensions.register(new MidiReader());
