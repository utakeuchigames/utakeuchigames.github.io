(function(Scratch) {
  'use strict';

  class MidiReader {
    constructor() {
      this.notes = [];
    }

    getInfo() {
      return {
        id: 'midireader',
        name: 'MIDI Reader',
        color1: '#e6b800',
        blocks: [
          {
            opcode: 'loadMIDIFile',
            blockType: Scratch.BlockType.COMMAND,
            text: 'load MIDI file'
          },
          {
            opcode: 'getNotes',
            blockType: Scratch.BlockType.REPORTER,
            text: 'get notes'
          }
        ]
      };
    }

    async loadMIDIFile() {
      const file = await Scratch.vm.extensionStorage.loadFile({
        extensions: ['mid', 'midi'],
        type: 'arraybuffer'
      });

      if (!file) {
        console.warn('No file selected.');
        return;
      }

      try {
        this.notes = this._parseMIDI(file);
        console.log(`MIDI loaded! Notes: ${this.notes.length}`);
      } catch (e) {
        console.error('Failed to parse MIDI:', e);
      }
    }

    getNotes() {
      return JSON.stringify(this.notes);
    }

    _parseMIDI(buffer) {
      const data = new DataView(buffer);
      let pos = 0;

      function readStr(len) {
        let s = '';
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

      if (readStr(4) !== 'MThd') throw new Error('Invalid MIDI file');
      const headerLen = read32();
      const format = read16();
      const ntrks = read16();
      const division = read16();
      pos += headerLen - 6;

      const notes = [];

      for (let t = 0; t < ntrks; t++) {
        if (readStr(4) !== 'MTrk') throw new Error('Missing MTrk');
        const trackEnd = pos + read32();
        let time = 0;
        let runningStatus = null;

        while (pos < trackEnd) {
          const delta = readVar();
          time += delta;
          let status = data.getUint8(pos);
          if (status < 0x80) {
            status = runningStatus;
          } else {
            pos++;
            runningStatus = status;
          }

          const type = status & 0xf0;
          const channel = status & 0x0f;

          if (type === 0x90) {
            const note = data.getUint8(pos++);
            const velocity = data.getUint8(pos++);
            if (velocity > 0)
              notes.push({ time, channel, note, velocity, delta });
          } else if (type === 0x80) {
            pos += 2;
          } else if (status === 0xff) {
            const metaType = data.getUint8(pos++);
            const len = readVar();
            pos += len;
          } else {
            if (type === 0xc0 || type === 0xd0) pos++;
            else pos += 2;
          }
        }
      }

      return notes;

      function readVar() {
        let value = 0;
        while (true) {
          const b = data.getUint8(pos++);
          value = (value << 7) | (b & 0x7f);
          if ((b & 0x80) === 0) break;
        }
        return value;
      }
    }
  }

  Scratch.extensions.register(new MidiReader());
})(Scratch);
