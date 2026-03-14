import PatientCaller from './components/PatientCaller';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-pink-500 mb-2">
            AI Patient Caller
          </h1>
          <p className="text-lg text-gray-500">
            Automated healthcare follow-ups powered by Twilio, ElevenLabs, & OpenAI
          </p>
        </div>

        <PatientCaller />
      </div>
    </main>
  );
}
