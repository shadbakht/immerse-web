'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

const SLIDES = [
  {
    icon: '📚',
    title: 'A Living Library',
    desc: '400+ sacred texts from every major tradition — Bahá\'í, Buddhist, Christian, Islamic, Jewish, Hindu, and more.',
  },
  {
    icon: '🏷️',
    title: 'Tag & Collect',
    desc: 'Select any passage and tag it. Build thematic collections across traditions and authors.',
  },
  {
    icon: '📝',
    title: 'Notes & Cross-References',
    desc: 'Attach private notes to passages, and link related quotes across different books.',
  },
  {
    icon: '🌐',
    title: 'Community',
    desc: 'Discover and import tag collections shared by other readers. Share your own with the world.',
  },
];

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const supabase = createClient();

  const [step, setStep] = useState<'onboarding' | 'auth'>('onboarding');
  const [slideIndex, setSlideIndex] = useState(0);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Skip onboarding if returning user (has seen it before)
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('immerse_onboarding_done')) {
      setStep('auth');
    }
  }, []);

  function completeOnboarding() {
    localStorage.setItem('immerse_onboarding_done', '1');
    setStep('auth');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push(redirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    router.push(redirect);
  }

  const slide = SLIDES[slideIndex];
  const isLast = slideIndex === SLIDES.length - 1;

  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Image src="/immerse-icon.png" alt="Immerse" width={72} height={72} className="rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Immerse</h1>
          <p className="text-sm text-gray-400 mt-1">Sacred texts from all traditions</p>
        </div>

        {step === 'onboarding' ? (
          <div>
            {/* Slide */}
            <div className="bg-white/5 rounded-2xl px-6 py-8 mb-6 text-center min-h-[180px] flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">{slide.icon}</div>
              <h2 className="text-lg font-semibold text-white mb-2">{slide.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{slide.desc}</p>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-1.5 mb-6">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? 'bg-[#1B6B7B]' : 'bg-white/20'}`}
                />
              ))}
            </div>

            {/* Buttons */}
            {isLast ? (
              <button
                onClick={completeOnboarding}
                className="w-full bg-[#1B6B7B] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] transition mb-3"
              >
                Get Started
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={completeOnboarding}
                  className="flex-1 text-gray-500 text-sm py-3 hover:text-gray-300 transition"
                >
                  Skip
                </button>
                <button
                  onClick={() => setSlideIndex(i => i + 1)}
                  className="flex-1 bg-[#1B6B7B] text-white font-semibold py-3 rounded-xl hover:bg-[#155a68] transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B]"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#1B6B7B]"
              />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1B6B7B] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] transition disabled:opacity-50"
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-600">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={handleGuest}
              className="w-full border border-white/15 text-white/70 font-medium py-3.5 rounded-xl hover:bg-white/5 hover:text-white transition"
            >
              Continue as Guest
            </button>

            <p className="text-center text-sm text-gray-500 mt-5">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-[#1B6B7B] hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
