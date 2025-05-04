import { Window as GoogleWindow } from 'google-one-tap';

declare global {
  interface Window extends GoogleWindow {
    // Add any other global window properties here if needed
  }
}
