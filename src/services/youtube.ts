// YouTube API service for making requests to YouTube Data API v3

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
}

export interface YouTubeComment {
  commentId: string;
  authorName: string;
  authorChannelId?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  replyCount?: number;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  totalResults: number;
  nextPageToken?: string;
}

export interface YouTubeCommentsResult {
  comments: YouTubeComment[];
  totalResults: number;
  nextPageToken?: string;
  videoTitle?: string;
}

export interface YouTubeChannelVideosResult {
  videos: YouTubeVideo[];
  channelTitle: string;
  nextPageToken?: string;
}

function getApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY environment variable is not set. " +
      "Get a free API key from Google Cloud Console: " +
      "https://console.cloud.google.com/apis/credentials"
    );
  }
  return apiKey;
}

async function fetchYouTube<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 403) {
      throw new Error(
        `YouTube API quota exceeded or access denied. ` +
        `Check your API key and quota at https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas`
      );
    }
    if (response.status === 400) {
      throw new Error(`Invalid request: ${errorBody}`);
    }
    throw new Error(`YouTube API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

export async function searchVideos(
  query: string,
  maxResults: number = 10,
  pageToken?: string
): Promise<YouTubeSearchResult> {
  interface SearchResponse {
    items: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: { medium?: { url: string } };
      };
    }>;
    pageInfo: { totalResults: number };
    nextPageToken?: string;
  }

  const params: Record<string, string> = {
    part: "snippet",
    type: "video",
    q: query,
    maxResults: maxResults.toString(),
    order: "relevance"
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const data = await fetchYouTube<SearchResponse>("search", params);

  const videos: YouTubeVideo[] = data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails.medium?.url || ""
  }));

  return {
    videos,
    totalResults: data.pageInfo.totalResults,
    nextPageToken: data.nextPageToken
  };
}

export async function getVideoComments(
  videoId: string,
  maxResults: number = 50,
  pageToken?: string
): Promise<YouTubeCommentsResult> {
  interface CommentsResponse {
    items: Array<{
      id: string;
      snippet: {
        topLevelComment: {
          id: string;
          snippet: {
            authorDisplayName: string;
            authorChannelId?: { value: string };
            textDisplay: string;
            likeCount: number;
            publishedAt: string;
          };
        };
        totalReplyCount: number;
      };
    }>;
    pageInfo: { totalResults: number };
    nextPageToken?: string;
  }

  const params: Record<string, string> = {
    part: "snippet",
    videoId: videoId,
    maxResults: maxResults.toString(),
    order: "relevance",
    textFormat: "plainText"
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const data = await fetchYouTube<CommentsResponse>("commentThreads", params);

  const comments: YouTubeComment[] = data.items.map(item => ({
    commentId: item.snippet.topLevelComment.id,
    authorName: item.snippet.topLevelComment.snippet.authorDisplayName,
    authorChannelId: item.snippet.topLevelComment.snippet.authorChannelId?.value,
    text: item.snippet.topLevelComment.snippet.textDisplay,
    likeCount: item.snippet.topLevelComment.snippet.likeCount,
    publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
    replyCount: item.snippet.totalReplyCount
  }));

  return {
    comments,
    totalResults: data.pageInfo.totalResults,
    nextPageToken: data.nextPageToken
  };
}

export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10,
  pageToken?: string
): Promise<YouTubeChannelVideosResult> {
  interface ChannelResponse {
    items: Array<{
      snippet: { title: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  }

  const channelData = await fetchYouTube<ChannelResponse>("channels", {
    part: "contentDetails,snippet",
    id: channelId
  });

  if (!channelData.items || channelData.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
  const channelTitle = channelData.items[0].snippet.title;

  interface PlaylistResponse {
    items: Array<{
      snippet: {
        resourceId: { videoId: string };
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: { medium?: { url: string } };
      };
    }>;
    nextPageToken?: string;
  }

  const params: Record<string, string> = {
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: maxResults.toString()
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const playlistData = await fetchYouTube<PlaylistResponse>("playlistItems", params);

  const videos: YouTubeVideo[] = playlistData.items.map(item => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails.medium?.url || ""
  }));

  return {
    videos,
    channelTitle,
    nextPageToken: playlistData.nextPageToken
  };
}

export async function searchChannels(
  query: string,
  maxResults: number = 5
): Promise<Array<{ channelId: string; title: string; description: string }>> {
  interface ChannelSearchResponse {
    items: Array<{
      id: { channelId: string };
      snippet: {
        title: string;
        description: string;
      };
    }>;
  }

  const data = await fetchYouTube<ChannelSearchResponse>("search", {
    part: "snippet",
    type: "channel",
    q: query,
    maxResults: maxResults.toString()
  });

  return data.items.map(item => ({
    channelId: item.id.channelId,
    title: item.snippet.title,
    description: item.snippet.description
  }));
}
