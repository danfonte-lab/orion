import { captureException } from "@/src/monitoring/sentry";
import axios from "axios";
import apiClient from "./apiClient";
import { getCachedEmployeeProfile } from "./profileService";

export type NewsFeedEmoji = {
  emoji_id?: string;
  emoji_content?: string;
  emoji_title?: string;
  id?: string;
  emoji?: string;
  unicode?: string;
  unicode_character?: string;
  character?: string;
  name?: string;
};

export type NewsFeedPreview = {
  preview_id?: string;
  count?: number;
  post_id?: string;
  emoji_id?: string;
};

export type NewsFeedAttachment = {
  attachment_url?: string;
  processed_url?: string | null;
  attachment_type?: string;
  video_thumbnail_url?: string | null;
  thumbnail_url?: string | null;
  preview_image_url?: string | null;
  preview_url?: string | null;
};

export type NewsFeedPost = {
  post_id?: string;
  preview?: NewsFeedPreview[];
  attachments?: NewsFeedAttachment[];
  employee_profile?: {
    employee_id?: string;
    job_title?: string;
    full_name?: string;
    legal_sex?: string;
  };
  reacted_emoji_id?: string | null;
  post_content?: string;
  created_at?: string;
  updated_at?: string;
  has_reacted?: boolean;
};

export type NewsFeedResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: NewsFeedPost[];
};

type EmojiResponseShape = NewsFeedEmoji[] | { results?: NewsFeedEmoji[] };
type ReactionResponse = { message: string };

export type ReactPostRequest = {
  post_id: string;
  emoji_id: string;
};

export type RemoveReactionRequest = {
  post_id: string;
};

let emojiCache: NewsFeedEmoji[] | null = null;
let emojiRequest: Promise<NewsFeedEmoji[]> | null = null;

function toHierarchyHeaderValue(hierarchy?: string[]): string {
  return (hierarchy ?? []).filter(Boolean).join(",");
}

async function buildNewsFeedHeaders(): Promise<Record<string, string>> {
  const profile = await getCachedEmployeeProfile();
  const hierarchy = toHierarchyHeaderValue(profile.profile?.hierarchy_of_managers);
  const manager = profile.profile?.manager ?? "";

  return {
    "hierarchy-of-managers": hierarchy,
    manager,
    version: "v2",
  };
}

export async function getNewsFeed(
  page = 1,
  pageSize = 10,
): Promise<NewsFeedResponse> {
  const params = {
    page,
    "page-size": pageSize,
  };
  const headers = await buildNewsFeedHeaders();

  try {
    const res = await apiClient.get<NewsFeedResponse>("/mobile/api/newsfeed", {
      params,
      headers,
    });
    return res.data ?? {};
  } catch (error) {
    captureException(error, {
      scope: "news_feed_service",
      action: "get_news_feed",
      extras: { page, pageSize },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export async function getEmojis(
  forceRefresh = false,
): Promise<NewsFeedEmoji[]> {
  if (!forceRefresh && emojiCache) {
    return emojiCache;
  }

  if (!forceRefresh && emojiRequest) {
    return emojiRequest;
  }

  emojiRequest = (async () => {
    try {
      const res = await apiClient.get<EmojiResponseShape>("/mobile/api/emojis");
      const data = res.data;
      const emojis = Array.isArray(data) ? data : (data?.results ?? []);
   
      emojiCache = emojis;
      return emojis;
    } catch (error) {
      captureException(error, {
        scope: "news_feed_service",
        action: "get_emojis",
        extras: { forceRefresh },
      });
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        throw new Error(
          status ? `Request failed with status ${status}` : "Request failed",
        );
      }
      throw error;
    } finally {
      emojiRequest = null;
    }
  })();

  return emojiRequest;
}

export function clearNewsFeedCache(): void {
  emojiCache = null;
  emojiRequest = null;
}

export async function createReaction(
  payload: ReactPostRequest,
): Promise<ReactionResponse> {
  try {
    const res = await apiClient.post<ReactionResponse>(
      "/mobile/api/reaction",
      payload,
    );
    return res.data;
  } catch (error) {
    captureException(error, {
      scope: "news_feed_service",
      action: "create_reaction",
      extras: { post_id: payload.post_id, emoji_id: payload.emoji_id },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export async function updateReaction(
  payload: ReactPostRequest,
): Promise<ReactionResponse> {
  try {
    const res = await apiClient.put<ReactionResponse>(
      "/mobile/api/reaction",
      payload,
    );
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404 || status === 405) {
        return createReaction(payload);
      }
    }
    captureException(error, {
      scope: "news_feed_service",
      action: "update_reaction",
      extras: { post_id: payload.post_id, emoji_id: payload.emoji_id },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export async function deleteReaction(
  payload: RemoveReactionRequest,
): Promise<ReactionResponse> {
  try {
    const res = await apiClient.delete<ReactionResponse>("/mobile/api/reaction", {
      data: payload,
    });
    return res.data;
  } catch (error) {
    captureException(error, {
      scope: "news_feed_service",
      action: "delete_reaction",
      extras: { post_id: payload.post_id },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export default {
  getNewsFeed,
  getEmojis,
  clearNewsFeedCache,
  createReaction,
  updateReaction,
  deleteReaction,
};
