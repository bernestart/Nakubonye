const API_BASE_URL = "https://nakubonye.bernestart.workers.dev";

export const api = {
  getPosts: async () => {
    const res = await fetch(`${API_BASE_URL}/api/posts`);
    return await res.json();
  },
  createPost: async (content) => {
    const res = await fetch(`${API_BASE_URL}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    return await res.json();
  }
};

export const getUserPosts = async (userId) => {
  const res = await fetch(`${API_BASE_URL}/api/posts?userId=${userId}`);
  const json = await res.json();
  return json.data || []; // Return empty array if error
};

export const createPost = async (postData) => {
  const res = await fetch(`${API_BASE_URL}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postData)
  });
  return await res.json();
};

export const getRankedFeed = async (userId) => {
  const res = await fetch(`${API_BASE_URL}/api/feed?userId=${userId}`);
  const json = await res.json();
  return json.data || [];
};

export const toggleLikeAPI = async (postId, userId, action) => {
  const res = await fetch(`${API_BASE_URL}/api/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, userId, action })
  });
  return await res.json();
};

export const getCommunityPosts = async (communityIds, userId) => {
  const idsString = communityIds.join(',');
  const res = await fetch(`${API_BASE_URL}/api/community/posts?communityIds=${idsString}&userId=${userId}`);
  const json = await res.json();
  return json.data || [];
};
