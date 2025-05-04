'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import OneTapComponent from '@/app/components/auth/OneTapComponent';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background/50 to-background/80 px-4 dot-pattern-dark'>
      <div className='w-full max-w-md'>
        <div className='flex flex-col items-center space-y-4 text-center mb-8'>
          <h1 className='text-3xl font-bold'>Welcome to Taskmaster</h1>
          <p className='text-muted-foreground'>
            Sign in to your account to continue
          </p>
        </div>

        <div className='glass-dark rounded-xl p-8'>
          <div className='flex flex-col space-y-6'>
            <div className='relative flex items-center justify-center'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t border-border'></span>
              </div>
              <span className='relative z-10 px-3 text-sm uppercase text-muted-foreground bg-[#131622]'>
                Sign in with
              </span>
            </div>

            <div>
              <OneTapComponent />
              <div className='text-center text-sm text-muted-foreground mt-6'>
                By signing in, you agree to our
                <Link href='#' className='underline text-primary ml-1'>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href='#' className='underline text-primary'>
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
