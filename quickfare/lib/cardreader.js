// lib/cardReader.js
import { NFC } from 'nfc-pcsc';

class CardReader {
  constructor() {
    this.nfc = new NFC();
    this.readers = new Map();
  }

  start(callback) {
    this.nfc.on('reader', reader => {
      this.readers.set(reader.name, reader);

      reader.on('card', card => {
        const cardId = card.uid.toString('hex');
        callback(cardId);
      });

      reader.on('error', err => {
        console.error(`${reader.reader.name} an error occurred`, err);
      });
    });

    this.nfc.on('error', err => {
      console.error('NFC error', err);
    });
  }

  stop() {
    this.nfc.close();
  }
}

export default new CardReader();