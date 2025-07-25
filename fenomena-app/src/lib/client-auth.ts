// Client-side authentication utilities

export function checkAuthStatus(): boolean {
  // Since our auth cookie is HttpOnly, we can't read it from JavaScript
  // So we'll assume user is authenticated and let API calls handle auth failures
  console.log('Checking auth status - assuming authenticated (HttpOnly cookie)');
  return true;
}

export function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;
  
  // Clear auth cookie
  document.cookie = 'auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  
  // Redirect to login
  window.location.href = '/login';
}

export async function makeAuthenticatedRequest(
  url: string, 
  options: RequestInit = {},
  autoRedirectOn401: boolean = false
): Promise<Response> {
  // Ensure credentials are included
  const requestOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    }
  };

  console.log('Making authenticated request to:', url);
  console.log('Request options:', requestOptions);

  const response = await fetch(url, requestOptions);
  
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  // If authentication fails, handle it based on autoRedirectOn401 flag
  if (response.status === 401) {
    console.error('Authentication failed for:', url);
    
    if (autoRedirectOn401) {
      console.log('Auto-redirecting to login...');
      clearAuthAndRedirect();
      throw new Error('Authentication failed');
    } else {
      console.log('Authentication failed but not auto-redirecting');
      // Just return the response, let the caller handle it
    }
  }

  return response;
}