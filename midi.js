class MidiReaderExtension {
  constructor() {
    this.notes = [];
  }

  getInfo() {
    return {
      id: "midireader",
      name: "MIDI Reader",
      blocks: [
        {
          opcode: "loadMIDIFile",
          blockType: "command",
          text: "load MIDI file",
        },
        {
          opcode: "getNotes",
          blockType: "reporter",
          text: "get notes",
        },
      ],
    };
  }

  async loadMIDIFile() {
    try {
      const file = await this._chooseFile(".mid");
      const arrayBuffer = await file.arrayBuffer();
      this.notes = this._parseMIDI(arrayBuffer);
      alert("MIDI loaded! Notes: " + this.notes.length);
    } catch (e) {
      alert("Failed to load MIDI: " + e.message);
    }
  }

  getNotes() {
    return JSON.stringify(this.notes);
  }

  async _chooseFile(accept) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        if (input.files.length > 0) resolve(input.files[0]);
        else reject(new Error("No file selected"));
      };
      input.click();
    });
  }

  _parseMIDI(buffer) {
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

    // ヘッダー確認
    if (readStr(4) !== "MThd") throw new Error("Invalid MIDI file");
    const headerLen = read32();
    const format = read16();
    const ntrks = read16();
    const division = read16();
    pos += hea
