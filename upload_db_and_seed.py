import paramiko

HOST = "216.128.182.121"
USER = "root"
PASSWORD = "!Ya3GYHoY3-PG?%s"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read() + stderr.read()).decode(errors="replace").strip()

# Upload updated db.py
sftp = client.open_sftp()
sftp.put("/home/zayaan/Downloads/App/db_remote.py", "/opt/app-backend/db.py")

# Also directly insert the 2 new residents into the live DB
script = '''
from pymongo import MongoClient
from datetime import datetime

db = MongoClient("mongodb://localhost:27017/")["genai_app"]
now = datetime.utcnow()
FACILITY_ID = "ff000000-0000-4000-a000-000000000001"

new_residents = [
    {
        "_id": "dd000000-0000-4000-b000-000000000002",
        "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000002",
        "room_number": "102", "mrn": "MRN-1007",
        "first_name": "Harold", "last_name": "Chen",
        "full_name": "Harold Chen", "date_of_birth": "1941-04-12", "sex": "male",
        "primary_language": "en", "admission_date": "2023-01-15",
        "emergency_contact": {"name": "Karen Chen", "relation": "daughter", "relationship": "daughter", "phone": "+1-416-555-1007"},
        "allergies": ["Sulfa drugs"],
        "diagnoses": ["Congestive Heart Failure", "Respiratory Distress", "Orthostatic Hypotension"],
        "medications": ["Lisinopril 10mg (once daily)", "Furosemide 40mg (once daily)"],
        "model_coords": {"highlight_regions": ["chest", "lungs", "head"]},
        "phone_number": "+16479150932",
        "notes": "Chest tightness worsens when lying flat. Head-of-bed elevation required. Supervised transfers.",
        "created_at": now, "updated_at": now,
    },
    {
        "_id": "ee000000-0000-4000-c000-000000000003",
        "facility_id": FACILITY_ID, "room_id": "aa000000-0000-4000-a000-000000000003",
        "room_number": "103", "mrn": "MRN-1008",
        "first_name": "Margaret", "last_name": "Oduya",
        "full_name": "Margaret Oduya", "date_of_birth": "1955-08-22", "sex": "female",
        "primary_language": "en", "admission_date": "2024-02-10",
        "emergency_contact": {"name": "James Oduya", "relation": "son", "relationship": "son", "phone": "+1-647-555-1008"},
        "allergies": [],
        "diagnoses": ["Chronic Lower Back Pain", "Gastroesophageal Reflux Disease", "Fatigue"],
        "medications": ["Aspirin 81mg (once daily)", "Atorvastatin 20mg (once daily)"],
        "model_coords": {"highlight_regions": ["lower_back", "abdomen"]},
        "phone_number": "+16479150933",
        "notes": "Dull lower back pain rated 5/10. Post-meal stomach discomfort.",
        "created_at": now, "updated_at": now,
    },
]

for r in new_residents:
    result = db.residents.replace_one({"_id": r["_id"]}, r, upsert=True)
    action = "upserted" if result.upserted_id else "replaced"
    print(f"{action}: {r['_id']} — {r['full_name']}")

print("Total residents:", db.residents.count_documents({}))
for doc in db.residents.find({}, {"_id":1,"full_name":1,"room_number":1}).sort("room_number", 1):
    print(f"  Room {doc.get('room_number','?')}  {doc['_id']}  {doc.get('full_name','?')}")
'''
with sftp.open("/tmp/insert_residents.py", "w") as f:
    f.write(script.encode())
sftp.close()

print("=== Uploaded db.py ===")
print(run("/opt/app-backend/venv/bin/python3 /tmp/insert_residents.py"))
