import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { SearchService, HashtagResponse, SearchUser } from '../../core/services/search.service';
import { Post } from '../../core/services/post.service';

type SearchMode = 'users' | 'posts' | 'hashtags';

interface SearchTask {
  mode: SearchMode;
  query: string;
}

interface SearchPayload {
  mode: SearchMode;
  users: SearchUser[];
  posts: Post[];
  hashtags: HashtagResponse[];
}

@Component({
  selector: 'app-search',
  imports: [RouterLink, DatePipe],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnDestroy {
  private readonly searchService = inject(SearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  mode: SearchMode = 'users';
  query = '';

  userResults: SearchUser[] = [];
  postResults: Post[] = [];
  hashtagResults: HashtagResponse[] = [];
  postHashtagsMap: Record<number, HashtagResponse[]> = {};

  trendingHashtags: HashtagResponse[] = [];
  activeHashtagTag: string | null = null;

  loading = false;
  loadingTrending = false;
  hasSearched = false;

  private readonly searchSubject = new Subject<SearchTask>();
  private searchSubscription?: Subscription;

  ngOnInit(): void {
    this.loadTrendingHashtags();
    this.hydrateFromQueryParams();

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.mode === b.mode && a.query === b.query),
      switchMap(({ mode, query }) => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
          return of<SearchPayload>({
            mode,
            users: [],
            posts: [],
            hashtags: []
          });
        }

        this.loading = true;
        this.hasSearched = true;

        if (mode === 'users') {
          return this.searchService.searchUsers(trimmedQuery).pipe(
            map((users): SearchPayload => ({
              mode,
              users,
              posts: [],
              hashtags: []
            })),
            catchError(() => of<SearchPayload>({
              mode,
              users: [],
              posts: [],
              hashtags: []
            }))
          );
        }

        if (mode === 'posts') {
          return this.searchService.searchPosts(trimmedQuery).pipe(
            map((posts): SearchPayload => ({
              mode,
              users: [],
              posts,
              hashtags: []
            })),
            catchError(() => of<SearchPayload>({
              mode,
              users: [],
              posts: [],
              hashtags: []
            }))
          );
        }

        return this.searchService.searchHashtags(trimmedQuery).pipe(
          map((hashtags): SearchPayload => ({
            mode,
            users: [],
            posts: [],
            hashtags
          })),
          catchError(() => of<SearchPayload>({
            mode,
            users: [],
            posts: [],
            hashtags: []
          }))
        );
      })
    ).subscribe((payload) => {
      this.loading = false;
      this.userResults = payload.users;
      this.postResults = payload.posts;
      this.hashtagResults = payload.hashtags;

      if (!this.query.trim()) {
        this.hasSearched = false;
      }

      if (payload.mode === 'posts') {
        this.hydrateHashtagsForPosts(payload.posts);
      } else {
        this.postHashtagsMap = {};
      }
    });

    if (this.query.trim()) {
      this.triggerSearch();
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  get searchPlaceholder(): string {
    if (this.mode === 'users') {
      return 'Search by name or username...';
    }

    if (this.mode === 'posts') {
      return 'Search post content...';
    }

    return 'Search hashtags...';
  }

  setSearchMode(mode: SearchMode): void {
    if (this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.activeHashtagTag = null;

    if (!this.query.trim()) {
      this.hasSearched = false;
      this.userResults = [];
      this.postResults = [];
      this.hashtagResults = [];
      this.postHashtagsMap = {};
      return;
    }

    this.triggerSearch();
  }

  onSearch(event: Event): void {
    const nextQuery = (event.target as HTMLInputElement).value;
    this.query = nextQuery;
    this.activeHashtagTag = null;

    if (this.shouldUseHashtagMode(nextQuery) && this.mode !== 'hashtags') {
      this.mode = 'hashtags';
    }

    this.triggerSearch();
  }

  viewHashtagPosts(tag: string): void {
    const normalizedTag = this.normalizeTag(tag);
    if (!normalizedTag) {
      return;
    }
    this.router.navigate(['/hashtag', normalizedTag]);
  }

  useHashtagAsQuery(tag: string): void {
    const normalizedTag = this.normalizeTag(tag);
    if (!normalizedTag) {
      return;
    }

    this.mode = 'hashtags';
    this.query = normalizedTag;
    this.activeHashtagTag = null;
    this.triggerSearch();
  }

  getPostHashtags(postId: number): HashtagResponse[] {
    return this.postHashtagsMap[postId] || [];
  }

  private hydrateFromQueryParams(): void {
    const modeParam = this.route.snapshot.queryParamMap.get('mode');
    const queryParam = this.route.snapshot.queryParamMap.get('q');
    const hasExplicitMode = this.isValidMode(modeParam);

    if (hasExplicitMode) {
      this.mode = modeParam;
    }

    if (queryParam && queryParam.trim()) {
      this.query = queryParam.trim();
      this.hasSearched = true;

      if (!hasExplicitMode && this.shouldUseHashtagMode(this.query)) {
        this.mode = 'hashtags';
      }
    }
  }

  private isValidMode(mode: string | null): mode is SearchMode {
    return mode === 'users' || mode === 'posts' || mode === 'hashtags';
  }

  private normalizeTag(tag: string): string {
    const trimmedTag = (tag || '').trim();
    return trimmedTag.replace(/^#+/, '').replace(/#+$/, '');
  }

  private shouldUseHashtagMode(query: string): boolean {
    return (query || '').trim().startsWith('#');
  }

  private triggerSearch(): void {
    this.searchSubject.next({
      mode: this.mode,
      query: this.query
    });
  }

  private hydrateHashtagsForPosts(posts: Post[]): void {
    if (!posts || posts.length === 0) {
      this.postHashtagsMap = {};
      return;
    }

    for (const post of posts) {
      this.searchService.getHashtagsForPost(post.postId).pipe(
        catchError(() => of<HashtagResponse[]>([]))
      ).subscribe((hashtags) => {
        this.postHashtagsMap[post.postId] = hashtags;
      });
    }
  }

  private loadTrendingHashtags(): void {
    this.loadingTrending = true;
    this.searchService.getTrendingHashtags().pipe(
      catchError(() => of<HashtagResponse[]>([]))
    ).subscribe((hashtags) => {
      this.trendingHashtags = hashtags;
      this.loadingTrending = false;
    });
  }
}
