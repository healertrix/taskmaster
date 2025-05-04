declare module 'google-one-tap' {
  export interface CredentialResponse {
    credential: string;
    select_by: string;
  }

  export interface GsiButtonConfiguration {
    type: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: string | number;
    locale?: string;
  }

  export interface GsiButtonTargetElement extends Element {
    renderButton: (options: GsiButtonConfiguration) => void;
  }

  export interface IdConfiguration {
    client_id: string;
    auto_select?: boolean;
    callback: (handleCredentialResponse: CredentialResponse) => void;
    login_uri?: string;
    native_callback?: (...args: any[]) => void;
    cancel_on_tap_outside?: boolean;
    prompt_parent_id?: string;
    nonce?: string;
    context?: string;
    state_cookie_domain?: string;
    ux_mode?: 'popup' | 'redirect';
    allowed_parent_origin?: string | string[];
    intermediate_iframe_close_callback?: (...args: any[]) => void;
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
  }

  export interface Window {
    google: {
      accounts: {
        id: {
          initialize: (idConfiguration: IdConfiguration) => void;
          prompt: (momentListener?: (promptMoment: any) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: GsiButtonConfiguration
          ) => void;
          disableAutoSelect: () => void;
          storeCredential: (
            credential: { id: string; password: string },
            callback?: () => void
          ) => void;
          cancel: () => void;
          onGoogleLibraryLoad: () => void;
          revoke: (
            accessToken: string,
            callback?: (done: boolean) => void
          ) => void;
        };
      };
    };
  }
}
