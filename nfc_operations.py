# nfc_operations.py
import nfc
import ndef

class NFCReader:
    def __init__(self):
        self.clf = nfc.ContactlessFrontend('usb')

    def read_card(self):
        tag = self.clf.connect(rdwr={'on-connect': lambda tag: False})
        if tag.ndef:
            for record in tag.ndef.records:
                if record.type == "urn:nfc:wkt:T":
                    return record.text
        return None

    def write_card(self, data):
        tag = self.clf.connect(rdwr={'on-connect': lambda tag: False})
        if tag.ndef:
            record = ndef.TextRecord(data)
            tag.ndef.records = [record]
            return True
        return False

    def close(self):
        self.clf.close()

# Usage example
if __name__ == "__main__":
    reader = NFCReader()
    try:
        print("Place your card on the reader...")
        card_data = reader.read_card()
        if card_data:
            print(f"Card data: {card_data}")
            print("Writing new data to the card...")
            if reader.write_card("New balance: $50"):
                print("Data written successfully")
            else:
                print("Failed to write data")
        else:
            print("No data found on the card")
    finally:
        reader.close()