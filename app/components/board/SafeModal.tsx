'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';

interface SafeModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function SafeModal({
  isOpen,
  onClose,
  children,
  className = '',
}: SafeModalProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle modal opening
  useEffect(() => {
    if (isOpen && !shouldRender) {
      setShouldRender(true);
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setIsTransitioning(true);
      }, 10);
    } else if (!isOpen && shouldRender) {
      setIsTransitioning(false);
      // Wait for transition to complete before unmounting
      setTimeout(() => {
        setShouldRender(false);
      }, 300);
    }
  }, [isOpen, shouldRender]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isTransitioning) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isTransitioning]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isTransitioning) {
        handleClose();
      }
    },
    [isTransitioning]
  );

  // Safe close handler
  const handleClose = useCallback(() => {
    if (isTransitioning) return;
    onClose();
  }, [isTransitioning, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isTransitioning ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-background rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 ${
          isTransitioning ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
