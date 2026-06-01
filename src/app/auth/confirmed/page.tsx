import Link from 'next/link';
import Image from 'next/image';

export default function ConfirmedPage() {
  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <Image src="/immerse-icon.png" alt="Immerse" width={72} height={72} className="rounded-2xl" />
        </div>
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-3">Email Confirmed</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          Your account is ready. Sign in with your email and password to get started.
        </p>
        <Link
          href="/login"
          className="block w-full bg-[#1B6B7B] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] transition-colors text-sm"
        >
          Sign In to Immerse
        </Link>
      </div>
    </div>
  );
}
