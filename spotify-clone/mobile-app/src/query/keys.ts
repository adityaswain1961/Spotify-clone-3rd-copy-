export const queryKeys = {
  home: ['home'] as const,
  search: (q: string) => ['search', q] as const,
  myPlaylists: ['playlists', 'me'] as const,
  playlist: (id: string) => ['playlist', id] as const,
  likedSongs: ['likes', 'songs'] as const,
  likedIds: ['likes', 'ids'] as const,
};

export const mutationKeys = {
  like: ['like'] as const,
};
