import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    accessToken?: string;
    role?: string;
    permissions?: string[];
  }

  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      role?: string;
      // Page-permission allowlist driven by the admin Invite flow. Empty
      // array (or missing) = legacy unrestricted account; otherwise the
      // sidebar gates visibility against this list.
      permissions?: string[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    accessToken?: string;
    role?: string;
    permissions?: string[];
  }
}
