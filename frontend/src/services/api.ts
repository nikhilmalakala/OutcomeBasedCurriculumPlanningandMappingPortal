import { useAuthStore } from '../store/authStore';

// Custom API fetch wrapper with automatic token refresh logic
export const apiRequest = async (url: string, options: RequestInit = {}): Promise<any> => {
  const { accessToken, refreshToken, logout, setAccessToken } = useAuthStore.getState();

  // 1. Prepare default headers
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 2. Attach Bearer token if available
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const finalOptions = {
    ...options,
    headers
  };

  try {
    let response = await fetch(url, finalOptions);

    // 3. Handle expired tokens (401 Unauthorized or 403 Forbidden)
    // Skip token refresh for the login endpoint — no token to refresh during login
    const isLoginEndpoint = url.includes('/api/auth/login');
    if (!isLoginEndpoint && (response.status === 401 || response.status === 403) && refreshToken) {
      console.warn('[API] Access token expired or invalid. Attempting session refresh...');
      
      // Attempt token rotation
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (refreshResponse.ok) {
        let refreshData: any = {};
        const refreshContentType = refreshResponse.headers.get('content-type');
        if (refreshContentType && refreshContentType.includes('application/json')) {
          try {
            refreshData = await refreshResponse.json();
          } catch (err) {
            console.error('[API] Failed to parse refresh token response:', err);
          }
        }
        const newAccessToken = refreshData.accessToken;
        
        if (newAccessToken) {
          // Save new token in Zustand & localStorage
          setAccessToken(newAccessToken);
          
          // Retry original request with updated token
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          response = await fetch(url, { ...options, headers });
        } else {
          console.error('[API] Refresh token response did not contain an access token.');
          logout();
          throw new Error('Session expired. Please log in again.');
        }
      } else {
        // Refresh token failed -> boot to login
        console.error('[API] Refresh token expired. Logging out.');
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    let data: any = {};
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (err) {
        console.error('[API] Failed to parse JSON response:', err);
        throw new Error('Server returned an invalid JSON response');
      }
    } else {
      // Not a JSON response (like HTML or text)
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Server error (Status: ${response.status})`);
      }
      data = text ? { message: text } : {};
    }
    
    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error(`[API Error] Request to ${url} failed:`, error.message);
    throw error;
  }
};

export const downloadFile = async (url: string, defaultFilename: string) => {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error: any) {
    console.error(`[API Download Error] Download from ${url} failed:`, error.message);
    throw error;
  }
};

// API Endpoint Actions
export const api = {
  auth: {
    login: (body: any) => apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
    profile: () => apiRequest('/api/auth/profile'),
    getFaculty: () => apiRequest('/api/auth/faculty'),
    changePassword: (body: any) => apiRequest('/api/auth/change-password', { method: 'POST', body: JSON.stringify(body) })
  },
  programs: {
    list: () => apiRequest('/api/programs'),
    create: (body: any) => apiRequest('/api/programs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/programs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/programs/${id}`, { method: 'DELETE' }),
    listDept: () => apiRequest('/api/programs/departments'),
    listDeptByProgram: (progId: string) => apiRequest(`/api/programs/${progId}/departments`),
    createDept: (body: any) => apiRequest('/api/programs/departments', { method: 'POST', body: JSON.stringify(body) }),
    updateDept: (id: string, body: any) => apiRequest(`/api/programs/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    assignHod: (id: string, body: any) => apiRequest(`/api/programs/departments/${id}/assign-hod`, { method: 'POST', body: JSON.stringify(body) }),
    deleteDept: (id: string) => apiRequest(`/api/programs/departments/${id}`, { method: 'DELETE' })
  },
  regulations: {
    list: () => apiRequest('/api/regulations'),
    listByProgram: (progId: string) => apiRequest(`/api/regulations/program/${progId}`),
    listByDept: (deptId: string) => apiRequest(`/api/regulations/dept/${deptId}`),
    create: (body: any) => apiRequest('/api/regulations', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/regulations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/regulations/${id}`, { method: 'DELETE' })
  },
  courses: {
    list: () => apiRequest('/api/courses'),
    listByDept: (deptId: string) => apiRequest(`/api/courses/dept/${deptId}`),
    create: (body: any) => apiRequest('/api/courses', { method: 'POST', body: JSON.stringify(body) }),
    listByReg: (regId: string) => apiRequest(`/api/courses/regulation/${regId}`),
    getVersion: (id: string) => apiRequest(`/api/courses/version/${id}`),
    assign: (body: any) => apiRequest('/api/courses/assign', { method: 'POST', body: JSON.stringify(body) }),
    listAssigned: () => apiRequest('/api/courses/coordinator'),
    saveDraft: (id: string, body: any) => apiRequest(`/api/courses/version/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    updateStatus: (id: string, body: any) => apiRequest(`/api/courses/version/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
    downloadPdf: () => downloadFile('/api/courses/download/pdf', 'Curriculum_R24.pdf'),
    downloadWord: (id: string, filename: string) => downloadFile(`/api/courses/version/${id}/download-word`, filename),
    deleteVersion: (id: string) => apiRequest(`/api/courses/version/${id}`, { method: 'DELETE' }),
    deleteCourse: (id: string) => apiRequest(`/api/courses/${id}`, { method: 'DELETE' })
  },
  users: {
    list: () => apiRequest('/api/users'),
    create: (body: any) => apiRequest('/api/users', { method: 'POST', body: JSON.stringify(body) }),
    bulkCreate: (body: any) => apiRequest('/api/users/bulk', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/users/${id}`, { method: 'DELETE' })
  },
  peoPso: {
    getByDept: (deptId: string) => apiRequest(`/api/peo-pso/dept/${deptId}`),
    updateByDept: (deptId: string, body: any) => apiRequest(`/api/peo-pso/dept/${deptId}`, { method: 'PUT', body: JSON.stringify(body) })
  },
  curriculum: {
    getFull: (regulationId: string) => apiRequest(`/api/curriculum/${regulationId}`),
    getSummary: (regulationId: string) => apiRequest(`/api/curriculum/${regulationId}/summary`),
    getSemester: (regulationId: string, sem: number) => apiRequest(`/api/curriculum/${regulationId}/semester/${sem}`)
  },
  minorStreams: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/minor-streams?${qs}`);
    },
    create: (body: any) => apiRequest('/api/minor-streams', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/minor-streams/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/minor-streams/${id}`, { method: 'DELETE' })
  },
  prerequisites: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/prerequisites?${qs}`);
    },
    create: (body: any) => apiRequest('/api/prerequisites', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/prerequisites/${id}`, { method: 'DELETE' })
  },
  auditLogs: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/audit-logs?${qs}`);
    }
  },
  notifications: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/notifications?${qs}`);
    },
    markRead: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => apiRequest('/api/notifications/read-all', { method: 'PUT' })
  },
  peos: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/peos?${qs}`);
    },
    create: (body: any) => apiRequest('/api/peos', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/peos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/peos/${id}`, { method: 'DELETE' })
  },
  psos: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/psos?${qs}`);
    },
    create: (body: any) => apiRequest('/api/psos', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/psos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/psos/${id}`, { method: 'DELETE' })
  },
  courseAssignments: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/course-assignments?${qs}`);
    },
    create: (body: any) => apiRequest('/api/course-assignments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiRequest(`/api/course-assignments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => apiRequest(`/api/course-assignments/${id}`, { method: 'DELETE' })
  },
  curriculumBooks: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/curriculum-books/list?${qs}`);
    },
    get: (id: string) => apiRequest(`/api/curriculum-books/${id}`),
    upload: (formData: FormData) => apiRequest('/api/curriculum-books/upload', { method: 'POST', body: formData }),
    update: (id: string, body: any) => apiRequest(`/api/curriculum-books/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    updateStatus: (id: string, status: 'Draft' | 'Published' | 'Archived') => apiRequest(`/api/curriculum-books/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id: string) => apiRequest(`/api/curriculum-books/${id}`, { method: 'DELETE' }),
    versionHistory: (bookId: string) => apiRequest(`/api/curriculum-books/version/history?curriculumBookId=${bookId}`),
    createVersion: (body: any) => apiRequest('/api/curriculum-books/version/create', { method: 'POST', body: JSON.stringify(body) }),
    restoreVersion: (bookId: string, versionId: string) => apiRequest(`/api/curriculum-books/${bookId}/versions/${versionId}/restore`, { method: 'POST' }),
    exportPdf: (body: any) => apiRequest('/api/curriculum-books/export/pdf', { method: 'POST', body: JSON.stringify(body) }),
    livePreview: (curriculumBookId: string) => apiRequest(`/api/curriculum-books/live-preview?curriculumBookId=${curriculumBookId}`),
    creditSummary: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/api/curriculum-books/credit-summary?${qs}`);
    },
  }
};
