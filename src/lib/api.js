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

import { supabase } from "./supabase"; // Ensure supabase is imported here

export const getMediaUrl = (path, bucket = "community-media") => {
  if (!path) return null;
  if (typeof path === 'string' && path.startsWith('http')) return path;
  
  // If it's a Telegram file_id (no slashes), use Cloudflare Proxy
  if (typeof path === 'string' && !path.includes('/')) {
    return `https://nakubonye.bernestart.workers.dev/api/media/${path}`;
  }
  
  // Fallback to Supabase for old legacy files
  return supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl;
};

export const uploadMedia = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Upload failed");
  return json.file_id; // Returns the Telegram file_id
};
