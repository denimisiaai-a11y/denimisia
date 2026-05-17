import 'next-auth';
import '@auth/core/jwt';

declare module 'next-auth' {
  interface User {
    accessToken?: string;
    role?: string;
  }

  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      role?: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    accessToken?: string;
    role?: string;
  }
}
