'use client';

interface SignInPromptProps {
  message: string;
}

export default function SignInPrompt({ message }: SignInPromptProps) {
  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">✦</div>
        <p className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed mb-6">{message}</p>
        <a
          href="/login"
          className="inline-block w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors text-sm"
        >
          Sign In or Create Account
        </a>
      </div>
    </div>
  );
}
