async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event('unauthorized'));
    throw new Error('Unauthorized');
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function login(password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function checkAuth() {
  return request('/api/auth/check');
}

export async function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

export async function getFriends() {
  return request('/api/friends');
}

export async function createFriend(name) {
  return request('/api/friends', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function deleteFriend(id) {
  return request(`/api/friends/${id}`, { method: 'DELETE' });
}

export async function getEvents(friendId) {
  const url = friendId ? `/api/events?friendId=${friendId}` : '/api/events';
  return request(url);
}

export async function createEvent(data) {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(id) {
  return request(`/api/events/${id}`, { method: 'DELETE' });
}

export async function exportData() {
  return request('/api/export');
}
