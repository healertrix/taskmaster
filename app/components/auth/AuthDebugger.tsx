'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';

export default function AuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { user, session } = useAuth();
  const supabase = createClient();

  const checkAuthStatus = async () => {
    try {
      // Check session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      // Check profile
      let profileData = null;
      let profileError = null;

      if (sessionData.session?.user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .single();
        profileData = data;
        profileError = error;
      }

      // Check all profiles count
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at');

      setDebugInfo({
        contextUser: user,
        contextSession: !!session,
        supabaseSession: !!sessionData.session,
        supabaseUser: sessionData.session?.user,
        sessionError,
        profile: profileData,
        profileError,
        allProfiles,
        allProfilesError,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setDebugInfo({
        error: error,
        timestamp: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      checkAuthStatus();
    }
  }, [isVisible, user, session]);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <button
        onClick={() => setIsVisible(!isVisible)}
        className='bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700 transition-colors'
      >
        {isVisible ? 'Hide' : 'Debug Auth'}
      </button>

      {isVisible && (
        <div className='absolute bottom-12 right-0 w-96 max-h-96 overflow-auto bg-gray-900 text-white p-4 rounded-lg shadow-xl border border-gray-700'>
          <div className='flex justify-between items-center mb-3'>
            <h3 className='font-bold text-sm'>Auth Debug Info</h3>
            <button
              onClick={checkAuthStatus}
              className='bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors'
            >
              Refresh
            </button>
          </div>

          {debugInfo && (
            <div className='space-y-2 text-xs'>
              <div>
                <strong>Context User:</strong>{' '}
                {debugInfo.contextUser ? '✅' : '❌'}
                {debugInfo.contextUser && (
                  <div className='ml-2 text-gray-300'>
                    ID: {debugInfo.contextUser.id?.slice(0, 8)}...
                  </div>
                )}
              </div>

              <div>
                <strong>Supabase Session:</strong>{' '}
                {debugInfo.supabaseSession ? '✅' : '❌'}
                {debugInfo.supabaseUser && (
                  <div className='ml-2 text-gray-300'>
                    Email: {debugInfo.supabaseUser.email}
                  </div>
                )}
              </div>

              <div>
                <strong>Profile in DB:</strong>{' '}
                {debugInfo.profile ? '✅' : '❌'}
                {debugInfo.profileError && (
                  <div className='ml-2 text-red-400'>
                    Error: {debugInfo.profileError.message}
                  </div>
                )}
              </div>

              <div>
                <strong>Total Profiles:</strong>{' '}
                {debugInfo.allProfiles?.length || 0}
                {debugInfo.allProfiles && debugInfo.allProfiles.length > 0 && (
                  <div className='ml-2 text-gray-300 max-h-20 overflow-auto'>
                    {debugInfo.allProfiles.map((p: any) => (
                      <div key={p.id} className='text-xs'>
                        {p.email} ({p.id.slice(0, 8)}...)
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {debugInfo.error && (
                <div className='text-red-400'>
                  <strong>Error:</strong> {debugInfo.error.message}
                </div>
              )}

              <div className='text-gray-400 text-xs mt-2'>
                Last updated:{' '}
                {new Date(debugInfo.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
