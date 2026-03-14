import os
from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv()

# credentials
account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
client = Client(account_sid, auth_token)

call = client.calls.create(
    to='+16479150931',            # Patient
    from_='+12265058825',  # Caller
    twiml='<Response><Say>Hello! This is a test call from Twilio.</Say></Response>'
)

print(call.sid)