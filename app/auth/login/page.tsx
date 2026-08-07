'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import OneTapComponent from '@/app/components/auth/OneTapComponent';
import { CheckSquare, Lock, Zap, AlertCircle } from 'lucide-react';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (errorParam) {
      switch (errorParam) {
        case 'auth':
          setError(messageParam || 'Authentication failed. Please try again.');
          break;
        case 'session':
          setError('Session error. Please try again.');
          break;
        case 'unexpected':
          setError('An unexpected error occurred. Please try again.');
          break;
        default:
          setError('An error occurred during authentication.');
      }
    }
  }, [searchParams]);

  return (
    <div className='flex min-h-screen flex-col lg:flex-row overflow-hidden'>
      {/* Left side - product preview, trimmed to headline + mockup only */}
      <div className='hidden lg:flex flex-1 relative'>
        <div className='relative w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-6 h-full'>
          {/* Glass panel, unified with the app's card/modal tokens */}
          <div className='absolute top-8 left-8 right-8 bottom-8 rounded-2xl border border-border bg-card/75 backdrop-blur-xl'></div>

          <div className='relative flex flex-col items-center max-w-xl px-4'>
            {/* AI-first badge */}
            <div className='mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 heading-enter'>
              <Zap className='w-3.5 h-3.5 text-primary' />
              <span className='text-xs font-medium text-primary'>
                AI-first task management
              </span>
            </div>

            <h2 className='text-3xl font-bold mb-2 text-foreground heading-enter'>
              Boost Your Productivity
            </h2>
            <p className='text-muted-foreground text-center text-base leading-relaxed max-w-md mb-4'>
              Taskmaster helps teams move work forward efficiently with
              collaborative boards, lists, and cards
            </p>

            {/* Feature detail row */}
            <div className='flex items-center gap-3 text-xs text-muted-foreground mb-6'>
              <span>Kanban boards</span>
              <span className='w-1 h-1 rounded-full bg-border'></span>
              <span>Real-time collaboration</span>
              <span className='w-1 h-1 rounded-full bg-border'></span>
              <span>Smart automation</span>
            </div>

            {/* Product preview */}
            <div className='relative w-full bg-card/90 backdrop-blur-xl rounded-xl border border-border shadow-2xl overflow-hidden transform perspective-1000 rotate-x-1'>
              {/* Window controls bar - more compact */}
              <div className='absolute top-0 left-0 right-0 h-9 bg-card/95 border-b border-border flex items-center px-3 backdrop-blur-xl'>
                <div className='w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5'></div>
                <div className='w-2.5 h-2.5 rounded-full bg-yellow-500 mr-1.5'></div>
                <div className='w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5'></div>
                <div className='ml-3 h-3 w-32 bg-muted/30 rounded-full'></div>

                {/* Tab indicator */}
                <div className='ml-auto flex'>
                  <div className='px-2 py-0.5 rounded-t-md bg-background/50 border-b-2 border-primary text-xs font-medium text-[10px]'>
                    Dashboard
                  </div>
                  <div className='px-2 py-0.5 text-xs text-muted-foreground text-[10px]'>
                    Projects
                  </div>
                </div>
              </div>

              {/* Kanban board visualization - more compact */}
              <div className='pt-12 px-3 pb-4 flex gap-3 h-64 overflow-hidden'>
                {/* To Do column */}
                <div className='w-44 flex-shrink-0'>
                  <div className='flex items-center gap-1 h-6 mb-2'>
                    <div className='w-1.5 h-1.5 rounded-full bg-blue-500'></div>
                    <div className='text-xs font-semibold text-[10px]'>
                      TO DO
                    </div>
                    <div className='ml-auto text-xs text-muted-foreground text-[10px]'>
                      4
                    </div>
                  </div>
                  <div className='h-16 w-full bg-muted/10 rounded-lg mb-1.5 p-1.5 border border-border/30 hover:border-border/50 transition-colors'>
                    <div className='w-full h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='w-3/4 h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='flex justify-between mt-3'>
                      <div className='flex'>
                        <div className='w-4 h-4 rounded-full bg-blue-500/20'></div>
                      </div>
                      <div className='w-10 h-2 bg-muted/20 rounded-full'></div>
                    </div>
                  </div>
                  <div className='h-16 w-full bg-muted/10 rounded-lg mb-1.5 p-1.5 border border-border/30'>
                    <div className='w-full h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='w-2/3 h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='flex justify-between mt-3'>
                      <div className='flex'>
                        <div className='w-4 h-4 rounded-full bg-green-500/20'></div>
                      </div>
                      <div className='w-10 h-2 bg-muted/20 rounded-full'></div>
                    </div>
                  </div>
                  <div className='h-16 w-full bg-primary/5 rounded-lg mb-1.5 p-1.5 border border-primary/20 shadow-sm'>
                    <div className='w-full h-2 bg-primary/20 rounded-full mb-1.5'></div>
                    <div className='w-4/5 h-2 bg-primary/20 rounded-full mb-1.5'></div>
                    <div className='flex justify-between mt-3'>
                      <div className='flex'>
                        <div className='w-4 h-4 rounded-full bg-primary/20'></div>
                      </div>
                      <div className='w-10 h-2 bg-primary/20 rounded-full'></div>
                    </div>
                  </div>
                </div>

                {/* In Progress column */}
                <div className='w-44 flex-shrink-0'>
                  <div className='flex items-center gap-1 h-6 mb-2'>
                    <div className='w-1.5 h-1.5 rounded-full bg-yellow-500'></div>
                    <div className='text-xs font-semibold text-[10px]'>
                      IN PROGRESS
                    </div>
                    <div className='ml-auto text-xs text-muted-foreground text-[10px]'>
                      2
                    </div>
                  </div>
                  <div className='h-16 w-full bg-muted/10 rounded-lg mb-1.5 p-1.5 border border-border/30'>
                    <div className='w-full h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='w-2/3 h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='flex justify-between mt-3'>
                      <div className='flex'>
                        <div className='w-4 h-4 rounded-full bg-yellow-500/20'></div>
                      </div>
                      <div className='w-10 h-2 bg-muted/20 rounded-full'></div>
                    </div>
                  </div>
                  <div className='h-16 w-full bg-accent/5 rounded-lg mb-1.5 p-1.5 border border-accent/20 shadow-sm'>
                    <div className='w-full h-2 bg-accent/20 rounded-full mb-1.5'></div>
                    <div className='w-1/2 h-2 bg-accent/20 rounded-full mb-1.5'></div>
                    <div className='flex justify-between mt-3'>
                      <div className='flex'>
                        <div className='w-4 h-4 rounded-full bg-accent/20'></div>
                      </div>
                      <div className='w-10 h-2 bg-accent/20 rounded-full'></div>
                    </div>
                  </div>
                </div>

                {/* Completed column */}
                <div className='w-44 flex-shrink-0'>
                  <div className='flex items-center gap-1 h-6 mb-2'>
                    <div className='w-1.5 h-1.5 rounded-full bg-green-500'></div>
                    <div className='text-xs font-semibold text-[10px]'>
                      COMPLETED
                    </div>
                    <div className='ml-auto text-xs text-muted-foreground text-[10px]'>
                      3
                    </div>
                  </div>
                  <div className='h-16 w-full bg-muted/10 rounded-lg mb-1.5 p-1.5 border border-border/30'>
                    <div className='w-full h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='w-3/4 h-2 bg-muted/20 rounded-full mb-1.5'></div>
                    <div className='flex justify-between mt-3'>
                      <div className='flex'>
                        <div className='w-4 h-4 rounded-full bg-green-500/20'></div>
                      </div>
                      <div className='w-10 h-2 bg-muted/20 rounded-full'></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className='flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-8 relative'>
        <div className='w-full max-w-md z-10'>
          <div className='flex justify-center mb-6'>
            <div className='flex items-center gap-2 text-2xl font-bold text-foreground heading-enter'>
              <CheckSquare className='w-8 h-8 text-primary' />
              Taskmaster
            </div>
          </div>

          <div className='flex flex-col items-center space-y-4 text-center mb-8 heading-enter'>
            <h1 className='text-3xl font-bold leading-tight tracking-tight'>
              Welcome Back
            </h1>
            <p className='text-muted-foreground max-w-sm'>
              Sign in to your account to continue your productivity journey
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className='mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3'>
              <AlertCircle className='w-5 h-5 text-red-500 flex-shrink-0' />
              <div className='text-sm text-red-500'>{error}</div>
              <button
                onClick={() => setError(null)}
                className='ml-auto text-red-500 hover:text-red-400 transition-colors'
              >
                ×
              </button>
            </div>
          )}

          <div className='bg-card/90 backdrop-blur-xl rounded-xl shadow-2xl border border-border p-8 animate-in fade-in-50 zoom-in-95 duration-200'>
            <div className='flex flex-col space-y-8'>
              <div className='relative flex items-center justify-center'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t border-border'></span>
                </div>
                <span className='relative z-10 px-4 text-sm uppercase text-muted-foreground bg-card font-medium'>
                  Continue with
                </span>
              </div>

              <div>
                <OneTapComponent />

                <div className='flex items-center justify-center mt-8 gap-2'>
                  <Lock className='w-4 h-4 text-primary/70' />
                  <span className='text-sm text-muted-foreground'>
                    Secure Authentication
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
