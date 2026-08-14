import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  GestureResponderEvent,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useScreenView } from "@/src/analytics/useScreenView";
import { isSessionExpiredError } from "@/src/auth/auth-session";
import { captureException } from "@/src/monitoring/sentry";
import {
  createReaction,
  deleteReaction,
  getEmojis,
  getNewsFeed,
  type NewsFeedAttachment,
  type NewsFeedEmoji,
  type NewsFeedPost,
  type NewsFeedPreview,
  updateReaction,
} from "@/src/services/newsFeedService";
import { useVideoPlayer, VideoView } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";

const PAGE_SIZE = 10;
const CAPTION_PREVIEW_LINES = 3;
const videoThumbnailCache = new Map<string, string>();

function getEmojiId(emoji: NewsFeedEmoji): string {
  return emoji.emoji_id || emoji.id || "";
}

function getEmojiChar(emoji: NewsFeedEmoji): string {
  return (
    emoji.emoji_content ||
    emoji.emoji ||
    emoji.unicode_character ||
    emoji.unicode ||
    emoji.character ||
    emoji.emoji_title ||
    emoji.name ||
    "?"
  );
}

function formatDate(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPreviewCount(preview: NewsFeedPreview[] | undefined, emojiId: string): number {
  if (!preview?.length || !emojiId) return 0;
  const item = preview.find((reaction) => reaction.emoji_id === emojiId);
  return item?.count ?? 0;
}

function getAttachmentUrl(attachment: NewsFeedAttachment): string {
  return attachment.processed_url || attachment.attachment_url || "";
}

function getVideoPreviewUrl(attachment: NewsFeedAttachment): string {
  const withPreview = attachment as NewsFeedAttachment & {
    video_thumbnail_url?: string | null;
    thumbnail_url?: string | null;
    preview_image_url?: string | null;
    preview_url?: string | null;
  };
  return (
    withPreview.video_thumbnail_url ||
    withPreview.thumbnail_url ||
    withPreview.preview_image_url ||
    withPreview.preview_url ||
    ""
  );
}

function isImageAttachment(attachment: NewsFeedAttachment): boolean {
  return (attachment.attachment_type || "").toLowerCase().includes("image");
}

function isVideoAttachment(attachment: NewsFeedAttachment): boolean {
  return (attachment.attachment_type || "").toLowerCase().includes("video");
}

function isMediaAttachment(attachment: NewsFeedAttachment): boolean {
  return isImageAttachment(attachment) || isVideoAttachment(attachment);
}

function updateReactionPreview(
  preview: NewsFeedPreview[] | undefined,
  postId: string,
  currentEmojiId: string | null | undefined,
  nextEmojiId: string | null,
): NewsFeedPreview[] {
  const byEmoji = new Map<string, NewsFeedPreview>();
  (preview ?? []).forEach((entry) => {
    if (!entry.emoji_id) return;
    byEmoji.set(entry.emoji_id, {
      ...entry,
      post_id: entry.post_id || postId,
      count: entry.count ?? 0,
    });
  });

  if (currentEmojiId) {
    const current = byEmoji.get(currentEmojiId);
    if (current) {
      const nextCount = Math.max(0, (current.count ?? 0) - 1);
      if (nextCount === 0) {
        byEmoji.delete(currentEmojiId);
      } else {
        byEmoji.set(currentEmojiId, { ...current, count: nextCount });
      }
    }
  }

  if (nextEmojiId) {
    const existing = byEmoji.get(nextEmojiId);
    if (existing) {
      byEmoji.set(nextEmojiId, { ...existing, count: (existing.count ?? 0) + 1 });
    } else {
      byEmoji.set(nextEmojiId, { post_id: postId, emoji_id: nextEmojiId, count: 1 });
    }
  }

  return Array.from(byEmoji.values());
}

function applyReactionLocally(
  post: NewsFeedPost,
  nextEmojiId: string | null,
): NewsFeedPost {
  const postId = post.post_id;
  if (!postId) return post;
  return {
    ...post,
    has_reacted: Boolean(nextEmojiId),
    reacted_emoji_id: nextEmojiId,
    preview: updateReactionPreview(post.preview, postId, post.reacted_emoji_id, nextEmojiId),
  };
}

function AttachmentPreview({
  attachment,
  className,
  onPress,
  hiddenAttachmentCount = 0,
  allowInlineVideoPlayback = true,
  isScreenFocused = true,
}: {
  attachment: NewsFeedAttachment;
  className: string;
  onPress?: () => void;
  hiddenAttachmentCount?: number;
  allowInlineVideoPlayback?: boolean;
  isScreenFocused?: boolean;
}) {
  const isImage = isImageAttachment(attachment);
  const isVideo = isVideoAttachment(attachment);
  const imageUri = getAttachmentUrl(attachment);
  const videoPreviewUri = getVideoPreviewUrl(attachment);
  const [generatedVideoPreviewUri, setGeneratedVideoPreviewUri] = useState<string | null>(null);
  const [isInlineVideoPlaying, setIsInlineVideoPlaying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!isVideo || videoPreviewUri) {
      setGeneratedVideoPreviewUri(null);
      return () => {
        isMounted = false;
      };
    }

    const videoUri = imageUri;
    if (!videoUri) {
      setGeneratedVideoPreviewUri(null);
      return () => {
        isMounted = false;
      };
    }

    const cachedUri = videoThumbnailCache.get(videoUri);
    if (cachedUri) {
      setGeneratedVideoPreviewUri(cachedUri);
      return () => {
        isMounted = false;
      };
    }

    (async () => {
      try {
        const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 1000,
        });
        if (!thumbnail?.uri) return;
        videoThumbnailCache.set(videoUri, thumbnail.uri);
        if (isMounted) {
          setGeneratedVideoPreviewUri(thumbnail.uri);
        }
      } catch (e) {
        captureException(e, {
          scope: "news_feed_screen",
          action: "generate_video_thumbnail",
          extras: { videoUri },
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [imageUri, isVideo, videoPreviewUri]);

  const previewSource = isImage ? imageUri : videoPreviewUri || generatedVideoPreviewUri || "";
  const hasPreviewImage = Boolean(previewSource);
  const showHiddenCount = hiddenAttachmentCount > 0;
  const videoUri = isVideo ? imageUri : "";
  const canPlayInlineVideo = Boolean(isVideo && videoUri && allowInlineVideoPlayback);

  useEffect(() => {
    if (!isScreenFocused) {
      setIsInlineVideoPlaying(false);
    }
  }, [isScreenFocused]);

  const handlePlayPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canPlayInlineVideo) {
      onPress?.();
      return;
    }
    setIsInlineVideoPlaying(true);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`relative overflow-hidden rounded-xl bg-primary/5 ${className}`}
    >
      {isInlineVideoPlaying && canPlayInlineVideo ? (
        <InlineVideoPlayer videoUri={videoUri} />
      ) : hasPreviewImage ? (
        <Image source={{ uri: previewSource }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center border border-primary/10">
          <Text className="font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
            {isVideo ? "Video" : attachment.attachment_type || "attachment"}
          </Text>
        </View>
      )}

      {isVideo && !isInlineVideoPlaying ? (
        <>
          <View className="absolute inset-0 bg-black/35" />
          <View className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1">
            <Text className="font-sans text-[10px] font-bold text-white">VIDEO</Text>
          </View>
          <Pressable
            onPress={handlePlayPress}
            className="absolute inset-0 items-center justify-center"
          >
            <View className="h-15 w-15 items-center justify-center rounded-full bg-black/30">
              <Ionicons name="play-circle" size={53} color="#ffffff67" />
            </View>
          </Pressable>
        </>
      ) : null}

      {showHiddenCount ? (
        <View className="absolute inset-0 items-center justify-center bg-black/45">
          <Text className="font-sans text-lg font-bold text-white">+{hiddenAttachmentCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function InlineVideoPlayer({ videoUri }: { videoUri: string }) {
  const player = useVideoPlayer({ uri: videoUri }, (currentPlayer) => {
    currentPlayer.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      nativeControls
    />
  );
}

function FullScreenVideoPlayer({
  videoUri,
  shouldPlay,
}: {
  videoUri: string;
  shouldPlay: boolean;
}) {
  const player = useVideoPlayer({ uri: videoUri }, (currentPlayer) => {
    if (shouldPlay) {
      currentPlayer.play();
    } else {
      currentPlayer.pause();
    }
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
      return;
    }
    player.pause();
  }, [player, shouldPlay]);

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls
    />
  );
}

function PostCard({
  item,
  emojis,
  isReacting,
  onPressReaction,
  onPressOpenDetails,
  isScreenFocused,
}: {
  item: NewsFeedPost;
  emojis: NewsFeedEmoji[];
  isReacting: boolean;
  onPressReaction: (item: NewsFeedPost, emojiId: string) => void;
  onPressOpenDetails: (item: NewsFeedPost) => void;
  isScreenFocused: boolean;
}) {
  const previewAttachments = item.attachments ?? [];
  const primaryAttachment = previewAttachments[0];
  const shouldPrimaryAttachmentOpenDetails =
    !primaryAttachment || !isVideoAttachment(primaryAttachment);
  const secondaryAttachments = previewAttachments.slice(1, 3);
  const hiddenAttachmentCount = Math.max(0, previewAttachments.length - 3);

  return (
    <View className="mb-3 rounded-2xl border border-primary/10 bg-white p-4 dark:bg-surface-dark">
      <Pressable onPress={() => onPressOpenDetails(item)}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-sans text-base font-bold text-neutral-dark dark:text-[#F6EDE8]">
              {item.employee_profile?.full_name || "Unknown employee"}
            </Text>
            <Text className="mt-0.5 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
              {item.employee_profile?.job_title || "No title"}
            </Text>
          </View>
          <Text className="font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
            {formatDate(item.created_at)}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={() => onPressOpenDetails(item)}>
        <Text
          className="mt-3 font-sans text-base text-neutral-dark dark:text-[#F6EDE8]"
          numberOfLines={CAPTION_PREVIEW_LINES}
          ellipsizeMode="tail"
        >
          {item.post_content || ""}
        </Text>
      </Pressable>

      {previewAttachments.length ? (
        <View className="mt-3 gap-2">
          {previewAttachments.length === 1
            ? previewAttachments.map((attachment, index) => {
              const key = `${item.post_id || "post"}-attachment-preview-${index}`;
              if (isImageAttachment(attachment) || isVideoAttachment(attachment)) {
                return (
                  <AttachmentPreview
                    key={key}
                    attachment={attachment}
                    className="h-56 w-full"
                    onPress={shouldPrimaryAttachmentOpenDetails ? () => onPressOpenDetails(item) : undefined}
                    allowInlineVideoPlayback
                    isScreenFocused={isScreenFocused}
                  />
                );
              }

              return (
                <View key={key} className="h-56 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 px-3 py-2">
                  <Text className="font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                    {attachment.attachment_type || "attachment"}
                  </Text>
                </View>
              );
            })
            : (
                <View className="gap-2">
                  {isImageAttachment(previewAttachments[0]) || isVideoAttachment(previewAttachments[0]) ? (
                    <AttachmentPreview
                      attachment={previewAttachments[0]}
                      className="h-56 w-full"
                      onPress={shouldPrimaryAttachmentOpenDetails ? () => onPressOpenDetails(item) : undefined}
                      allowInlineVideoPlayback
                      isScreenFocused={isScreenFocused}
                    />
                  ) : (
                    <View className="h-56 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 px-3 py-2">
                      <Text className="text-center font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                      {previewAttachments[0]?.attachment_type || "attachment"}
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between">
                  {secondaryAttachments.map((attachment, index) => {
                    const key = `${item.post_id || "post"}-attachment-collage-secondary-${index}`;
                    const isLastVisibleSecondary =
                      index === secondaryAttachments.length - 1;
                    const showMoreOverlay =
                      hiddenAttachmentCount > 0 && isLastVisibleSecondary;
                    return (
                      <View key={key} style={{ width: "49%" }}>
                        {isImageAttachment(attachment) || isVideoAttachment(attachment) ? (
                          <AttachmentPreview
                            attachment={attachment}
                            className="h-28 w-full"
                            onPress={() => onPressOpenDetails(item)}
                            hiddenAttachmentCount={showMoreOverlay ? hiddenAttachmentCount : 0}
                            allowInlineVideoPlayback={false}
                            isScreenFocused={isScreenFocused}
                          />
                        ) : (
                          <View className="h-28 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 px-3 py-2">
                            <Text className="text-center font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                              {attachment.attachment_type || "attachment"}
                            </Text>
                            {showMoreOverlay ? (
                              <Text className="mt-1 font-sans text-xs font-bold text-primary">
                                +{hiddenAttachmentCount} more
                              </Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
        </View>
      ) : null}

      <View className="mt-3 flex-row flex-wrap gap-2">
        {emojis.map((emoji) => {
          const emojiId = getEmojiId(emoji);
          const count = getPreviewCount(item.preview, emojiId);
          const isSelected = item.reacted_emoji_id === emojiId;
          return (
            <Pressable
              key={`${item.post_id || "post"}-${emojiId || getEmojiChar(emoji)}`}
              onPress={() => {
                if (!emojiId || isReacting) return;
                onPressReaction(item, emojiId);
              }}
              disabled={!emojiId || isReacting}
              className={`rounded-full border px-2.5 py-1 ${
                isSelected ? "border-primary bg-primary/10" : "border-primary/15"
              } ${isReacting ? "opacity-60" : ""}`}
            >
              <Text className="font-sans text-xs text-neutral-dark dark:text-[#F6EDE8]">
                {count > 0 ? `${getEmojiChar(emoji)} ${count}` : getEmojiChar(emoji)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NewsFeedScreen() {
  useScreenView("news_feed");
  const isScreenFocused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const [posts, setPosts] = useState<NewsFeedPost[]>([]);
  const [emojis, setEmojis] = useState<NewsFeedEmoji[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reactingByPost, setReactingByPost] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<NewsFeedPost | null>(null);
  const [fullScreenMediaIndex, setFullScreenMediaIndex] = useState<number | null>(null);
  const [activeFullScreenMediaIndex, setActiveFullScreenMediaIndex] = useState(0);

  const selectedPostMediaAttachments = (selectedPost?.attachments ?? []).filter((attachment) => {
    if (!isMediaAttachment(attachment)) return false;
    return Boolean(getAttachmentUrl(attachment));
  });

  const openPostDetails = (post: NewsFeedPost) => {
    setSelectedPost(post);
  };

  const closePostDetails = () => {
    setSelectedPost(null);
    setFullScreenMediaIndex(null);
    setActiveFullScreenMediaIndex(0);
  };

  const openAttachmentFullScreen = (mediaIndex: number) => {
    if (mediaIndex < 0 || mediaIndex >= selectedPostMediaAttachments.length) return;
    setFullScreenMediaIndex(mediaIndex);
    setActiveFullScreenMediaIndex(mediaIndex);
  };

  const closeAttachmentFullScreen = () => {
    setFullScreenMediaIndex(null);
    setActiveFullScreenMediaIndex(0);
  };

  const handleFullScreenScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!screenWidth) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setActiveFullScreenMediaIndex(nextIndex);
  };

  const loadFirstPage = useCallback(async () => {
    return Promise.all([
      getEmojis(),
      getNewsFeed(1, PAGE_SIZE),
    ]);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [emojiList, feed] = await loadFirstPage();
        if (!mounted) return;
        setEmojis(emojiList);
        setPosts(feed.results ?? []);
        setHasNext(Boolean(feed.next));
        setPage(1);
      } catch (e) {
        captureException(e, {
          scope: "news_feed_screen",
          action: "initial_load",
        });
        if (!mounted) return;
        if (isSessionExpiredError(e)) return;
        setError(e instanceof Error ? e.message : "Failed to load newsfeed.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [loadFirstPage]);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const [emojiList, feed] = await loadFirstPage();
      setEmojis(emojiList);
      setPosts(feed.results ?? []);
      setHasNext(Boolean(feed.next));
      setPage(1);
    } catch (e) {
      captureException(e, {
        scope: "news_feed_screen",
        action: "refresh",
      });
      if (isSessionExpiredError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to refresh newsfeed.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (isLoadingMore || isLoading || !hasNext) return;

    const nextPage = page + 1;
    setIsLoadingMore(true);

    try {
      const feed = await getNewsFeed(nextPage, PAGE_SIZE);
      setPosts((prev) => [...prev, ...(feed.results ?? [])]);
      setHasNext(Boolean(feed.next));
      setPage(nextPage);
    } catch (e) {
      captureException(e, {
        scope: "news_feed_screen",
        action: "load_more",
        extras: { nextPage },
      });
      if (isSessionExpiredError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to load more news.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const setPostReacting = (postId: string, isReacting: boolean) => {
    setReactingByPost((prev) => {
      if (isReacting) return { ...prev, [postId]: true };
      const { [postId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handlePressReaction = async (post: NewsFeedPost, emojiId: string) => {
    const postId = post.post_id;
    if (!postId || !emojiId || reactingByPost[postId]) return;

    const previousPost = post;
    const currentEmojiId = post.reacted_emoji_id ?? null;
    const nextEmojiId = currentEmojiId === emojiId ? null : emojiId;

    setError(null);
    setPostReacting(postId, true);
    setPosts((prev) =>
      prev.map((item) =>
        item.post_id === postId ? applyReactionLocally(item, nextEmojiId) : item,
      ),
    );

    try {
      if (!nextEmojiId) {
        await deleteReaction({ post_id: postId });
      } else if (currentEmojiId) {
        await updateReaction({ post_id: postId, emoji_id: nextEmojiId });
      } else {
        await createReaction({ post_id: postId, emoji_id: nextEmojiId });
      }
    } catch (e) {
      captureException(e, {
        scope: "news_feed_screen",
        action: "react_to_post",
        extras: { postId, currentEmojiId, nextEmojiId },
      });
      setPosts((prev) =>
        prev.map((item) => (item.post_id === postId ? previousPost : item)),
      );
      if (isSessionExpiredError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to react to post.");
    } finally {
      setPostReacting(postId, false);
    }
  };

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <FlatList
        data={posts}
        keyExtractor={(item, index) => item.post_id || `post-${index}`}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            emojis={emojis}
            isReacting={Boolean(item.post_id && reactingByPost[item.post_id])}
            onPressReaction={handlePressReaction}
            onPressOpenDetails={openPostDetails}
            isScreenFocused={isScreenFocused}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#ff5d38" />
        }
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="font-serif text-4xl text-neutral-dark dark:text-[#F6EDE8]">
              Newsfeed
            </Text>
            <Text className="mt-1 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">
              Latest posts from your organization
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="rounded-2xl border border-primary/10 bg-white p-4 dark:bg-surface-dark">
              <ActivityIndicator color="#ff5d38" />
              <Text className="mt-2 font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">Loading newsfeed...</Text>
            </View>
          ) : error ? (
            <View className="rounded-2xl border border-red-200 bg-white p-4 dark:bg-surface-dark">
              <Text className="font-sans text-sm text-red-600">{error}</Text>
            </View>
          ) : (
            <View className="rounded-2xl border border-primary/10 bg-white p-4 dark:bg-surface-dark">
              <Text className="font-sans text-sm text-neutral-soft dark:text-neutral-soft-dark">No news available.</Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View className="py-2">
              <Text className="font-sans text-center text-sm text-neutral-soft dark:text-neutral-soft-dark">Loading more...</Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={Boolean(selectedPost)}
        animationType="slide"
        transparent
        onRequestClose={closePostDetails}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-4 py-8">
          <View
            className="w-full rounded-2xl border border-primary/10 bg-white p-4 dark:bg-surface-dark"
            style={{ maxHeight: "88%" }}
          >
            {selectedPost ? (
              <>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-sans text-sm font-bold text-neutral-dark dark:text-[#F6EDE8]">
                        {selectedPost.employee_profile?.full_name || "Unknown employee"}
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                        {selectedPost.employee_profile?.job_title || "No title"}
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                        {formatDate(selectedPost.created_at)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={closePostDetails}
                      hitSlop={8}
                      className="h-9 w-9 items-center justify-center rounded-full bg-primary/5"
                    >
                      <Ionicons name="close" size={22} color="#ff5d38" />
                    </Pressable>
                  </View>

                  <Text className="mt-4 font-sans text-base leading-6 text-neutral-dark dark:text-[#F6EDE8]">
                    {selectedPost.post_content || ""}
                  </Text>

                  {selectedPost.attachments?.length ? (
                    <View className="mt-4 gap-2">
                      {selectedPost.attachments.map((attachment, index) => {
                        const key = `${selectedPost.post_id || "post"}-attachment-detail-${index}`;
                        const mediaIndex = selectedPostMediaAttachments.findIndex(
                          (mediaAttachment) => mediaAttachment === attachment,
                        );
                        if (isImageAttachment(attachment)) {
                          return (
                            <Pressable key={key} onPress={() => openAttachmentFullScreen(mediaIndex)}>
                              <AttachmentPreview attachment={attachment} className="h-56 w-full" />
                            </Pressable>
                          );
                        }

                        if (isVideoAttachment(attachment)) {
                          return (
                            <AttachmentPreview
                              key={key}
                              attachment={attachment}
                              className="h-56 w-full"
                              isScreenFocused={isScreenFocused}
                            />
                          );
                        }

                        return (
                          <View
                            key={key}
                            className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2"
                          >
                            <Text className="font-sans text-xs text-neutral-soft dark:text-neutral-soft-dark">
                              {attachment.attachment_type || "attachment"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </ScrollView>

                {fullScreenMediaIndex !== null && selectedPostMediaAttachments.length > 0 ? (
                  <View className="absolute inset-0 z-50 bg-black">
                    <View className="flex-row items-center justify-between px-4 pt-12">
                      <Text className="font-sans text-sm text-white">
                        {activeFullScreenMediaIndex + 1} / {selectedPostMediaAttachments.length}
                      </Text>
                      <Pressable
                        onPress={closeAttachmentFullScreen}
                        hitSlop={8}
                        className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
                      >
                        <Ionicons name="close" size={22} color="#FFFFFF" />
                      </Pressable>
                    </View>
                    <FlatList
                      data={selectedPostMediaAttachments}
                      horizontal
                      pagingEnabled
                      decelerationRate="fast"
                      disableIntervalMomentum
                      snapToInterval={screenWidth}
                      snapToAlignment="start"
                      showsHorizontalScrollIndicator={false}
                      initialScrollIndex={fullScreenMediaIndex}
                      key={`fullscreen-media-${selectedPost.post_id || "post"}-${fullScreenMediaIndex}`}
                      keyExtractor={(_, index) => `${selectedPost.post_id || "post"}-fullscreen-media-${index}`}
                      getItemLayout={(_, index) => ({
                        length: screenWidth,
                        offset: screenWidth * index,
                        index,
                      })}
                      onMomentumScrollEnd={handleFullScreenScrollEnd}
                      renderItem={({ item, index }) => (
                        <View
                          style={{ width: screenWidth }}
                          className="flex-1 items-center justify-center pb-8"
                        >
                          {isImageAttachment(item) ? (
                            <Image
                              source={{ uri: getAttachmentUrl(item) }}
                              className="h-full w-full"
                              resizeMode="contain"
                            />
                          ) : (
                            <FullScreenVideoPlayer
                              videoUri={getAttachmentUrl(item)}
                              shouldPlay={index === activeFullScreenMediaIndex}
                            />
                          )}
                        </View>
                      )}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
