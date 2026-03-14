import PatientCaller from './components/PatientCaller';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-pink-500 mb-1">
            Patient Caller
          </h1>
          <p className="text-sm text-gray-500">
            Automated healthcare calls powered by Twilio, ElevenLabs, &amp; OpenAI
          </p>
        </div>
        <PatientCaller />
      </div>
    </main>
  );
}
