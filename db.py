import json
import os

DB_FILE = 'database.json'

def init_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w') as f:
            json.dump({}, f)

def read_db():
    init_db()
    with open(DB_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def write_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def clear_patient(phone_number):
    db = read_db()
    db[phone_number] = []
    write_db(db)

def append_response(phone_number, question, answer):
    db = read_db()
    if phone_number not in db:
        db[phone_number] = []
    
    db[phone_number].append({
        "question": question,
        "answer": answer
    })
    write_db(db)
