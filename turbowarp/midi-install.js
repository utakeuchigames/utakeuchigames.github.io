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

      const arrayBuffer = await fileHandle.arrayBuffer();
      let parsed;
      try {
        parsed = parseMidi(new Uint8Array(arrayBuffer));
      } catch (err) {
        console.warn("parseMidi failed, fallback mode:", err);
        parsed = this._safeParse(arrayBuffer);
      }

      this.notes = [];
      for (const track of parsed.tracks ?? []) {
        let time = 0;
        for (const e of track) {
          time += e.deltaTime ?? 0;
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

  _safeParse(buffer) {
    const data = new DataView(buffer);
    let pos = 0;
    const readStr = len =>
      Array.from({ length: len }, () => String.fromCharCode(data.getUint8(pos++))).join("");
    const read32 = () => {
      const v = data.getUint32(pos);
      pos += 4;
      return v;
    };
    const read16 = () => {
      const v = data.getUint16(pos);
      pos += 2;
      return v;
    };

    if (readStr(4) !== "MThd") throw new Error("Invalid MIDI header");
    const headerLen = read32();
    const format = read16();
    const ntrks = read16();
    const division = read16();
    pos += headerLen - 6;

    const tracks = [];
    for (let i = 0; i < ntrks; i++) {
      if (pos >= data.byteLength) break;
      const chunk = readStr(4);
      if (chunk !== "MTrk") {
        console.warn(`⚠️ スキップ: 不正なチャンク (${chunk})`);
        break;
      }
      const len = read32();
      const trackEnd = pos + len;
      const events = [];
      let time = 0;
      while (pos < trackEnd && pos < data.byteLength) {
        const delta = this._readVar(data, () => pos++, () => pos);
        time += delta;
        const status = data.getUint8(pos++);
        if (status === 0xff) {
          const metaType = data.getUint8(pos++);
          const len = this._readVar(data, () => pos++, () => pos);
          pos += len;
        } else if ((status & 0xf0) === 0x90) {
          const note = data.getUint8(pos++);
          const vel = data.getUint8(pos++);
          events.push({ deltaTime: delta, type: "noteOn", noteNumber: note, velocity: vel });
        } else {
          pos += (status & 0xf0) === 0xc0 ? 1 : 2;
        }
      }
      tracks.push(events);
    }
    return { format, tracks };
  }

  _readVar(data, advance, posGetter) {
    let value = 0,
      pos = posGetter();
    while (true) {
      const b = data.getUint8(pos);
      advance();
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return value;
  }

  getNotes() {
    return JSON.stringify(this.notes, null, 2);
  }

  getStatus() {
    return this.status;
  }
}

Scratch.extensions.register(new MidiReader());
