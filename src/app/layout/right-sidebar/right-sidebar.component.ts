import { Component, OnDestroy, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FollowResponse, FollowService } from '../../core/services/follow.service';
import { SearchService, HashtagResponse, SearchUser } from '../../core/services/search.service';
import { catchError, map, of, switchMap } from 'rxjs';

interface SuggestedUserView {
  userId: number;
  followed: boolean;
  loadingProfile: boolean;
  username: string;
  displayName: string;
  hasMutualConnection: boolean;
}

interface FallbackSuggestionUser extends SearchUser {
  followed: boolean;
}

@Component({
  selector: 'app-right-sidebar',
  imports: [RouterLink],
  templateUrl: './right-sidebar.component.html',
  styleUrls: ['./right-sidebar.component.css']
})
export class RightSidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private followService = inject(FollowService);
  private searchService = inject(SearchService);

  suggestions: SuggestedUserView[] = [];
  trendingHashtags: HashtagResponse[] = [];
  loading = true;
  loadingTrending = true;
  private mutualFollowIds = new Set<number>();
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.refreshSidebarData(user?.userId ?? null);

    if (!user) {
      this.loading = false;
      return;
    }

    this.refreshIntervalId = setInterval(() => {
      this.refreshSidebarData(user.userId);
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  private loadSuggestions(userId: number): void {
    this.followService.getSuggestions(userId).pipe(
      catchError(() => of<number[]>([])),
      switchMap((userIds) => {
        const uniqueIds = [...new Set((userIds || []).filter((id) => Number(id) && Number(id) !== userId))]
          .map((id) => Number(id))
          .slice(0, 5);

        if (uniqueIds.length > 0) {
          return of({
            suggestionIds: uniqueIds,
            fallbackUsers: [] as FallbackSuggestionUser[]
          });
        }

        return this.loadFallbackSuggestions(userId).pipe(
          map((users) => ({
            suggestionIds: users.map((user) => user.userId),
            fallbackUsers: users
          }))
        );
      })
    ).subscribe({
      next: ({ suggestionIds, fallbackUsers }) => {
        if (fallbackUsers.length > 0) {
          this.suggestions = fallbackUsers.map((user) => ({
            userId: user.userId,
            followed: user.followed,
            loadingProfile: false,
            username: user.username || `user${user.userId}`,
            displayName: user.fullName?.trim() || user.username || `User ${user.userId}`,
            hasMutualConnection: false
          }));
        } else {
          this.suggestions = suggestionIds.map((id) => ({
            userId: id,
            followed: false,
            loadingProfile: true,
            username: `user${id}`,
            displayName: `User ${id}`,
            hasMutualConnection: false
          }));
          this.suggestions.forEach((suggestion) => this.loadSuggestionProfile(suggestion));
        }

        this.applyMutualFlags();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private loadFallbackSuggestions(userId: number) {
    return this.followService.getFollowing(userId).pipe(
      catchError(() => of<FollowResponse[]>([])),
      switchMap((following) => {
        const alreadyFollowing = new Set(
          (following || []).map((relation) => Number(relation.followeeId))
        );

        return this.searchService.searchUsers('').pipe(
          map((users) => {
            const candidates = (users || [])
              .filter((user) => user.userId !== userId);

            const notFollowedUsers = candidates
              .filter((user) => !alreadyFollowing.has(Number(user.userId)));

            const prioritized = (notFollowedUsers.length > 0 ? notFollowedUsers : candidates)
              .slice(0, 5);

            return prioritized.map((user) => ({
              ...user,
              followed: alreadyFollowing.has(Number(user.userId))
            })) as FallbackSuggestionUser[];
          }),
          catchError(() => of<FallbackSuggestionUser[]>([]))
        );
      })
    );
  }

  private loadMutualConnections(userId: number): void {
    this.followService.getMutualFollows(userId).subscribe({
      next: (mutualIds) => {
        this.mutualFollowIds = new Set((mutualIds || []).map((id) => Number(id)));
        this.applyMutualFlags();
      }
    });
  }

  private loadSuggestionProfile(suggestion: SuggestedUserView): void {
    this.authService.getUserById(suggestion.userId).subscribe({
      next: (user) => {
        suggestion.username = user.username || suggestion.username;
        suggestion.displayName = user.fullName?.trim() || user.username || suggestion.displayName;
        suggestion.loadingProfile = false;
      },
      error: () => {
        suggestion.loadingProfile = false;
      }
    });
  }

  private applyMutualFlags(): void {
    this.suggestions = this.suggestions.map((suggestion) => ({
      ...suggestion,
      hasMutualConnection: this.mutualFollowIds.has(suggestion.userId)
    }));
  }

  private loadTrendingHashtags(): void {
    this.loadingTrending = true;
    this.searchService.getTrendingHashtags().subscribe({
      next: (hashtags) => {
        this.trendingHashtags = (hashtags || []).slice(0, 8);
        this.loadingTrending = false;
      },
      error: () => {
        this.trendingHashtags = [];
        this.loadingTrending = false;
      }
    });
  }

  private refreshSidebarData(userId: number | null): void {
    this.loadTrendingHashtags();
    if (!userId) {
      return;
    }
    this.loadSuggestions(userId);
    this.loadMutualConnections(userId);
  }

  followUser(suggestion: SuggestedUserView): void {
    if (suggestion.followed) {
      return;
    }
    suggestion.followed = true;
    this.followService.followUser(suggestion.userId).subscribe({
      error: () => {
        suggestion.followed = false;
      }
    });
  }
}
