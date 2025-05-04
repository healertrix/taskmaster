'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import OneTapComponent from '@/app/components/auth/OneTapComponent';
import {
  CheckSquare,
  ArrowRight,
  Lock,
  Shield,
  Zap,
  Layout,
  Users,
  Calendar,
} from 'lucide-react';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className='flex min-h-screen flex-col lg:flex-row overflow-hidden'>
      {/* Left side - Illustration/Preview (more compact) */}
      <div className='hidden lg:flex flex-1 bg-gradient-to-br from-background/95 to-background/80 relative'>
        {/* Enhanced decorative elements */}
        <div className='absolute inset-0 bg-grid-pattern-dark opacity-10'></div>
        <div className='absolute top-1/3 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse duration-7000'></div>
        <div className='absolute bottom-1/3 -right-24 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse duration-5000 delay-1000'></div>

        {/* Pattern overlay */}
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:24px_24px]'></div>

        <div className='relative w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-6 h-full'>
          {/* Glass card background with refined border */}
          <div className='absolute top-8 left-8 right-8 bottom-8 rounded-2xl border border-white/10 backdrop-blur-md bg-white/[0.03] shadow-[0_8px_32px_rgba(0,0,0,0.1)]'></div>

          <div className='relative flex flex-col items-center max-w-xl px-4'>
            {/* Compact header with icon */}
            <div className='mb-3 flex items-center gap-2'>
              <div className='w-10 h-10 rounded-xl bg-primary/20 backdrop-blur-sm flex items-center justify-center'>
                <Zap className='w-5 h-5 text-primary' />
              </div>
              <div className='h-px w-12 bg-gradient-to-r from-primary/40 to-transparent'></div>
            </div>

            <h2 className='text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80'>
              Boost Your Productivity
            </h2>
            <p className='text-muted-foreground text-center text-base leading-relaxed max-w-md mb-6'>
              Taskmaster helps teams move work forward efficiently with
              collaborative boards, lists, and cards
            </p>

            {/* Feature points with icons - more compact grid */}
            <div className='grid grid-cols-2 gap-3 gap-y-2 mb-6 w-full'>
              <div className='flex items-center gap-2'>
                <div className='flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center'>
                  <Layout className='w-4 h-4 text-blue-400' />
                </div>
                <span className='text-xs font-medium'>Kanban boards</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex-shrink-0 w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center'>
                  <Users className='w-4 h-4 text-green-400' />
                </div>
                <span className='text-xs font-medium'>Collaboration</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center'>
                  <CheckSquare className='w-4 h-4 text-purple-400' />
                </div>
                <span className='text-xs font-medium'>Task management</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center'>
                  <Calendar className='w-4 h-4 text-orange-400' />
                </div>
                <span className='text-xs font-medium'>Deadlines</span>
              </div>
            </div>

            {/* More compact app preview */}
            <div className='relative w-full bg-background/40 backdrop-blur-sm rounded-xl border border-border/40 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] overflow-hidden transform perspective-1000 rotate-x-1'>
              {/* Window controls bar - more compact */}
              <div className='absolute top-0 left-0 right-0 h-9 bg-background/80 border-b border-border/30 flex items-center px-3 backdrop-blur-md'>
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

      {/* Right side - Login form - Keep unchanged */}
      <div className='flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-8 dot-pattern-dark relative'>
        {/* Floating elements animation (decorative) */}
        <div className='absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute bottom-1/4 right-1/3 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse delay-700'></div>

        <div className='w-full max-w-md z-10'>
          <div className='flex justify-center mb-6'>
            <div className='flex items-center gap-2 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent'>
              <CheckSquare className='w-8 h-8 text-primary' />
              Taskmaster
            </div>
          </div>

          <div className='flex flex-col items-center space-y-4 text-center mb-8'>
            <h1 className='text-3xl font-bold leading-tight tracking-tight'>
              Welcome Back
            </h1>
            <p className='text-muted-foreground max-w-sm'>
              Sign in to your account to continue your productivity journey
            </p>
          </div>

          <div className='glass-dark rounded-xl p-8 shadow-xl backdrop-blur-sm border border-border/50'>
            <div className='flex flex-col space-y-8'>
              <div className='relative flex items-center justify-center'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t border-border/50'></span>
                </div>
                <span className='relative z-10 px-4 text-sm uppercase text-muted-foreground bg-[#131622] font-medium'>
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

              <div className='text-center text-xs text-muted-foreground pt-2 border-t border-border/30 space-y-2'>
                <p>
                  By signing in, you agree to our
                  <Link
                    href='#'
                    className='underline text-primary hover:text-primary/80 mx-1 transition-colors'
                  >
                    Terms of Service
                  </Link>
                  and
                  <Link
                    href='#'
                    className='underline text-primary hover:text-primary/80 ml-1 transition-colors'
                  >
                    Privacy Policy
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Feature highlights */}
          <div className='mt-10 grid grid-cols-2 gap-4'>
            <div className='flex items-start gap-2'>
              <div className='w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5'>
                <Shield className='w-4 h-4 text-blue-500' />
              </div>
              <div>
                <h3 className='text-sm font-medium'>Secure</h3>
                <p className='text-xs text-muted-foreground'>
                  Google authentication
                </p>
              </div>
            </div>
            <div className='flex items-start gap-2'>
              <div className='w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5'>
                <CheckSquare className='w-4 h-4 text-green-500' />
              </div>
              <div>
                <h3 className='text-sm font-medium'>Reliable</h3>
                <p className='text-xs text-muted-foreground'>
                  Trusted by teams
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
