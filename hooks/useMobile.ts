'use client';

import { useState, useEffect } from 'react';

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = [
        'mobile',
        'android',
        'iphone',
        'ipad',
        'ipod',
        'blackberry',
        'windows phone',
      ];
      const isMobileUA = mobileKeywords.some((keyword) =>
        userAgent.includes(keyword)
      );
      const isSmallScreen = window.innerWidth <= 768;
      const hasTouchScreen =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setIsMobile(isMobileUA || isSmallScreen);
      setIsTouchDevice(hasTouchScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle back gesture for mobile
  const handleMobileBack = (callback: () => void) => {
    if (isMobile) {
      // Add back button listener for Android
      const handlePopState = () => {
        callback();
      };

      window.addEventListener('popstate', handlePopState);

      // Push a new state to enable back button
      window.history.pushState(null, '', window.location.href);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  };

  return {
    isMobile,
    isTouchDevice,
    handleMobileBack,
  };
}
