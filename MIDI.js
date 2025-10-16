(function(Scratch) {
  "use strict";

  class MidiReader {
    constructor() {
      this.midiNotes = [];
      this.parseMidi = null;
      this.loading = false;
    }

    async _loadParser() {
      if (!this.parseMidi) {
        const module = await import("https://cdn.jsdelivr.net/npm/midi-file@1.2.3/+esm");
        this.parseMidi = module.parseMidi;
      }
    }

    getInfo() {
      return {
        id: "midiReader",
        name: "MIDIリーダー",
        color1: "#7B5EFF",
        blocks: [
          {
            opcode: "loadMidiFile",
            blockType: Scratch.BlockType.COMMAND,
            text: "MIDIファイルを読み込む",
          },
          {
            opcode: "getNoteList",
            blockType: Scratch.BlockType.REPORTER,
            text: "ノート一覧(JSON)",
          },
          {
            opcode: "getNoteAt",
            blockType: Scratch.BlockType.REPORTER,
            text: "ノート[INDEX]番の高さ",
            arguments: {
              INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
            },
          },
        ],
      };
    }

    // TurboWarpではPromiseをそのまま返す必要あり
    loadMidiFile() {
      this.loading = true;
      return this._loadMidiFileCore().then(() => {
        this.loading = false;
        alert(`読み込み完了！ ノート数: ${this.midiNotes.length}`);
      }).catch(err => {
        this.loading = false;
        alert("MIDI読み込みエラー: " + err.message);
      });
    }

    async _loadMidiFileCore() {
      await this._loadParser();

      const result = await this._showFilePrompt(".mid");
      const midi = this.parseMidi(new Uint8Array(result.arrayBuffer));

      const notes = [];
      for (const [trackIndex, track] of midi.tracks.entries()) {
        let currentTime = 0;
        for (const event of track) {
          currentTime += event.deltaTime;
          if (event.type === "noteOn" && event.velocity > 0) {
            notes.push({
              track: trackIndex,
              noteNumber: event.noteNumber,
              deltaTime: event.deltaTime,
              absTime: currentTime,
            });
          }
        }
      }

      this.midiNotes = notes;
    }

    getNoteList() {
      return JSON.stringify(this.midiNotes);
    }

    getNoteAt(args) {
      const i = Math.floor(args.INDEX) - 1;
      if (i < 0 || i >= this.midiNotes.length) return "";
      return this.midiNotes[i].noteNumber;
    }

    _showFilePrompt(accept = "*/*") {
      return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.style.display = "none";

        input.onchange = () => {
          const file = input.files[0];
          if (!file) {
            reject(new Error("ファイルが選択されませんでした"));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({ name: file.name, arrayBuffer: reader.result });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        };

        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      });
    }
  }

  Scratch.extensions.register(new MidiReader());
})(Scratch);
