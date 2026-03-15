import paramiko
from datetime import datetime

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

sftp = client.open_sftp()

script = '''
from pymongo import MongoClient
from datetime import datetime

db = MongoClient("mongodb://localhost:27017/")["genai_app"]
now = datetime.utcnow()

# Mock-patient-rooms.ts expects:
#   dd000000-0000-4000-b000-000000000002  Room 102  age 85  cardiac/respiratory
#   ee000000-0000-4000-c000-000000000003  Room 103  age 71  back pain/GI

new_residents = [
    {
        "_id": "dd000000-0000-4000-b000-000000000002",
        "facility_id": "ff000000-0000-4000-a000-000000000001",
        "room_id": "aa000000-0000-4000-a000-000000000002",
        "room_number": "102",
        "mrn": "MRN-1007",
        "first_name": "Harold",
        "last_name": "Steinberg",
        "full_name": "Harold Steinberg",
        "date_of_birth": "1941-04-12",
        "sex": "male",
        "primary_language": "en",
        "admission_date": "2023-01-15",
        "emergency_contact": {
            "name": "Karen Steinberg",
            "relation": "daughter",
            "relationship": "daughter",
            "phone": "+1-416-555-1007",
        },
        "allergies": ["Sulfa drugs"],
        "diagnoses": [
            "Congestive Heart Failure",
            "Respiratory Distress",
            "Orthostatic Hypotension",
        ],
        "medications": ["Lisinopril 10mg (once daily)", "Furosemide 40mg (once daily)"],
        "model_coords": {"highlight_regions": ["chest", "lungs", "head"]},
        "phone_number": "+16479150932",
        "notes": "Chest tightness worsens when lying flat. Requires head-of-bed elevation. Dizziness on standing — supervised transfers only.",
        "created_at": now,
        "updated_at": now,
    },
    {
        "_id": "ee000000-0000-4000-c000-000000000003",
        "facility_id": "ff000000-0000-4000-a000-000000000001",
        "room_id": "aa000000-0000-4000-a000-000000000003",
        "room_number": "103",
        "mrn": "MRN-1008",
        "first_name": "Margaret",
        "last_name": "Oduya",
        "full_name": "Margaret Oduya",
        "date_of_birth": "1955-08-22",
        "sex": "female",
        "primary_language": "en",
        "admission_date": "2024-02-10",
        "emergency_contact": {
            "name": "James Oduya",
            "relation": "son",
            "relationship": "son",
            "phone": "+1-647-555-1008",
        },
        "allergies": [],
        "diagnoses": [
            "Chronic Lower Back Pain",
            "Gastroesophageal Reflux Disease",
            "Fatigue",
        ],
        "medications": ["Aspirin 81mg (once daily)", "Atorvastatin 20mg (once daily)"],
        "model_coords": {"highlight_regions": ["lower_back", "abdomen"]},
        "phone_number": "+16479150933",
        "notes": "Dull lower back pain rated 5/10. Post-meal stomach discomfort — small frequent meals recommended. Generally fatigued.",
        "created_at": now,
        "updated_at": now,
    },
]

for r in new_residents:
    existing = db.residents.find_one({"_id": r["_id"]})
    if existing:
        print(f"SKIP (already exists): {r['_id']} — {r['full_name']}")
    else:
        db.residents.insert_one(r)
        print(f"INSERTED: {r['_id']} — {r['full_name']} (Room {r['room_number']})")

print("Done. Total residents:", db.residents.count_documents({}))
'''

with sftp.open("/tmp/seed_patients.py", "w") as f:
    f.write(script.encode())
sftp.close()

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

print(run("/opt/app-backend/venv/bin/python3 /tmp/seed_patients.py"))
client.close()
